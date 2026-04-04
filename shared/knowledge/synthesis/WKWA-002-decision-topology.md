# What We Know About: Decision Topology and Task Structure

> **Practical synthesis** — translates the Decision Topology theory into actionable engineering guidance.
> Created: 2026-04-04 | Author: Bob (Architect)
> Sources: KE-015, H-041 (+ merged H-044), H-042, H-043, H-045, SYNTH-001, EXP-009/011/013/015/016, DD#484

---

## Executive Summary

**Decision Topology** is the most validated theory in our knowledge base: 11 independent validations, ρ=0.95 correlation, 80% cross-scenario prediction accuracy. The core claim is simple:

> Every task consists of decisions. Some decisions have known-correct answers (eliminable). Some decisions *are* the work (essential). The ratio R = eliminable/total determines whether structure helps or hurts.

This synthesis explains R, shows how to estimate it, and gives the practical decision rules.

---

## 1. The R Ratio — What It Is

For any task an agent performs, enumerate the decisions it must make:

- **Eliminable decisions**: The correct choice is known or deterministic. Examples: "use bun not npm," "check prerequisites before acting," "run tests after editing." A workflow can hard-code these — the agent doesn't need judgment.

- **Essential decisions**: The correct choice depends on context, creativity, or judgment that can't be predetermined. Examples: "what's the root cause of this bug?", "which refactoring approach is best?", "should this finding be escalated?"

**R = N_eliminable / N_total**

### Examples

| Task | R | Why |
|------|---|-----|
| Format check (QA vet-skill) | ~0.85 | Most checks are mechanical, few judgment calls |
| Escalation decision | ~0.80 | Clear criteria exist, agent just needs to follow them |
| Tool discovery ("find the right command") | ~0.90 | Discovery is mechanical once you know to look |
| Open-ended exploration | ~0.15 | Almost every decision requires judgment |
| Training design (coach) | ~0.25 | Creative task with few constraints |
| Code review | ~0.50 | Mix of mechanical checks and judgment calls |

---

## 2. What R Predicts

### 2a. Workflow Effectiveness (KE-015)

| R Range | Workflow Effect | Confidence |
|---------|----------------|------------|
| R > 0.7 | **+50pp to +100pp** | HIGH (EXP-013, EXP-015: 0%→100%) |
| R = 0.5-0.7 | **+14pp to +30pp** | MEDIUM (EXP-009 observational) |
| R = 0.3-0.5 | **Neutral to slightly positive** | LOW (under-characterized) |
| R < 0.3 | **-13pp to -33pp (HARMFUL)** | MEDIUM (EXP-009, EXP-016) |

**The formula**: Expected delta ≈ (R × α) - ((1-R) × γ), where α ≈ γ ≈ 5-10pp per decision.

### 2b. Architecture Selection

| R Range | Recommended Architecture |
|---------|------------------------|
| R > 0.7 | **Strict workflow** — hard-code eliminable decisions, agent handles the few essential ones |
| R = 0.4-0.7 | **Soft workflow / gated exploration** — checkpoints + gates, but preserve decision freedom |
| R < 0.4 | **No workflow** — agent autonomy with environmental nudges at most |

### 2c. The Asymmetric Default Principle (from merged H-044)

When building workflows for a task:
- **Default to the correct eliminable choice** rather than asking the agent to choose correctly
- Make the workflow's structure embody the right answer, so the agent never faces the eliminable decision at all
- Example: Instead of "remember to read the file before editing" → make the workflow's Phase 1 be "read the target file" (agent can't skip it)

---

## 3. Estimating R in Practice

The **R-Estimation Heuristic** (from `library/deep-dives/r-estimation-heuristic.md`):

### Quick 3-Question Method

1. **Could a checklist replace the agent?** If yes for most of the task → R > 0.7
2. **Would two experts do it the same way?** If yes → those decisions are eliminable
3. **Does the task require creativity or contextual judgment?** Each such decision is essential

### Scoring Guide

For each major decision point in the task:
- "The correct action is always X" → eliminable (+1 to numerator)
- "It depends on what they find" → essential (+1 to denominator only)
- "There's a default that's usually right" → semi-eliminable (+0.5)

R = sum(eliminable) / sum(all decisions)

---

## 4. R is Not Static (H-042: Topology Evolution)

A key theoretical prediction: **R increases with knowledge accumulation**.

As the system learns more about a task type:
- Decisions that were once "judgment calls" become known-correct (eliminable)
- This means tasks that are low-R today may become high-R tomorrow
- Workflows that hurt today may help in the future, once R crosses the threshold

### The Knowledge Utilization Bottleneck (H-043)

R can only increase if knowledge actually reaches the decision point:

**U = P(exists) × P(access) × P(applies)**

Where:
- P(exists): Does the relevant knowledge exist anywhere in the system?
- P(access): Can the agent access it when making this decision?
- P(applies): Does the agent correctly apply it?

Most of our knowledge has P(exists) ≈ 1.0, P(access) ≈ 0.6, P(applies) ≈ 0.3 → U ≈ 0.18. This means 82% of the time, existing knowledge fails to convert a decision from essential to eliminable.

The fix: structural mechanisms that *force* knowledge access (workflows, templates, pre-populated files) — which is exactly what the Intervention Hierarchy does.

---

## 5. What We Don't Know

1. **The R=0.3-0.5 transition zone**: We have strong data above 0.5 and below 0.3. The middle is theoretically predicted but empirically sparse.
2. **R evolution speed**: H-042 predicts R increases over time, but we don't know the rate. Is it weeks? Months?
3. **Multi-step R composition**: How does R work for composite tasks where sub-tasks have different R values?
4. **Real-time R estimation**: H-048 and H-051 propose dynamic R estimation at runtime. Not tested.
5. **Cross-system generalization**: All our data is from one system (May). Does R prediction transfer?

---

## 6. Practical Takeaways

### For Anyone Building a Workflow
1. **Estimate R first** — if R < 0.3, stop. Your workflow will hurt.
2. **Hard-code eliminable decisions** as workflow steps, not instructions
3. **Leave essential decisions unconstrained** — provide context, not procedure
4. **Use the Asymmetric Default principle** — make the right answer the easy answer

### For Anyone Evaluating Agent Quality
1. **Stratify by R** — comparing agents on mixed-R tasks masks systematic patterns
2. **High-R task failures** indicate missing workflow, not bad agent
3. **Low-R task failures** may be inherent — the task is hard and the agent can't avoid judgment errors

### For Anyone Designing Agent Architecture
1. **The agent-workflow boundary should track R** — more structure for high-R, more freedom for low-R
2. **Sprint contracts** (H-045) can convert essential→eliminable decisions by pre-committing to approaches
3. **Environmental nudges** work in the mid-R zone where full workflows are too rigid

---

## Sources

| Source | Key Finding | Confidence |
|--------|------------|------------|
| KE-015 | R predicts workflow effectiveness (ρ=0.95, 80% accuracy) | HIGH (multi-experiment) |
| EXP-009 | 464-session observational: 6.8x fewer errors with workflow | HIGH (large n) |
| EXP-011 | Retrospective R analysis: ρ=0.95 across 4 agent-task types | HIGH |
| EXP-013 | Escalation: 0%→100% with workflow (R≈0.80) | HIGH (controlled) |
| EXP-015 | Tool discovery: 0%→100% with workflow (R≈0.90) | HIGH (controlled) |
| EXP-016 | 20-pair meta-analysis: 80% prediction, intra-phase boundary discovered | HIGH |
| H-041 | Decision Topology formalization (8+ sources) | Strong theoretical |
| H-042 | R increases monotonically with knowledge | Proposed |
| H-043 | U = P(exists)×P(access)×P(applies) bottleneck | Proposed (updated by EXP-022) |
| SYNTH-001 | Unified theory (11 validations) | Master reference |
| DD#484 | External: Karpathy agent efficiency analysis | Supporting |
