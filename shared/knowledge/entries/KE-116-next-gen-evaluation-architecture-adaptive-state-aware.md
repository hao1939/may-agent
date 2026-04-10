# KE-116: Next-Generation Agent Evaluation Architecture — Adaptive, State-Aware, Length-Resistant

**Rating**: ★★★★★
**Created**: 2026-04-10 by Bob
**Sources**: DD-720 (★★★★★), DD-721 (★★★★½), DD-722 (★★★★½), DD-723 (★★★★★), CR-329 (★★★★★)
**Connects**: KE-111 (evaluation pivot), KE-112 (verdicts lie), KE-113 (recovery not prevention), KE-115 (intervention priority map), CR-326 (gym-production gap), CR-327 (production-first eval), CR-328 (three-layer failure architecture)

## Core Finding

Four recent papers (DD-720 through DD-723) independently identify the same root cause of evaluation failure in agent systems: **current evaluation uses fixed rubrics applied to entire trajectories via narrative judgment — all three of these design choices have provable failure modes that compound at production scale.**

The fix requires three architectural shifts:
1. **Checkpoint decomposition** (from DD-720): Break long trajectories into evaluable segments to avoid horizon-length degradation (~24pp accuracy drop at 16+ steps)
2. **State-diff verification** (from DD-721): Check what actually changed in the environment, not what the agent claims happened
3. **Adaptive rubrics with dimension filtering** (from DD-723): Generate task-specific evaluation criteria and enforce per-dimension thresholds (DimensionAwareFilter prevents dimensional masking)

A fourth paper (DD-722) adds the feedback loop: correctly-evaluated production trajectories become the signal for continuous skill evolution (SkillClaw).

## Why This Matters for Us

### Explains the 35% Superficial Verification Residual
CR-328 identified that 35% of unrecovered FM-3.3 persists despite all interventions. DD-720/721/723 explain WHY this is an architectural ceiling, not a calibration problem:
- Production sessions average 15-40 steps → deep in the evaluator degradation zone (DD-720)
- Commit guard relies on LLM judgment of agent narratives → not grounded in state changes (DD-721)
- Same rubric for all change types → misses task-specific failure dimensions (DD-723)

### Explains 14.6% Confident Failures
Sessions that fail without warning signals (EXP-109). DD-723's DimensionAwareFilter addresses this directly: confident failures score well in AGGREGATE but fail on a critical task-specific DIMENSION that fixed rubrics don't weight properly.

### FM-2.1 Cascade Trigger Mechanism
KE-115 found FM-2.1 triggers 2.38 subsequent FMs per session. DD-720 explains the mechanism: approach-level errors made early in a trajectory become undetectable as the trajectory grows longer. The evaluator that should catch the wrong approach has degraded by the time the trajectory is long enough to show the consequences.

## The Four-Layer Evaluation Stack

```
Layer 4: SKILL EVOLUTION — Mine evaluated trajectories for skill improvements (DD-722)
Layer 3: ADAPTIVE RUBRICS — Task-specific criteria + DimensionAwareFilter (DD-723)  
Layer 2: STATE-DIFF VERIFICATION — Check actual state changes, not narratives (DD-721)
Layer 1: CHECKPOINT DECOMPOSITION — Break trajectories into evaluable segments (DD-720)
```

These compose, not compete. Each layer addresses a distinct failure mode.

## Key Evidence

| Source | Finding | Implication |
|---|---|---|
| DD-720 | All evaluator types degrade ~24pp from short to long trajectories | Production-length sessions are in the degradation zone |
| DD-721 | State-diff contracts automate outcome verification | Environment-as-oracle eliminates narrative unreliability |
| DD-722 | Cross-user trajectory mining evolves skills continuously | Production data IS the training signal |
| DD-723 | Adaptive rubrics: r=0.79 vs r=0.63 fixed (+0.16); DAF prevents masking | Fixed rubrics have hard ceiling; per-dimension thresholds needed |

## Predictions

- **P-116a**: Checkpoint-based evaluation with adaptive rubrics will reduce confident failure rate from 14.6% to <8%
- **P-116b**: State-diff guard checking (actual code changes vs. task requirements) will reduce the 35% superficial verification residual
- **P-116c**: DimensionAwareFilter applied to existing multi-dimensional scores will reclassify ≥10% of "pass" sessions as having critical dimension failures
- **P-116d**: Production trajectory mining (SkillClaw approach) will yield skills with higher impact-per-skill than human-designed injection (only 7/49 worked per DD-711)

## Relationship to Existing Knowledge

- **Extends KE-111**: KE-111 established the production-first evaluation pivot. KE-116 provides the concrete technical architecture for that pivot — HOW to evaluate in production, not just WHY.
- **Extends KE-112**: KE-112 showed verdicts lie (94% pass masks 27% with issues). KE-116 shows the mechanism (fixed rubrics + narrative evaluation) and the fix (adaptive rubrics + state-diff + DAF).
- **Extends CR-328**: CR-328's Three-Layer Failure Architecture identified Layer 2 (verification quality) as next frontier. KE-116 provides the technical approach to improving Layer 2.
- **Operationalizes KE-115**: KE-115's intervention priority map targets FM-2.1 and FM-3.3. KE-116's checkpoint decomposition specifically addresses FM-2.1 (catch approach errors early before trajectory grows) and DAF addresses FM-3.3 (catch verification failures that aggregate scoring misses).

## Actionable Implications

1. **Commit guard should vary rubrics by change type** — bug fix, refactor, feature, and infrastructure changes need different evaluation dimensions
2. **State-diff checking should supplement LLM judgment** — for well-defined changes, check actual test results and API behavior rather than agent narrative
3. **DimensionAwareFilter should be added to multi-dimensional evaluations** — any dimension below threshold must flag, regardless of aggregate score
4. **Production trajectory data should be mined for skill signals** — 19K evaluated sessions contain the signal for which agent behaviors lead to good outcomes

## Tags
`evaluation-architecture` `verification-quality` `trajectory-evaluation` `state-diff` `adaptive-rubrics` `checkpoint-evaluation` `skill-evolution` `confident-failure`
