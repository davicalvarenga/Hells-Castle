#nullable enable
using System.Collections.Generic;

namespace HellsCastle.Core
{
    /// <summary>
    /// Combate de teste: sala 5x7, deck inicial de 8 cartas e três inimigos, cada um fazendo
    /// uma pergunta diferente ao jogador. Os números são ponto de partida para balancear.
    /// </summary>
    public static class TestRoom
    {
        public static Combat Create(HandMode handMode, int seed)
        {
            var config = new CombatConfig
            {
                Width = 5,
                Height = 7,
                PlayerStart = new Pos(2, 0),
                PlayerMaxHp = 20,
                HandSize = 4,
                HandMode = handMode,
                Seed = seed,
                Deck = CardLibrary.StarterDeck(),
                Enemies = new List<Enemy>
                {
                    new Ghoul(new Pos(1, 3)),
                    new BoneArcher(new Pos(3, 5)),

                    // Na última fileira: como o jogador nunca recua, o Sineiro não pode ficar para trás.
                    new BellRinger(new Pos(2, 6))
                }
            };

            return new Combat(config);
        }
    }
}
