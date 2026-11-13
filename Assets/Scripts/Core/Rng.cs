#nullable enable
using System.Collections.Generic;

namespace HellsCastle.Core
{
    /// <summary>
    /// Gerador xorshift32 com semente. Implementação própria para que a mesma semente
    /// produza a mesma sequência em qualquer runtime (.NET, Mono/Unity, Godot).
    /// </summary>
    public sealed class Rng
    {
        private uint _state;

        public Rng(int seed)
        {
            // O estado do xorshift não pode ser zero.
            _state = seed == 0 ? 0x9E3779B9u : unchecked((uint)seed);
        }

        private uint NextUInt()
        {
            uint x = _state;
            x ^= x << 13;
            x ^= x >> 17;
            x ^= x << 5;
            _state = x;
            return x;
        }

        /// <summary>Inteiro em [0, maxExclusive).</summary>
        public int Next(int maxExclusive)
        {
            if (maxExclusive <= 0)
            {
                throw new System.ArgumentOutOfRangeException(nameof(maxExclusive));
            }

            return (int)(NextUInt() % (uint)maxExclusive);
        }

        /// <summary>Embaralhamento Fisher-Yates no próprio lugar.</summary>
        public void Shuffle<T>(IList<T> items)
        {
            for (int i = items.Count - 1; i > 0; i--)
            {
                int j = Next(i + 1);
                T tmp = items[i];
                items[i] = items[j];
                items[j] = tmp;
            }
        }
    }
}
