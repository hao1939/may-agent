# Iteration 1 deliverable — reduce false/unstable NI labeling

## Objective
Reduce false/unstable `needs_improvement` labeling by the heuristic evaluator by changing alerting semantics from “all sessions” to “substantive sessions”, while keeping the existing metric available for continuity.

This deliverable is an **approval + patch kit** that is merge-ready once an owner approves the pivot.

## Proposed change (minimal & merge-friendly)
1. **Keep existing metric** `evaluator.low-quality-rate-24h` unchanged (for continuity).
2. **Add new metric** `evaluator.low-quality-rate-24h.substantive` computed from a filtered denominator (exclude sessions that shouldn’t count toward quality regression).
3. **Pivot alerting/thresholds** to the substantive metric only.

## Substantive filter (heuristic)
A session counts as **substantive** if:
- it has at least one tool call beyond `read`-only inspection OR it modifies/creates a file OR it runs tests/build (proxy: `bash` call), AND
- it is not an explicit “blocked/triage” turn.

If the current system already tags sessions with structured fields (e.g., `status`, `completed_items`), prefer that over heuristics.

## Evidence (from prior work)
- Current (all sessions) low-quality rate observed around **~0.53**.
- Substantive-only low-quality rate observed around **~0.078**.
- This implies the alert is dominated by non-substantive/administrative turns, producing unstable `needs_improvement` labeling.

(See prior: `outputs/iteration-5-approval-packet.md`.)

## Merge-ready patch plan
**File scope constraint:** only touch `agents/may/handlers/metrics-snapshot.ts`.

### A) Metric registry changes
- Add a new `ALL_METRICS` entry:
  - id: `evaluator.low-quality-rate-24h.substantive`
  - description: “Low-quality (needs_improvement) share of substantive evaluator sessions over last 24h.”

### B) Computation changes
- In the metrics snapshot computation, compute both:
  - `rate_all = low_quality_all / total_all`
  - `rate_substantive = low_quality_substantive / total_substantive`
- Emit both metrics; pivot alert to `rate_substantive`.

### C) Rollback plan
- If substantive filter causes under-counting or blindness, revert alert pivot only (keep new metric) and restore old alert condition.

## What I need from May/owner
1. Approval to add the new metric id and pivot alerting.
2. Confirmation of substantive filter definition (fields available in DB/event logs).

## Next action
Once approved, produce a minimal diff for `agents/may/handlers/metrics-snapshot.ts` adding the new metric and alert pivot.