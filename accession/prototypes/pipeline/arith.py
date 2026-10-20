import math
print("DUD: 1-(1-p)^n")
for p in [0.005,0.01,0.02,0.05,0.10,0.20,0.34]:
    print(p, [round(1-(1-p)**n,3) for n in (1,3,8,10)])
print()
print("Max p for target run-level dud rate, n=8")
for target in [0.02,0.05,0.10,0.20]:
    p = 1-(1-target)**(1/8)
    print(target, round(p,4))
print()
print("RECURRENCE seen N(1-(1-n/N)^R), n=8")
for N in [12,20,30,60,100,150,300]:
    row=[]
    for R in [1,5,10,20,50]:
        row.append(round(N*(1-(1-8/N)**R),1))
    print(N,row)
print()
print("NEW per run at run R+1: n(1-n/N)^R, n=8")
for N in [12,20,30,60,100,150,300]:
    print(N,[round(8*(1-8/N)**R,2) for R in [1,5,10,20,50]])
print()
print("visits per dept after R runs = nR/N")
for N in [30,60,100,150]:
    print(N,[round(8*R/N,1) for R in [10,20,50]])
print()
print("N needed for >=1 new dept per run at run R (n=8)")
for R in [5,10,20,50,100]:
    # 8(1-8/N)^R = 1 -> 1-8/N = (1/8)^(1/R)
    x=(1/8)**(1/R)
    print(R, round(8/(1-x)))
print()
# placard coverage: doors offered 2.5 per transition, 7 transitions + start? assume 20 placards per run distinct depts offered ~ 8 visited + 12 seen-not-visited.
print("Placards seen (distinct departments offered), m per run")
for N in [30,60,100]:
    for m in [16,20]:
        print(N,m,[round(N*(1-(1-m/N)**R),1) for R in [1,3,5,10]])
