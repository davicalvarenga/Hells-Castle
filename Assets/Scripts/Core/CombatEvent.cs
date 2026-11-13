#nullable enable
using System;
using System.Collections.Generic;

namespace HellsCastle.Core
{
    public enum CombatEventType
    {
        PlayerMoved,
        CardPlayed,
        EnemyDamaged,
        EnemyDied,
        EnemyMoved,
        EnemyAttacked,
        BlockGained,
        EdgeGranted,
        Recomposed,
        Guarded,
        Victory,
        Defeat
    }

    /// <summary>
    /// Algo que aconteceu no combate, na ordem em que aconteceu. A interface usa esta lista
    /// para animar (movimento, golpes, dano), sem precisar interpretar o texto do registro.
    /// </summary>
    public sealed class CombatEvent
    {
        private static readonly IReadOnlyList<Pos> NoTiles = Array.Empty<Pos>();

        internal CombatEvent(CombatEventType type)
        {
            Type = type;
        }

        public CombatEventType Type { get; }

        /// <summary>Posição do inimigo na lista <see cref="Combat.Enemies"/>; -1 se não se aplica.</summary>
        public int EnemyIndex { get; internal set; } = -1;

        public Pos From { get; internal set; }
        public Pos To { get; internal set; }

        /// <summary>Dano, bloqueio ganho ou cartas compradas, conforme o tipo.</summary>
        public int Amount { get; internal set; }

        /// <summary>Dano absorvido pelo bloqueio (em <see cref="CombatEventType.EnemyAttacked"/>).</summary>
        public int Absorbed { get; internal set; }

        /// <summary>O ataque do inimigo acertou o jogador.</summary>
        public bool Hit { get; internal set; }

        /// <summary>O movimento do inimigo foi um empurrão.</summary>
        public bool Pushed { get; internal set; }

        public CardId? Card { get; internal set; }

        /// <summary>Casas afetadas (área da carta ou do ataque do inimigo).</summary>
        public IReadOnlyList<Pos> Tiles { get; internal set; } = NoTiles;
    }
}
