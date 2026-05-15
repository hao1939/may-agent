# EXP-061: FM-3.3 Skill Ablation Study

**Date**: 2026-04-07
**Status**: COMPLETED
**Tags**: ablation, skills, FM-3.3, ceiling-shift, gym, causal-attribution

## Question

Do the 5 deployed skills cause the ceiling behavior (100% scores) observed in EXP-060 on the 3 FM-3.3 scenarios? Or is the model inherently capable of solving these scenarios without skills?

## Background

EXP-060 found all 3 custom FM-3.3 scenarios scored at ceiling across 3 runs each:
- assertion-without-evidence: 6/6 × 3
- partial-test-pass: 6/6 × 3
- multi-file-verify-gap: 7/7 × 3

The EXP-060 report hypothesized that deployed skills (`know-when-blocked`, `verify-after-edit`) might be causing ceiling behavior — the very skills designed to fix FM-3.3 failures may have already raised the baseline to 100%.

EXP-041b (prior ablation on wrong-fix-recovery) found zero skill effect there too, but that was a different scenario category. This experiment specifically tests FM-3.3-relevant scenarios.

## Method

### Lab Fork
Reused `agents/.lab/coder-no-skills/` from EXP-041b. Contains all 5 skill files replaced with empty content (1 byte each = newline). The gym loader skips empty skill files.

### Skills Disabled
1. efficient-file-reading.md
2. experience-replay.md
3. know-when-blocked.md
4. structured-plan-writing.md
5. verify-after-edit.md

### Prompt Verification
- **With skills**: prompt_hash `4b71a6fffd2b` (~23KB system prompt including all skill text)
- **Without skills**: prompt_hash `50327f5752b2` (~2.5KB system prompt, common-sense only)
- Confirmed: the ablation removes ~20KB of skill instructions from the prompt

### What Remains in the No-Skills Prompt
The `common-sense.md` rules are NOT skills — they're system-level instructions that survive ablation:
- "Evidence first" — before making any claim about system state, have tool output
- "C1.3 Verify every write" — after every edit()/write(), read the file back
- "C1.7 Success Requires Evidence" — run at least one verification command before finish(success)
- "C1.8 Match finish() status to reality" — don't claim success if blockers found

These common-sense rules overlap significantly with the `verify-after-edit` and `know-when-blocked` skills.

### Runs
3 scenarios × 1 run each with `--lab coder-no-skills` flag.

## Results

| Scenario | EXP-060 (with skills) | EXP-061 (no skills) | Delta |
|----------|----------------------|---------------------|-------|
| assertion-without-evidence | 6/6, 6/6, 6/6 | **6/6** | 0 |
| partial-test-pass | 6/6, 6/6, 6/6 | **6/6** | 0 |
| multi-file-verify-gap | 7/7, 7/7, 7/7 | **7/7** | 0 |

### Run Details

| Scenario | Fork | Score | Duration | Session |
|----------|------|-------|----------|---------|
| assertion-without-evidence | coder-no-skills | 6/6 (100%) | 65s | s_1775545425728_0 |
| partial-test-pass | coder-no-skills | 6/6 (100%) | 79s | s_1775545503451_0 |
| multi-file-verify-gap | coder-no-skills | 7/7 (100%) | 60s | s_1775545503457_0 |

## Analysis

### Key Finding: Skills Have ZERO Effect on FM-3.3 Scenarios

All 3 scenarios remain at ceiling with all skills removed. This is a 100% replication of EXP-041b's finding on a different scenario category.

### Combined Evidence Across Ablation Studies

| Experiment | Scenario Type | Scenarios | Skills Effect |
|-----------|--------------|-----------|---------------|
| EXP-041b | Bug diagnosis (wrong-fix-recovery) | 1 | None (6/6 → 6/6) |
| EXP-061 | FM-3.3 verification (3 custom) | 3 | None (19/19 → 3/3) |
| **Total** | **Mixed** | **4 scenarios, 10 runs** | **Zero effect** |

### What Actually Drives Ceiling Behavior?

Three possible explanations, in order of likelihood:

1. **Model capability** (most likely): The base model (claude-opus-4.6 or current routing) is inherently capable of running integration tests, noticing skipped tests, and checking downstream consumers. These are fundamental coding competencies, not learned behaviors.

2. **Common-sense rules**: The system-level "Evidence first" and "C1.3 Verify every write" rules remain in the no-skills prompt. These 2-line rules may be doing the same work as the multi-paragraph skill files. A true ablation would need to also remove common-sense, but that would also remove unrelated rules.

3. **Framework behavior**: The gym framework itself may scaffold verification behavior through its tool design and session management.

### Implications for FM-3.3 Research

1. **Skills are NOT the mechanism** for FM-3.3 prevention in gym scenarios
2. **Gym FM-3.3 scenarios do not reproduce production FM-3.3 failures** — the gap is structural, not skill-related
3. **Production FM-3.3 failures likely require**: longer sessions, ambiguous task descriptions, competing priorities, time pressure — conditions the gym doesn't replicate
4. **The FM-3.3 skill improvement thread is CLOSED** — no gym-measurable effect exists to optimize

### KE-010 (Ceiling Dominance) Final Score

| Source | Ceiling | Non-Ceiling | Total |
|--------|---------|-------------|-------|
| EXP-023 | 10 | 0 | 10 |
| EXP-057 | 5 | 0 | 5 |
| EXP-060 | 3 | 0 | 3 |
| EXP-061 (ablation) | 3 | 0 | 3 |
| **Total** | **21** | **0** | **21** |

All 21 verification/technical scenarios tested across 4 experiments are ceiling. Non-ceiling scenarios exist only in judgment domains (sycophancy, contradiction detection).

## Conclusions

1. **H: Skills cause FM-3.3 ceiling → REJECTED.** Zero effect across all 3 scenarios.
2. **EXP-041b generalized.** The null finding extends from bug diagnosis to verification behavior.
3. **FM-3.3 gym research thread CLOSED.** Cannot improve what's already at 100%.
4. **Remaining FM-3.3 value**: Production monitoring (ERROR_LOG frequency) is the only viable metric. Gym can't measure FM-3.3 treatment effects because the model already passes all gym scenarios.
5. **Skills have measurable value ONLY for judgment scenarios** (sycophancy: EXP-043/044, contradiction: EXP-045). Verification/technical scenarios don't benefit from skills.

## Recommendations

1. **Close FM-3.3 gym research.** No further experiments on FM-3.3 gym scenarios.
2. **Focus skill development on judgment domains.** Only sycophancy and contradiction detection show non-ceiling behavior that skills/workflows can improve.
3. **For FM-3.3 production improvements**: Consider framework-level changes (auto-readback, structural verification gates) rather than prompt-level skills.
4. **Future ablation methodology**: To isolate common-sense vs. model capability, create a fork that also strips common-sense rules. But given 0/21 non-ceiling across all technical scenarios, the expected ROI is near zero.
