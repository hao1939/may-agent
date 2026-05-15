# Dev heartbeat: null-error steward watch

Date: 2026-05-08

## Goal
Run the dev heartbeat loop: check approved work, inspect runtime health, handle pending lifecycle signals, and decide whether a code change is warranted.

## Signals checked

### Work queue
- `agents/shared/work-queue.md` has no unchecked items under `## Approved`.
- There are many P0/P1 items under `## Proposed`, but dev's standing plan gates implementation on Approved items.

### Active metrics
Core runtime metrics are healthy enough for routine maintenance:
- `session.error-rate-6h`: `0.0388` with alert op `>` threshold `0.3`.
- `handler.success-rate`: `1` with alert op `<` threshold `0.8`.
- `handler.failed-count`: `0` with alert op `>` threshold `10`.
- The unmeasured active metrics query returned `0` rows.

### Alerts
- One unresolved metric alert exists: `alert#136`, `metric_id=v2.spec-coverage-rate`, message `current=0.1364, threshold=0.8, target=1`.
- The metric owner is `may`, not dev. Current steward prompts show this is already judged as `waiting_with_evidence` on the pending-review `v2-spec-coverage-buildout` work.

### Pending events / inbox
- Pending events visible to this heartbeat are lifecycle/runtime telemetry (`session.start`, `session.end`, `handler.started`, `handler.completed`, `context.read`) plus evaluator escalation records for recent may errors.
- Decision: conceptually dismiss dev heartbeat lifecycle items as already acted by this run; do not hand-edit DB event state. Non-dev handler/evaluator lifecycle events are observed, not delegated.

## Failure triage
Recent `sessions.status='error'` rows include repeated pairs:
- `may` `closed-loop-steward` sessions `s_1778203539819_150` and `s_1778205939498_158` ended `error` with `error=NULL` and empty summary.
- Corresponding evaluator aftermath sessions `s_1778203540602_151` and `s_1778205940263_159` also ended `error`.

Evidence from session transcripts via JSON extraction showed the may sessions had only the user prompt followed by an empty assistant message (`content: []`) whose `stopReason` was `error`. The transcript-level `errorMessage` was a model/provider authentication failure: `401 ... Github_copilotException - IDE token expired: unauthorized: token expired ... Received Model Group=claude-opus-4.6`. Session rows still recorded `error=NULL`, so the DB summary hides the root cause even though the transcript contains it.

Counter-signal: later `closed-loop-steward` sessions completed successfully, and handler metrics remain healthy (`handler.success-rate=1`, `handler.failed-count=0`). This indicates a transient provider/token issue rather than a currently broken handler implementation.

## Judgment
No code patch is warranted this heartbeat. The highest-impact actionable queue is empty, handler health is green, all active metrics have fresh snapshots, and the only open alert is may-owned pending-review work. The latest error cluster is now explained as provider token expiry, and later steward runs recovered; if this repeats in consecutive future runs or raises `session.error-rate-6h`, investigate provider-token alerting and why `sessions.error` remains null when transcript `errorMessage` is present.

## Follow-up watchpoints
- Empty Approved queue continues to be the main dev throughput blocker.
- Watch for repeated `status='error' AND error IS NULL` sessions where transcript `errorMessage` contains a provider failure; if persistent, inspect the session runner's propagation of transcript error messages into `sessions.error`.
