# Opus 5.5 and Haiku 5.5 prices from tech-art F7 ($/MTok); batch = half
OP = dict(inp=4, cr=0.20, out=20)
HK = dict(inp=0.10, cr=0.01, out=0.50)
def cost(p, cached, uncached, out, batch=True):
    f = 0.5 if batch else 1
    return f*(cached*p['cr'] + uncached*p['inp'] + out*p['out'])/1e6
s1 = cost(OP, 6000, 800, 2500)
s2 = cost(OP, 14000, 2500, 8000) * 1.36
s4 = cost(OP, 10000, 7000, 11000) * 1.15
s5 = cost(OP, 5000, 2000, 3500)
judge = cost(HK, 1500, 600, 450) * 60
print("per stage batch:", round(s1,4), round(s2,4), round(s4,4), round(s5,4), round(judge,4))
cand = s1+s2+s4+s5+judge
print("per full candidate batch", round(cand,3), "interactive", round(2*cand,3))
# funnel
n1, n2, n4 = 400, 100, 48
tot = n1*s1 + n2*s2 + n4*(s4+s5) + 150*judge
print("launch batch total", round(tot,2), "per accepted (31)", round(tot/31,2))
for a in (0.5,):
    print("auto-accepted temp exhibition: opus batch", round(cand/a,2), "opus interactive", round(2*cand/a,2),
          "sonnet batch", round(cand/a/2,2), "sonnet int", round(cand/a,2), "haiku batch", round(cand/a/40,3))
print("buffer 20/day opus batch per month", round(20*cand/0.5*30,0), "5/day", round(5*cand/0.5*30,0))
# sim compute
runs_full = 3*50*5 + 3*50*22
print("runs per dept full gate", runs_full, "core-min at 0.5s", round(runs_full*0.5/60,1))
print("60 depts on 8 cores hours", round(60*runs_full*0.5/3600/8,1))
