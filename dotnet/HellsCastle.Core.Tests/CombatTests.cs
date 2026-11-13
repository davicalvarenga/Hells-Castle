using HellsCastle.Core;

namespace HellsCastle.Core.Tests;

/// <summary>Inimigo que só espera. Serve de alvo.</summary>
internal sealed class Dummy : Enemy
{
    private readonly int _wait;

    public Dummy(Pos pos, int hp = 10, int wait = 99) : base("Boneco", 'B', hp, pos)
    {
        _wait = wait;
    }

    protected override void Announce(Combat combat) => SetIntent("Esperar", _wait, 0, null);

    protected override void Act(Combat combat)
    {
    }
}

/// <summary>Inimigo que repete o mesmo ataque nas mesmas casas.</summary>
internal sealed class Striker : Enemy
{
    private readonly int _ticks;
    private readonly int _damage;
    private readonly Pos[] _tiles;

    public Striker(Pos pos, int ticks, int damage, params Pos[] tiles) : base("Algoz", 'X', 10, pos)
    {
        _ticks = ticks;
        _damage = damage;
        _tiles = tiles;
    }

    protected override void Announce(Combat combat) => SetIntent("Ataque", _ticks, _damage, _tiles);

    protected override void Act(Combat combat) => combat.ResolveEnemyAttack(this);
}

public class CombatTests
{
    private static readonly Pos Start = new Pos(2, 0);

    private static Combat Make(HandMode mode, List<CardId>? deck, params Enemy[] enemies)
    {
        return new Combat(new CombatConfig
        {
            PlayerStart = Start,
            HandMode = mode,
            ShuffleDeck = false,
            Deck = deck ?? CardLibrary.StarterDeck(),
            Enemies = enemies.ToList()
        });
    }

    private static Combat Make(params Enemy[] enemies) => Make(HandMode.Recompose, null, enemies);

    // ---------------------------------------------------------------- movimento

    [Fact]
    public void Recuar_e_rejeitado_e_nao_gasta_tempo()
    {
        var combat = new Combat(new CombatConfig
        {
            PlayerStart = new Pos(2, 3),
            Enemies = { new Dummy(new Pos(0, 6)) }
        });

        ActionResult result = combat.Move(Direction.Back);

        Assert.False(result.Success);
        Assert.Equal(new Pos(2, 3), combat.PlayerPos);
        Assert.Equal(0, combat.Tick);
    }

    [Fact]
    public void Andar_custa_um_tique_e_reduz_a_contagem_dos_inimigos()
    {
        var dummy = new Dummy(new Pos(0, 6), wait: 5);
        Combat combat = Make(dummy);

        Assert.True(combat.Move(Direction.Forward).Success);

        Assert.Equal(new Pos(2, 1), combat.PlayerPos);
        Assert.Equal(1, combat.Tick);
        Assert.Equal(4, dummy.Counter);
    }

    [Fact]
    public void Andar_para_casa_ocupada_ou_fora_da_sala_e_rejeitado()
    {
        var combat = new Combat(new CombatConfig
        {
            PlayerStart = new Pos(0, 0),
            Enemies = { new Dummy(new Pos(0, 1)) }
        });

        Assert.False(combat.Move(Direction.Forward).Success);
        Assert.False(combat.Move(Direction.Left).Success);
        Assert.Equal(0, combat.Tick);
    }

    // ---------------------------------------------------------------- marcas e "por um fio"

    [Fact]
    public void Marca_nao_acompanha_o_jogador()
    {
        Combat combat = Make(new Striker(new Pos(4, 6), ticks: 2, damage: 3, Start));

        combat.Move(Direction.Left);
        combat.Move(Direction.Left);

        Assert.Equal(20, combat.PlayerHp);
        Assert.False(combat.OnTheEdge);
    }

    [Fact]
    public void Ficar_na_casa_marcada_leva_o_dano()
    {
        Combat combat = Make(new Striker(new Pos(4, 6), ticks: 2, damage: 3, Start, new Pos(1, 0)));

        combat.Move(Direction.Left);
        combat.Move(Direction.Right);

        Assert.Equal(17, combat.PlayerHp);
        Assert.Equal(3, combat.DamageTaken);
    }

    [Fact]
    public void Sair_da_casa_marcada_no_ultimo_tique_da_desconto_na_proxima_carta()
    {
        Combat combat = Make(new Striker(new Pos(4, 6), ticks: 2, damage: 3, Start, new Pos(3, 0)));

        combat.Move(Direction.Right);   // contagem 2 -> 1, ainda em casa marcada
        combat.Move(Direction.Forward); // sai com a contagem em 1

        Assert.True(combat.OnTheEdge);
        Assert.Equal(1, combat.EdgeCount);
        Assert.Equal(20, combat.PlayerHp);
        Assert.Equal(2, combat.EffectiveCost(CardId.GolpePesado));
        Assert.Equal(1, combat.EffectiveCost(CardId.Golpe)); // mínimo 1
    }

    [Fact]
    public void Desconto_de_por_um_fio_vale_so_para_a_proxima_carta()
    {
        var deck = new List<CardId> { CardId.Estocada, CardId.Estocada, CardId.Golpe, CardId.Golpe };
        Combat combat = Make(HandMode.Recompose, deck,
            new Striker(new Pos(4, 6), ticks: 2, damage: 3, Start, new Pos(3, 0)));
        combat.Move(Direction.Right);
        combat.Move(Direction.Forward);
        int tickBefore = combat.Tick;

        combat.PlayCard(0); // Estocada: 2 -> 1 tique
        Assert.Equal(tickBefore + 1, combat.Tick);
        Assert.False(combat.OnTheEdge);

        combat.PlayCard(0); // Estocada: custo cheio
        Assert.Equal(tickBefore + 3, combat.Tick);
    }

    // ---------------------------------------------------------------- bloqueio

    [Fact]
    public void Aparar_absorve_o_proximo_ataque_e_e_consumido()
    {
        var deck = new List<CardId> { CardId.Aparar, CardId.Golpe, CardId.Golpe, CardId.Golpe };
        Combat combat = Make(HandMode.Recompose, deck, new Striker(new Pos(4, 6), ticks: 1, damage: 5, Start));

        combat.PlayCard(0);

        Assert.Equal(19, combat.PlayerHp); // 5 de dano - 4 bloqueados
        Assert.Equal(0, combat.Block);
        Assert.True(combat.OnTheEdge);     // bloqueou com a contagem em 1
    }

    [Fact]
    public void Bloqueio_e_consumido_inteiro_mesmo_por_ataque_fraco()
    {
        var deck = new List<CardId> { CardId.Aparar, CardId.Golpe, CardId.Golpe, CardId.Golpe };
        Combat combat = Make(HandMode.Recompose, deck, new Striker(new Pos(4, 6), ticks: 1, damage: 1, Start));

        combat.PlayCard(0);

        Assert.Equal(20, combat.PlayerHp);
        Assert.Equal(0, combat.Block);
    }

    [Fact]
    public void Guardar_bloqueia_2_custa_2_tiques_e_funciona_com_a_mao_vazia()
    {
        Combat combat = Make(HandMode.Recompose, new List<CardId>(),
            new Striker(new Pos(4, 6), ticks: 2, damage: 3, Start));

        Assert.Empty(combat.Hand);
        Assert.True(combat.Guard().Success);

        Assert.Equal(2, combat.Tick);
        Assert.Equal(19, combat.PlayerHp); // 3 de dano - 2 bloqueados
        Assert.Equal(1, combat.GuardCount);
    }

    // ---------------------------------------------------------------- cadeia

    [Fact]
    public void Cadeia_conta_cartas_ignora_passos_e_zera_quando_inimigo_age()
    {
        var deck = new List<CardId> { CardId.Golpe, CardId.Golpe, CardId.Golpe, CardId.Golpe };
        Combat combat = Make(HandMode.Recompose, deck, new Dummy(new Pos(0, 6), wait: 3));

        combat.PlayCard(0, Direction.Forward);
        Assert.Equal(1, combat.Chain);

        combat.Move(Direction.Left);
        Assert.Equal(1, combat.Chain);

        combat.PlayCard(0, Direction.Forward); // no 3º tique o inimigo age
        Assert.Equal(0, combat.Chain);
        Assert.Equal(2, combat.BestChain);
    }

    [Fact]
    public void Varredura_causa_2_sem_cadeia_e_4_com_cadeia_2()
    {
        var semCadeia = new Dummy(new Pos(2, 1));
        Combat a = Make(HandMode.Recompose, new List<CardId> { CardId.Varredura }, semCadeia);
        a.PlayCard(0);
        Assert.Equal(8, semCadeia.Hp);

        var comCadeia = new Dummy(new Pos(3, 1));
        var deck = new List<CardId> { CardId.Golpe, CardId.Golpe, CardId.Varredura };
        Combat b = Make(HandMode.Recompose, deck, comCadeia);
        b.PlayCard(0, Direction.Left);
        b.PlayCard(0, Direction.Left);
        b.PlayCard(0);
        Assert.Equal(6, comCadeia.Hp); // só a Varredura acertou, com 4 (arco pega a diagonal)
    }

    [Fact]
    public void Golpe_pesado_com_cadeia_2_empurra_o_inimigo()
    {
        var dummy = new Dummy(new Pos(2, 1), hp: 20);
        var deck = new List<CardId> { CardId.Golpe, CardId.Golpe, CardId.GolpePesado };
        Combat combat = Make(HandMode.Recompose, deck, dummy);

        combat.PlayCard(0, Direction.Forward);
        combat.PlayCard(0, Direction.Forward);
        combat.PlayCard(0, Direction.Forward);

        Assert.Equal(6, dummy.Hp);
        Assert.Equal(new Pos(2, 2), dummy.Pos);
    }

    [Fact]
    public void Golpe_pesado_sem_cadeia_nao_empurra()
    {
        var dummy = new Dummy(new Pos(2, 1), hp: 20);
        Combat combat = Make(HandMode.Recompose, new List<CardId> { CardId.GolpePesado }, dummy);

        combat.PlayCard(0, Direction.Forward);

        Assert.Equal(12, dummy.Hp);
        Assert.Equal(new Pos(2, 1), dummy.Pos);
        Assert.Equal(3, combat.Tick);
    }

    // ---------------------------------------------------------------- cartas

    [Fact]
    public void Estocada_acerta_as_duas_casas_a_frente()
    {
        var perto = new Dummy(new Pos(2, 1));
        var longe = new Dummy(new Pos(2, 2));
        Combat combat = Make(HandMode.Recompose, new List<CardId> { CardId.Estocada }, perto, longe);

        combat.PlayCard(0);

        Assert.Equal(6, perto.Hp);
        Assert.Equal(6, longe.Hp);
    }

    [Fact]
    public void Golpe_acerta_inimigo_que_ficou_atras()
    {
        var atras = new Dummy(new Pos(2, 2));
        var combat = new Combat(new CombatConfig
        {
            PlayerStart = new Pos(2, 3),
            ShuffleDeck = false,
            Deck = new List<CardId> { CardId.Golpe },
            Enemies = { atras }
        });

        Assert.True(combat.PlayCard(0, Direction.Back).Success);
        Assert.Equal(7, atras.Hp);
    }

    [Fact]
    public void Passo_sombrio_move_2_casas_por_1_tique_e_nunca_para_tras()
    {
        var deck = new List<CardId> { CardId.PassoSombrio, CardId.PassoSombrio };
        Combat combat = Make(HandMode.Recompose, deck, new Dummy(new Pos(0, 6)));

        Assert.False(combat.PlayCard(0, Direction.Forward, Direction.Back).Success);
        Assert.Equal(2, combat.Hand.Count); // jogada inválida não gasta a carta
        Assert.Equal(0, combat.Tick);

        Assert.True(combat.PlayCard(0, Direction.Forward, Direction.Right).Success);
        Assert.Equal(new Pos(3, 1), combat.PlayerPos);
        Assert.Equal(1, combat.Tick);
    }

    [Fact]
    public void Passo_sombrio_nao_atravessa_inimigo()
    {
        var deck = new List<CardId> { CardId.PassoSombrio };
        Combat combat = Make(HandMode.Recompose, deck, new Dummy(new Pos(2, 1)));

        Assert.False(combat.PlayCard(0, Direction.Forward, Direction.Forward).Success);
        Assert.Equal(Start, combat.PlayerPos);
    }

    [Fact]
    public void Carta_de_direcao_sem_direcao_e_rejeitada_sem_gastar_nada()
    {
        Combat combat = Make(HandMode.Recompose, new List<CardId> { CardId.Golpe }, new Dummy(new Pos(0, 6)));

        Assert.False(combat.PlayCard(0).Success);
        Assert.False(combat.PlayCard(0, Direction.Back).Success); // fora da sala
        Assert.False(combat.PlayCard(5, Direction.Forward).Success);
        Assert.Single(combat.Hand);
        Assert.Equal(0, combat.Tick);
    }

    // ---------------------------------------------------------------- mão

    [Fact]
    public void Recompor_completa_a_mao_por_2_tiques()
    {
        Combat combat = Make(new Dummy(new Pos(0, 6)));
        combat.PlayCard(0, Direction.Forward);
        Assert.Equal(3, combat.Hand.Count);

        Assert.True(combat.Recompose().Success);

        Assert.Equal(4, combat.Hand.Count);
        Assert.Equal(3, combat.Tick); // 1 do Golpe + 2 do Recompor
        Assert.Equal(1, combat.RecomposeCount);
    }

    [Fact]
    public void Recompor_com_a_mao_cheia_e_rejeitado()
    {
        Combat combat = Make(new Dummy(new Pos(0, 6)));

        Assert.False(combat.Recompose().Success);
        Assert.Equal(0, combat.Tick);
    }

    [Fact]
    public void Compra_automatica_mantem_a_mao_cheia_e_nao_tem_recompor()
    {
        Combat combat = Make(HandMode.AutoDraw, null, new Dummy(new Pos(0, 6)));

        combat.PlayCard(0, Direction.Forward);

        Assert.Equal(4, combat.Hand.Count);
        Assert.False(combat.Recompose().Success);
    }

    [Fact]
    public void Descarte_volta_para_o_monte_quando_ele_acaba()
    {
        var deck = new List<CardId> { CardId.Aparar, CardId.Aparar, CardId.Aparar, CardId.Aparar, CardId.Aparar };
        Combat combat = Make(HandMode.AutoDraw, deck, new Dummy(new Pos(0, 6)));

        for (int i = 0; i < 12; i++)
        {
            Assert.True(combat.PlayCard(0).Success);
            Assert.Equal(4, combat.Hand.Count);
        }

        Assert.Equal(5, combat.Hand.Count + combat.DrawPileCount + combat.DiscardCount);
    }

    // ---------------------------------------------------------------- fim do combate

    [Fact]
    public void Vitoria_quando_todos_os_inimigos_morrem()
    {
        Combat combat = Make(HandMode.Recompose, new List<CardId> { CardId.Golpe, CardId.Golpe },
            new Dummy(new Pos(2, 1), hp: 3));

        combat.PlayCard(0, Direction.Forward);

        Assert.Equal(CombatStatus.Victory, combat.Status);
        Assert.False(combat.Move(Direction.Forward).Success);
        Assert.False(combat.PlayCard(0, Direction.Forward).Success);
    }

    [Fact]
    public void Derrota_quando_a_vida_chega_a_zero()
    {
        var combat = new Combat(new CombatConfig
        {
            PlayerStart = Start,
            PlayerMaxHp = 3,
            Enemies = { new Striker(new Pos(4, 6), ticks: 1, damage: 5, Start, new Pos(1, 0)) }
        });

        combat.Move(Direction.Left);

        Assert.Equal(CombatStatus.Defeat, combat.Status);
        Assert.Equal(0, combat.PlayerHp);
        Assert.False(combat.Guard().Success);
    }

    // ---------------------------------------------------------------- inimigos do teste

    [Fact]
    public void Carnical_avanca_ate_ficar_vizinho_e_morde_quem_fica_parado()
    {
        var ghoul = new Ghoul(new Pos(2, 3));
        Combat combat = Make(HandMode.Recompose, new List<CardId>(), ghoul);

        combat.Guard(); // 2 tiques: o Carniçal avança 2 casas e anuncia a mordida
        Assert.Equal(new Pos(2, 1), ghoul.Pos);
        Assert.Contains(Start, ghoul.Marks);

        combat.Move(Direction.Left);
        combat.Move(Direction.Right); // de volta à casa marcada na hora da mordida

        Assert.Equal(20 - Ghoul.BiteDamage + Combat.GuardBlock, combat.PlayerHp);
    }

    [Fact]
    public void Carnical_erra_a_mordida_se_o_jogador_sai_da_casa()
    {
        var ghoul = new Ghoul(new Pos(2, 2));
        Combat combat = Make(HandMode.Recompose, new List<CardId>(), ghoul);

        combat.Move(Direction.Left);
        combat.Move(Direction.Right); // tique 2: avança para (2,1) e marca (2,0)
        Assert.Contains(Start, ghoul.Marks);

        combat.Move(Direction.Right);
        combat.Move(Direction.Right); // tique 4: morde (2,0), vazia

        Assert.Equal(20, combat.PlayerHp);
    }

    [Fact]
    public void Arqueiro_alterna_coluna_e_fileira()
    {
        var archer = new BoneArcher(new Pos(4, 6));
        Combat combat = Make(HandMode.Recompose, new List<CardId>(), archer);
        Assert.Contains(new Pos(2, 6), archer.Marks); // coluna do jogador
        Assert.DoesNotContain(new Pos(0, 0), archer.Marks);

        combat.Move(Direction.Left);
        combat.Move(Direction.Left);
        combat.Move(Direction.Right);
        combat.Move(Direction.Left); // tique 4: flecha na coluna 2, jogador em (0,0)

        Assert.Equal(20, combat.PlayerHp);
        Assert.Contains(new Pos(4, 0), archer.Marks); // agora a fileira 0 inteira
        Assert.DoesNotContain(new Pos(0, 1), archer.Marks);

        combat.Move(Direction.Right);
        combat.Move(Direction.Right);
        combat.Move(Direction.Right);
        combat.Move(Direction.Right); // andar de lado não tira da fileira

        Assert.Equal(20 - BoneArcher.ArrowDamage, combat.PlayerHp);
    }

    [Fact]
    public void Arqueiro_que_ficou_para_tras_sobe_ate_a_fileira_do_jogador()
    {
        var archer = new BoneArcher(new Pos(0, 0));
        var combat = new Combat(new CombatConfig
        {
            PlayerStart = new Pos(4, 3),
            Deck = new List<CardId>(),
            Enemies = { archer }
        });

        for (int i = 0; i < 4; i++)
        {
            combat.Guard(); // 8 tiques: dois disparos
        }

        Assert.True(archer.Pos.Y >= combat.PlayerPos.Y);
    }

    [Fact]
    public void Badalada_poupa_as_casas_vizinhas_ao_sineiro()
    {
        var combat = new Combat(new CombatConfig
        {
            PlayerStart = new Pos(2, 5),
            Deck = new List<CardId>(),
            Enemies = { new BellRinger(new Pos(2, 6)) }
        });

        for (int i = 0; i < 6; i++)
        {
            combat.Move(i % 2 == 0 ? Direction.Left : Direction.Right);
        }

        // No 6º tique o jogador está de volta em (2,5), vizinho ao Sineiro.
        Assert.Equal(new Pos(2, 5), combat.PlayerPos);
        Assert.Equal(20, combat.PlayerHp);
    }

    [Fact]
    public void Badalada_acerta_o_resto_da_sala()
    {
        Combat combat = Make(HandMode.Recompose, new List<CardId>(), new BellRinger(new Pos(2, 6)));

        for (int i = 0; i < 6; i++)
        {
            combat.Move(i % 2 == 0 ? Direction.Left : Direction.Right);
        }

        Assert.Equal(20 - BellRinger.TollDamage, combat.PlayerHp);
    }

    [Fact]
    public void Sineiro_nao_pode_ser_empurrado()
    {
        var bell = new BellRinger(new Pos(2, 1));
        var deck = new List<CardId> { CardId.Golpe, CardId.Golpe, CardId.GolpePesado };
        Combat combat = Make(HandMode.Recompose, deck, bell, new Dummy(new Pos(0, 6)));

        combat.PlayCard(0, Direction.Left);
        combat.PlayCard(0, Direction.Left);
        combat.PlayCard(0, Direction.Forward);

        Assert.Equal(new Pos(2, 1), bell.Pos);
        Assert.Equal(2, bell.Hp);
    }

    // ---------------------------------------------------------------- sala de teste

    [Theory]
    [InlineData(HandMode.Recompose)]
    [InlineData(HandMode.AutoDraw)]
    public void Sala_de_teste_e_reproduzivel_pela_semente(HandMode mode)
    {
        Combat a = TestRoom.Create(mode, seed: 42);
        Combat b = TestRoom.Create(mode, seed: 42);

        Assert.Equal(a.Hand, b.Hand);
        Assert.Equal(4, a.Hand.Count);
        Assert.Equal(3, a.Enemies.Count);
        Assert.Equal(CombatStatus.InProgress, a.Status);
    }

    [Fact]
    public void Sementes_diferentes_mudam_a_ordem_do_deck()
    {
        var hands = new HashSet<string>();
        for (int seed = 1; seed <= 20; seed++)
        {
            hands.Add(string.Join(",", TestRoom.Create(HandMode.Recompose, seed).Hand));
        }

        Assert.True(hands.Count > 5);
    }
}
