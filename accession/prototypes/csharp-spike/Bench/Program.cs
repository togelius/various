using System.Diagnostics;
using Accession.Core;
for (int rep = 0; rep < 4; rep++)
{
    var sw = Stopwatch.StartNew();
    uint c = Bot.Batch(1, 10000, 500, out long turns, out int wins);
    sw.Stop();
    System.Console.WriteLine($"rep {rep}: {turns} steps in {sw.ElapsedMilliseconds} ms = {turns / sw.Elapsed.TotalSeconds / 1e6:F2} M steps/s hash={c}");
}
