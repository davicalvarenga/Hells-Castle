#nullable enable
using System;
using System.Collections.Generic;

namespace HellsCastle.Core
{
    /// <summary>
    /// Inimigo com ciclo fixo de ações. Cada ação é anunciada antes (com contagem em tiques e
    /// casas marcadas) e executada quando a contagem chega a zero.
    /// </summary>
    public abstract class Enemy
    {
        private readonly HashSet<Pos> _marks = new HashSet<Pos>();

        protected Enemy(string name, char symbol, int maxHp, Pos pos)
        {
            if (maxHp <= 0)
            {
                throw new ArgumentOutOfRangeException(nameof(maxHp));
            }

            Name = name;
            Symbol = symbol;
            MaxHp = maxHp;
            Hp = maxHp;
            Pos = pos;
        }

        public string Name { get; }
        public char Symbol { get; }
        public int MaxHp { get; }
        public int Hp { get; private set; }
        public Pos Pos { get; private set; }
        public bool IsAlive => Hp > 0;

        /// <summary>Inimigos imóveis não podem ser empurrados.</summary>
        public virtual bool Immovable => false;

        /// <summary>Tiques que faltam para a ação anunciada.</summary>
        public int Counter { get; private set; }

        /// <summary>Descrição da ação anunciada, para a interface.</summary>
        public string IntentText { get; private set; } = "";

        /// <summary>Dano da ação anunciada (0 se não for ataque).</summary>
        public int IntentDamage { get; private set; }

        /// <summary>Casas que a ação anunciada vai atingir. As marcas não acompanham o jogador.</summary>
        public IReadOnlyCollection<Pos> Marks => _marks;

        public bool HasMarkOn(Pos pos) => IsAlive && _marks.Contains(pos);

        /// <summary>Escolhe e anuncia a próxima ação (deve chamar <see cref="SetIntent"/>).</summary>
        protected internal abstract void Announce(Combat combat);

        /// <summary>Executa a ação anunciada.</summary>
        protected internal abstract void Act(Combat combat);

        protected void SetIntent(string text, int counter, int damage, IEnumerable<Pos>? marks)
        {
            if (counter <= 0)
            {
                throw new ArgumentOutOfRangeException(nameof(counter), "A contagem precisa ser de pelo menos 1 tique.");
            }

            IntentText = text;
            Counter = counter;
            IntentDamage = damage;
            _marks.Clear();
            if (marks != null)
            {
                foreach (Pos mark in marks)
                {
                    _marks.Add(mark);
                }
            }
        }

        internal void TickDown() => Counter--;

        internal void TakeDamage(int amount)
        {
            Hp = Math.Max(0, Hp - amount);
            if (Hp == 0)
            {
                _marks.Clear();
                IntentText = "";
                IntentDamage = 0;
            }
        }

        internal void MoveTo(Pos pos) => Pos = pos;

        /// <summary>
        /// Anda até <paramref name="maxSteps"/> casas na direção do jogador, parando ao ficar vizinho.
        /// Movimento guloso: cada passo vai para a casa livre que mais reduz a distância.
        /// </summary>
        protected int AdvanceToward(Combat combat, int maxSteps)
        {
            int moved = 0;
            Pos start = Pos;
            for (int i = 0; i < maxSteps; i++)
            {
                if (Pos.IsAdjacentTo(combat.PlayerPos))
                {
                    break;
                }

                int bestDistance = Pos.DistanceTo(combat.PlayerPos);
                Pos? best = null;
                foreach (Direction direction in StepOrder)
                {
                    Pos candidate = Pos.Step(direction);
                    if (!combat.IsFree(candidate))
                    {
                        continue;
                    }

                    int distance = candidate.DistanceTo(combat.PlayerPos);
                    if (distance < bestDistance)
                    {
                        bestDistance = distance;
                        best = candidate;
                    }
                }

                if (best == null)
                {
                    break;
                }

                Pos = best.Value;
                moved++;
            }

            combat.ReportEnemyMoved(this, start);
            return moved;
        }

        /// <summary>Ordem fixa de desempate, para o movimento ser determinístico.</summary>
        protected static readonly Direction[] StepOrder =
        {
            Direction.Forward, Direction.Back, Direction.Left, Direction.Right
        };

        protected void StepTo(Combat combat, Pos pos)
        {
            if (!combat.IsFree(pos))
            {
                throw new InvalidOperationException("A casa de destino não está livre: " + pos);
            }

            Pos from = Pos;
            Pos = pos;
            combat.ReportEnemyMoved(this, from);
        }
    }

    /// <summary>
    /// Carniçal: alterna Avançar (até 2 casas) e Mordida na casa onde o jogador está no anúncio.
    /// Só anuncia a mordida se estiver vizinho; senão, avança de novo.
    /// </summary>
    public sealed class Ghoul : Enemy
    {
        public const int ActionTicks = 2;
        public const int BiteDamage = 3;
        public const int AdvanceSteps = 2;

        private bool _wantsToBite;
        private bool _biting;

        public Ghoul(Pos pos) : base("Carniçal", 'C', 6, pos)
        {
        }

        protected internal override void Announce(Combat combat)
        {
            if (_wantsToBite && Pos.IsAdjacentTo(combat.PlayerPos))
            {
                _biting = true;
                SetIntent("Mordida (" + BiteDamage + " de dano)", ActionTicks, BiteDamage, new[] { combat.PlayerPos });
            }
            else
            {
                _biting = false;
                SetIntent("Avançar", ActionTicks, 0, null);
            }
        }

        protected internal override void Act(Combat combat)
        {
            if (_biting)
            {
                _wantsToBite = false;
                bool inReach = false;
                foreach (Pos mark in Marks)
                {
                    if (mark.IsAdjacentTo(Pos))
                    {
                        inReach = true;
                    }
                }

                if (inReach)
                {
                    combat.ResolveEnemyAttack(this);
                }
                else
                {
                    combat.ReportEnemyMiss(this);
                    combat.AddLog(Name + " morde o vazio: foi afastado do alvo.");
                }
            }
            else
            {
                _wantsToBite = true;
                int moved = AdvanceToward(combat, AdvanceSteps);
                if (moved > 0)
                {
                    combat.AddLog(Name + " avança para " + Pos + ".");
                }
            }
        }
    }

    /// <summary>
    /// Arqueiro de Ossos: marca a coluna inteira e, no disparo seguinte, a fileira inteira onde o
    /// jogador está (alternando). Depois de atirar, reposiciona 1 casa para longe do jogador,
    /// sem nunca ficar atrás dele; se ficou para trás, sobe até 2 casas.
    /// </summary>
    public sealed class BoneArcher : Enemy
    {
        public const int AimTicks = 4;
        public const int ArrowDamage = 5;

        private bool _nextIsRow;

        public BoneArcher(Pos pos) : base("Arqueiro de Ossos", 'A', 5, pos)
        {
        }

        protected internal override void Announce(Combat combat)
        {
            Pos player = combat.PlayerPos;
            var marks = new List<Pos>();
            string text;
            if (_nextIsRow)
            {
                for (int x = 0; x < combat.Width; x++)
                {
                    marks.Add(new Pos(x, player.Y));
                }

                text = "Flecha na fileira " + player.Y;
            }
            else
            {
                for (int y = 0; y < combat.Height; y++)
                {
                    marks.Add(new Pos(player.X, y));
                }

                text = "Flecha na coluna " + player.X;
            }

            SetIntent(text + " (" + ArrowDamage + " de dano)", AimTicks, ArrowDamage, marks);
        }

        protected internal override void Act(Combat combat)
        {
            combat.ResolveEnemyAttack(this);
            _nextIsRow = !_nextIsRow;
            Reposition(combat);
        }

        private void Reposition(Combat combat)
        {
            Pos player = combat.PlayerPos;

            // Ficou atrás do jogador (que não pode voltar): sobe para continuar alcançável.
            if (Pos.Y < player.Y)
            {
                for (int i = 0; i < 2 && Pos.Y < player.Y; i++)
                {
                    Pos? next = null;
                    foreach (Direction direction in new[] { Direction.Forward, Direction.Left, Direction.Right })
                    {
                        Pos candidate = Pos.Step(direction);
                        if (combat.IsFree(candidate))
                        {
                            next = candidate;
                            break;
                        }
                    }

                    if (next == null)
                    {
                        break;
                    }

                    StepTo(combat, next.Value);
                }

                return;
            }

            int bestDistance = Pos.DistanceTo(player);
            Pos? best = null;
            foreach (Direction direction in StepOrder)
            {
                Pos candidate = Pos.Step(direction);
                if (!combat.IsFree(candidate) || candidate.Y < player.Y)
                {
                    continue;
                }

                int distance = candidate.DistanceTo(player);
                if (distance > bestDistance)
                {
                    bestDistance = distance;
                    best = candidate;
                }
            }

            if (best != null)
            {
                StepTo(combat, best.Value);
            }
        }
    }

    /// <summary>
    /// Sineiro: imóvel. A Badalada atinge a sala inteira, menos as casas vizinhas a ele.
    /// </summary>
    public sealed class BellRinger : Enemy
    {
        public const int TollTicks = 6;
        public const int TollDamage = 4;

        public BellRinger(Pos pos) : base("Sineiro", 'S', 10, pos)
        {
        }

        public override bool Immovable => true;

        protected internal override void Announce(Combat combat)
        {
            var marks = new List<Pos>();
            for (int x = 0; x < combat.Width; x++)
            {
                for (int y = 0; y < combat.Height; y++)
                {
                    var tile = new Pos(x, y);
                    if (tile != Pos && !tile.IsAdjacentTo(Pos))
                    {
                        marks.Add(tile);
                    }
                }
            }

            SetIntent("Badalada (" + TollDamage + " de dano, menos nas casas vizinhas a ele)", TollTicks, TollDamage, marks);
        }

        protected internal override void Act(Combat combat)
        {
            combat.ResolveEnemyAttack(this);
        }
    }
}
