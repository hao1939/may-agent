# Dev heartbeat: provider-token recovery check

Date: 2026-05-08

## Goal
Handle the dev heartbeat by checking the approved queue, runtime metrics, pending lifecycle events, and recent failures for the highest-impact actionable issue.

## Queue and inbox judgment
- `agents/shared/work-queue.md` has no unchecked items under `## Approved`; dev has no approved implementation item to pick up.
- Pending dev inbox items are lifecycle telemetry from recent dev heartbeat starts/ends. Decision: dismiss as already acted by this heartbeat; do not hand-edit event rows.
- Non-dev pending events observed in the DB are handler/session lifecycle records plus may-owned stewardship messages; decision: observe only, not dev-owned.

## Runtime health evidence
Latest active metric query showed:
- `handler.success-rate = 1` with threshold `0.8` (`<` alert), healthy.
- `handler.failed-count = 0` with threshold `10` (`>` alert), healthy.
- `session.error-rate-6h = 0.0396` with threshold `0.3` (`>` alert), healthy.
- Unmeasured active metrics query returned 0 rows.

## Failure triage
Recent `sessions.status='error'` rows in the last 6h total 4: two may `closed-loop-steward` sessions and two evaluator aftermath sessions.

Transcript extraction for the may steward errors (`s_1778203539819_150`, `s_1778205939498_158`) showed the root cause was not a handler bug: each transcript contained an assistant message with `stopReason: error` and `errorMessage` containing `401 ... Github_copilotException - IDE token expired: unauthorized: token expired ... Received Model Group=claude-opus-4.6`.

## Judgment
No code patch is warranted in this heartbeat. The top failure pattern is a recovered provider/token failure whose details are present in transcript history but not propagated into `sessions.error`; later steward sessions completed successfully and current handler metrics are green.

## Watchpoint
If future heartbeats see more `status='error' AND error IS NULL` rows whose transcript contains a provider `errorMessage`, investigate the session runner's propagation of transcript errors into the `sessions.error` column or add alerting for provider-token expiry.
