# CR-329: Next-Generation Agent Evaluation Architecture — Adaptive, State-Aware, Length-Resistant

**Rating**: ★★★★★
**Sources**: DD-720 (Plan-RewardBench), DD-721 (Agent-Diff), DD-722 (SkillClaw), DD-723 (AdaRubric)
**Created**: 2026-04-10 by Bob
**Connects to**: CR-326 (gym-production gap), CR-327 (production-first evaluation), CR-328 (production-reality convergence), KE-111 (evaluation pivot), KE-112 (verdicts lie), KE-113 (recovery not prevention), KE-115 (intervention priority map)

## Executive Summary

Four recent papers (DD-720 through DD-723) converge on a single thesis: **current agent evaluation is fundamentally broken, and fixing it requires three architectural shifts** — from fixed to adaptive rubrics, from narrative to state-diff verification, and from whole-trajectory to checkpoint-based judgment. Together they explain WHY our production evaluation fails (35% superficial verification residual, 14.6% confident failures) and provide a concrete technical path forward.

## The Convergence

### Problem Triangle Identified

Each paper independently exposes one edge of the same problem triangle:

```
         EVALUATION FAILS
        /         |        \
  LENGTH          FIXED        NARRATIVE
  DEGRADATION     RUBRICS      OVER STATE
  (DD-720)        (DD-723)     (DD-721)
```

- **DD-720 (Plan-RewardBench)**: ALL evaluator types (generative RM, discriminative RM, LLM-as-Judge) degrade to near-random at production-relevant trajectory lengths (16+ steps). ~24pp accuracy drop from short to long horizons.
- **DD-723 (AdaRubric)**: Fixed rubrics systematically miss task-specific failure dimensions. r=0.79 human correlation with adaptive rubrics vs r=0.63 with best static baseline (+0.16). DimensionAwareFilter prevents high-scoring dimensions from masking dimension-level failures.
- **DD-721 (Agent-Diff)**: Evaluating agent NARRATIVES about what they did is unreliable. State-diff contracts — checking what ACTUALLY changed in the environment — are automatable and unjudgeable.
- **DD-722 (SkillClaw)**: Production trajectories contain the signal for skill evolution, but only if evaluation correctly identifies what works vs. what fails. SkillClaw's collective evolution depends on evaluation quality upstream.

### How They Compose: The Evaluation Stack

These are not competing approaches. They compose into a layered evaluation architecture:

```
Layer 4: SKILL EVOLUTION (DD-722 SkillClaw)
  ↑ Consumes evaluated trajectories to evolve skills
  |
Layer 3: ADAPTIVE RUBRIC GENERATION (DD-723 AdaRubric)
  ↑ Generates task-specific rubrics with DimensionAwareFilter
  |
Layer 2: STATE-DIFF VERIFICATION (DD-721 Agent-Diff)
  ↑ Checks what actually changed vs. what was expected
  |
Layer 1: CHECKPOINT DECOMPOSITION (DD-720 Plan-RewardBench insight)
  ↑ Breaks long trajectories into evaluable segments
  |
  └── Raw agent trajectory
```

**Layer 1** solves the horizon-length degradation by decomposing long trajectories into checkpoint-sized segments where evaluators still work. **Layer 2** grounds each checkpoint evaluation in observable state changes rather than agent narratives. **Layer 3** ensures each checkpoint is evaluated with task-appropriate criteria, and DAF prevents dimension masking. **Layer 4** feeds correctly-evaluated trajectories back into skill improvement.

## Mapping to Our Production Findings

### The 35% Superficial Verification Residual (CR-328)
CR-328 identified a 35% residual of unrecovered FM-3.3 that no external system has solved. The DD-720/721/723 triangle explains WHY:
- **Length degradation** (DD-720): Our production sessions average 15-40 steps — deep into the degradation zone
- **Fixed rubrics** (DD-723): Our commit guard uses the same criteria for all change types
- **Narrative evaluation** (DD-721): Our evaluation often relies on what the agent SAYS it verified rather than checking the actual state change

**Implication**: The 35% residual is not a calibration problem — it's an architectural ceiling of narrative-based, fixed-rubric, whole-trajectory evaluation.

### Confident Failures (EXP-109: 14.6%)
Sessions that fail without warning signals. DD-723's DimensionAwareFilter specifically addresses this:
- Confident failures score well on AGGREGATE (overall quality looks fine)
- But fail on one critical DIMENSION that fixed rubrics don't weight properly
- DAF forces per-dimension threshold checking: `PASS iff ∀d: score(d) ≥ threshold(d)`

### The Commit Guard as State-Diff System
DD-721's insight maps directly: our commit guard already does partial state-diff evaluation (checking actual code changes). But it evaluates diffs via LLM judgment (narrative layer) rather than automated state verification. The evolution path:
1. **Current**: Guard reads diff → LLM judges quality → approve/reject
2. **Improved**: Guard reads diff → extracts state changes → checks against task requirements → LLM judges only ambiguous cases

### FM-2.1 as Evaluation Gap
KE-115 identified FM-2.1 as the #1 cascade trigger (2.38 subsequent FMs per session). DD-720 explains the mechanism: when an agent takes a wrong approach early, the evaluation failure cascades because the EVALUATOR (internal or external) cannot detect approach-level errors in long trajectories. By the time the error is observable, it's embedded in a long enough trajectory that evaluators are in the degradation zone.

## Synthesis Predictions

### P-329a: Checkpoint-Based Evaluation Reduces Confident Failures
Breaking trajectories into checkpoint-evaluated segments (DD-720 insight) with task-adaptive rubrics (DD-723) will reduce the 14.6% confident failure rate by catching dimension-level failures early. **Testable**: Apply checkpoint evaluation to EXP-109 data retrospectively — would checkpoints at each tool call have detected the silent failures?

### P-329b: State-Diff Guard Outperforms Narrative Guard
Replacing LLM-judgment of diffs with automated state-diff checking (DD-721) for well-defined change types will reduce the 35% superficial verification residual. **Testable**: Compare guard decisions on a held-out set when using (a) LLM judgment vs. (b) automated diff analysis against task requirements.

### P-329c: DimensionAwareFilter Catches FM-3.3 that Aggregates Miss
Applying DAF to multi-dimensional quality scores will identify sessions currently scored as "acceptable" that fail on a critical dimension. **Testable**: Re-score EXP-109 sessions with per-dimension thresholds and check how many "pass" sessions would be caught.

### P-329d: Production Trajectory Mining Will Yield Better Skills Than Design
SkillClaw's approach (DD-722) — mining production trajectories for skill evolution — will produce higher-impact skills than human-designed injection (cf. DD-711: only 7/49 skills help). **Testable**: Compare skill improvements from trajectory-mined updates vs. human-authored skills on the same capability dimensions.

## Actionable Next Steps

### Immediate (This Sprint)
1. **Audit commit guard for narrative-vs-state evaluation**: Classify what percentage of guard checks are "agent says X" vs. "code actually shows X"
2. **Prototype DAF for multi-dimensional evals**: Apply DimensionAwareFilter logic to existing EXP-109 data

### Medium-Term (Next 2-4 Weeks)
3. **Checkpoint decomposition experiment**: Design an experiment that applies checkpoint-based evaluation to production session replays
4. **Task-adaptive rubric pilot**: For 3 common change types (bug fix, refactor, feature), generate distinct evaluation rubrics and compare to fixed rubric

### Long-Term (Research Direction)
5. **State-diff evaluation for code changes**: Build automated verification of expected state changes (test results, API behavior) rather than LLM-judged diffs
6. **Trajectory mining for skill evolution**: Apply SkillClaw-style analysis to commit guard data to discover production-effective skill updates

## Tags
`evaluation-architecture` `trajectory-evaluation` `state-diff` `adaptive-rubrics` `checkpoint-evaluation` `skill-evolution` `production-evaluation` `synthesis`
