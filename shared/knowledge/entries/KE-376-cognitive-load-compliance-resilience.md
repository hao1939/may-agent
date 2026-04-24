# KE-376: Structural Compliance Is Resilient Under Cognitive Load; Task Quality Degrades Instead

**Date**: 2026-04-24
**Source**: H-EXP-015 Phase 2 baseline (11 gym runs across 3 pressure scenarios)
**Confidence**: Medium-High
**Connects**: KE-002 (text rules), H-EXP-015, EXP-215 (ceiling effect), EXP-025

## Core Finding

When agents face multi-task pressure (3-5 concurrent responsibilities), **structural compliance behaviors remain at ceiling** (finish(), read-before-edit, structured output — 100% in 10/11 runs). Instead, **task completion quality degrades**: agents skip the hardest subtask or produce incomplete work on one of several required outputs.

## Evidence

**H-EXP-015 Phase 2 — 11 runs across 3 pressure scenarios:**

| Scenario | Runs | Compliance (C1.4+C8.2+C1.1) | Task Completion |
|---|---|---|---|
| heartbeat-pressure | 5 | 5/5 (100%) | P0 fix: 0/5, P1 fix: 5/5, decision: 5/5 |
| multi-bug-review | 3 | 3/3 (100%) | PR1: 3/3, PR2-review: 2/3, PR2-bug: 1/3, PR3: 3/3 |
| research-and-report | 3 | 2/3 (67%) — 1 run failed overall, rest 100% | Full synthesis: 2/3 |

**Key pattern**: The P0-widget-syntax-fixed check failed 5/5 times in heartbeat-pressure. The agent consistently fixed the easy bug (P1 off-by-one) and wrote the decision doc, but skipped the harder syntax fix. Under load, agents **triage by difficulty, not priority**.

## Mechanism / Why

Structural compliance (finish, read-before-edit) is now deeply encoded in agent context and prompts — it's become automatic/"habitual." Task completion requires judgment about what to do and how, which suffers under cognitive load. The agent optimizes for completing the most tasks possible, sacrificing quality on the hardest one. This is analogous to human "satisficing" under pressure.

## Implications

### 1. Compliance interventions have succeeded — diminishing returns
Our compliance infrastructure (context.md warnings, guards) has pushed structural behaviors to near-ceiling. Further compliance work has low ROI. The failure frontier has moved from "agents forget process" to "agents misjudge priorities."

### 2. Priority-awareness is the next frontier
Agents skip P0 tasks in favor of easier P1/P2 tasks under load. This is a **judgment failure**, not a compliance failure — and per KE-002, text-based rules won't fix it. Needs structural intervention (e.g., task-priority sorting before execution, P0-first workflow).

### 3. Gym pressure scenarios work — they reveal production-like patterns
The 0/5 P0-fix failure in heartbeat-pressure matches the production pattern of "agent does lots of stuff but misses the important thing." These scenarios are useful for testing prioritization interventions.

## Actionable

- **Stop investing in compliance interventions** — they're at ceiling. Focus on task quality under load.
- **Design H-EXP-016: Priority-First Execution** — test whether explicit "handle P0 items first" instruction or workflow ordering improves critical task completion under load.
- **Use pressure scenarios** as the primary gym tier for testing new interventions (single-task scenarios are at ceiling).
- **heartbeat-pressure** is now a regression test for priority-awareness interventions.

## Open Questions

- Does the "skip hardest task" pattern hold for non-bob agents (QA, coder)?
- Would a simple "list tasks by priority, do P0 first" instruction fix this, or is it deeper?
- Is the research-and-report failure (1/3 overall fail) a different failure mode or same pattern?
- How does this interact with turn limits? Are agents rationally triaging or just running out of turns?
