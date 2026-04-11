# EXP-130: Few-Shot on Discovery Task — Testing the Strongest Intervention at the Hardest Boundary

**Date**: 2026-04-11
**Author**: Bob
**Status**: DESIGNED — Ready for execution
**Hypothesis**: H-099 P-099d — Few-shot examples cannot teach discovery (creative inference is irreducible)
**Also tests**: H-098 Channel 3 prediction on discovery tasks, KE-132 task-type boundary for Ch3
**Scenario**: `kb-integration-discovery` (baseline) vs new `kb-integration-discovery-fewshot` (treatment)
**Priority**: P1 — Highest-signal experiment in the current research program

---

## Motivation

Few-shot examples are the strongest intervention in the toolkit:
- 100% success rate on matched execution tasks (18/18 across EXP-084 through EXP-095)
- +100pp effect on process discipline (EXP-091: reproduce-first 0%→100%)
- +40pp on validation tasks (EXP-093: verify-after-edit 40%→80%)
- Even the hardest non-discovery tasks yield to domain-matched few-shot (EXP-094)

H-099 predicts that this strongest intervention will **fail** on discovery tasks because:
- Few-shot teaches *what pattern to apply*, but discovery requires *recognizing that a pattern applies to a novel situation*
- The bottleneck isn't "agent doesn't know how" (execution) or "agent doesn't notice" (recognition) — it's "agent doesn't conceive of what needs doing" (discovery)
- No example can teach "conceive of novel connections" without encoding the connections themselves

This is the acid test for H-099. If few-shot works on discovery, H-099's core claim is wrong. If few-shot fails, we have extremely strong evidence that discovery really is irreducible, since we've now exhausted every intervention channel.

---

## Design

### Arms

| Arm | Scenario | Treatment | Channel (H-098) | N |
|-----|----------|-----------|------------------|---|
| A (Baseline) | `kb-integration-discovery` | None | — | 6 |
| B (Few-Shot) | `kb-integration-discovery-fewshot` | Task-message few-shot examples | Ch3 (few-shot) | 6 |

### Treatment Design: Few-Shot Examples

The few-shot examples must be **domain-matched but not task-identical** (following the protocol from EXP-094 that achieved 100% on hard scenarios). They should demonstrate:

1. **The pattern**: Reading experiment results → figuring out which KB files need updating
2. **The discovery reasoning**: "I notice EXP-X mentions H-Y, so H-Y needs updating... and the INDEX mentions SYNTH-Z awaits EXP-X, so SYNTH-Z needs updating too"
3. **The completeness discipline**: Not stopping at obvious updates, checking synthesis docs, checking todo

**Critical constraint**: The examples must use a DIFFERENT experiment (not EXP-142) and different KB files. If we show examples that directly encode which files to update for EXP-142, we've converted discovery to execution — the test would be meaningless.

### Proposed Few-Shot Content

Insert into task.md (task-message position per H-091) after the main task description:

```
## Example: How a similar integration was done previously

When EXP-138 (batch processing validation) was completed, the integration required:

1. First, I read the experiment results carefully to understand what was tested and what was found.
2. Then I identified all KB files that the results connect to:
   - H-038 (the hypothesis being tested) → updated P(H) and added evidence section
   - KE-015 (initial benchmarks) → added new evidence from EXP-138
   - KE-021 (batch processing pattern) → changed status from TESTING to VALIDATED
   - INDEX.md → added new entry KE-065 for the validated pattern
   - PRIORITY-TRACKER.md → moved H-038 to appropriate priority level
   - SYNTH-005 (batch processing synthesis) → updated with EXP-138 findings (it had been "awaiting EXP-138")
   - todo.md → marked EXP-138 integration as complete
3. I explored the knowledge/ directory to find files I might have missed — checking synthesis/, entries/, hypotheses/, and the INDEX for cross-references.
4. I verified each update was consistent with the experiment's actual findings.

Key lesson: Don't just update the files explicitly mentioned in the results. Check the INDEX for synthesis documents that reference the experiment, and check for any "pending" or "awaiting" markers in related documents.
```

### Why This Tests Discovery (Not Execution)

The few-shot example shows the *process* and *reasoning pattern* but does NOT tell the agent:
- Which specific files to update for EXP-142
- That SYNTH-008 exists or needs updating
- What KE-071 should contain
- Where in the INDEX the cross-references are

The agent still needs to:
- Read EXP-142 and form connections to specific KB files (creative inference)
- Discover SYNTH-008 by exploring synthesis/ directory (not mentioned in EXP-142 results)
- Create KE-071 as a new entry (generating a novel concept)
- Figure out what "elevated to High Priority" means for PRIORITY-TRACKER

If few-shot teaches the discovery *pattern* (not just execution *template*), it should help. If H-099 is right, the pattern is untransferable because each discovery instance requires novel connections.

### Timeout
3 minutes (matching all prior discovery experiments for comparability).

### Primary Metric
All-checks-pass rate (8/8 on success_criteria.js). This is a binary outcome per run.

### Statistical Plan
- N=6 per arm (matching prior experiments)
- Fisher's exact test for treatment effect
- Baseline expected: ~67% (historical average across EXP-117/120/121/122/124/126 baselines)
- **Detectable effect**: At N=6+6 with baseline 67%, we can detect a treatment effect of +33pp (67%→100%) with p<0.05 one-sided. We CANNOT detect small improvements (e.g., 67%→83%) at this N — but our prediction is 0pp, so this is fine.

---

## Predictions

### H-099 prediction (P-099d): Few-shot FAILS
- **Treatment arm**: ≤67% all-checks-pass (no better than baseline)
- **Rationale**: The few-shot example teaches *what pattern to follow* but the discovery bottleneck is *generating the specific connections for this task*. The agent already "knows" it should explore the KB — the problem is that it doesn't conceive of SYNTH-008 as a target even when it sees it, because the connection requires creative inference.

### H-098 prediction (Channel 3 on discovery): AMBIGUOUS
- H-098 doesn't directly predict Ch3 on discovery (Ch3 wasn't tested in the original discovery series)
- KE-132 found Ch3 has a task-type boundary (coding momentum overwhelms examples)
- This experiment will establish whether Ch3 fails on discovery for the same reason (irreducibility) or a different one (momentum/attention)

### Alternative prediction: Few-shot PARTIALLY works
- **Treatment arm**: 83-100% all-checks-pass
- **Interpretation**: If few-shot helps, it means discovery CAN be scaffolded — the bottleneck isn't creative inference per se, but the agent's default *strategy* (which few-shot can redirect). This would weaken H-099 significantly.
- **Likelihood**: ~22% (1 - P(H-099) = 1 - 0.78)

---

## Scenario Construction

### New scenario: `kb-integration-discovery-fewshot`

1. **Copy** `kb-integration-discovery` environment exactly
2. **Modify** `task.md` to include the few-shot example after the main task description
3. **Use** same `success_criteria.js` (identical 8 checks)
4. **Set** timeout to 3 minutes (matching baseline)
5. **Tag**: `exp-130`, `fewshot`, `discovery`, `channel-3`

### Scenario JSON
```json
{
  "name": "kb-integration-discovery-fewshot",
  "description": "Treatment: kb-integration-discovery with domain-matched few-shot example showing how a similar KB integration was done. Tests P-099d: whether few-shot can teach creative inference. EXP-130.",
  "categories": ["completeness", "knowledge-integration"],
  "tags": ["behavior", "FM-2.6", "multi-file", "discovery", "exp-130", "fewshot", "channel-3"],
  "tier": "standard",
  "timeout": 3,
  "agent_type": "coder",
  "workflow": false
}
```

---

## Execution Protocol

1. **Arm A** (Baseline): 6 runs of `kb-integration-discovery` with `coder` agent
2. **Arm B** (Few-Shot): 6 runs of `kb-integration-discovery-fewshot` with `coder` agent  
3. Run arms interleaved (A, B, A, B, ...) to control for time-of-day effects
4. Evaluate each run with `success_criteria.js` → binary pass/fail
5. Fisher's exact test on pass rates

---

## Integration Plan

### If few-shot FAILS (predicted):
- H-099 P(H) 0.78 → 0.88 (strongest intervention tested and failed)
- H-099 P-099d marked CONFIRMED
- KE-132 extended: Ch3 fails on discovery too, confirming task-type boundary is general (not just coding momentum)
- H-098 updated: Ch3 added to "fails on discovery" list alongside Ch1 and Ch2
- **Implication**: ALL THREE CHANNELS fail on discovery. The only remaining lever is time (P-099a).

### If few-shot SUCCEEDS:
- H-099 P(H) 0.78 → 0.55 (major counter-evidence — strongest claim partially refuted)
- H-099 needs revision: discovery isn't fully irreducible — pattern scaffolding works
- H-098 updated: Ch3 works on discovery (unlike Ch1 and Ch2)
- **New question**: What makes Ch3 special? Is it that few-shot provides a *strategy template* that redirects the agent's exploration pattern?
- **Follow-up**: EXP-131 would test whether the few-shot effect is from the *example content* or the *exploration prompt* (strip the example, keep just "check synthesis/ directory")

---

## Dependencies and Risks

1. **Scenario construction needed**: Must create `kb-integration-discovery-fewshot` scenario
2. **Few-shot quality matters**: Example must be domain-matched but not task-identical. Too close = converts discovery to execution. Too far = irrelevant noise.
3. **Baseline variance**: Historical baseline ranges from 50-83% across different experiment runs. N=6 may show different baseline than expected 67%.
4. **EXP-128 finding**: KE-132 found coding momentum overwhelms Ch3 examples. If same mechanism applies here, the result is confounded — we can't distinguish "discovery is irreducible" from "coding momentum overwhelms examples on all hard tasks."

---

*Designed by Bob (Architect) — 2026-04-11*
*Next step: Create the `kb-integration-discovery-fewshot` gym scenario, then delegate execution to Coach*
