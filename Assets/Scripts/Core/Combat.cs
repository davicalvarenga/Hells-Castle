#nullable enable
using System;
using System.Collections.Generic;

namespace HellsCastle.Core
{
    /// <summary>Como a mão volta a encher, já que não existem turnos.</summary>
    public enum HandMode
    {
        /// <summary>Cartas jogadas não são repostas; Recompor (2 tiques) completa a mão.</summary>
        Recompose,

        /// <summary>A cada carta jogada, outra é comprada na hora.</summary>
        AutoDraw
    }

    public enum CombatStatus
    {
        InProgress,
        Victory,
        Defeat
    }

    /// <summary>Resultado de uma ação do jogador. Ações inválidas não gastam tempo.</summary>
    public readonly struct ActionResult
    {
        private ActionResult(bool success, string error)
        {
            Success = success;
            Error = error;
        }

        public bool Success { get; }
        public string Error { get; }

        public static ActionResult Ok() => new ActionResult(true, "");
        public static ActionResult Fail(string error) => new ActionResult(false, error);
    }

    public sealed class CombatConfig
    {
        public int Width { get; set; } = 5;
        public int Height { get; set; } = 7;
        public Pos PlayerStart { get; set; } = new Pos(2, 0);
        public int PlayerMaxHp { get; set; } = 20;
        public int HandSize { get; set; } = 4;
        public HandMode HandMode { get; set; } = HandMode.Recompose;
        public int Seed { get; set; } = 1;

        /// <summary>Se falso, as cartas são compradas na ordem da lista (útil em testes).</summary>
        public bool ShuffleDeck { get; set; } = true;

        public List<CardId> Deck { get; set; } = CardLibrary.StarterDeck();
        public List<Enemy> Enemies { get; set; } = new List<Enemy>();
    }

    /// <summary>
    /// Estado e regras de um combate em uma sala.
    ///
    /// Não há turnos: cada ação do jogador tem efeito imediato e depois faz o relógio avançar
    /// pelo seu custo em tiques. A cada tique, a contagem de todos os inimigos cai 1; quem
    /// chega a zero age e anuncia a próxima ação.
    /// </summary>
    public sealed class Combat
    {
        public const int MoveTicks = 1;
        public const int RecomposeTicks = 2;
        public const int GuardTicks = 2;
        public const int GuardBlock = 2;

        private readonly List<Enemy> _enemies;
        private readonly List<CardId> _drawPile;
        private readonly List<CardId> _hand = new List<CardId>();
        private readonly List<CardId> _discard = new List<CardId>();
        private readonly List<string> _log = new List<string>();
        private readonly List<CombatEvent> _events = new List<CombatEvent>();
        private readonly Rng _rng;

        public Combat(CombatConfig config)
        {
            if (config == null)
            {
                throw new ArgumentNullException(nameof(config));
            }

            if (config.Width <= 0 || config.Height <= 0)
            {
                throw new ArgumentException("A sala precisa ter largura e altura positivas.", nameof(config));
            }

            if (config.PlayerMaxHp <= 0 || config.HandSize <= 0)
            {
                throw new ArgumentException("Vida e tamanho da mão precisam ser positivos.", nameof(config));
            }

            if (config.Deck == null || config.Enemies == null)
            {
                throw new ArgumentException("Deck e lista de inimigos são obrigatórios.", nameof(config));
            }

            Width = config.Width;
            Height = config.Height;
            HandMode = config.HandMode;
            HandSize = config.HandSize;
            PlayerMaxHp = config.PlayerMaxHp;
            PlayerHp = config.PlayerMaxHp;
            PlayerPos = config.PlayerStart;

            if (!IsInside(PlayerPos))
            {
                throw new ArgumentException("O jogador começa fora da sala.", nameof(config));
            }

            _enemies = new List<Enemy>(config.Enemies);
            var occupied = new HashSet<Pos> { PlayerPos };
            foreach (Enemy enemy in _enemies)
            {
                if (enemy == null || !IsInside(enemy.Pos) || !occupied.Add(enemy.Pos))
                {
                    throw new ArgumentException("Inimigo nulo, fora da sala ou em casa já ocupada.", nameof(config));
                }
            }

            _rng = new Rng(config.Seed);
            _drawPile = new List<CardId>(config.Deck);
            if (config.ShuffleDeck)
            {
                _rng.Shuffle(_drawPile);
            }

            DrawUpTo(HandSize);

            foreach (Enemy enemy in _enemies)
            {
                enemy.Announce(this);
            }

            CheckVictory();
        }

        public int Width { get; }
        public int Height { get; }
        public HandMode HandMode { get; }
        public int HandSize { get; }

        public Pos PlayerPos { get; private set; }
        public int PlayerHp { get; private set; }
        public int PlayerMaxHp { get; }

        /// <summary>Bloqueio acumulado. É consumido inteiro pelo próximo ataque que acertar.</summary>
        public int Block { get; private set; }

        /// <summary>Cartas jogadas desde a última ação de um inimigo.</summary>
        public int Chain { get; private set; }

        /// <summary>"Por um fio": a próxima carta custa 1 tique a menos (mínimo 1).</summary>
        public bool OnTheEdge { get; private set; }

        /// <summary>Tiques decorridos desde o início do combate.</summary>
        public int Tick { get; private set; }

        public CombatStatus Status { get; private set; } = CombatStatus.InProgress;

        public IReadOnlyList<CardId> Hand => _hand;
        public int DrawPileCount => _drawPile.Count;
        public int DiscardCount => _discard.Count;
        public IReadOnlyList<Enemy> Enemies => _enemies;
        public IReadOnlyList<string> Log => _log;

        /// <summary>Tudo o que aconteceu, em ordem. A interface lê a partir do ponto em que parou.</summary>
        public IReadOnlyList<CombatEvent> Events => _events;

        // Estatísticas para avaliar o teste.
        public int CardsPlayed { get; private set; }
        public int EdgeCount { get; private set; }
        public int RecomposeCount { get; private set; }
        public int GuardCount { get; private set; }
        public int DamageTaken { get; private set; }
        public int BestChain { get; private set; }

        public bool IsInside(Pos pos) => pos.X >= 0 && pos.X < Width && pos.Y >= 0 && pos.Y < Height;

        public Enemy? EnemyAt(Pos pos)
        {
            foreach (Enemy enemy in _enemies)
            {
                if (enemy.IsAlive && enemy.Pos == pos)
                {
                    return enemy;
                }
            }

            return null;
        }

        /// <summary>Casa dentro da sala, sem jogador e sem inimigo vivo.</summary>
        public bool IsFree(Pos pos) => IsInside(pos) && pos != PlayerPos && EnemyAt(pos) == null;

        /// <summary>Menor contagem entre os ataques que marcam a casa; nulo se ninguém a marca.</summary>
        public int? TicksUntilHit(Pos pos)
        {
            int? best = null;
            foreach (Enemy enemy in _enemies)
            {
                if (enemy.HasMarkOn(pos) && (best == null || enemy.Counter < best.Value))
                {
                    best = enemy.Counter;
                }
            }

            return best;
        }

        /// <summary>Custo da carta agora, já com o desconto de "por um fio".</summary>
        public int EffectiveCost(CardId card)
        {
            int cost = CardLibrary.Get(card).Cost;
            return OnTheEdge ? Math.Max(1, cost - 1) : cost;
        }

        /// <summary>
        /// Casas atingidas pelas cartas de área fixa (Estocada e Varredura), a partir da posição
        /// atual do jogador. Vazio para as demais cartas. Serve também para a interface destacar a área.
        /// </summary>
        public IReadOnlyList<Pos> CardArea(CardId card)
        {
            var tiles = new List<Pos>();
            Pos front = PlayerPos.Step(Direction.Forward);
            switch (card)
            {
                case CardId.Estocada:
                    tiles.Add(front);
                    tiles.Add(front.Step(Direction.Forward));
                    break;

                case CardId.Varredura:
                    tiles.Add(front.Step(Direction.Left));
                    tiles.Add(front);
                    tiles.Add(front.Step(Direction.Right));
                    break;
            }

            tiles.RemoveAll(tile => !IsInside(tile));
            return tiles;
        }

        public void AddLog(string message) => _log.Add(message);

        /// <summary>Registra que um inimigo mudou de casa por conta própria (chamado pelos inimigos).</summary>
        public void ReportEnemyMoved(Enemy enemy, Pos from)
        {
            if (enemy == null)
            {
                throw new ArgumentNullException(nameof(enemy));
            }

            if (enemy.Pos != from)
            {
                _events.Add(new CombatEvent(CombatEventType.EnemyMoved)
                {
                    EnemyIndex = _enemies.IndexOf(enemy),
                    From = from,
                    To = enemy.Pos
                });
            }
        }

        /// <summary>Registra um ataque de inimigo que não chegou a ser aplicado (ex.: alvo fora de alcance).</summary>
        public void ReportEnemyMiss(Enemy enemy)
        {
            if (enemy == null)
            {
                throw new ArgumentNullException(nameof(enemy));
            }

            _events.Add(new CombatEvent(CombatEventType.EnemyAttacked)
            {
                EnemyIndex = _enemies.IndexOf(enemy),
                From = enemy.Pos,
                Tiles = new List<Pos>(enemy.Marks),
                Hit = false
            });
        }

        // ------------------------------------------------------------------
        // Ações do jogador
        // ------------------------------------------------------------------

        /// <summary>Anda 1 casa (1 tique). Nunca para trás.</summary>
        public ActionResult Move(Direction direction)
        {
            if (Status != CombatStatus.InProgress)
            {
                return ActionResult.Fail("O combate já terminou.");
            }

            if (direction == Direction.Back)
            {
                return ActionResult.Fail("Não é possível recuar.");
            }

            Pos target = PlayerPos.Step(direction);
            if (!IsFree(target))
            {
                return ActionResult.Fail("A casa de destino está ocupada ou fora da sala.");
            }

            MovePlayer(target);
            Elapse(MoveTicks);
            return ActionResult.Ok();
        }

        /// <summary>
        /// Joga a carta da posição <paramref name="handIndex"/> da mão (começando em 0).
        /// <paramref name="directions"/>: uma direção para cartas de casa vizinha; um caminho de
        /// 1 ou 2 passos para Passo Sombrio; vazio para as demais.
        /// </summary>
        public ActionResult PlayCard(int handIndex, params Direction[] directions)
        {
            if (Status != CombatStatus.InProgress)
            {
                return ActionResult.Fail("O combate já terminou.");
            }

            if (handIndex < 0 || handIndex >= _hand.Count)
            {
                return ActionResult.Fail("Não há carta nessa posição da mão.");
            }

            directions = directions ?? Array.Empty<Direction>();
            CardId cardId = _hand[handIndex];
            CardDefinition card = CardLibrary.Get(cardId);

            // Valida tudo antes de alterar o estado.
            Pos pathEnd = PlayerPos;
            switch (card.Targeting)
            {
                case CardTargeting.OneDirection:
                    if (directions.Length != 1)
                    {
                        return ActionResult.Fail(card.Name + " precisa de exatamente uma direção.");
                    }

                    if (!IsInside(PlayerPos.Step(directions[0])))
                    {
                        return ActionResult.Fail("Não há casa nessa direção.");
                    }

                    break;

                case CardTargeting.Path:
                    if (directions.Length < 1 || directions.Length > 2)
                    {
                        return ActionResult.Fail(card.Name + " precisa de um caminho de 1 ou 2 passos.");
                    }

                    foreach (Direction step in directions)
                    {
                        if (step == Direction.Back)
                        {
                            return ActionResult.Fail("Não é possível recuar.");
                        }

                        pathEnd = pathEnd.Step(step);
                        if (!IsFree(pathEnd))
                        {
                            return ActionResult.Fail("O caminho passa por uma casa ocupada ou fora da sala.");
                        }
                    }

                    break;
            }

            int cost = EffectiveCost(cardId);
            bool discounted = cost < card.Cost;
            OnTheEdge = false;
            int chainBefore = Chain;

            _hand.RemoveAt(handIndex);
            _discard.Add(cardId);
            AddLog("Você joga " + card.Name + " (" + cost + (cost == 1 ? " tique" : " tiques")
                   + (discounted ? ", por um fio" : "") + ").");

            var affected = new List<Pos>(CardArea(cardId));
            if (card.Targeting == CardTargeting.OneDirection)
            {
                affected.Add(PlayerPos.Step(directions[0]));
            }

            _events.Add(new CombatEvent(CombatEventType.CardPlayed)
            {
                Card = cardId,
                Amount = cost,
                From = PlayerPos,
                Tiles = affected
            });

            switch (cardId)
            {
                case CardId.Golpe:
                    DamageEnemyAt(PlayerPos.Step(directions[0]), CardLibrary.GolpeDamage);
                    break;

                case CardId.Aparar:
                    GainBlock(CardLibrary.ApararBlock);
                    break;

                case CardId.Estocada:
                    foreach (Pos tile in CardArea(cardId))
                    {
                        DamageEnemyAt(tile, CardLibrary.EstocadaDamage);
                    }

                    break;

                case CardId.Varredura:
                {
                    int damage = chainBefore >= CardLibrary.ChainBonusThreshold
                        ? CardLibrary.VarreduraChainDamage
                        : CardLibrary.VarreduraDamage;
                    foreach (Pos tile in CardArea(cardId))
                    {
                        DamageEnemyAt(tile, damage);
                    }

                    break;
                }

                case CardId.GolpePesado:
                {
                    Direction direction = directions[0];
                    Pos target = PlayerPos.Step(direction);
                    Enemy? enemy = EnemyAt(target);
                    DamageEnemyAt(target, CardLibrary.GolpePesadoDamage);
                    if (enemy != null && enemy.IsAlive && chainBefore >= CardLibrary.ChainBonusThreshold)
                    {
                        Push(enemy, direction);
                    }

                    break;
                }

                case CardId.PassoSombrio:
                    MovePlayer(pathEnd);
                    break;

                default:
                    throw new InvalidOperationException("Carta sem efeito implementado: " + cardId);
            }

            Chain++;
            CardsPlayed++;
            if (Chain > BestChain)
            {
                BestChain = Chain;
            }

            if (HandMode == HandMode.AutoDraw)
            {
                DrawUpTo(HandSize);
            }

            CheckVictory();
            Elapse(cost);
            return ActionResult.Ok();
        }

        /// <summary>Completa a mão (2 tiques). Só existe no modo Recompor.</summary>
        public ActionResult Recompose()
        {
            if (Status != CombatStatus.InProgress)
            {
                return ActionResult.Fail("O combate já terminou.");
            }

            if (HandMode != HandMode.Recompose)
            {
                return ActionResult.Fail("Neste modo a mão é reposta automaticamente.");
            }

            if (_hand.Count >= HandSize)
            {
                return ActionResult.Fail("A mão já está cheia.");
            }

            int before = _hand.Count;
            DrawUpTo(HandSize);
            RecomposeCount++;
            _events.Add(new CombatEvent(CombatEventType.Recomposed) { Amount = _hand.Count - before });
            AddLog("Você se recompõe e compra " + (_hand.Count - before) + " carta(s) ("
                   + RecomposeTicks + " tiques).");
            Elapse(RecomposeTicks);
            return ActionResult.Ok();
        }

        /// <summary>Ação básica sempre disponível, fora do deck: 2 tiques, bloqueia 2.</summary>
        public ActionResult Guard()
        {
            if (Status != CombatStatus.InProgress)
            {
                return ActionResult.Fail("O combate já terminou.");
            }

            GuardCount++;
            _events.Add(new CombatEvent(CombatEventType.Guarded));
            AddLog("Você se guarda (" + GuardTicks + " tiques).");
            GainBlock(GuardBlock);
            Elapse(GuardTicks);
            return ActionResult.Ok();
        }

        // ------------------------------------------------------------------
        // Usado pelos inimigos
        // ------------------------------------------------------------------

        /// <summary>Aplica o ataque anunciado do inimigo: acerta se o jogador estiver em casa marcada.</summary>
        public void ResolveEnemyAttack(Enemy enemy)
        {
            if (enemy == null)
            {
                throw new ArgumentNullException(nameof(enemy));
            }

            if (!enemy.HasMarkOn(PlayerPos))
            {
                ReportEnemyMiss(enemy);
                AddLog(enemy.Name + " erra: você não está mais na área.");
                return;
            }

            int absorbed = Math.Min(Block, enemy.IntentDamage);
            int damage = enemy.IntentDamage - absorbed;
            Block = 0;
            PlayerHp = Math.Max(0, PlayerHp - damage);
            DamageTaken += damage;
            _events.Add(new CombatEvent(CombatEventType.EnemyAttacked)
            {
                EnemyIndex = _enemies.IndexOf(enemy),
                From = enemy.Pos,
                Tiles = new List<Pos>(enemy.Marks),
                Hit = true,
                Amount = damage,
                Absorbed = absorbed
            });
            AddLog(enemy.Name + " acerta: " + damage + " de dano"
                   + (absorbed > 0 ? " (" + absorbed + " bloqueado)" : "") + ".");

            if (PlayerHp == 0)
            {
                Status = CombatStatus.Defeat;
                _events.Add(new CombatEvent(CombatEventType.Defeat));
                AddLog("Você morreu.");
            }
        }

        // ------------------------------------------------------------------
        // Internos
        // ------------------------------------------------------------------

        private void Elapse(int ticks)
        {
            for (int i = 0; i < ticks && Status == CombatStatus.InProgress; i++)
            {
                Tick++;
                foreach (Enemy enemy in _enemies)
                {
                    if (!enemy.IsAlive)
                    {
                        continue;
                    }

                    enemy.TickDown();
                    if (enemy.Counter > 0)
                    {
                        continue;
                    }

                    enemy.Act(this);
                    Chain = 0;
                    if (Status != CombatStatus.InProgress)
                    {
                        return;
                    }

                    enemy.Announce(this);
                }
            }
        }

        private void MovePlayer(Pos target)
        {
            Pos from = PlayerPos;
            bool edge = false;
            foreach (Enemy enemy in _enemies)
            {
                if (enemy.Counter == 1 && enemy.HasMarkOn(from) && !enemy.HasMarkOn(target))
                {
                    edge = true;
                }
            }

            PlayerPos = target;
            _events.Add(new CombatEvent(CombatEventType.PlayerMoved) { From = from, To = target });
            if (edge)
            {
                GrantEdge("Você escapa por um fio.");
            }
        }

        private void GainBlock(int amount)
        {
            bool edge = false;
            foreach (Enemy enemy in _enemies)
            {
                if (enemy.Counter == 1 && enemy.HasMarkOn(PlayerPos))
                {
                    edge = true;
                }
            }

            Block += amount;
            _events.Add(new CombatEvent(CombatEventType.BlockGained) { Amount = amount });
            if (edge)
            {
                GrantEdge("Você bloqueia por um fio.");
            }
        }

        private void GrantEdge(string message)
        {
            OnTheEdge = true;
            EdgeCount++;
            _events.Add(new CombatEvent(CombatEventType.EdgeGranted));
            AddLog(message + " A próxima carta custa 1 tique a menos.");
        }

        private void DamageEnemyAt(Pos pos, int amount)
        {
            Enemy? enemy = EnemyAt(pos);
            if (enemy == null)
            {
                return;
            }

            enemy.TakeDamage(amount);
            int index = _enemies.IndexOf(enemy);
            _events.Add(new CombatEvent(CombatEventType.EnemyDamaged) { EnemyIndex = index, Amount = amount, To = pos });
            if (!enemy.IsAlive)
            {
                _events.Add(new CombatEvent(CombatEventType.EnemyDied) { EnemyIndex = index, To = pos });
            }

            AddLog(enemy.Name + " sofre " + amount + " de dano"
                   + (enemy.IsAlive ? " (vida " + enemy.Hp + "/" + enemy.MaxHp + ")." : " e morre."));
        }

        private void Push(Enemy enemy, Direction direction)
        {
            if (enemy.Immovable)
            {
                AddLog(enemy.Name + " não pode ser empurrado.");
                return;
            }

            Pos destination = enemy.Pos.Step(direction);
            if (!IsFree(destination))
            {
                AddLog("Não há espaço para empurrar " + enemy.Name + ".");
                return;
            }

            Pos origin = enemy.Pos;
            enemy.MoveTo(destination);
            _events.Add(new CombatEvent(CombatEventType.EnemyMoved)
            {
                EnemyIndex = _enemies.IndexOf(enemy),
                From = origin,
                To = destination,
                Pushed = true
            });
            AddLog(enemy.Name + " é empurrado para " + destination + ".");
        }

        private void DrawUpTo(int handSize)
        {
            while (_hand.Count < handSize)
            {
                if (_drawPile.Count == 0)
                {
                    if (_discard.Count == 0)
                    {
                        return;
                    }

                    _drawPile.AddRange(_discard);
                    _discard.Clear();
                    _rng.Shuffle(_drawPile);
                }

                _hand.Add(_drawPile[0]);
                _drawPile.RemoveAt(0);
            }
        }

        private void CheckVictory()
        {
            if (Status != CombatStatus.InProgress)
            {
                return;
            }

            foreach (Enemy enemy in _enemies)
            {
                if (enemy.IsAlive)
                {
                    return;
                }
            }

            Status = CombatStatus.Victory;
            _events.Add(new CombatEvent(CombatEventType.Victory));
            AddLog("Todos os inimigos caíram. A porta se abre.");
        }
    }
}
