dept_turns=600; run_turns=8*600+400
expert_mult=3.0
for ms in (1.0,0.3):
    s_dept=dept_turns*ms/1000; s_run=run_turns*ms/1000
    # calibration sweep: 6 personas (median skill) x 5 b-values x 3 depths x 120 seeds
    sweep=6*5*3*120; sweep_s=sweep*s_dept
    # verification: 6 personas x 3 skills x 3 depths x 200 seeds; experts cost x3
    ver=6*3*3*200; ver_s=(ver*2/3)*s_dept+(ver/3)*s_dept*expert_mult
    # limited-agent intro check: 2 variants x 3 depths x 200 seeds on the Intro only (~80 turns)
    intro=2*3*200; intro_s=intro*80*ms/1000
    per_dept=(sweep_s+ver_s+intro_s)/3600
    nightly=6*3*300; nightly_s=(nightly*2/3)*s_run+(nightly/3)*s_run*expert_mult
    print(f"{ms} ms/turn: dept play {s_dept:.2f}s, run {s_run:.1f}s | sweep {sweep} plays {sweep_s/3600:.1f} CPU-h, verify {ver} plays {ver_s/3600:.1f} CPU-h, intro {intro_s/3600:.2f} CPU-h -> {per_dept:.1f} CPU-h/dept; 30 depts {30*per_dept:.0f} CPU-h = {30*per_dept/4:.0f} h on 4 cores, {30*per_dept/32:.1f} h on 32 | nightly {nightly} runs {nightly_s/3600:.1f} CPU-h = {nightly_s/3600/4:.1f} h on 4 cores")
