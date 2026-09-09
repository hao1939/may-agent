# Host maintenance

This adapter runs named deterministic Host duties. It cannot launch an agent or
workflow. App work uses SDK schedules/observers, declared event admission, and
bounded Task attempts. Maintenance is not another work authority.

`contracts.ts` owns the private declaration. `configuration.ts` reads the
conventional agent-local `cron.json`; a declaration names a module in the adjacent
`handlers/` directory. `handler-loader.ts` supplies the private capabilities in
`context.ts`. These are trusted Host modules, not sandboxed App workflows.

`composition/maintenance.ts` prepares registrations during agent-generation
preparation, whether or not the agent has the `cron` tool. No timer or subscription
starts during loading. After publication, `composition/maintenance-activation.ts`
attaches observations and optionally enables interval timers. The `--cron` flag
selects optional timers, not Task startup, recovery, or event observations.

The `cron` tool only lists or updates **existing** maintenance declarations.
It does not construct a scheduler, add jobs, or author model prompts. Its edits
reload the same registrations. External file edits require explicit reload or
restart. Activation uses the prepared declarations rather than rereading files.
Invalid replacement configuration retains the previous active set.

## Execution and failure

Each named duty is single-flight. A timeout signals cancellation but does not
free the duty for overlapping side effects until its callback actually settles.
Handlers should respect the optional abort signal. Retiring a generation stops
future timers/subscriptions and discards queued observations; already-running
callbacks drain under their existing timeout. This is not live code unloading.

The retained maintenance observation buffer holds at most three pending events
per duty, with reported keep-latest overflow and bounded error backoff. It is
**best-effort**, never durable App acceptance. Work-critical input needs normal
Task/request admission. Timer callbacks may recollect current state; required
payloads must not rely solely on this buffer for recovery.

`handler.started/completed/failed` remain diagnostic evidence for existing health
readers. Start publication failure does not count as a run or hold the duty busy.
Failure-report publication falls back to process diagnostics rather than causing
an unhandled rejection. Restart cadence uses maintenance start evidence only,
not workflow runs. App schedule slots keep their separate publication semantics.

## Removed path

Standalone workflow-backed jobs, auto-heartbeat workflow discovery, synthetic
App registrations, configurable concurrent job execution, and prompt-based cron
authoring are removed. Obsolete work declarations are rejected explicitly: move
them to the existing App schedule and Task contracts, not another wrapper.

The retained installed duties are escalation routing, session recovery, metric
snapshots, operations health review, and the daily operations digest. Their
named callbacks and private capabilities are preserved. No App maintenance
configuration or live installation is changed by the Host refactor.

The governing design is [Scheduling and Observation](../../../../../may-agent.app/docs/2a-design/cron.md).
This guide describes implementation ownership, not deployment proof.
