# Runtime Storage

**Design status:** Accepted.
**Implementation status:** SQLite holds canonical work and admission state;
files hold full execution artifacts. Bounded read projections coexist with
those authorities.

## Decision

SQLite is authoritative for Tasks, attempts, accepted results, Conditions,
requests, admission records, Events and Conversation relationships. It also
holds indexes and read projections. The database cannot be discarded and
rebuilt from transcripts. Backup and recovery must preserve both the database
and its referenced artifacts.

Files hold full prompts, transcripts, workflow inputs/results, large event
bodies and evaluation evidence. Keeping these payloads out of bounded resource
rows does not make the resource rows disposable.

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

SQLite resource rows retain the bounded state needed for correctness. Artifact
projections retain what a query needs without opening a file: identity, lifecycle status, ownership, timestamps,
lineage, counters, short previews, common correlation fields, and artifact
reference/hash/size metadata.

## Record Ownership

| Record | Authority and storage | Rebuildability |
| --- | --- | --- |
| Tasks, attempts, accepted results/receipts, Conditions and links | Canonical SQLite Task resource rows and fenced transactions | Not reconstructible from session artifacts; preserve the database |
| Host input handling and cross-App request correlation | SQLite request rows, exact Task/dependency links and accepted results | Not disposable; preserve identity and accepted state |
| Accepted conversational Requests | SQLite `conversation_requests`: scope, revision, exact Task links and closure | Not reconstructible from input completion; preserve accepted obligations |
| Pending admission and ordered Task input | SQLite admission journal and Task-event links | Required to recover unaccepted input; an in-memory queue is only a hint |
| Event and causal links | SQLite identity, envelope and trace; large bodies in content-addressed files | Requires retained rows and referenced bodies; transcripts are not substitutes |
| Conversation messages, Topics and Task links | Durable message evidence and canonical SQLite Topic/correlation records | Read views derive from retained evidence; exact links are authoritative |
| Session | `meta.json`, `session.jsonl`, `result.json` | Bounded SQL lifecycle/index rows derive from retained artifacts |
| Workflow run | `workflow-runs/<id>/run.json` | Bounded SQL run projection derives from retained artifacts |
| Session digest/evaluation | Evaluation facts, `session.eval.jsonl` and referenced evidence | Summary queries are projections; rebuilding requires retained evidence |
| Metrics and alerts | SQLite definitions, samples and alert state | Definitions may be reloaded; historical samples cannot be recreated by remeasurement |
| Task lists, human-action views, event graphs and dashboards | Read projections of the authorities above | Disposable views; never restore Task state from presentation |

Host inbox rows track input handling. Separate `conversation_requests` implement the
[conversational Request contract](message-lifecycle.md#requests-acceptance-and-closure)
across turns. The Host fences updates by revision and commits closure with its
explanatory Conversation message in one transaction. The App judges whether
the accepted ask is fulfilled. Input completion is not fulfillment, and Request
storage does not copy Task progress or own execution.

Small Event bodies remain inline. Large bodies are written to the
content-addressed store before their event row commits; SQL retains a bounded
projection and the artifact reference.

Keep resource writes bounded. Retention limits row count and cannot compensate
for unbounded payloads. Historical storage incidents belong in review evidence,
not in the definition of authority.

## Write And Recovery Contract

Canonical Task transitions use a version- and attempt-fenced SQLite transaction
that commits accepted state and its related records atomically. Requests and
admission records have their own durable coordination boundaries; see
[Events](events.md) and [Task Resource Engine](task-resource-engine.md).

Claimed request attachment commits Task input, request wait/claim release and
Topic correlation together. Settlement persists linked request readiness in
the same transaction; an event notification only accelerates discovery.
Retained input is not necessarily runnable work: retry-exhausted attention
must ready linked requests for review without permitting another execution.
Ordinary attention with new eligible input must wait for a fresh result.
Request attachment and the retry-exhaustion readiness correction are merged
at the [source baseline](../README.md). The [storage proposal](../proposals/storage-state-service.md)
records their proof and considers further extraction.

For artifact-backed records, the file and its SQL projection use this order:

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

Current writes use one schema and one session layout. Explicit bounded read or
migration adapters may interpret retained historical rows, but compatibility
never becomes a second writer, path, or mutable authority. Missing references
in current state are integrity errors, not an alternate storage mode.

## Agent Boundary

Storage is Host context outside agent generation. The agent uses its
normal generate and tool APIs; it does not call a private infra-context API.
Infra resolves artifacts and prepares context before `agent.run`, then persists
results and emits events after the run. This keeps every agent usable without
the autonomous event/task/metric runtime.
