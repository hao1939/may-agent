# H-179: Self-Generated Lesson Replay vs Curated Few-Shot — Task-Type Moderates Which Wins

**Created**: 2025-04-21 by orchestrator
**Status**: proposed
**Confidence**: ★★★☆ (P(H) ≈ 0.65)
**Source**: KE-330 (task-typed lesson replay), DD-831 (Reflexion), KE-334 (learn-in-production)
**Connects**: H-091 (curated few-shot 100%), H-165 (self-production harms hard tasks), H-043 (push > pull), EXP-166

---

## Claim

Task-typed replay of an agent's own past failure lessons (as proposed in KE-330/Reflexion) will **underperform** curated few-shot examples on **judgment tasks** due to quality gap, but may **match or outperform** on **execution tasks** where procedural memory matters more than insight quality.

The key asymmetry: judgment tasks require *correct mental models* (hard to self-generate after failure — H-165 shows self-analysis actively harms hard tasks). Execution tasks require *procedural checklists* (easy to self-generate — "I forgot to run tests first" is both accurate and reusable).

## Mechanism

Reflexion's verbal RL works because it's **iterative retry on the SAME task** — the agent refines its approach with immediate feedback. KE-330 proposes **cross-session replay on SIMILAR tasks** — fundamentally different because:

1. **Quality gap**: Self-generated lessons after failure are often vague ("I should have been more careful") or wrong (H-165: cognitive displacement, EXP-166 showed 100%→7% when self-analysis added on hard tasks). Curated few-shot examples encode *correct* reasoning by design.
2. **Task-type moderator**: Judgment tasks (sycophancy resistance, credential evaluation) need the agent to adopt a specific *stance* — self-lessons rarely capture this. Execution tasks (reproduce-first debugging, knowing when to escalate) need *procedural steps* — self-lessons capture these well because the failure mode is forgettable but not complex.
3. **Push vs pull**: H-043 shows P(access)≈0 for pull-based knowledge. Lesson replay is push (injected at task start), solving the access problem. But pushed *bad* lessons may be worse than no lessons (extends H-165).

## Predictions

- **P-179a** (judgment): On judgment scenarios (sycophants-dilemma, credentials-in-binary), self-lesson replay will achieve **<50%** pass rate vs curated few-shot's **100%** (18/18 from H-091). The quality gap dominates.
- **P-179b** (execution): On execution scenarios (reproduce-first, know-when-blocked), self-lesson replay will achieve **≥80%** pass rate, comparable to curated few-shot. Procedural memory transfers reliably.
- **P-179c** (quality correlation): Quality of self-generated lessons inversely correlates with task difficulty — easy-task lessons are specific/reusable, hard-task lessons are vague/wrong. This extends H-165's finding that self-production harms hard tasks.

## Test Design (EXP-179)

### Phase 1: Lesson Generation (~$3)
1. Run agent through 6 known-failure scenarios (3 judgment, 3 execution) without guidance
2. After each failure, prompt agent to generate a lesson/reflection (Reflexion-style)
3. Independently rate lesson quality: specific & correct, vague but directional, or wrong

### Phase 2: Replay Comparison (~$8)
For each of the 6 scenarios, run 3 arms × 3 trials = 54 runs:
- **Arm A**: No guidance (baseline)
- **Arm B**: Self-generated lesson from Phase 1 injected at task start
- **Arm C**: Curated few-shot example (from H-091's proven set)

### Metrics
- Pass rate per arm per task type (judgment vs execution)
- Lesson quality score vs pass-rate delta (tests P-179c)
- Cost: ~$11 total, 54 evaluator-scored runs

### Decision Criteria
- If P-179a confirmed (judgment: self <50%, curated ~100%): curated few-shot is the right approach for judgment tasks; don't rely on self-generated lessons
- If P-179b confirmed (execution: self ≥80%): self-lesson replay is viable for execution tasks, supporting KE-330's narrower claim
- If P-179b **rejected** (execution: self <80%): self-lesson replay is not viable even in its best case; KE-330's 30-50% failure reduction estimate is overoptimistic

## Implications for KE-330

KE-330 predicts 30-50% failure reduction from task-typed lesson replay. This hypothesis predicts that estimate is **correct for execution tasks** but **wildly overoptimistic for judgment tasks**. The practical recommendation would be: use self-lesson replay for execution/procedural tasks, use curated few-shot for judgment/reasoning tasks. KE-334's "learn in production, store structurally" may work — but only if structured storage includes quality filtering that rejects vague/wrong lessons.

## Priority

Medium. KE-330 is a proposed feature; testing this hypothesis before implementation avoids building infrastructure for a mechanism that only works on half the task space.
