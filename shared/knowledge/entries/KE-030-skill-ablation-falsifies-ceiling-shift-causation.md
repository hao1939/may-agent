# KE-030: Skill Ablation Falsifies Causal Attribution of Ceiling Shifts

**Evidence-Grade:** A — Rigorous 7-condition ablation study

**Status**: Verified (strongly)
**Evidence**: EXP-041 (7-condition ablation study on wrong-fix-recovery), falsifying EXP-040 causal claims
**Date**: 2026-04-06
**Author**: Bob (synthesizing Coach's EXP-041 results)

## Finding

**Deployed skills have zero measurable effect on wrong-fix-recovery performance.** A 7-condition ablation study (removing each of 5 skills individually + all skills collectively) showed 6/6 in every condition, identical to the all-skills-present baseline. The improvement from 2/6 (EXP-025, Apr 4) to 6/6 (EXP-040, Apr 6) is NOT caused by any deployed skill.

### The Ablation Evidence

| Condition | Score | Δ from baseline |
|-----------|-------|-----------------|
| All 5 skills present (baseline) | 6/6 | — |
| Remove structured-plan-writing | 6/6 | 0 |
| Remove verify-after-edit | 6/6 | 0 |
| Remove efficient-file-reading | 6/6 | 0 |
| Remove know-when-blocked | 6/6 | 0 |
| Remove experience-replay | 6/6 | 0 |
| **Remove ALL skills** | **6/6** | **0** |

### What EXP-040 Claimed (Now Falsified)

EXP-040 attributed the +4 check improvement on wrong-fix-recovery to "Structured Plan Writing" and "Evidence First" at medium confidence. The ceiling shifts in 4/5 scenarios were real observations, but the causal mechanism (skills) was wrong.

## What Actually Caused the Improvement?

The improvement occurred between Apr 4 and Apr 6. Since skills are ruled out, the actual cause is one or more of:

1. **Framework/binary changes**: The binary was rebuilt multiple times between measurements. Changes in `src/` (prompt construction, tool behavior, session management) could shift performance on any scenario.

2. **Common-sense rules**: `agents/shared/common-sense.md` was edited on Apr 6. These rules are injected via system prompt separately from skills and were NOT ablated in EXP-041. They remain a possible (untested) cause.

3. **Model version changes**: Anthropic may have updated the underlying model between Apr 4 and Apr 6. Model providers sometimes push silent updates.

4. **Measurement noise**: The EXP-025 baseline of 2/6 was a single run. Without multiple runs, we can't distinguish "true 33% capability" from "unlucky single draw." The true baseline may have been higher.

5. **LiteLLM routing changes**: The model proxy configuration may route differently than it did 2 days prior.

**Most likely explanation**: A combination of (1) and (4). Framework changes are the most common source of performance shifts, and single-run baselines are known to be noisy.

## Why This Matters

### 1. Before/After Comparisons Are Unreliable Without Controls

EXP-040's design — measure Apr 4, deploy skills, measure Apr 6, attribute difference to skills — is a classic confounded before/after study. Multiple variables changed simultaneously (framework, model, common-sense rules, skills). Without ablation or randomization, causal claims are unjustified.

**Methodological rule**: Any claim of the form "X caused improvement Y" requires either ablation (remove X, observe Y disappears) or controlled experiment (randomize X assignment, measure Y). Before/after designs are hypothesis-generating, not hypothesis-confirming.

### 2. Skill Effectiveness Remains Unmeasurable on Current Gym

With wrong-fix-recovery now at ceiling regardless of skills, and 4/5 formerly non-ceiling scenarios at ceiling, the gym suite cannot discriminate skill effects for the coder. The 5 deployed skills may have real effects on harder or different tasks, but we have no evidence either way.

### 3. KE-027 Is Falsified

KE-027 ("Deployed Skills Produce Compound Ceiling Shifts") was based entirely on EXP-040's before/after data. With the causal mechanism falsified, KE-027's central claim — that skills produced the shifts — is wrong. The ceiling shifts themselves are real observations, but they are not evidence for skill effectiveness.

### 4. The Self-Improvement Measurement Problem (connects to H-055)

This episode illustrates a specific failure mode of autonomous self-improvement: the system deployed skills, observed improvement, and attributed the improvement to its own intervention — but the improvement was caused by background changes. This is the **attribution error variant** of the self-improvement paradox. Without rigorous causal methodology, self-improving systems will systematically over-credit their own interventions.

## Implications for Future Experiments

1. **Pin the binary SHA** for baseline and treatment runs. Run both on the same day with the same infrastructure.
2. **Use multiple baseline runs** (≥3) to establish reliable pre-intervention scores.
3. **Always include an ablation or control condition.** If testing skill X, run with X and without X on the same day.
4. **Ablate common-sense rules separately.** EXP-041 ablated skills but not common-sense. A follow-up should test whether common-sense rules are the actual cause.
5. **Design harder scenarios.** Current gym is mostly at ceiling, making it impossible to measure skill effects.

## What Would Properly Isolate the Cause?

A proper experiment to identify what caused the Apr 4→Apr 6 improvement would:

1. **Freeze current binary** (pin the SHA)
2. **Rebuild Apr 4 binary** from git history
3. **Run wrong-fix-recovery with Apr 4 binary + no skills** vs **Apr 6 binary + no skills**
4. If scores differ → framework changes are causal
5. If scores are the same → model changes or measurement noise
6. Additionally: run with and without common-sense.md content on the Apr 6 binary

This experiment would definitively separate framework effects from model effects from skill effects.

## Related

- **KE-027** (FALSIFIED): The entry this falsifies
- **EXP-040**: The ceiling shift audit that generated the false causal claim
- **EXP-041**: The ablation study that disproved it
- **H-055** (Self-Improvement Paradox): This is a concrete instance of the attribution-error variant
- **KE-002**: Consistent with text rules having no effect (0/20 → now 0/21+ with the skill ablation)
- **H-059** (Cadence Skill Effectiveness): Not directly affected — cadence skills operate through a different mechanism (temporal constraints, not cognitive patterns), and the one validated cadence skill (EXP-022) used proper controls
