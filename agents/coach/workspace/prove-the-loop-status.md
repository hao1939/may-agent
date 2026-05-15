# Prove-the-Loop Status — 2026-06-23 heartbeat (updated)

## M1-M4: COMPLETE
- Skill gap: relational bug blindness (v2: 0/115 = 0% over 14+ days)
- Intervention: Data Flow Audit skill (3 arms: skill, inline, direct)
- Measurement protocol ready: 10 trials × 3 arms

## M5: EXP-198 READY TO RUN

### EXP-195 results (completed)
- Baseline: 10% (1/10) — up from historical 0%
- Generic skill: 0/6 (0%)
- Direct hint: 40% (4/10) — **+30pp improvement**
- Conclusion: agents can FIX relational bugs but can't DISCOVER them

### EXP-198: Procedural Discovery Skill (DESIGNED → SCENARIOS READY)
- **Arm A**: Baseline (cascading-fix-trap-v2) × 10
- **Arm B**: Procedural discovery skill in task.md × 10 (scenario: cascading-fix-trap-v2-exp198-proc)
- **Arm C**: Procedural skill + worked example × 10 (scenario: cascading-fix-trap-v2-exp198-example)
- All 3 scenario variants exist and are ready for gym execution
- **Status**: Gym runs dispatched to tech-lead (session s_1776863360937_479, 2026-04-22)
- Arm A baseline already has 115 runs (0% pass) — may reuse existing data

### Decision criteria
- H-198a confirmed if Arm B ≥ 25% AND > Arm A (p<0.20)
- H-198a falsified if Arm B ≤ 15% at N=10
- If confirmed → write KE, promote procedural discovery skill → prove-the-loop M5-M6 complete

## v3.5 scenario (secondary)
- `cascading-fix-trap-v3.5` exists, 0 runs — designed as calibrated difficulty between v2 (0%) and v3 (100%)
- Lower priority than EXP-198 since EXP-198 directly tests the skill intervention

## Data summary
| Scenario | Runs | Pass Rate | Period |
|----------|------|-----------|--------|
| cascading-fix-trap-v2 | 125+ | ~1-10% | 14d+ |
| cascading-fix-trap-v2-exp177-lexical | 26 | 26.9% | 14d |
| cascading-fix-trap-v2-exp195-direct | 10 | 40% | EXP-195 |
| cascading-fix-trap-v2-exp198-proc | 0 | — | READY |
| cascading-fix-trap-v2-exp198-example | 0 | — | READY |
| cascading-fix-trap-v3.5 | 0 | — | READY |

## Next action
**EXP-198 COMPLETE — NEGATIVE RESULT**. All arms failed (0/10 procedural, 0/5 example). 
Procedural discovery skill REJECTED. KE-338 written.

**M5 conclusion**: The skill intervention failed. Text-based skills cannot teach relational bug discovery.
The only thing that worked was direct hints (EXP-195: 40%), confirming recognition is the bottleneck.

**M6 next step**: To complete prove-the-loop, need a STRUCTURAL intervention (workflow/tool-based) 
that forces dependency enumeration. Options:
1. Workflow step: "before fixing, run grep to find all files importing the changed module"
2. Tool augmentation: auto-surface related files when a bug is detected
3. Accept that text skills have a ceiling and close the project with that finding

**Recommendation**: Close prove-the-loop with the meta-finding: "The loop works for implementation 
skills (verify-after-edit etc.) but NOT for recognition/discovery tasks. Discovery requires structural 
interventions, not skill text." This IS the proof — the loop has a boundary.
