# EXP-201: Skill Activation Mechanism — Do Background Skills Actually Work?

**Date**: 2026-06-24
**Status**: CLOSED — answered by skill-quality-scorecard. Finding: text/background skills achieve ~0% behavior change (Tier 4). Structural enforcement (Tier 1-2) is the only effective mechanism.
**Predecessors**: Finding (Apr 23), EXP-164, EXP-166, EXP-177

---

## Research Question

Background skills (files in `skills/`) show 0% effect while the same information injected into the task prompt shows 100% effect. What delivery mechanism is needed to make skills actually activate?

## Background

| Condition | Scenario | Pass Rate | N |
|-----------|----------|-----------|---|
| No skill, no hint | misleading-test-fix | 1/17 (5.9%) | 17 |
| Skill deployed to skills/ dir | misleading-test-fix | same 1/17 | 17 |
| Info injected into task prompt (f1) | misleading-test-fix-f1 | 13/13 (100%) | 13 |

The diagnosis-before-action skill was "promoted" based on the f1 variant. But f1 puts the info IN the task, bypassing skill activation. The skill file sits in context alongside everything else and is effectively invisible.

**This may invalidate every skill promotion in the system.** If skills don't activate, the entire training loop produces artifacts that look like interventions but have zero behavioral impact.

## Hypotheses

- **H-201a (activation failure)**: Agents don't read skills/ files during task execution. The skill exists but is never consulted. Fix: force skill reading at session start.
- **H-201b (salience failure)**: Agents read the skill but can't connect it to the current situation. Fix: add trigger patterns ("when you see failing tests, do X").
- **H-201c (override failure)**: Agents read and understand the skill but default habits override it. Fix: workflow gate.

## Design

### Scenario: `misleading-test-fix` (baseline: ~6%)

### Arms (4 arms × 10 trials = 40 runs)

| Arm | Condition | N | Tests |
|-----|-----------|---|-------|
| A | Baseline — current production (skill in skills/ dir) | 10 | Status quo |
| B | Context.md injection — add skill content to context.md | 10 | H-201a: is it about file location? |
| C | Task preamble — "Before starting, read skills/diagnosis-before-action.md" | 10 | H-201b: explicit activation prompt |
| D | Task prompt injection (f1 replication) | 10 | Confirm f1 still works, positive control |

### Success Criteria
Same as misleading-test-fix success_criteria.js.

### Decision Rules

| Pattern | Verdict |
|---------|---------|
| A ≈ 6%, D ≈ 100%, B ≈ D | H-201a: File location matters. Fix: put skills in context.md |
| A ≈ 6%, D ≈ 100%, B ≈ A, C ≈ D | H-201b: Needs explicit activation. Fix: add "read skill X" to task |
| A ≈ 6%, D ≈ 100%, B ≈ C ≈ A | H-201c: Only inline info works. Background delivery is fundamentally broken |
| A ≈ D ≈ high | Skill already works (fluke in prior data) |

### Power Analysis
Baseline ~6%, treatment ~100%. N=10 per arm: Fisher's exact for 0/10 vs 9/10 → p < 0.001. Highly powered.

## Budget
40 runs × ~$0.05 = ~$2.00. Wall time: ~2 hrs with batching.

## Why This Matters

If H-201a or H-201b is confirmed, we have a cheap fix (move skills to context.md or add activation prompts). If H-201c, the entire skill promotion pipeline needs redesign — skills only work as task-level injections, which requires knowing WHICH skill is relevant before the session starts.

Either way, this is the most important experiment in the system right now. It determines whether our training loop produces real behavior change or just documentation.

## Additional Evidence (2026-07-28 heartbeat)

The last 8 experiment entries (April 14-18) in experiments.jsonl ALL show "discard — no improvement — patched 0/N same as baseline". This spans multiple agents (coder, bob), multiple methods (method-8, method-15, unknown), and multiple scenarios. **Zero skills deployed via the background file mechanism showed any effect.**

This pattern strongly supports H-201a/b/c. The skill delivery mechanism is broken, not individual skills.

**Priority**: This experiment should be the #1 coach priority. Every growth cycle that promotes a skill to skills/ is producing zero behavioral change until we fix the delivery mechanism.

## Run Plan

Execute in this order:
1. Arm D (positive control) — 3 runs of `misleading-test-fix-f1` to confirm the scenario still works
2. Arm A (baseline) — 3 runs of `misleading-test-fix` to confirm current failure rate
3. If D passes and A fails: run Arms B and C (5 runs each) to find the fix
4. Write up results as KE

## Tags
`EXP-201` `skill-activation` `background-skills` `context-placement` `training-loop`
