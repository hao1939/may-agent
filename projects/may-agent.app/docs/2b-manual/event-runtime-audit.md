# Event Runtime Audit

**Supports:** [Events And Task Admission](../2a-design/events.md). Checks admitted input, delivery and ownership through the real event path.

**Choice basis:** [Core Principles](../1-principles/core-principles.md#convention-over-configuration).

Use this guide to compare the running system with the event design. Keep live
row counts and one-off findings in runtime reports or task evidence, not in the
stable design doc.

## What To Check

The audit answers three questions:

1. Which event types are currently emitted?
2. Which handlers or runtime components consume them?
3. Which events are admitted, unhandled, or waiting for a paired close?

The event table has retention, so counts are windowed facts. A zero count means
"not seen in the retained window", not "impossible".

## Emitter Reality

Query the retained event window:

```sql
SELECT event_type, COUNT(*) AS rows, MAX(timestamp) AS last_seen
FROM events
GROUP BY event_type
ORDER BY rows DESC;
```

Check for malformed event names:

```sql
SELECT id, event_type, source, owner, timestamp
FROM events
WHERE LENGTH(event_type) > 100
   OR event_type LIKE '{%'
   OR event_type NOT LIKE '%.%';
```

Malformed event names usually mean an ingress path bypassed canonical envelope
normalization. Fix the emitter path instead of teaching handlers to accept the
bad shape.

## Consumer Reality

Check recent handler activity:

```sql
SELECT handler_name, COUNT(*) AS runs, MAX(started_at) AS last_started
FROM handler_runs
WHERE started_at > unixepoch() * 1000 - 86400000 * 7
GROUP BY handler_name
ORDER BY runs DESC;
```

Then compare the emitted event types with handler subscriptions in code:

```bash
rg -n 'on:|events:|subscribe|project\\.owner\\.requested|session\\.end|metric\\.breach' \
  agents projects packages projects/may-agent/src
```

Before adding a new `on:`-only handler:

1. Confirm the source event is emitted in the retained window.
2. Confirm the event has a stable owner and target context.
3. Add a timer fallback only when delayed or backfill behavior is required.

Before adding a new event type to `SystemEvent`:

1. Identify the emitter site in code.
2. Identify the consumer or owner route.
3. Decide whether the event needs pair tracking.

## Admission Health

Event admission is not work completion. The current schema still calls its
routing fields `delivery_*`; use them to find admission gaps:

```sql
SELECT id, event_type, owner, source, timestamp, delivery_status,
       accepted_by, delivery_route, delivery_note
FROM events
WHERE delivery_status IN ('pending', 'unhandled')
ORDER BY timestamp DESC
LIMIT 100;
```

Interpretation:

- `delivery_status='unhandled'` means no responsible route accepted the event
  within its TTL.
- A missing specialized App/task/internal acceptance means the event remains
  pending; there is no generic owner fallback that can turn routing into work.
- `delivery_route='noop'` is only a legacy baseline marker for old rows.

## Pair Health

Opening events with expected closing events should appear in pair tracking:

```sql
SELECT pair_name, correlation_key, owner, status, opened_at,
       expected_close_at, closed_at, note
FROM event_pair_runs
WHERE status != 'closed'
ORDER BY expected_close_at ASC
LIMIT 100;
```

An orphan is an investigation signal. It can mean stuck work, a missing close
event, a wrong correlation key, a bad timeout, or an event naming issue.

## Semantic Trace Health

Structural integrity is necessary but insufficient. One default singleton
trace row per event can pass dangling-reference checks while causal propagation
and closure are broken.

Find closed pairs whose authoritative closure link was not persisted:

```sql
SELECT p.pair_name, p.open_event_id, p.close_event_id, p.closed_at
FROM event_pair_runs p
LEFT JOIN event_trace_links l
  ON l.from_event_id = p.close_event_id
 AND l.to_event_id = p.open_event_id
 AND l.type = 'closure'
WHERE p.status = 'closed'
  AND l.id IS NULL
ORDER BY p.closed_at DESC;
```

Find opener/closer trace splits:

```sql
SELECT p.pair_name, p.open_event_id, p.close_event_id,
       ot.trace_id AS open_trace, ct.trace_id AS close_trace
FROM event_pair_runs p
JOIN event_traces ot ON ot.event_id = p.open_event_id
JOIN event_traces ct ON ct.event_id = p.close_event_id
WHERE p.status = 'closed'
  AND ot.trace_id != ct.trace_id;
```

For human-rooted work on the current implementation, verify the trace plus
durable App lineage. One trace is
not expected to own every asynchronous attempt:

```text
conversation.message.created (target.appId=may, author.kind=human)
  -> exact bounded May frontend request
    -> direct Conversation answer, or responsible Task admission and Topic link
      -> meaningful Task event wakes May's supervision Task
        -> accepted Task result and optional Conversation update
          -> independent adapter rendering attempt
```

Also check that each human semantic message has one bounded May frontend
request and either a direct persisted answer or one accepted typed request or
exact-Task feedback. The frontend request does not stay open for destination
work. Topic links, exact Task references, and event identities preserve durable
work and supervision across restarts. Adapter attempt IDs diagnose
presentation only.
Direct-agent
persistent-chat turns, if used, must have distinct traces unless reply context
links them.

The accepted [unified route](../2a-design/conversation-execution.md#one-conversation-input-path)
will replace the supervision hop with a source-marked conversation inbox item.
Audit that path only after its implementation lands. Verify Task/timer input
identity, quiet completion and Request closure; do not interpret a system
review as another human request or require another Task to handle it.

For Conversation reads, also verify that non-human semantic messages create no
May request and transient messages do not replay. A command/tool view is
appended as seen human context only after the adapter actually rendered it;
May results require no delivery receipt to enter Conversation.

Trace tests should cover new May requests, later/corrective requests, approval,
cancellation, cross-App Task dependencies and results, failure, and recovery. Compatibility
execution tests separately cover async fork/workflow/CLI events and direct-chat
cold resume.

## Post-rollout state reconciliation

A rollout can make retained Requests, Conditions, metric definitions, or operator
prompts stale without making them disposable. Review each retained item from its
full current scope and canonical linked evidence; do not bulk-close by age,
origin, title, or a shared fix.

Use this order:

1. Pin the deployed Host and App-definition identities and the exact rollout or
   trial receipts. Separate source readiness, deployment, activation, and the
   observed outcome.
2. Read the retained item's current scope, origin, revision, linked Task, and
   actual accepted result. A system-origin Request may still carry a real
   closure contract; a human-origin item may already have been superseded.
3. Classify premises individually. Retire an obsolete premise only when current
   evidence disproves it. Preserve independent authority, credential, security,
   approval, or outcome requirements even when the implementation premise was
   repaired.
4. Close a Request only through the Conversation Request contract, with the
   current revision and an explanatory response. Consolidate explanations for a
   proved cohort when the Conversation schema permits, but retain one justified
   disposition per Request. Do not silently close old automated-review Requests
   merely because new automated reviews are now quiet by default.
5. Retire a Condition only through its owning Task's generation-fenced action.
   A deployed change or successful trial is evidence, not the human decision
   represented by a still-independent Condition.
6. For standing promises, recurring hygiene, and current human obligations,
   preserve the existing identity and next review. For retired metric cohorts,
   require canonical retirement, stopped collection, preserved history, and
   restart/reload persistence before treating their old review Requests as
   fulfilled.
7. Re-read canonical state after settlement. Record counts, exact identities,
   receipts, remaining obligations, and evidence limitations; do not infer that
   a successful result closed a Request or removed a Condition.

A handler that returns `waiting` without an exact Condition is not a valid
migration wait. Correct the owning Task or workflow to perform its current
review and converge, or bind the genuine external fact through the supported
Condition contract. Do not add a scheduler, notification filter, or retry loop
to compensate for an invalid result shape.

## Historical Trace Audit And Backfill

Run the bounded structural and semantic audit against a retained state directory:

```bash
bun run check:event-graph -- --state-dir /app/.state
```

Without `--backfill`, the command does not add historical trace relationships.
It opens the canonical database through the normal schema boundary, then
reports missing trace rows, invalid parents or links, lifecycle closure gaps,
split opener/closer traces, and other relationships that cannot be proved from
retained evidence. Current Conversation checks start at
`conversation.message.created`; pre-cutover direct control-socket requests
remain compatibility history rather than false current-Conversation failures.

When the report identifies historical rows whose relationships can be derived
exactly from existing lifecycle or correlation records, an operator may run:

```bash
bun run check:event-graph -- --state-dir /app/.state --backfill
```

Backfill is additive and idempotent: repeated runs preserve the same trace and
link facts. Review the initial report first and rerun it afterward. Backfill
must not invent semantic parents, App results, or closure; change a Task or App
request; satisfy a Condition; or become authority for current routing. If the
retained evidence cannot prove a relationship, leave it disconnected and fix
the live producer or propagation path instead.

## Audit Smells

Treat these as follow-up tasks:

- A documented canonical event has no emitter.
- A live event has no declared App/task/internal consumer and remains pending.
- A lifecycle-shaped event has no direct-close contract, compatibility
  correlation key, or explicit exception.
- A closed pair has no persisted closure link or its opener/closer traces differ.
- A persistent chat session reuses one trace for unrelated human turns.
- A human semantic message has neither a direct answer nor a typed follow-up,
  or its persisted result is absent from Conversation.
- A targeted domain event is accepted only by lifecycle bookkeeping rather
  than durable admission or a bounded internal handler.
- A handler subscribes to a legacy or shortcut event when a canonical event
  exists.
- An ingress path persists flattened data instead of the canonical envelope.
- A dated row-count table appears in a design doc.

## Where Findings Go

- Design mismatch: update the design doc or implementation in the same task.
- Runtime issue likely to repeat: add or adjust a metric.
- One-off runtime issue: record evidence on the task or runtime report.
- Human decision needed: emit or route an owner request with enough context.
