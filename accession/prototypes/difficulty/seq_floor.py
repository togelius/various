# Per-floor hidden graph, generated at the Entrance Hall / each Stair Hall, conditioned on the
# departments actually visited. Simulates players choosing doors and reports guarantees.
import random, statistics, sys, time, collections
import sequencer as S
FLOORS=[[3,3,3],[3,3,3],[3,2]]
ROW0=[0,3,6]
def gen_floor(pool, rng, fl, history, maxrep, gap, relax=False, step_limit=1500, restarts=30):
    width=FLOORS[fl]; base=ROW0[fl]
    hist_prims=tuple(d['prim'] for d in history); hist_ids=set(d['id'] for d in history)
    last=history[-1] if history else None
    for attempt in range(restarts):
        rows=[[(base+r,i) for i in range(w)] for r,w in enumerate(width)]
        edges={}
        for r in range(len(width)-1):
            a,b=rows[r],rows[r+1]; cap=2 if len(b)>=len(a) else 3
            while True:
                e={n:set(rng.sample(b, 2 if len(b)<3 else rng.choice([2,2,2,3]))) for n in a}
                ind={c:sum(c in e[p] for p in a) for c in b}
                if all(1<=v<=cap for v in ind.values()): break
            edges.update(e)
        for n in rows[-1]: edges[n]=set()
        par=S.parents_of(edges)
        order=[n for row in rows for n in row]; A={}; H={}; AN={}; steps=[0]
        def ok_seq(seq):
            pos={}
            for i,t in enumerate(seq): pos.setdefault(t,[]).append(i)
            reps=[t for t,p in pos.items() if len(p)>1]
            if len(reps)>maxrep: return False
            return all(len(pos[t])<=2 and pos[t][1]-pos[t][0]>=gap for t in reps)
        def cands(n):
            R=n[0]; ps=par.get(n,set()); row=rows[R-base]
            inh={hist_prims} if not ps else set().union(*(H[p] for p in ps))
            an=(set().union(*(AN[p] for p in ps)) if ps else set())|hist_ids
            prev=[A[p] for p in ps] if ps else ([last] if last else [])
            sib=set(A[c]['prim'] for p in ps for c in edges[p] if c in A) if ps else set(A[m]['prim'] for m in row if m in A)
            out=[]
            for d in pool:
                if d['id'] in an or d['cx']>S.CXMAX[R]+(1 if relax else 0): continue
                if any(A.get(m) is d for m in row): continue
                if R==0 and d['prim'] in ('Darkness','Attrition','Social'): continue
                if d['prim'] in sib: continue
                if any(q['prim']==d['prim'] for q in prev): continue
                if not relax and any(q['fam']==d['fam'] or q['prog']==d['prog'] for q in prev): continue
                if not all(ok_seq(h+(d['prim'],)) for h in inh): continue
                w=2.718**(-0.5*abs(d['cx']-(1+4*R/7)))
                if prev:
                    md=statistics.mean(S.dist(q,d) for q in prev); w*=2.718**(-((md-0.65)/0.2)**2)
                if not any(d['prim'] in h for h in inh): w*=2.0
                out.append((w,d))
            return out,inh,an
        def rec(i):
            if i==len(order): return True
            steps[0]+=1
            if steps[0]>step_limit: return False
            n=order[i]; cs,inh,an=cands(n); ordered=[]
            while cs:
                k=rng.choices(range(len(cs)),[c[0] for c in cs])[0]; ordered.append(cs.pop(k)[1])
            for d in ordered:
                A[n]=d; H[n]={h+(d['prim'],) for h in inh}; AN[n]=an|{d['id']}
                if rec(i+1): return True
                del A[n],H[n],AN[n]
                if steps[0]>step_limit: return False
            return False
        if rec(0): return rows,edges,A
    return None
def run(pool, rng, rules):
    history=[]; offered=set(); level=[]
    cur=None
    for fl in range(3):
        res=None
        for li,(mr,gp,rx) in enumerate(rules):
            res=gen_floor(pool,rng,fl,history,mr,gp,rx)
            if res: level.append(li); break
        if not res: return None
        rows,edges,A=res
        choices=rows[0]
        for r in range(len(rows)):
            offered|=set(A[c]['prim'] for c in choices)
            n=rng.choice(choices); history.append(A[n]); choices=sorted(edges[n])
    return history, offered, level
if __name__=='__main__':
    N=int(sys.argv[1]); social=int(sys.argv[2]); trials=int(sys.argv[3])
    if len(sys.argv)>4 and sys.argv[4]=='narrow': FLOORS[:]=[[2,2,2],[2,2,2],[2,2]]
    rules=[(2,3,False),(3,3,False),(3,2,False),(3,2,True),(8,2,True)]
    ok=0; dist=collections.Counter(); off=[]; lv=collections.Counter(); t=time.time()
    for s in range(trials):
        rng=random.Random(5000+s); pool=S.make_pool(N,rng,social)
        r=run(pool,rng,rules)
        if not r: continue
        ok+=1; h,o,l=r; dist[len(set(d['prim'] for d in h))]+=1; off.append(len(o)); lv[max(l)]+=1
    print(f"N={N} social={social}: {ok}/{trials} runs built; distinct primaries visited {dict(sorted(dist.items()))}; types offered mean {statistics.mean(off):.2f}/8; worst rule level used {dict(lv)}; {1000*(time.time()-t)/trials:.0f} ms/run")
