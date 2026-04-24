# Delegation Quality Diagnostic

**Date**: 2026-06-17 | **Metric**: 0.79 vs 0.85 target | **Severity**: Medium

## How Delegation Quality Is Computed

The metric is tracked as a ratio in the tech-lead's heartbeat context (`agents/tech-lead/workspace/heartbeat-context.md:35`). The target of 0.85 was set in `agents/tech-lead/scripts/refine-metrics-2026-04-18.ts:9`.

The underlying data comes from two sources:
1. **`agents/evaluator/skills/delegation-metrics.cjs`** — computes Task Success Rate (TSR) and Integration Success Rate (ISR) from `.state/delegations.jsonl` (1,289 entries total, `delegation-metrics.cjs:1-176`). TSR = callee reports success; ISR = caller's parent session also succeeds.
2. **Per-session evaluation scores** — the evaluator grades each delegated session on FM criteria (FM-2.6 drift, FM-3.3 deliverable integrity, etc.), producing a 0-1 quality score per session.

The 0.79 ratio appears to be an aggregate of per-session quality scores across recent delegated sessions.

## Prior Finding (Still Relevant)

A detailed investigation already exists at `agents/tech-lead/workspace/finding-delegation-quality-gap.md`. It found the metric at 0.73 (now improved to 0.79). The three root causes identified then remain the primary drivers of the 0.06 remaining gap:

## Top 3 Reasons Delegations Score Low

### 1. Evaluator Zero-Score Bug on Self-Delegations (~3pts drag)
**Evidence**: `finding-delegation-quality-gap.md:27` — Same-agent delegations (coach→coach, bob→bob) receive `quality=0` with issue "evaluator did not score this session (duplicate agent name)." These zeros drag the average without reflecting actual quality.
**Impact**: Fixing or excluding these would raise the metric from ~0.79 to ~0.82.

### 2. Unbounded Investigation Tasks — FM-2.6/FM-3.3 Failures (~2pts drag)
**Evidence**: `finding-delegation-quality-gap.md:33-38` — Tech-lead lens sessions (self-delegated investigations) average 0.63 quality (n=26). They fail on:
- **FM-2.6 (DRIFT)**: Investigation wanders from stated question
- **FM-3.3 (DELIVERABLE_MISSING)**: Deliverable file not written before session ends
- **PHASE_VIOLATION**: Op budget exceeded

Per `agents/tech-lead/workspace/common-sense-feedback.md:19`, delegation quality correlates strongly with bounded tasks + explicit file scope (KE-013).

### 3. Coder Retry Sessions Produce Scope Violations (~1pt drag)
**Evidence**: `finding-delegation-quality-gap.md:40-42` — Verified-coder workflow retry sessions ("attempt 2/2") average ~0.40 quality (n≈6). Issues: `SCOPE_VIOLATION`, `FM-3.3/VERIFICATION_FAILURE`, `MISALIGNED_SUCCESS`. The retry task lacks sufficient context about what specifically failed.

Additional: `.state/delegations.jsonl` shows infrastructure errors (empty model responses, JSON parse errors, request aborts) account for ~15 of 1,289 entries — these are API-level failures, not delegation quality issues, but they may be counted against the metric.

## Concrete Recommendations (Do NOT Implement Here)

### R1: Exclude or Fix Self-Delegation Scoring (Est. +0.03)
In the evaluator's session scoring logic, either evaluate same-agent delegations normally or exclude them from the delegation-quality aggregate. This is the single highest-ROI fix.

### R2: Make Investigation Tasks More Bounded (Est. +0.02)
For tech-lead lens/investigation tasks: specify exact output format, exact file scope (max 3 files), and a hard deliverable path in the task description. The current phase-boundary system (as in this session's prompt) is the right pattern — adopt it universally for all self-delegated investigations.

### R3: Enrich Retry Context in Verified-Coder Workflow (Est. +0.01)
When the verified-coder workflow retries, include: (a) the specific test output/error, (b) the diff of what the first attempt changed, (c) explicit "do NOT touch files outside X." Currently retry tasks say "fix the failing verification" without enough context, causing scope drift (`agents/tech-lead/workspace/system-gaps.md:37`).

### R4: Filter Infrastructure Errors from Quality Metric
API-level failures (empty model responses, JSON parse errors per `.state/delegations.jsonl`) should not count as delegation quality failures. They're infrastructure issues.

## Expected Impact

If R1-R3 are implemented: 0.79 → ~0.85 (meeting target). R1 alone gets to ~0.82.
