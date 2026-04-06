# EXP-041: Skill Ablation Study on wrong-fix-recovery

**Date**: 2026-04-06
**Author**: Coach
**Status**: COMPLETED
**Tags**: ablation, skills, ceiling-shift, gym, causal-attribution

## Question

Which specific deployed skill(s) caused the wrong-fix-recovery improvement from 2/6 (EXP-025, Apr 4) to 6/6 (EXP-040, Apr 6)?

## Background

EXP-040 found that wrong-fix-recovery improved by +4 checks (33%→100%) since EXP-025. The analysis attributed this to "Structured Plan Writing" and "Evidence First" with **medium confidence**. This ablation study tests that causal claim by removing one skill at a time and measuring the effect.

### Five Deployed Skills
1. **Efficient File Reading** — targeted reads, grep before read
2. **Experience Replay** — check error logs before repeating mistakes
3. **Know When Blocked** — honest finish() status
4. **Structured Plan Writing** — decompose/order/risk/checkpoint before acting
5. **Verify After Edit** — read-back after every write

### Method

Created lab forks where each skill file is replaced with an empty file (which the `loadFile` function skips, since `.trim()` → `""` → `undefined` → not included in system prompt). Ran wrong-fix-recovery with each fork.

**Ablation mechanism verified**: 
- `cpSync()` overlays fork files onto existing agent directory (merge, not replace)
- Empty `.md` files in `skills/` are skipped by the prompt builder
- Created forks: `coder-no-{skill}` for each skill, plus `coder-no-skills` (all skills empty)

### Infrastructure Fix Required

Before running, discovered the gym was producing ~180ms "timeout" results with no actual LLM call. Root cause: the compiled binary symlink was stale. Fixed by rebuilding with `bun run bundle`. Verified with a baseline run (6/6, 47.5s).

## Results

### Individual Ablations

| Run | Condition | Score | Duration | Status |
|-----|-----------|-------|----------|--------|
| Baseline | All skills | 6/6 | 47.5s | success |
| Ablation 1 | No structured-plan-writing | 6/6 | 49.3s | success |
| Ablation 2 | No verify-after-edit | 6/6 | 52.8s | success |
| Ablation 3 | No efficient-file-reading | 6/6 | 48.9s | success |
| Ablation 4 | No know-when-blocked | 6/6 | 46.2s | success |
| Ablation 5 | No experience-replay | 6/6 | 49.1s | success |
| **Ablation 6** | **No skills at all** | **6/6** | **68.0s** | **success** |

### Key Finding: **NO SKILL IS CAUSAL**

Every ablation scored 6/6, including the complete removal of ALL skills. The wrong-fix-recovery improvement from 2/6 to 6/6 is **not caused by any of the 5 deployed skills**.

## Analysis

### What Changed Between EXP-025 (Apr 4) and Now (Apr 6)?

Since skills are not the cause, the improvement must come from one or more of:

1. **Framework/binary changes** — The binary was rebuilt multiple times between Apr 4 and Apr 6. The current binary (d8e642a) is different from whatever was used for EXP-025. Framework changes in `src/` could affect prompt construction, tool behavior, session management, etc.

2. **Common-sense rules** — `agents/shared/common-sense.md` was last modified Apr 6 19:32. It includes "Evidence first" and "Claim then act" — these are in the system prompt for ALL runs (baseline and ablation). Since they're not in `skills/`, they weren't ablated. However, the no-skills run (Ablation 6) showed the prompt was only 1434 chars with NO common-sense content visible in the user message, suggesting common-sense is injected via the system prompt separately.

3. **LiteLLM routing changes** — The model proxy may route `claude-opus-4.6` differently now than on Apr 4.

4. **Model version changes** — Anthropic may have updated the opus model between Apr 4 and Apr 6.

5. **Non-determinism** — The original 2/6 baseline may have been an unlucky run. Without multiple EXP-025 runs on wrong-fix-recovery, we can't distinguish "true 33% baseline" from "bad luck on one run."

### EXP-040's Causal Claims Were Wrong

EXP-040 stated (medium confidence):
> "wrong-fix-recovery (2/6→6/6): Likely driven by **Structured Plan Writing** and **Evidence First**"

This ablation study **falsifies** that claim. Structured Plan Writing has zero effect (Ablation 1: 6/6). Even removing ALL skills has zero effect (Ablation 6: 6/6).

### Implications for KE-027

KE-027 ("Deployed Skills Produce Compound Ceiling Shifts") was based on EXP-040's before/after comparison. This ablation study challenges KE-027's causal mechanism. The ceiling shifts may be real, but they are NOT caused by skills. The actual cause is likely framework changes, model changes, or measurement noise.

**KE-027 status should be downgraded from "verified (strongly)" to "unverified — confounded by framework/model changes".**

## Methodological Lessons

1. **Before/after comparisons without controls are unreliable.** EXP-040 compared Apr 4 baselines to Apr 6 results, but many variables changed (framework, model, common-sense rules). Without holding these constant, skill attribution was impossible.

2. **Ablation is the gold standard for causal claims.** Only by removing the hypothesized cause and observing no change can we rule it out.

3. **Infrastructure changes are a major confounder.** The binary was rebuilt multiple times, and common-sense rules were edited. These background changes swamped any skill effects.

4. **Single-run baselines are fragile.** The EXP-025 "2/6" baseline may have been a single unlucky run. Multiple runs are needed for reliable baselines.

## Confidence

- **Very high** confidence that no individual skill is causal (5 independent ablations, all 6/6)
- **Very high** confidence that skills collectively are not causal (complete ablation, 6/6)
- **Medium** confidence in alternative explanations (framework/model changes are likely but not proven)

## Recommendations

1. **Downgrade KE-027** from "verified" to "hypothesis — confounded"
2. **Future experiments must control for framework changes.** Use the same binary (pinned SHA) for baseline and treatment runs.
3. **Run multiple baseline trials.** A single 2/6 score could be noise. 3+ runs establish reliable baselines.
4. **Test skills on scenarios where they are theoretically necessary.** wrong-fix-recovery tests bug diagnosis — none of the 5 skills directly address diagnosis strategy.
5. **Re-run EXP-040 style comparison with same binary.** To isolate whether the improvement is from framework or from common-sense rules, freeze the binary and ablate common-sense.
