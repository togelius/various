import sys, collections
sys.path.insert(0, sys.argv[1])
from sketches import S
PASS=set('.+SEX=b:^')
OPAQUE=set('#oCHc|')
def grid(s):
    rows=[r for r in s.strip('\n').split('\n')]
    w=max(len(r) for r in rows)
    return [r.ljust(w,'#') for r in rows]
def nbrs8(g,y,x):
    H,W=len(g),len(g[0])
    for dy in(-1,0,1):
        for dx in(-1,0,1):
            if dy==dx==0: continue
            ny,nx=y+dy,x+dx
            if 0<=ny<H and 0<=nx<W:
                if dy and dx and not (g[y][nx] in PASS and g[ny][x] in PASS): continue
                yield ny,nx
def bfs(g,start,blocked=None):
    D={start:0};q=collections.deque([start])
    while q:
        y,x=q.popleft()
        for ny,nx in nbrs8(g,y,x):
            if g[ny][nx] in PASS and (ny,nx)!=blocked and (ny,nx) not in D:
                D[(ny,nx)]=D[(y,x)]+1;q.append((ny,nx))
    return D
def los(g,y0,x0,y1,x1):
    dy,dx=abs(y1-y0),abs(x1-x0);sy=1 if y1>y0 else -1;sx=1 if x1>x0 else -1
    err=dx-dy;y,x=y0,x0
    while (y,x)!=(y1,x1):
        if (y,x)!=(y0,x0) and g[y][x] in OPAQUE: return False
        e2=2*err
        if e2>-dy: err-=dy;x+=sx
        if e2<dx: err+=dx;y+=sy
    return True
def metrics(name,s):
    g=grid(s);H,W=len(g),len(g[0])
    cells=[(y,x) for y in range(H) for x in range(W)]
    floor=[c for c in cells if g[c[0]][c[1]] in PASS]
    E=[c for c in cells if g[c[0]][c[1]]=='E'][0]; X=[c for c in cells if g[c[0]][c[1]]=='X'][0]
    D=bfs(g,E); assert len(D)==len(floor), (name,'disconnected',len(D),len(floor))
    path=D[X]
    # holes: 8-connected components of non-passable cells not touching border
    seen=set();holes=[]
    for c in cells:
        if g[c[0]][c[1]] in PASS or c in seen: continue
        comp=[c];seen.add(c);q=[c];border=False
        while q:
            y,x=q.pop()
            if y in(0,H-1) or x in(0,W-1): border=True
            for dy in(-1,0,1):
                for dx in(-1,0,1):
                    ny,nx=y+dy,x+dx
                    if 0<=ny<H and 0<=nx<W and g[ny][nx] not in PASS and (ny,nx) not in seen:
                        seen.add((ny,nx));comp.append((ny,nx));q.append((ny,nx))
        if not border:
            ring=set()
            for y,x in comp:
                for dy in(-1,0,1):
                    for dx in(-1,0,1):
                        ny,nx=y+dy,x+dx
                        if g[ny][nx] in PASS: ring.add((ny,nx))
            holes.append((len(comp),len(ring)))
    short=sum(1 for h in holes if h[1]<=16); long_=len(holes)-short
    # chokepoints (Brogue-like): removing tile cuts off >=4 tiles
    choke=0
    fs=set(floor)
    for c in floor:
        nb=[n for n in nbrs8(g,*c) if n in fs]
        if not nb: continue
        R=bfs(g,nb[0],blocked=c)
        cut=len(floor)-1-len(R)
        small=min(cut,len(R))
        if cut>0 and small>=4: choke+=1
    deg=[sum(1 for n in nbrs8(g,*c) if n in fs) for c in floor]
    defn=sum(1 for d in deg if d<=2)/len(floor)
    surf=sum(deg)/len(floor)
    Cs=[c for c in cells if g[c[0]][c[1]]=='C']
    vista=any(los(g,E[0],E[1],c[0],c[1]) for c in Cs) if Cs else None
    # openness: mean fraction of floor tiles within r=7 visible
    r=7;vis=[]
    for (y,x) in floor:
        tot=v=0
        for (yy,xx) in floor:
            if (yy-y)**2+(xx-x)**2<=r*r:
                tot+=1; v+= los(g,y,x,yy,xx)
        vis.append(v/tot)
    open_=sum(vis)/len(vis)
    interior=[c for c in cells if g[c[0]][c[1]] not in PASS and g[c[0]][c[1]]!='#']
    glass=sum(1 for c in interior if g[c[0]][c[1]] not in OPAQUE)
    gr=glass/len(interior) if interior else 0
    manh=abs(E[0]-X[0])+abs(E[1]-X[1])
    return dict(name=name,size=f"{W}x{H}",floor=len(floor),path=path,tort=round(path/max(abs(E[0]-X[0]),abs(E[1]-X[1])),2),
                loops=len(holes),pillar_loops=short,circuit_loops=long_,choke=round(choke/len(floor),2),defensible=round(defn,2),surface=round(surf,1),vista=vista,
                open=round(open_,2),glass=round(gr,2))
rows=[metrics(k,v) for k,v in S.items()]
keys=list(rows[0].keys())
print('| '+' | '.join(keys)+' |');print('|'+'---|'*len(keys))
for r in rows: print('| '+' | '.join(str(r[k]) for k in keys)+' |')
