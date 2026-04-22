# Prove-the-Loop Status — 2026-05-04 heartbeat

## M1-M4: COMPLETE
- Skill gap: relational bug blindness (v2: 0/115 = 0% over 14+ days)
- Intervention: Data Flow Audit skill (3 arms: skill, inline, direct)
- Measurement protocol ready: 10 trials × 3 arms

## M5-M6: BLOCKED → PARTIAL UNBLOCK

### New: cascading-fix-trap-v3.5 created
- **v2**: 0% baseline (too hard — `adjusted_pct` indirection completely hides the bug)
- **v3**: 100% baseline (too easy — no indirection, 5 test failures point directly at penalties)
- **v3.5**: calibrated middle ground — penalties produce `adjusted_pct`, homework reads stale `pct`
  - Agent must trace data flow: penalties → homework (field mismatch)
  - Fixing data flow reveals cascading `>` vs `>=` threshold bug in grades.js
  - 5 test failures initially, 4 more after partial fix = requires two-stage debugging
  - Target baseline: 20-40%

### Execution plan
1. **Baseline**: Run v3.5 bare × 10 — expect 20-40% pass rate
2. **Treatment**: Run v3.5 + Data Flow Audit skill × 10 — expect ≥50% 
3. **Comparison**: If treatment - baseline ≥ 20pp, promote skill

### EXP-195 (v2 arms) still ready
- 3 scenario variants exist: `cascading-fix-trap-v2-exp195-{skill,inline,direct}`
- Still worth running alongside v3.5 for completeness

### What's needed
- Gym batch execution on k3s for both v3.5 and v2-exp195 scenarios
- Create v3.5 treatment scenario variants (v3.5-skill, v3.5-inline)

## Data summary
| Scenario | Runs | Pass Rate | Period |
|----------|------|-----------|--------|
| cascading-fix-trap-v2 | 115 | 0% | 14d+ |
| cascading-fix-trap-v2-exp177-placebo | 10 | 0% | 14d |
| cascading-fix-trap-v2-exp177-lexical | 26 | 26.9% | 14d |
| cascading-fix-trap-v2-exp177-paraphrase | 10 | 20% | 14d |
| cascading-fix-trap-v3 | 5 | 100% | 12d ago |
| cascading-fix-trap-v3.5 | 0 | — | NEW |
| cascading-fix-trap-v2-exp195-skill | 0 | — | never |
| cascading-fix-trap-v2-exp195-inline | 0 | — | never |
| cascading-fix-trap-v2-exp195-direct | 0 | — | never |
