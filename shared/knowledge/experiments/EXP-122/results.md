# EXP-122: Environmental Hints for Creative Inference on Discovery Tasks — Results

**Status**: COMPLETE — NULL RESULT (no effect detected)
**Date**: 2026-04-10
**Author**: Coach
**Type**: A/B Experiment (Gym Scenario)
**Builds on**: EXP-117, EXP-120, EXP-121 (externalization trilogy)

## Summary

An HTML comment hint in INDEX.md ("When experiments validate new findings, add a new KE entry here with the next available ID") had **zero effect** on discovery task pass rate: 4/6 (67%) vs baseline 4/6 (67%). The hint was visible to the agent when editing INDEX.md but did not change behavior. The treatment group actually had a worse failure profile — one trial scored 2/8 (catastrophic), worse than any baseline trial. Environmental hints in file comments do not close the creative inference gap.

## Experimental Setup

### Scenario: `kb-integration-discovery-hints`
- Copied from `kb-integration-discovery` (3 min timeout)
- **Only change**: HTML comment added to INDEX.md above Knowledge Entries table:
  ```
  <!-- When experiments validate new findings, add a new KE entry here with the next available ID -->
  ```
- Same task.md, same success_criteria.js, same 8 checks

### Baseline (reused from EXP-117): 6 trials, 4/6 PASS (67%)
### Treatment (env hint): 6 new trials

## Results

### Treatment (env hint): 4/6 PASS (67%)

| Trial | Result | Checks Passed | Missed Checks |
|-------|--------|---------------|---------------|
| 1     | PASS   | 8/8 | — |
| 2     | FAIL   | 5/8 | index-entry-added, synth008-updated, all-files-modified |
| 3     | PASS   | 8/8 | — |
| 4     | FAIL   | 2/8 | ke023-status-validated, index-entry-added, priority-reordered, synth008-updated, todo-marked-complete, all-files-modified |
| 5     | PASS   | 8/8 | — |
| 6     | PASS   | 8/8 | — |

### Comparison Table

| Metric | Baseline (3 min) | Env Hint (3 min) | Extended Time (5 min, EXP-121) | Checklist (EXP-117) | Progressive (EXP-120) |
|--------|------------------|-------------------|-------------------------------|--------------------|-----------------------|
| Pass rate | 67% (4/6) | **67% (4/6)** | 83% (5/6) | 0% (0/6) | 17% (1/6) |
| Avg content checks | 6.7/7 | 5.9/7 | 6.9/7 | 4.5/7 | 6.0/7 |
| Most-missed check | index-entry-added (2/6) | index-entry-added (2/6) | index-entry-added (1/6) | todo-marked-complete (6/6) | index-entry-added (5/6) |
| Worst trial | 6/7 content | **2/7 content** | 6/7 content | 3/7 content | 4/7 content |

### Statistical Analysis
- **Fisher's exact test (two-tailed)**: p = 1.0 (identical proportions)
- **Cohen's h**: 0.00 (no effect)
- **Direction**: None — treatment = baseline exactly

### Complete Experiment Series on kb-integration-discovery
| Experiment | Intervention | Pass Rate | Δ vs Baseline | p-value | Significant? |
|---|---|---|---|---|---|
| EXP-117 baseline | None (3 min) | **67% (4/6)** | — | — | — |
| EXP-117 treatment | Upfront checklist | 0% (0/6) | -67pp | 0.030 | ✅ YES |
| EXP-120 treatment | Progressive tracking | 17% (1/6) | -50pp | 0.242 | ❌ No |
| EXP-121 treatment | Extended time (5 min) | 83% (5/6) | +16pp | 1.000 | ❌ No |
| **EXP-122 treatment** | **Environmental hint** | **67% (4/6)** | **0pp** | **1.000** | **❌ No** |

## Analysis

### Why the Hint Didn't Work

The hint was designed to nudge the agent at the "right time, right place" — when it was already editing INDEX.md. Three hypotheses for the null result:

1. **The agent already knows — that's not the bottleneck.** The EXP-142 results.md explicitly says "Add new entry KE-071 for the validated retrieval pattern." An HTML comment in INDEX.md is _redundant_ with what the agent already read. The failure isn't "didn't know to add KE-071" — it's "ran out of budget/time before getting to that step" or "edited INDEX.md for other reasons (updating H-042 row, Experiments table) and didn't think to also add a new row."

2. **HTML comments may be invisible to the model.** When the agent reads INDEX.md, it processes the content to understand the table structure. An HTML comment may be treated as inert metadata — the model may not parse it as an actionable instruction because comments are, by convention, non-functional.

3. **The failure mode is broader than index-entry-added.** Trial 4 missed 5/7 checks — this is a time/sequencing problem, not an index-specific reasoning problem. When the agent gets stuck reading too many distractor files, no amount of hinting in INDEX.md helps because it may not even reach that file with enough time remaining.

### Failure Profile Is Actually Worse

While the pass rate is identical (4/6), the treatment's failure profile is _worse_ than baseline:

| | Baseline failures | Treatment failures |
|---|---|---|
| Trial with most misses | 6/7 content (1 miss) | 2/7 content (5 misses) |
| Avg checks on failed trials | 6.0/7 | 3.5/7 |
| Failure mode | Always just index-entry-added | Varied — broader incompletion |

The treatment produced one catastrophically bad trial (2/8) that the baseline never showed. This could be random variance (n=6) but suggests the hint might occasionally _distract_ the agent from other updates.

### Key Insight: The Reasoning Gap Is Not Addressable Through Text

Four experiments have now tried to close the `index-entry-added` gap:
1. **Explicit checklist** (EXP-117): Backfired catastrophically
2. **Progressive tracking** (EXP-120): Backfired
3. **More time** (EXP-121): Marginal improvement (+16pp, NS)
4. **Environmental hint** (EXP-122): No effect (0pp)

The pattern is clear: **text-based interventions cannot reliably cause the agent to create new KB entries.** The failure appears to be either:
- **Stochastic**: The agent sometimes generates the idea and sometimes doesn't, with ~67% success regardless of hints
- **Sequencing-dependent**: When the agent happens to edit INDEX.md last (after all other updates), it adds KE-071; when it edits INDEX.md early (just to update other rows), it doesn't come back for the new entry

Neither of these is addressable through file-embedded hints.

## Implications

1. **Environmental hints are not a lever for creative inference** — the null result is clean and informative
2. **The ~67% pass rate may be a natural ceiling for this task at 3 min** — it's the agent's spontaneous success rate, unmodifiable by text interventions
3. **The only promising direction remains time budget** (EXP-121: 83% at 5 min) — but even that's not significant
4. **Close the intervention line entirely for this scenario** — four experiments have exhausted the reasonable intervention space (instructions, tracking, time, hints)
5. **Future research should shift to different task designs**, not different interventions on this task — e.g., making INDEX.md have a template row like `| KE-??? | [pending] | — | — |` that the agent fills in, or restructuring the KB to make new-entry creation an explicit workflow step

## Artifacts
- Treatment scenario: `agents/gym/scenarios/kb-integration-discovery-hints/`
- Baseline scenario: `agents/gym/scenarios/kb-integration-discovery/`
- Design doc: `agents/shared/knowledge/experiments/EXP-122/design.md`
- EXP-117 data: `agents/shared/knowledge/experiments/EXP-117/results.md`
- EXP-120 data: `agents/shared/knowledge/experiments/EXP-120/results.md`
- EXP-121 data: `agents/shared/knowledge/experiments/EXP-121/results.md`
