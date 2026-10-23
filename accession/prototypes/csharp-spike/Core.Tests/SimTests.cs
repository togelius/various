using System.Collections.Generic;
using System.Diagnostics;
using Accession.Core;

namespace Core.Tests;

public class SimTests
{
    [Test]
    public void SameSeedGivesSameEventsAndHash()
    {
        var e1 = new List<int>(); var e2 = new List<int>();
        uint h1 = Bot.PlayRun(42, 500, e1, out int t1, out _);
        uint h2 = Bot.PlayRun(42, 500, e2, out int t2, out _);
        Assert.That(h2, Is.EqualTo(h1));
        Assert.That(t2, Is.EqualTo(t1));
        Assert.That(e2, Is.EqualTo(e1));
    }

    [Test]
    public void GoldenHashMatchesJavaScriptPort()
    {
        // Values printed by js/sim.js under Node 22 for seeds 1..1000.
        uint c = Bot.Batch(1, 1000, 500, out long turns, out int wins);
        Assert.That(c, Is.EqualTo(2366039937u));
        Assert.That(turns, Is.EqualTo(381594));
        Assert.That(wins, Is.EqualTo(403));
    }

    [Test]
    public void TenThousandHeadlessRuns()
    {
        var sw = Stopwatch.StartNew();
        uint c = Bot.Batch(1, 10000, 500, out long turns, out int wins);
        sw.Stop();
        TestContext.Progress.WriteLine($"C#: 10000 runs, {turns} steps in {sw.ElapsedMilliseconds} ms = {turns / sw.Elapsed.TotalSeconds / 1e6:F2} M steps/s; hash={c} wins={wins}");
        Assert.That(c, Is.EqualTo(4197054079u));
    }
}
