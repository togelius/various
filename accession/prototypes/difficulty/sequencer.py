# Prototype of the run sequencer: hidden graph with constrained department assignment.
# Synthetic pool; checks feasibility of the hard constraints proposed in design/difficulty.md.
import random, itertools, statistics, sys, time
TYPES = ['Swarm','Artillery','Guarded','Darkness','Hazard','Locks','Attrition','Social']
FAMS = ['Copies','Light','Tides','Machines','Specimens','Classification']
PROGS = ['enfilade','rotunda','grandhall','caselab','stacks','court']
CATS = ['technology','land','era','natural','practice','concept']
bias = {'Copies':['Swarm','Locks','Guarded'],'Light':['Darkness','Artillery','Guarded'],
        'Tides':['Hazard','Attrition','Swarm'],'Machines':['Artillery','Locks','Guarded'],
        'Specimens':['Swarm','Guarded','Darkness'],'Classification':['Locks','Guarded','Artillery']}
def make_pool(n, rng, social=2):
    pool=[]
    counts = {t:0 for t in TYPES}
    for i in range(n):
        fam = FAMS[i % len(FAMS)]
        if i < social: prim='Social'
        else:
            opts=[t for t in TYPES if t!='Social']
            w=[(3 if t in bias[fam] else 1)/(1+counts[t]) for t in opts]
            prim=rng.choices(opts,w)[0]
        counts[prim]+=1
        sec = rng.choice([t for t in TYPES if t!=prim and t!='Social'])
        cx = rng.choices([1,2,3,4,5],[5,8,8,6,3])[0]
        pool.append(dict(id=i,fam=fam,prim=prim,sec=sec,cx=cx,prog=rng.choice(PROGS),cat=rng.choice(CATS),
                         theme=[rng.random() for _ in range(4)]))
    return pool
WIDTH=[3,3,3,3,3,3,3,2]
OFF=set()
MAXREP=2
GAP=3
CXMAX=[2,3,3,4,4,5,5,5]
def build_graph(rng, width):
    rows=[[ (r,i) for i in range(w)] for r,w in enumerate(width)]
    edges={}
    for r in range(len(width)-1):
        a,b=rows[r],rows[r+1]
        cap = 2 if len(b)>=len(a) else 3
        while True:
            e={}
            for n in a:
                k = 2 if len(b)<3 else rng.choice([2,2,2,3])
                e[n]=set(rng.sample(b,k))
            indeg={c:sum(c in e[p] for p in a) for c in b}
            if all(1<=v<=cap for v in indeg.values()): break
        edges.update(e)
    for n in rows[-1]: edges[n]=set()
    return rows, edges
def parents_of(edges):
    par={}
    for p,cs in edges.items():
        for c in cs: par.setdefault(c,set()).add(p)
    return par
def dist(a,b):
    import math
    d = 0.35*(a['fam']!=b['fam']) + 0.2*(a['cat']!=b['cat']) + 0.2*(a['prog']!=b['prog'])
    d += 0.25*min(1, sum((x-y)**2 for x,y in zip(a['theme'],b['theme']))**0.5)
    return d
def ok_path(seq):
    # at most 2 types repeated, each at most twice, repeats >= 3 rows apart
    pos={}
    for i,t in enumerate(seq): pos.setdefault(t,[]).append(i)
    reps=[t for t,p in pos.items() if len(p)>1]
    if len(reps)>MAXREP: return False
    for t in reps:
        p=pos[t]
        if len(p)>2 or p[1]-p[0]<GAP: return False
    return True
def assign(pool, rng, width=WIDTH, max_restarts=40, step_limit=800):
    for attempt in range(max_restarts):
        rows, edges = build_graph(rng, width)
        par = parents_of(edges)
        order=[n for row in rows for n in row]
        A={}; hist={}; anc={}; steps=[0]
        def cands_for(n):
            r=n[0]; ps=par.get(n,set()); row=rows[r]
            in_hist={()} if not ps else set().union(*(hist[p] for p in ps))
            an=set().union(*(anc[p] for p in ps)) if ps else set()
            sib=set(A[c]['prim'] for p in ps for c in edges[p] if c in A)
            out=[]
            for d in pool:
                if d['id'] in an: continue
                if 'cx' not in OFF and d['cx']>CXMAX[r]: continue
                if any(A.get(m) is d for m in row): continue
                if 'r1' not in OFF and r==0 and d['prim'] in ('Darkness','Attrition','Social'): continue
                if 'sib' not in OFF and d['prim'] in sib: continue
                if any(A[p]['prim']==d['prim'] for p in ps): continue
                if 'fam' not in OFF and any(A[p]['fam']==d['fam'] for p in ps): continue
                if 'prog' not in OFF and any(A[p]['prog']==d['prog'] for p in ps): continue
                if 'path' not in OFF and not all(ok_path(h+(d['prim'],)) for h in in_hist): continue
                target=1+4*r/7
                w=2.718**(-0.5*abs(d['cx']-target))
                if ps:
                    md=statistics.mean(dist(A[p],d) for p in ps)
                    w*=2.718**(-((md-0.65)/0.2)**2)
                if not any(d['prim'] in h for h in in_hist): w*=1.5
                out.append((w,d))
            return out, in_hist, an
        def rec(i):
            if i==len(order): return True
            steps[0]+=1
            if steps[0]>step_limit: return False
            n=order[i]
            cs,in_hist,an=cands_for(n)
            ordered=[]
            while cs:
                k=rng.choices(range(len(cs)),[c[0] for c in cs])[0]
                ordered.append(cs.pop(k)[1])
            for d in ordered:
                A[n]=d; hist[n]={h+(d['prim'],) for h in in_hist}; anc[n]=an|{d['id']}
                if rec(i+1): return True
                del A[n]; del hist[n]; del anc[n]
                if steps[0]>step_limit: return False
            return False
        if rec(0): return rows, edges, A, hist, attempt
    return None
def paths(rows, edges):
    out=[]
    def rec(n, acc):
        acc=acc+[n]
        if not edges[n]: out.append(acc); return
        for c in edges[n]: rec(c, acc)
    for n in rows[0]: rec(n, [])
    return out
if __name__=='__main__':
    N=int(sys.argv[1]) if len(sys.argv)>1 else 30
    width=[int(x) for x in sys.argv[2].split(',')] if len(sys.argv)>2 else WIDTH
    social=int(sys.argv[3]) if len(sys.argv)>3 else 2
    rng=random.Random(1)
    restarts=[]; fails=0; mind=[]; meand=[]; offered=[]; npaths=[]; used=[]; t0=time.time()
    trials=int(sys.argv[4]) if len(sys.argv)>4 else 40
    for s in range(trials):
        rng=random.Random(1000+s)
        pool=make_pool(N, rng, social)
        res=assign(pool, rng, width)
        if res is None: fails+=1; continue
        rows,edges,A,hist,att=res
        restarts.append(att)
        P=paths(rows,edges); npaths.append(len(P))
        ds=[len(set(A[n]['prim'] for n in p)) for p in P]
        mind.append(min(ds)); meand.append(statistics.mean(ds))
        used.append(len(set(d['id'] for d in A.values())))
        # types offered along a random path (all doors seen)
        p=rng.choice(P); seen=set(A[n]['prim'] for n in rows[0])
        for n in p: seen |= set(A[c]['prim'] for c in edges[n])
        offered.append(len(seen))
    dt=time.time()-t0
    print(f"pool={N} width={width} social={social}: success {trials-fails}/{trials}; restarts mean {statistics.mean(restarts):.2f} max {max(restarts)}; "
          f"paths/graph {statistics.mean(npaths):.0f}; distinct primaries per path min {min(mind)} mean {statistics.mean(meand):.2f}; "
          f"types offered on a random path mean {statistics.mean(offered):.2f}/8 (min {min(offered)}); depts used {statistics.mean(used):.1f}; {dt/trials*1000:.0f} ms/run")
