# EXP-195: Relational Bug Recognition Skill

**Date**: 2026-04-22
**Status**: RUNNING
**Predecessors**: EXP-194 (bug-type classification), EXP-177 (hints don't help cascading-fix-trap-v2)
**Project**: prove-the-loop

## Research Question

Can a **relational-bug-recognition skill** (injected via task preamble) move the agent's pass rate on cascading-fix-trap-v2 from 0% to ≥33%?

## Background

EXP-194 established that relational bugs (component ordering, data flow, shared state) have 0% base rate vs ~87% for value bugs. In cascading-fix-trap-v2 specifically, the agent fixes the VALUE bug (threshold `>` vs `>=`) in 97.5% of trials but the RELATIONAL bug (pipeline ordering) in only 2.5%.

EXP-177 showed that **lexical hints** ("Pipeline ordering is wrong") don't help — 1/10 vs 0/10 baseline. The agent needs more than a pointer; it needs a *reasoning strategy* for detecting relational bugs.

## Hypothesis

**H-195**: A skill that teaches systematic data-flow tracing and ordering verification will enable the agent to discover the pipeline ordering bug, raising pass rate from ~0% to ≥33%.

**Rationale**: The agent fails not because it can't fix ordering bugs, but because it never *looks* for them. The skill teaches a checklist: after fixing obvious value bugs, systematically verify component ordering, initialization sequences, and data-flow assumptions.

## Intervention: Relational Bug Recognition Skill

The skill is injected as a `RELATIONAL_BUG_CHECKLIST.md` file in the environment root, referenced from task.md. Content:

```markdown
# Relational Bug Recognition Checklist

When debugging a multi-component system, value-level bugs (wrong operator, wrong constant) are
easy to spot. But **relational bugs** — where the issue is HOW components interact — are harder.
After fixing any obvious bugs, work through this checklist:

## 1. Verify Processing Order
- Read the pipeline/workflow from top to bottom
- For each step, ask: "Does this step's INPUT depend on a PREVIOUS step's OUTPUT?"
- Check: Are steps in the right order? Could swapping two steps change results?
- **Red flag**: Comments describe one order, but code implements a different order

## 2. Trace Data Flow Between Components
- Pick a data value and trace it through the full pipeline
- At each stage, verify: what fields exist? What are their types and ranges?
- Check: Does each function receive the data format it expects?
- **Red flag**: A function computes on raw values but receives already-processed values (or vice versa)

## 3. Check Initialization and Dependency Order
- Are modules initialized in the right order?
- Do shared resources get set up before they're used?
- **Red flag**: A config/registry is read before it's populated

## 4. Verify Shared State Mutations
- If multiple components modify the same data structure, check for conflicts
- Order of mutations matters — does the code enforce the right order?

## Key Principle
**After fixing value bugs, re-run tests. If tests still fail, the remaining bug is likely RELATIONAL
— look at how components connect, not what values they compute.**
```

## Design

### Arms

| Arm | N | Scenario | Intervention |
|-----|---|----------|-------------|
| Baseline | 3 | cascading-fix-trap-v2 | None (confirm 0% base rate) |
| Treatment | 3 | cascading-fix-trap-v2-exp195-skill | Skill checklist injected |

### Treatment Scenario
- Identical environment to cascading-fix-trap-v2
- `RELATIONAL_BUG_CHECKLIST.md` added to environment root
- task.md updated to reference the checklist: "Read RELATIONAL_BUG_CHECKLIST.md before starting"
- Same success_criteria.js

### Success Criteria
- **Primary**: Treatment pass rate > 0% (any improvement proves skill has effect)
- **Strong signal**: Treatment pass rate ≥ 33% (1/3 trials)
- **Prove the loop**: If ≥33%, M1 and M2 of prove-the-loop are complete

### Statistical Note
N=3 per arm is small. A single treatment pass (33%) vs 0% baseline, combined with EXP-177's 0/10 and 1/40 historical baseline, provides meaningful signal. If treatment shows 0/3, we reject the skill design and iterate. If ≥1/3, we have evidence to justify a larger N follow-up.
