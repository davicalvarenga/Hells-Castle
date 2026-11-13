using System.Diagnostics;
using System.Text;
using HellsCastle.Core;

namespace HellsCastle.ConsoleApp;

/// <summary>
/// Protótipo de terminal do combate de teste. Serve para sentir as regras (e comparar os dois
/// modos de mão) antes de existir a parte visual na Unity.
/// </summary>
internal static class Program
{
    private static int Main(string[] args)
    {
        Console.OutputEncoding = Encoding.UTF8;

        HandMode? mode = null;
        int seed = Environment.TickCount;

        for (int i = 0; i < args.Length; i++)
        {
            switch (args[i])
            {
                case "--mao" when i + 1 < args.Length:
                    mode = ParseMode(args[++i]);
                    if (mode == null)
                    {
                        Console.Error.WriteLine("Valor inválido para --mao. Use: recompor ou auto.");
                        return 2;
                    }

                    break;

                case "--semente" when i + 1 < args.Length:
                    if (!int.TryParse(args[++i], out seed))
                    {
                        Console.Error.WriteLine("Valor inválido para --semente. Use um número inteiro.");
                        return 2;
                    }

                    break;

                default:
                    Console.Error.WriteLine("Uso: dotnet run -- [--mao recompor|auto] [--semente N]");
                    return 2;
            }
        }

        if (mode == null)
        {
            Console.WriteLine("Hell's Castle — combate de teste");
            Console.WriteLine("Modo de mão: [1] Recompor (2 tiques para completar a mão)  [2] Compra automática");
            while (mode == null)
            {
                Console.Write("> ");
                string? answer = Console.ReadLine();
                if (answer == null)
                {
                    return 0;
                }

                mode = answer.Trim() switch
                {
                    "1" => HandMode.Recompose,
                    "2" => HandMode.AutoDraw,
                    _ => ParseMode(answer.Trim())
                };
            }
        }

        Combat combat = TestRoom.Create(mode.Value, seed);
        var stopwatch = Stopwatch.StartNew();
        int logShown = 0;
        string? error = null;

        while (combat.Status == CombatStatus.InProgress)
        {
            Render(combat, seed, ref logShown, error);
            Console.Write("> ");
            string? line = Console.ReadLine();
            if (line == null || line.Trim().Equals("q", StringComparison.OrdinalIgnoreCase))
            {
                Console.WriteLine("Combate abandonado.");
                return 0;
            }

            error = Execute(combat, line);
        }

        stopwatch.Stop();
        Render(combat, seed, ref logShown, null);
        PrintSummary(combat, stopwatch.Elapsed);
        return 0;
    }

    private static HandMode? ParseMode(string text)
    {
        switch (text.ToLowerInvariant())
        {
            case "recompor": return HandMode.Recompose;
            case "auto": return HandMode.AutoDraw;
            default: return null;
        }
    }

    /// <summary>Executa um comando. Devolve a mensagem de erro, ou nulo se deu certo.</summary>
    private static string? Execute(Combat combat, string line)
    {
        string[] parts = line.Trim().ToLowerInvariant().Split(' ', StringSplitOptions.RemoveEmptyEntries);
        if (parts.Length == 0)
        {
            return "Digite um comando (? mostra a ajuda).";
        }

        ActionResult result;
        switch (parts[0])
        {
            case "w": result = combat.Move(Direction.Forward); break;
            case "a": result = combat.Move(Direction.Left); break;
            case "d": result = combat.Move(Direction.Right); break;
            case "s": return "Não é possível recuar. (Para atacar atrás, use a carta: ex. \"1 s\".)";
            case "r": result = combat.Recompose(); break;
            case "g": result = combat.Guard(); break;
            case "?": return Help;
            default:
                if (!int.TryParse(parts[0], out int cardNumber))
                {
                    return "Comando desconhecido (? mostra a ajuda).";
                }

                var directions = new List<Direction>();
                foreach (char c in string.Concat(parts.Skip(1)))
                {
                    switch (c)
                    {
                        case 'w': directions.Add(Direction.Forward); break;
                        case 'a': directions.Add(Direction.Left); break;
                        case 'd': directions.Add(Direction.Right); break;
                        case 's': directions.Add(Direction.Back); break;
                        default: return "Direção inválida: use w (frente), a (esquerda), d (direita), s (trás).";
                    }
                }

                result = combat.PlayCard(cardNumber - 1, directions.ToArray());
                break;
        }

        return result.Success ? null : result.Error;
    }

    private const string Help =
        "w/a/d anda (frente/esquerda/direita) · N joga a carta N · \"N w\" carta com direção · "
        + "\"N wd\" Passo Sombrio com caminho · r recompõe · g guarda · q sai";

    private static void Render(Combat combat, int seed, ref int logShown, string? error)
    {
        if (!Console.IsOutputRedirected)
        {
            Console.Clear();
        }

        var sb = new StringBuilder();
        sb.AppendLine();
        sb.AppendLine("Hell's Castle — combate de teste   (mão: "
                      + (combat.HandMode == HandMode.Recompose ? "Recompor" : "compra automática")
                      + ", semente " + seed + ")");
        sb.AppendLine("Tique " + combat.Tick
                      + " | Vida " + combat.PlayerHp + "/" + combat.PlayerMaxHp
                      + " | Bloqueio " + combat.Block
                      + " | Cadeia " + combat.Chain
                      + (combat.OnTheEdge ? " | POR UM FIO: próxima carta -1 tique" : ""));
        sb.AppendLine();

        string border = "   +" + new string('-', combat.Width * 3 + 1) + "+";
        sb.AppendLine(border + "  saída");
        for (int y = combat.Height - 1; y >= 0; y--)
        {
            sb.Append(' ').Append(y).Append(" | ");
            for (int x = 0; x < combat.Width; x++)
            {
                var pos = new Pos(x, y);
                Enemy? enemy = combat.EnemyAt(pos);
                char symbol = pos == combat.PlayerPos ? '@' : enemy?.Symbol ?? '.';
                int? ticks = combat.TicksUntilHit(pos);
                char danger = ticks == null ? ' ' : ticks.Value > 9 ? '+' : (char)('0' + ticks.Value);
                sb.Append(symbol).Append(danger).Append(' ');
            }

            sb.AppendLine("|");
        }

        sb.AppendLine(border + "  entrada");
        sb.Append("     ");
        for (int x = 0; x < combat.Width; x++)
        {
            sb.Append(x).Append("  ");
        }

        sb.AppendLine();
        sb.AppendLine("   @ você · número ao lado = tiques até aquela casa ser atingida");
        sb.AppendLine();

        sb.AppendLine("Inimigos:");
        foreach (Enemy enemy in combat.Enemies)
        {
            if (!enemy.IsAlive)
            {
                sb.AppendLine("  " + enemy.Symbol + " " + enemy.Name.PadRight(18) + " morto");
                continue;
            }

            sb.AppendLine("  " + enemy.Symbol + " " + enemy.Name.PadRight(18)
                          + " vida " + (enemy.Hp + "/" + enemy.MaxHp).PadRight(6)
                          + " em " + enemy.Counter + ": " + enemy.IntentText);
        }

        sb.AppendLine();
        sb.AppendLine("Mão (monte " + combat.DrawPileCount + ", descarte " + combat.DiscardCount + "):");
        if (combat.Hand.Count == 0)
        {
            sb.AppendLine("  (vazia)");
        }

        for (int i = 0; i < combat.Hand.Count; i++)
        {
            CardDefinition card = CardLibrary.Get(combat.Hand[i]);
            int cost = combat.EffectiveCost(card.Id);
            sb.AppendLine("  " + (i + 1) + ") " + card.Name.PadRight(14) + "[" + cost + "] " + card.Text);
        }

        sb.AppendLine();
        if (logShown < combat.Log.Count)
        {
            for (int i = logShown; i < combat.Log.Count; i++)
            {
                sb.AppendLine("  · " + combat.Log[i]);
            }

            logShown = combat.Log.Count;
            sb.AppendLine();
        }

        if (error != null)
        {
            sb.AppendLine("  ! " + error);
            sb.AppendLine();
        }

        if (combat.Status == CombatStatus.InProgress)
        {
            sb.AppendLine(Help);
        }

        Console.Write(sb.ToString());
    }

    private static void PrintSummary(Combat combat, TimeSpan elapsed)
    {
        Console.WriteLine(combat.Status == CombatStatus.Victory ? "VITÓRIA" : "DERROTA");
        Console.WriteLine("  Duração real:        " + elapsed.ToString(@"mm\:ss"));
        Console.WriteLine("  Tiques:              " + combat.Tick);
        Console.WriteLine("  Vida restante:       " + combat.PlayerHp + "/" + combat.PlayerMaxHp);
        Console.WriteLine("  Dano sofrido:        " + combat.DamageTaken);
        Console.WriteLine("  Cartas jogadas:      " + combat.CardsPlayed);
        Console.WriteLine("  Maior cadeia:        " + combat.BestChain);
        Console.WriteLine("  Por um fio:          " + combat.EdgeCount);
        Console.WriteLine("  Recompor:            " + combat.RecomposeCount);
        Console.WriteLine("  Guardar:             " + combat.GuardCount);
    }
}
