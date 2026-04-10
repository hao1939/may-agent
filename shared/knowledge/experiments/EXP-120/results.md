# EXP-120: Progressive Externalization for Discovery Tasks — Results

**Status**: COMPLETE ❌ NEGATIVE RESULT
**Date**: 2026-04-10
**Author**: Coach
**Type**: A/B Experiment (Gym Scenario)

## Summary

**Hypothesis REJECTED.** Progressive externalization instruction ("maintain a running list as you explore") does NOT improve multi-file KB integration completion. Treatment: **1/6 pass (17%)** vs Baseline: **4/6 pass (67%)**. The instruction was largely **ignored** — no trial created an external tracking file, and the dominant failure mode (missing INDEX.md KE-071 entry) was identical to the baseline failure mode.

## Experimental Setup

### Scenario: `kb-integration-discovery-progressive`
Same environment as EXP-117 baseline. Only difference: task.md appends a paragraph instructing the agent to maintain a running list of updates as files are explored.

### Baseline (reused from EXP-117): 6 trials, 4/6 PASS (67%)
### Treatment (progressive): 6 new trials

## Results

### Treatment (Progressive): 1/6 PASS (17%) ⚠️
| Trial | Result | Checks Passed | Missed Checks |
|-------|--------|---------------|---------------|
| 1     | FAIL   | 6/8 (6/7 content) | index-entry-added |
| 2     | FAIL   | 6/8 (6/7 content) | index-entry-added |
| 3     | PASS   | 8/8 | — |
| 4     | FAIL   | 6/8 (6/7 content) | index-entry-added |
| 5     | FAIL   | 6/8 (6/7 content) | index-entry-added |
| 6     | FAIL   | 4/8 (4/7 content) | ke023-status-validated, index-entry-added, priority-reordered |

### Comparison Table
| Metric | Baseline (EXP-117) | Checklist (EXP-117) | Progressive (EXP-120) |
|--------|-------------------|--------------------|-----------------------|
| Pass rate | **67% (4/6)** | 0% (0/6) | 17% (1/6) |
| Avg content checks | 6.7/7 | 4.5/7 | 6.0/7 |
| Most-missed check | index-entry-added (2/6) | todo-marked-complete (6/6) | index-entry-added (5/6) |
| Worst trial | 6/7 content | 3/7 content | 4/7 content |

### Statistical Analysis
- **Baseline vs Progressive**: Fisher's exact test p = 0.242 (NOT significant at α=0.05)
- **Direction**: Treatment is worse than baseline (17% vs 67%) but sample too small to confirm statistical significance
- **Progressive vs Checklist**: Fisher's exact test p = 1.0 (both bad, cannot distinguish)

## Analysis

### Why Progressive Instruction Failed

1. **Instruction Was Ignored**: No trial created an external tracking file. The agent treated "jot down" as mental tracking, which it already does by default. The instruction added no new behavioral structure.

2. **Same Failure Mode as Baseline**: 5/6 failures were on `index-entry-added` (adding a KE-071 row to INDEX.md) — exactly the same check that caused baseline failures. This means the progressive instruction did NOT help with the specific discovery gap.

3. **Possible Interference**: The instruction may have subtly slowed the agent by adding meta-cognitive overhead ("am I tracking everything?") without actually producing a tracking artifact. The worst trial (4/7 content checks) was worse than any baseline trial.

4. **The One Pass Was Natural Variance**: Trial 3 passed, but examination of the transcript shows the agent naturally built a comprehensive 9-item list in its reasoning text — something baseline trials also sometimes do spontaneously.

### Behavioral Observations

**Failing trials (5/6)**: Agent reads experiment results → explores knowledge files → edits existing files (H-042, KE-017, KE-023, SYNTH-008, PRIORITY-TRACKER, todo) → updates INDEX.md entries for existing items but forgets to ADD a new KE-071 row → finishes.

**Passing trial (1/6)**: Agent built an explicit 9-item running list in its reasoning text, including "add KE-071 entry" — but this happened without any apparent influence from the progressive instruction (baseline trials also do this sometimes).

### Key Insight: The Failure is NOT a Tracking Problem

Both EXP-117 and EXP-120 now demonstrate that the INDEX.md update failure is **not caused by forgetting** items that were once known. The agent never "discovers" that it needs to add KE-071 — it simply doesn't generate the idea of creating a new knowledge entry. This is a **reasoning gap** (not knowing what to do) not a **tracking gap** (forgetting what to do).

The experiment results show:
- **Creating KE-071 as a new entry** requires creative inference: "this experiment's results deserve their own KB entry"
- **Updating existing entries** in INDEX.md (H-042 status, SYNTH-008 status, EXP-142 status) is straightforward — agent just propagates what it read
- No amount of "track your updates" instruction helps if the agent never conceptualizes the update in the first place

## Implications

### Three Intervention Types Tested, All Failed or Hurt:
| Intervention | Type | Result | Why |
|---|---|---|---|
| Upfront checklist (EXP-117) | Structural (forced file) | ❌ -67pp | Time tax + anchoring |
| Progressive tracking (EXP-120) | Advisory (instruction) | ❌ -50pp | Ignored; wrong problem type |
| No intervention (baseline) | None | **Best**: 67% | Agent already competent at tracking |

### The Real Problem
**Bob doesn't need help tracking discovered items — he needs help discovering items he hasn't thought of.** Specifically:
- "This experiment's results should create a NEW knowledge entry (KE-071)" is not obvious from reading the files
- The INDEX.md already has a KE section, but nothing explicitly says "add new entries when experiments produce novel findings"
- The task itself says "update knowledge entries" — which the agent interprets as modifying existing ones

### Recommended Next Steps
1. **EXP-121 candidate**: Test whether explicit instruction to "check if any NEW knowledge entries should be created" (targeting the specific reasoning gap) improves the KE-071 discovery rate
2. **Environmental fix**: Add a comment in INDEX.md: "Remember to add new KE entries for significant experimental results" — this targets the discovery gap directly
3. **Abandon instruction-only interventions for discovery tasks** — EXP-117 + EXP-120 together show that both structural and advisory instructions fail when the problem is reasoning, not tracking

## Artifacts
- Baseline scenario: `agents/gym/scenarios/kb-integration-discovery/`
- Treatment scenario: `agents/gym/scenarios/kb-integration-discovery-progressive/`
- EXP-117 results: `agents/shared/knowledge/experiments/EXP-117/results.md`
- Design doc: `agents/shared/knowledge/experiments/EXP-120/design.md`
