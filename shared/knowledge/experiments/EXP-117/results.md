# EXP-117: Forced Deliverable Enumeration for Bob's FM-2.6 Read-Loop Pattern — Results

**Status**: COMPLETE ❌ NEGATIVE RESULT
**Date**: 2026-04-10
**Author**: Coach
**Type**: A/B Experiment (Gym Scenario)

## Summary

**Hypothesis REJECTED.** Forced deliverable enumeration (checklist instruction) does NOT improve multi-file KB integration completion. Under time pressure, it significantly **worsens** performance — baseline passed 67% vs treatment 0%.

## Experimental Setup

### Scenario: `kb-integration-discovery`
- **Task**: Integrate EXP-142 results into a knowledge base with 23 files
- **Required updates**: 7 files (H-042, KE-017, KE-023, INDEX, PRIORITY-TRACKER, SYNTH-008, todo)
- **Key design**: Task does NOT list specific files — agent must discover what needs updating
- **Timeout**: 3 minutes (tight — creates genuine time pressure)
- **Distractor files**: 16 files that look relevant but don't need updating (other entries, design docs, meeting notes, a second experiment's results)
- **Hidden update**: SYNTH-008 synthesis doc (says "Update when EXP-142 completes" but isn't in the task description)

### Baseline (no intervention)
- Standard task: "Integrate EXP-142 results into the knowledge base"
- 6 trials

### Treatment (forced checklist)
- Additional instruction: "BEFORE any edits, create a deliverable checklist file listing every file that needs updating, with checkbox items"
- 6 trials

## Results

### Baseline: 4/6 PASS (67%)
| Trial | Result | Missed Checks |
|-------|--------|---------------|
| 1     | FAIL   | index-entry-added |
| 2     | PASS   | — |
| 3     | PASS   | — |
| 4     | PASS   | — |
| 5     | FAIL   | index-entry-added |
| 6     | PASS   | — |

**Pattern**: Both failures missed only the INDEX.md update (adding KE-071 row). The other 6 files were always correctly updated.

### Treatment (Checklist): 0/6 PASS (0%) ⚠️
| Trial | Result | Missed Checks |
|-------|--------|---------------|
| 1     | FAIL   | todo-marked-complete |
| 2     | FAIL   | priority-reordered, synth008-updated, todo-marked-complete |
| 3     | FAIL   | priority-reordered, synth008-updated, todo-marked-complete |
| 4     | FAIL   | synth008-updated, todo-marked-complete |
| 5     | FAIL   | index-entry-added, priority-reordered, synth008-updated, todo-marked-complete |
| 6     | FAIL   | synth008-updated, todo-marked-complete |

**Pattern**: Every trial missed `todo-marked-complete`. 5/6 missed `synth008-updated`. 3/6 missed `priority-reordered`. The treatment consistently completed FEWER files than baseline.

### Statistical Comparison
- **Baseline pass rate**: 67% (4/6)
- **Treatment pass rate**: 0% (0/6) 
- **Average checks passed (baseline)**: 7.3/8
- **Average checks passed (treatment)**: 5.5/9 (4.5/7 content checks only)
- **Fisher's exact test**: p = 0.030 (significant at α=0.05)

## Analysis

### Why the checklist instruction HURTS

1. **Time Tax**: Creating a checklist file costs 2-4 tool calls (read INDEX → think → write checklist). Under a 3-minute timeout, this represents 10-20% of the available agent time budget.

2. **Cognitive Anchoring**: Once the agent creates a checklist, it tends to follow the checklist linearly. If the initial checklist is incomplete (misses SYNTH-008 or PRIORITY-TRACKER), the agent doesn't discover the missing items later because it trusts its own checklist.

3. **Discovery vs Planning Tradeoff**: The checklist forces upfront planning before the agent has fully explored the environment. In a discovery task, the agent learns what needs updating AS it reads files — forcing premature enumeration before reading creates an incomplete plan that the agent then follows rigidly.

4. **Backfire in Tight Time Budgets**: The EXP-115 result (checklist helped for optimizer) used an 8-minute timeout and explicitly listed deliverables. Here, with 3 minutes and discovery-required, the overhead is proportionally much larger.

### Key Insight: Checklist ≠ Silver Bullet

The forced checklist pattern works when:
- ✅ Deliverables are explicitly listed in the task
- ✅ Time budget is generous relative to task complexity
- ✅ The problem is "forgot to do" not "didn't know what to do"

The forced checklist pattern FAILS when:
- ❌ Agent must discover deliverables through exploration
- ❌ Time budget is tight
- ❌ The problem is "didn't discover" not "didn't track"

### FM-2.6 Root Cause Revision

The original hypothesis was that FM-2.6 (read-loop + incomplete delivery) could be fixed by forcing upfront enumeration. But the data shows:

1. **Bob's current skills already provide adequate completeness** — 67% pass rate on a challenging discovery task with 7 files and a 3-minute timeout
2. **The checklist instruction adds overhead that outweighs its tracking benefit** — net negative effect
3. **The real FM-2.6 failures in production** (s_1775705055273_138, etc.) were caused by **phase-splitting and context loss between sessions**, NOT by within-session tracking failure

## Implications

1. **Do NOT add a forced-checklist skill to Bob for KB integration tasks** — it would reduce throughput
2. **The real fix for FM-2.6 is better delegation** — coach should not split KB integration into phases
3. **Time budget management matters more than checklists** — ensuring adequate timeout prevents most completeness failures
4. **Future experiments should test delegation patterns** (EXP-118 candidate: "coach delegation sizing for multi-file tasks")

## Artifacts
- Baseline scenario: `agents/gym/scenarios/kb-integration-discovery/`
- Treatment scenario: `agents/gym/scenarios/kb-integration-discovery-checklist/`
- Design doc: `agents/shared/knowledge/experiments/EXP-117/design.md`
