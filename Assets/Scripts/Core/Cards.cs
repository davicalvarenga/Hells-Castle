#nullable enable
using System;
using System.Collections.Generic;

namespace HellsCastle.Core
{
    public enum CardId
    {
        Golpe,
        Aparar,
        Estocada,
        Varredura,
        GolpePesado,
        PassoSombrio
    }

    /// <summary>O que o jogador precisa informar ao jogar a carta.</summary>
    public enum CardTargeting
    {
        /// <summary>Nada: a área é fixa.</summary>
        None,

        /// <summary>Uma direção (frente, lados ou trás).</summary>
        OneDirection,

        /// <summary>Um caminho de 1 ou 2 passos, só para frente ou para os lados.</summary>
        Path
    }

    public sealed class CardDefinition
    {
        public CardId Id { get; }
        public string Name { get; }

        /// <summary>Custo em tiques.</summary>
        public int Cost { get; }

        public CardTargeting Targeting { get; }
        public string Text { get; }

        public CardDefinition(CardId id, string name, int cost, CardTargeting targeting, string text)
        {
            Id = id;
            Name = name;
            Cost = cost;
            Targeting = targeting;
            Text = text;
        }
    }

    public static class CardLibrary
    {
        public const int GolpeDamage = 3;
        public const int ApararBlock = 4;
        public const int EstocadaDamage = 4;
        public const int VarreduraDamage = 2;
        public const int VarreduraChainDamage = 4;
        public const int GolpePesadoDamage = 8;

        /// <summary>Cadeia mínima para ativar os bônus de Varredura e Golpe Pesado.</summary>
        public const int ChainBonusThreshold = 2;

        private static readonly Dictionary<CardId, CardDefinition> Definitions = new Dictionary<CardId, CardDefinition>
        {
            {
                CardId.Golpe,
                new CardDefinition(CardId.Golpe, "Golpe", 1, CardTargeting.OneDirection,
                    "Casa vizinha: 3 de dano.")
            },
            {
                CardId.Aparar,
                new CardDefinition(CardId.Aparar, "Aparar", 1, CardTargeting.None,
                    "Bloqueia 4 do próximo ataque.")
            },
            {
                CardId.Estocada,
                new CardDefinition(CardId.Estocada, "Estocada", 2, CardTargeting.None,
                    "Linha de 2 casas à frente: 4 de dano em cada.")
            },
            {
                CardId.Varredura,
                new CardDefinition(CardId.Varredura, "Varredura", 2, CardTargeting.None,
                    "Arco de 3 casas à frente: 2 de dano em cada. Cadeia 2+: 4 de dano.")
            },
            {
                CardId.GolpePesado,
                new CardDefinition(CardId.GolpePesado, "Golpe Pesado", 3, CardTargeting.OneDirection,
                    "Casa vizinha: 8 de dano. Cadeia 2+: empurra 1 casa.")
            },
            {
                CardId.PassoSombrio,
                new CardDefinition(CardId.PassoSombrio, "Passo Sombrio", 1, CardTargeting.Path,
                    "Move até 2 casas, para frente ou para os lados.")
            }
        };

        public static CardDefinition Get(CardId id)
        {
            if (!Definitions.TryGetValue(id, out CardDefinition? definition))
            {
                throw new ArgumentOutOfRangeException(nameof(id), id, "Carta sem definição.");
            }

            return definition;
        }

        /// <summary>Deck inicial do combate de teste (8 cartas).</summary>
        public static List<CardId> StarterDeck()
        {
            return new List<CardId>
            {
                CardId.Golpe,
                CardId.Golpe,
                CardId.Aparar,
                CardId.Aparar,
                CardId.Estocada,
                CardId.Varredura,
                CardId.GolpePesado,
                CardId.PassoSombrio
            };
        }
    }
}
