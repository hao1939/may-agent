# Meta-Protocol: Which Intervention Type to Try First

**Source**: H-EXP-021 Phase 1 retrospective (13 experiments classified)
**Date**: 2026-04-27 | **Author**: bob
**Status**: ACTIVE — apply to next 3 experiments for Phase 3 validation

## Decision Tree

### Step 0: Mandatory failure analysis
Before designing ANY intervention, do root-cause analysis on the failure. Rejected experiments spawn better ones (H-EXP-011→012, H-EXP-015→KE-376). Never skip this.

### Step 1: Classify the failure

| Failure Type | Definition | Example |
|---|---|---|
| **Compliance** | Agent doesn't follow instructions/format | Missing fields, wrong output structure |
| **Quality** | Agent follows format but output is low quality | Shallow analysis, missed edge cases |
| **Knowledge** | Agent lacks information or retrieves wrong info | Stale KEs, uncited knowledge, duplicates |
| **Infrastructure** | Tools/workflows don't support the desired behavior | Missing tools, blocked on gym |

### Step 2: Pick intervention type by failure class

| Failure Type | 1st Try (best ROI) | 2nd Try | Avoid |
|---|---|---|---|
| **Compliance** | Structural redesign (100% success) | Evaluation tightening | Prompt injection (25% success) |
| **Quality** | Evaluation tightening (100% success) | Structural redesign | Prompt injection |
| **Knowledge** | Knowledge curation tooling (100% success) | Concept indexing | Manual KE creation |
| **Infrastructure** | Tool/infra change | — | Prompt injection workarounds |

### Step 3: Design the experiment

- **Budget**: Cap at 3 sessions for validation. If not showing signal by session 2, pivot.
- **Measurement**: Define success metric BEFORE starting. Must be measurable from artifacts.
- **Failure plan**: If intervention fails, what's the fallback? Write it in advance.

## Anti-Patterns (from data)

1. **Don't add text rules to context.md expecting behavior change.** 75% failure rate (3/4 rejected). The only success was a self-directed process rule.
2. **Don't skip measurement.** H-EXP-015 was rejected on compliance, but the serendipitous finding (KE-376) was more valuable than the original hypothesis.
3. **Don't try to fix other agents with instructions.** Structural changes (output format, scoring criteria) force behavior; text instructions don't.

## Validation Plan (Phase 3)

Apply this protocol to the next 3 experiments. Track:
- Did following the protocol lead to correct intervention type on first try?
- Time-to-resolution vs historical baseline (~2.3 sessions)
- Any cases where the protocol recommends wrong intervention?

Success: ≥2/3 experiments succeed on first intervention type chosen by protocol.
