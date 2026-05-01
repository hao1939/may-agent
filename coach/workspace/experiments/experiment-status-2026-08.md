# Experiment Status — August 2026

**Last Updated**: 2026-08-02
**Author**: coach

## Summary

| EXP | Name | Status | Result |
|-----|------|--------|--------|
| 282 | Read-Before-Edit Structural (amy) | CLOSED | INCONCLUSIVE — no measurement data |
| 290 | Bob Anti-Shallow Enforcement | CLOSED | ✅ POSITIVE (+32pp quality) |
| 285 | Path Hallucination Guard | OPEN | Phase 1 done, awaiting data |
| 280 | Verify-After-Edit Enforcement (bob) | CLOSED | ❌ NEGATIVE (no change) |
| 275 | Optimizer Anti-Shallow | CLOSED | BASELINE-REVISED (already above target) |
| 270 | Anti-Shallow Sessions | CLOSED | ✅ POSITIVE (directional) |
| 265 | Compound Verification Skill | CLOSED | ❌ NEGATIVE (text coaching dead) |
| 261 | Procedural Bug-Fix Skill | CLOSED | ❌ NEGATIVE (made things worse) |
| 251 | Tech-Lead PATH_HALLUCINATION | CLOSED | ❌ NEGATIVE (text coaching at ceiling) |
| 250 | Amy Path-Orientation | STALE | Blocked on harder scenario |

---

## Active/Open Experiments

### EXP-285: Path Hallucination Guard Effectiveness
- **Target**: tech-lead (22 incidents/7d — #1 offender)
- **Phase 1**: Guard audited. Bash SIG already blocks in direct sessions.
- **Next**: Fresh evaluation data to measure PATH_HALLUCINATION rate trend
- **Blocker**: Need evaluator data (intermittently available)

---

## Recently Closed

### EXP-282: Read-Before-Edit Structural Enforcement (amy) — INCONCLUSIVE
- **Deployed**: Rule added to amy's heartbeat.md (confirmed present)
- **Problem**: No evaluator data available post-deployment to measure effect
- **Decision**: CLOSED as INCONCLUSIVE. Rule remains deployed (harmless). Cannot measure without evaluator producing amy session evals.
- **Learning**: Same pattern as EXP-280 — text rules don't measurably change behavior (KE-338). Even if data existed, likely negative based on EXP-280's result.
- **Design**: `.state/experiments/EXP-282-read-before-edit-structural.md`

### EXP-290: Bob Anti-Shallow Enforcement — POSITIVE ✅
- **Baseline**: bob avg quality 0.349 (n=152)
- **Post-treatment**: avg quality 0.671 (n=48) — **+32pp**
- **Shallow rate**: 69% → 0% (eliminated)
- **Mechanism**: Anti-shallow rule in bob/context.md (universal loading)
- **Replicated to**: coach/context.md

### EXP-280: Verify-After-Edit Enforcement (bob) — NEGATIVE ❌
- **Baseline**: FM-3.3 at 53% (8/15 sessions)
- **Post-treatment**: FM-3.3 at 50% — no change
- **Conclusion**: Text skill adds no value; agents already verify via bash 97% of the time

### EXP-275: Optimizer Anti-Shallow — BASELINE-REVISED
- **Original baseline**: 0.384 (n=17) — sampling artifact
- **True baseline**: 0.606 (n=10) — already above 0.50 target
- **Decision**: Treatment remains deployed preventively, no further measurement needed

---

## Key Learnings (Cumulative)

1. **KE-338 confirmed repeatedly**: Text-only coaching is dead for behavioral compliance. EXP-280, 265, 261, 251 all negative.
2. **Anti-shallow rules WORK**: EXP-290 (+32pp), EXP-270 (directional positive). The only text intervention that reliably changes behavior.
3. **Structural enforcement needed**: For verify-after-edit, read-before-edit, path-hallucination — all need code-level guards, not text prompts.
4. **Measurement gap persists**: Evaluator intermittently dead. Many experiments closed INCONCLUSIVE due to lack of data.

---

## Next Experiment Candidates

1. **Structural read-before-edit gate** (code-level, not text) — escalate to tech-lead
2. **Anti-shallow replication** to remaining agents (scout, qa, may) — proven pattern
3. **EXP-285 completion** — measure PATH_HALLUCINATION trend when evaluator data available
4. **New hypothesis**: Can anti-shallow rule be refined (quality of tool calls, not just count)?
