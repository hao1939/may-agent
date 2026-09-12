# Optional Host health read

Ordinary App observers can call `ctx.read.hostHealth({ lookbackMs })`. The
default is the last hour; the largest allowed window is one day. The shipped
composition supplies this read through optional reporting. Without it, the
call rejects. No new collector, scheduler, storage, tool policy or recovery
path is introduced.

The snapshot contains current running execution counts, ended execution
outcomes, undated terminal-row counts, and selected Host-boundary failure
events. It includes success, error, blocked, interrupted and unknown statuses
separately. These are all retained agent/workflow executions, including nested
calls and retries—not unique Tasks, product failures or App acceptance.

Ended executions and events use `[window.start, window.end)`. Running counts
describe the current read. Undated counts only cover recognized terminal rows
which started in the window; they are not a complete historical corruption
audit. Retention may have removed older rows. No counts imply complete lifetime
coverage or a healthy/unhealthy verdict.

Each recent-error list and the recent-event list contains at most 20 diagnostic
IDs. Totals are not capped; `errorsTruncated`/`truncated` expose omitted detail.
Reports omit transcript text, task instructions, agent configuration, provider
errors and raw event payloads. The failure-event vocabulary is the explicit
`HOST_HEALTH_FAILURE_EVENTS` list in `host-health.ts`, not every domain event
ending in `.failed`. Passive facts without a consumer are not counted as failures.

An App owns thresholds, interpretation and any route to work. For example,
an observer can return an App fact containing the snapshot; its subscription
may ask its existing owner Task to investigate. Neither the report nor its
collector chooses an agent, opens a Task or repairs state. `host-health-observer`
tests that path through the shipped daemon, event admission and workflow.

This API is for observer collection. Bounded workers receive relevant facts
through their App, not a global SQL or private-context escape hatch. Maintenance
App source and its registration changes require paired adoption after this Host
capability is available. Do not enable both the old private health job and its
replacement observer, and do not infer deployment authority from this source PR.
