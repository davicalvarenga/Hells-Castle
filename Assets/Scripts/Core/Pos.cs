#nullable enable
using System;

namespace HellsCastle.Core
{
    /// <summary>
    /// Direção relativa ao jogador. "Frente" é sempre o sentido da saída da sala (Y crescente).
    /// </summary>
    public enum Direction
    {
        Forward,
        Left,
        Right,
        Back
    }

    /// <summary>Casa do grid. X cresce para a direita; Y cresce em direção à saída.</summary>
    public readonly struct Pos : IEquatable<Pos>
    {
        public int X { get; }
        public int Y { get; }

        public Pos(int x, int y)
        {
            X = x;
            Y = y;
        }

        public Pos Step(Direction direction)
        {
            switch (direction)
            {
                case Direction.Forward: return new Pos(X, Y + 1);
                case Direction.Back: return new Pos(X, Y - 1);
                case Direction.Left: return new Pos(X - 1, Y);
                case Direction.Right: return new Pos(X + 1, Y);
                default: throw new ArgumentOutOfRangeException(nameof(direction));
            }
        }

        /// <summary>Distância em passos ortogonais (sem diagonais).</summary>
        public int DistanceTo(Pos other) => Math.Abs(X - other.X) + Math.Abs(Y - other.Y);

        /// <summary>Vizinha ortogonal: frente, trás ou lados. Diagonais não contam.</summary>
        public bool IsAdjacentTo(Pos other) => DistanceTo(other) == 1;

        public bool Equals(Pos other) => X == other.X && Y == other.Y;
        public override bool Equals(object? obj) => obj is Pos other && Equals(other);
        public override int GetHashCode() => (X * 397) ^ Y;
        public static bool operator ==(Pos a, Pos b) => a.Equals(b);
        public static bool operator !=(Pos a, Pos b) => !a.Equals(b);
        public override string ToString() => "(" + X + "," + Y + ")";
    }
}
