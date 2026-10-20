# Role curves (anchors from design/core-systems.md §2.6) vs median player build (§8.7).
# Computes expected head-on duel cost (fraction of player max HP lost) per role and depth.
import math
anch = {  # depth 1/4/8: HP, Acc, Eva, dmin, dmax, Pad
 'fodder':     [(7,2,1,1,4,0),(16,3,2,3,8,1),(28,4,3,5,13,2)],
 'skirmisher': [(12,3,3,2,5,0),(24,4,4,4,9,1),(42,5,5,7,14,2)],
 'artillery':  [(10,4,1,2,5,0),(20,5,2,4,11,0),(35,6,3,7,16,1)],
 'brute':      [(15,1,0,3,7,1),(35,2,1,6,14,2),(65,3,2,10,22,3)],
 'controller': [(12,3,2,1,3,0),(26,4,3,2,5,1),(46,5,4,3,8,2)],
 'warden':     [(21,3,2,2,5,1),(49,4,3,4,10,2),(91,5,4,7,15,3)],
}
warden_special = {1:5,4:10,8:14}
def interp(t, pts):  # pts: dict depth->value, piecewise linear, extrapolate beyond 8 with 4-8 slope
    ks = sorted(pts)
    if t <= ks[0]: return pts[ks[0]]
    for a,b in zip(ks, ks[1:]):
        if t <= b: return pts[a] + (pts[b]-pts[a])*(t-a)/(b-a)
    a,b = ks[-2], ks[-1]
    return pts[b] + (pts[b]-pts[a])*(t-b)/(b-a)
def role(r, t):
    vals = []
    for i in range(6):
        pts = {1:anch[r][0][i], 4:anch[r][1][i], 8:anch[r][2][i]}
        vals.append(math.floor(interp(t, pts)))
    return dict(zip(['HP','Acc','Eva','dmin','dmax','Pad'], vals))
# median player at start of department t (core §8.7); t=9 is the Exit (HP 60, Clearance 18)
P = {1:(20,4,3,1),2:(25,5,3,1),3:(30,7,4,2),4:(35,9,4,3),5:(40,11,5,3),6:(45,13,5,4),7:(50,14,5,5),8:(55,16,6,5),9:(60,17,6,6)}
def hitp(acc, eva): return max(10, min(95, 75+5*(acc-eva)))/100
def net_mean(dmin, dmax, pad):
    vals = [max(1, x-pad) for x in range(dmin, dmax+1)]
    return sum(vals)/len(vals)
rate = {'fodder':1,'skirmisher':1,'artillery':1,'brute':100/150,'controller':1,'warden':1}
approach = {'fodder':0,'skirmisher':0,'artillery':2,'brute':0,'controller':1,'warden':0}
def duel(r, t, p_dodge=0.5):
    e = role(r, t); hp, dmg, acc, pad = P[t]; eva = 2
    hp_p = hitp(acc, e['Eva']); netp = max(1, dmg - e['Pad'])
    turns = e['HP']/(hp_p*netp) + approach[r]
    he = hitp(e['Acc'], eva); ne = net_mean(e['dmin'], e['dmax'], pad)
    per_turn = rate[r]*he*ne
    if r == 'warden':
        sp = interp(t, warden_special)
        per_turn = (2/3)*he*ne + (1/3)*(1-p_dodge)*sp
    if r == 'controller':
        turns += turns/3*0.5   # status every 3rd action costs ~half a turn of tempo
    return turns, per_turn*turns/hp, e, hp_p, netp, he, ne
if __name__ == '__main__':
    roles = list(anch)
    print('Stat table (HP/Acc/Eva/dmg/Pad) by depth')
    for r in roles:
        row = []
        for t in range(1,10):
            e = role(r,t); row.append(f"{e['HP']}/{e['dmin']}-{e['dmax']}/{e['Pad']}")
        print(r.ljust(11), ' | '.join(row))
    print('\nDuel: turns to kill (player) and HP fraction lost, by depth')
    for r in roles:
        out=[]
        for t in range(1,10):
            turns, cost, *_ = duel(r,t); out.append(f"{turns:4.1f}t {cost*100:4.1f}%")
        print(r.ljust(11), ' | '.join(out))
    print('\nFodder-equivalent cost (duel cost / fodder duel cost)')
    for r in roles:
        out=[]
        for t in range(1,10):
            out.append(f"{duel(r,t)[1]/duel('fodder',t)[1]:4.1f}")
        print(r.ljust(11), ' '.join(out))
    print('\nEnemy hits on player: hit%, net mean dmg, % of max HP per hit')
    for r in roles:
        out=[]
        for t in range(1,10):
            *_, he, ne = duel(r,t); out.append(f"{he*100:.0f}% {ne:.1f} {ne/P[t][0]*100:.0f}%")
        print(r.ljust(11), ' | '.join(out))
