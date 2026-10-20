import math
def logit(p): return math.log(p/(1-p))
def sig(x): return 1/(1+math.exp(-x))
cands = {
 'sawtooth': [0.03,0.05,0.07, 0.06,0.08,0.10, 0.10,0.12, 0.15],
 'linear':   [0.03,0.045,0.06,0.075,0.09,0.105,0.12,0.135,0.15],
 'flat10':   [0.10]*8+[0.10],
}
skills = {'first-timer':-1.6,'novice':-1.0,'median':0.0,'expert':+1.0,'MCTS ref':+1.8}
for name, ps in cands.items():
    print(name, ' '.join(f"{p*100:.0f}" for p in ps))
    for beta in (1.0,):
        for sk, s in skills.items():
            surv = 1; per=[]
            for p in ps:
                q = sig(logit(p) - beta*s); per.append(q); surv *= (1-q)
            # reach probabilities per floor
            print(f"   {sk:11s} beta={beta}: clear={surv*100:5.1f}%  per-dept: " + ' '.join(f"{q*100:4.1f}" for q in per))
# where do median deaths happen (sawtooth)
ps = cands['sawtooth']; alive=1; share=[]
for p in ps:
    share.append(alive*p); alive*=1-p
tot=sum(share)
print('death location share (median, sawtooth):', ' '.join(f"{s/tot*100:.0f}" for s in share), ' floor1', round(sum(share[:3])/tot*100), 'floor2', round(sum(share[3:6])/tot*100),'floor3', round(sum(share[6:8])/tot*100),'exit',round(share[8]/tot*100))
# heat: each heat point multiplies odds of death by k per department
for k in (1.08,1.10,1.12):
    for h in (0,4,8,12,16,20):
        surv=1
        for p in ps:
            q = sig(logit(p)+h*math.log(k)); surv*=1-q
        print(f"heat odds x{k}/pt h={h:2d}: median clear {surv*100:5.1f}%", end='; ')
        surv=1
        for p in ps:
            q = sig(logit(p)+h*math.log(k)-1.0); surv*=1-q
        print(f"expert {surv*100:5.1f}%")
