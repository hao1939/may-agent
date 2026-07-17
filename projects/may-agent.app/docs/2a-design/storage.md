# Runtime Storage

**Design status:** Accepted.
**Implementation status:** Implemented with file-backed artifacts and bounded
SQLite projections.

## Decision

SQLite is the runtime's bounded metadata, index, and coordination store. It is
not the archive for prompts, transcripts, workflow inputs/results, large event
bodies, or evaluation evidence.

Files are authoritative for full execution artifacts:

```text
.state/sessions/<id>/meta.json
.state/sessions/<id>/session.jsonl
.state/sessions/<id>/result.json
.state/sessions/<id>/session.eval.jsonl
.state/workflow-runs/<id>/run.json
.state/event-bodies/<sha256>.json
```

Session paths are immutable. A session remains under
`.state/sessions/<id>/` from creation through idle, terminal, and resumed
states. Lifecycle changes update `meta.json`, marker files, and the SQLite read
model; they never rename or relocate the session directory.

This is a storage invariant, not an optimization preference:

> A session ID owns exactly one filesystem path for its entire lifetime.

Moving completed sessions creates no retention value. It does not reclaim
space, and it introduces broken references, rename failure windows, collision
handling, and unnecessary resume logic.

SQLite keeps only what a query, join, scheduler, or coordinator needs without
opening an artifact: identity, lifecycle status, ownership, timestamps,
lineage, counters, short previews, common correlation fields, and artifact
reference/hash/size metadata.

## Why

The old layout stored the same large task in session files, `sessions`,
`workflow_runs`, `session.start`, and `session.end`. The database consequently
contained gigabytes of live payload. Deleting rows followed by `VACUUM` could
not solve that: `VACUUM` rewrote the remaining live gigabytes and blocked May's
event loop.

The invariant is therefore about writes, not cleanup:

> Keep every new SQLite write bounded. Retention limits row count; it must not
> compensate for unbounded row size.

## Record Ownership

| Record | Authoritative content | SQLite projection |
| --- | --- | --- |
| Session | `meta.json`, `session.jsonl`, `result.json` | lifecycle, lineage, counters, task preview/reference |
| Workflow run | `workflow-runs/<id>/run.json` | lifecycle, lineage, source revision, task preview/reference |
| Event | inline bounded body or content-addressed body file | routing, delivery, causality, common correlation fields, bounded body projection |
| Session digest | session/evaluation artifact trail | classification, short summaries, task reference |
| Evaluation | `session.eval.jsonl` and referenced evidence | verdict, scores, timestamps, short issue summary |
| Metric | SQLite | current value/config and bounded snapshots; metrics are coordination data |

Small event bodies may remain inline because they are themselves bounded
coordination data. Bodies over the inline limit are written atomically to the
content-addressed store before the event row is committed. Their SQL `data`
contains a bounded compatibility projection plus the artifact reference.

## Write And Recovery Contract

Artifact-backed writes follow this order:

```text
serialize -> write temporary file -> atomic rename -> write SQL projection
```

If the file write fails, the SQL row is not committed. If SQL fails after the
rename, the file is a harmless orphan and a later reconciler may rebuild the
projection or garbage-collect it. A SQL row must never point at a file that was
not durably renamed first.

Content-addressed event bodies are immutable. Mutable session and workflow
records use atomic replace and publish the new hash/size in the SQL projection.
Readers verify a hash when correctness depends on exact content; a mismatch is
reported as storage corruption rather than silently using different content.

## Query Contract

Do not parse full bodies or use `task LIKE` as an identity mechanism. Producers
persist frequently queried event dimensions explicitly:

```text
session_id, workflow_run_id, project_id, task_id, attempt_id,
handler, metric_id, alert_id, escalation_id, subject_status, duration_ms
```

Queries use typed columns. Full-content inspection resolves the artifact
reference.

## Retention And Maintenance

Retention is bounded work owned by the runtime maintenance boundary, not by an
agent or a metrics handler:

- delete a fixed-size batch and stop;
- never loop until a table is empty in a live request;
- never run full `VACUUM` in May's event loop;
- use passive WAL checkpoints during normal operation;
- run disruptive compaction only as an explicit offline operator action;
- delete an artifact only after no retained metadata row or domain record
  references it.

Database size is an observability signal, not a trigger for synchronous full
rewrites. With bounded rows, old rows can age out naturally and incremental
reclaim can remain opportunistic.

## Canonical Layout

The runtime supports one current schema and one session layout. Historical
state is normalized once during deployment; runtime readers do not carry
fallback paths or legacy-schema branches. Missing references are integrity
errors, not an alternate storage mode.

## Agent Boundary

Storage is infrastructure context outside agent generation. The agent uses its
normal generate and tool APIs; it does not call a private infra-context API.
Infra resolves artifacts and prepares context before `agent.run`, then persists
results and emits events after the run. This keeps every agent usable without
the autonomous event/task/metric runtime.
