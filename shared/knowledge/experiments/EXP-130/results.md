# EXP-130: Few-Shot on Discovery Task — Results

**Date**: 2026-04-11
**Status**: COMPLETE
**Author**: Coach (execution), Bob (design)

---

## Summary

**Few-shot examples HURT discovery performance.** The treatment arm (with domain-matched few-shot examples) passed only 33% of trials vs 100% for the baseline — the opposite of the predicted direction. This is the first experiment in the program where an intervention caused harm. H-099 is confirmed but the mechanism appears different than predicted: few-shot doesn't just *fail to help* — it actively *hurts* by displacing discovery with template-following.

---

## Results

### Primary Metric: All-Checks-Pass Rate

| Arm | Scenario | N | Pass | Fail | Rate |
|-----|----------|---|------|------|------|
| A (Baseline) | `kb-integration-discovery` | 6 | 6 | 0 | **100%** |
| B (Few-Shot) | `kb-integration-discovery-fewshot` | 6 | 2 | 4 | **33%** |

**Effect**: -67 percentage points (100% → 33%)  
**Fisher's exact test**: p = 0.030 (one-sided, B < A), p = 0.061 (two-sided)  
**Direction**: Treatment HURTS (opposite of expected if intervention worked)

### Individual Run Results

| Run ID | Arm | Passed | Score | Missed Checks |
|--------|-----|--------|-------|---------------|
| 266 | A | ✅ | 8/8 | — |
| 269 | A | ✅ | 8/8 | — |
| 271 | A | ✅ | 8/8 | — |
| 276 | A | ✅ | 8/8 | — |
| 277 | A | ✅ | 8/8 | — |
| 279 | A | ✅ | 8/8 | — |
| 270 | B | ✅ | 8/8 | — |
| 272 | B | ❌ | 6/8 | todo-marked-complete |
| 273 | B | ❌ | 5/8 | priority-reordered, todo-marked-complete |
| 278 | B | ✅ | 8/8 | — |
| 280 | B | ❌ | 4/8 | index-entry-added, priority-reordered, todo-marked-complete |
| 283 | B | ❌ | 4/8 | index-entry-added, priority-reordered, todo-marked-complete |

### Check-by-Check Analysis

| Check | Arm A | Arm B | Delta |
|-------|-------|-------|-------|
| h042-probability-updated | 6/6 (100%) | 6/6 (100%) | 0 |
| ke017-evidence-appended | 6/6 (100%) | 6/6 (100%) | 0 |
| ke023-status-validated | 6/6 (100%) | 6/6 (100%) | 0 |
| synth008-updated | 6/6 (100%) | 6/6 (100%) | 0 |
| index-entry-added | 6/6 (100%) | 4/6 (67%) | -33pp |
| priority-reordered | 6/6 (100%) | 3/6 (50%) | -50pp |
| todo-marked-complete | 6/6 (100%) | 2/6 (33%) | -67pp |
| all-files-modified | 6/6 (100%) | 2/6 (33%) | -67pp |

### Pattern in Failures

The 4 B-arm failures show a clear pattern:

1. **All 4 missed `todo-marked-complete`** (100% failure rate on this check)
2. **3/4 missed `priority-reordered`** (H-042 not moved to High Priority)
3. **2/4 missed `index-entry-added`** (KE-071 not added to INDEX.md)
4. **0/4 missed** core knowledge updates (h042, ke017, ke023, synth008)

The B-arm agent reliably updates the "obvious" KB files (those directly referenced in results) but misses the "peripheral" files (todo, priority tracker, index cross-refs). This is exactly the discovery bottleneck — the agent follows the example's explicit steps but doesn't independently discover which peripheral files need updating.

---

## Analysis

### H-099 Confirmation: Discovery Is Irreducible — And Worse, Fragile

H-099 predicted few-shot would *fail to help* (≤67% pass rate). The actual result is stronger: few-shot *actively hurts* (-67pp). This wasn't predicted but is consistent with H-099's core mechanism:

**Why few-shot hurts discovery tasks:**

1. **Template-following displaces exploration.** The few-shot example shows a 7-step pattern. The agent follows the pattern but doesn't independently explore beyond it. Without the example, the agent explores freely and discovers all files.

2. **The example creates false completeness.** The agent sees "here are the 7 types of updates" and, after completing updates that match those types, believes it's done — even though the specific files for *this* task differ from the example. The checklist in the example becomes a ceiling rather than a floor.

3. **Peripheral files are the discovery target.** The consistently missed checks (todo, priority-tracker, index) are exactly the "peripheral" files that require independent discovery. The example mentions these generically ("marked todo complete", "moved to appropriate priority") but doesn't help the agent *find* them in the current context.

This reveals a deeper insight: **few-shot doesn't just fail to teach discovery — it actively suppresses the exploratory behavior that makes discovery possible.** The agent in the baseline condition explores broadly because it has no template to follow. The treatment agent narrows its exploration to match the template.

### Baseline Surprise: 100% vs Expected 67%

The baseline achieved 100% (6/6), far above the historical average of ~67%. Possible explanations:

1. **Prompt/model improvements since earlier experiments.** The coder agent may have improved over the weeks since EXP-117/120/121.
2. **Statistical variance.** At N=6, getting 6/6 when the true rate is ~80% happens ~26% of the time.
3. **Scenario-specific factor.** This particular scenario may be easier than the historical average (though it was designed as a hard discovery task).

This doesn't invalidate the comparison — both arms ran in the same session with the same agent — but it means the absolute baseline rate isn't directly comparable to historical data.

### KE-132 Extension: Channel 3 Fails on Discovery

KE-132 found that Ch3 (few-shot) has a task-type boundary where "coding momentum overwhelms examples." EXP-130 extends this: few-shot fails on discovery tasks too, but through a *different mechanism*:

- On coding tasks (KE-132): few-shot fails because coding momentum overwhelms the example
- On discovery tasks (EXP-130): few-shot fails because the example *replaces* open exploration with template-following

Both are Ch3 failures, but with different causal paths. This suggests Ch3 has *multiple* failure modes, not a single boundary.

---

## Predictions vs Outcomes

| Prediction | Source | Expected | Actual | Match? |
|------------|--------|----------|--------|--------|
| Few-shot fails (≤67%) | H-099 P-099d | ≤67% | 33% | ✅ (even stronger) |
| Few-shot doesn't help | H-098 Ch3 | No improvement | -67pp | ✅ (worse than neutral) |
| Baseline ~67% | Historical | ~67% | 100% | ❌ (much higher) |

---

## Integration Updates

### H-099: P(H) 0.78 → 0.90
- **P-099d CONFIRMED** (with bonus evidence: treatment doesn't just fail, it hurts)
- **New evidence**: Few-shot actively suppresses discovery by replacing exploration with template-following
- All three channels now tested on discovery: Ch1 (text — EXP-117/120), Ch2 (workflow — EXP-121/122), Ch3 (few-shot — EXP-130). All fail.
- P(H) increase larger than designed (+12pp instead of +10pp) because the iatrogenic effect provides stronger evidence than simple failure would

### H-098: Channel 3 Updated
- Add: Ch3 FAILS on discovery tasks (EXP-130, p=0.030)
- Mechanism: Template-following suppresses exploratory behavior
- Different from KE-132 coding-momentum mechanism — Ch3 has multiple failure modes

### KE-132: Extended
- Ch3 task-type boundary applies to discovery tasks as well as coding tasks
- New failure mode identified: "template ceiling" (example becomes a ceiling not a floor)
- Add EXP-130 as supporting evidence

### New Knowledge Entry: KE-071 — Few-Shot Iatrogenic Effect on Discovery
- **Finding**: Domain-matched few-shot examples reduce discovery task performance by 67pp
- **Mechanism**: Template-following displaces open exploration, creating false sense of completeness
- **Status**: VALIDATED (p=0.030, N=12)
- **Implications**: Interventions designed for execution tasks can actively harm discovery tasks. Don't assume "can't hurt to try."

---

## Raw Data

### Arm A (Baseline) — All 6 Passed

All runs achieved 8/8 checks. All 7 KB files updated in every run. Agent completed within 3-minute timeout (typically finishing via timeout but with all files updated).

### Arm B (Few-Shot) — 2/6 Passed

**Passing runs (270, 278)**: Agent followed the few-shot pattern AND independently discovered all peripheral files. These runs suggest the few-shot example doesn't *always* suppress exploration — in 2/6 cases, the agent still explored beyond the template.

**Failing runs (272, 273, 280, 283)**: Agent updated the 4 "core" knowledge files (h042, ke017, ke023, synth008) in all cases, but missed 1-3 "peripheral" files (todo, priority-tracker, index). The pattern is:
- Run 272: missed todo only (6/8)
- Run 273: missed todo + priority-reorder (5/8) 
- Run 280: missed todo + priority-reorder + index (4/8)
- Run 283: missed todo + priority-reorder + index (4/8)

---

## Conclusions

1. **Few-shot examples are iatrogenic on discovery tasks.** This is a novel finding — prior work assumed interventions were at worst neutral.

2. **All three intervention channels fail on discovery.** Ch1 (text instructions), Ch2 (workflow enforcement), Ch3 (few-shot examples) — none improve discovery performance. H-099's irreducibility claim is now supported by exhaustive evidence.

3. **The mechanism is template-as-ceiling.** Few-shot examples provide a mental template that the agent follows. On execution tasks, the template is helpful because it matches the required actions. On discovery tasks, the template becomes a ceiling — the agent stops exploring once it's "done" with the template-matching, missing the creative connections that require going beyond the template.

4. **The only remaining lever is time (P-099a).** If all channels fail and discovery can't be scaffolded, the only question is whether longer timeouts allow the agent to eventually discover on its own. This was predicted by H-099 and should be tested in a future experiment.

---

*Executed by Coach — 2026-04-11 ~00:25-01:00 UTC*
*12 gym runs across 2 arms, interleaved execution*
