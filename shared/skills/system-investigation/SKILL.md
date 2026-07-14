---
name: system-investigation
description: >
  Debug may-agent runtime, metrics, alerts, handlers, workflows, and session
  failures with a repeatable evidence loop. Use this when investigating why the
  autonomous system is not closing the loop, not when doing normal feature work.
---

# Skill: System Investigation

## When to Apply

Use this skill when the task is about may-agent system behavior:

- A metric alert is open, stale, or incorrectly owned.
- A workflow/session failed, hung, restarted, or produced surprising output.
- Telegram, socket, cron, handler, evaluator, or heartbeat behavior looks wrong.
- You are tempted to run similar DB/transcript commands repeatedly.

Do not use this skill for ordinary coding tasks unless the code change is fixing
one of the system failures above.

## Core Rule

Investigate with **facts in this order**:

1. Schema or contract
2. Live row/value
3. Transcript or event evidence
4. Root cause
5. Fix
6. Re-measure

Do not skip from signal to fix. Do not guess DB columns, paths, owners, or
handler behavior.

## Protocol

### 1. Start With the Contract

Before querying a table or assuming a field, inspect the schema or source of
truth.

- DB tables: use `query_db("pragma table_info(<table>)")` when available.
- Handler/workflow contracts: read the handler or workflow source first.
- Agent/project conventions: read the relevant V3 `project.json`, `app.ts`,
  `tasks/tree.json`, `AGENTS.md`, or manual page. Treat `project.md` as legacy
  compatibility material only.

If `query_db` is unavailable, use a bounded readonly runtime query, not
`sqlite3` and not guessed DB paths.

### 2. Decompose Metrics

A metric value is a signal, not the judgment. For any metric alert:

1. Read the metric row: owner, current, target, threshold, alert_op, priority.
2. Read the open alert row.
3. Recreate the metric's component counts from the handler source.
4. Identify which component is contributing the breach.
5. Fix or judge that component.

Never tune a threshold until you can explain the numerator and denominator.

### 3. Inspect Sessions Deliberately

For a session failure:

1. Read the `sessions` row and linked `workflow_runs` row.
2. Inspect only relevant transcript slices: first prompt, failed tool calls,
   guard blocks, finish attempts, and final messages.
3. Check what the LLM actually saw before judging behavior.
4. If the session wrote files, inspect those files too.

Avoid dumping full `session.jsonl` into context. Use bounded extraction.

### 4. Treat Guards as Signals

When a guard fires, ask what instruction or contract made the agent choose the
bad action.

- Path hallucination: check runtime environment prompt and stale path examples.
- Verify-after-write: check whether prompt/tool output says read-back clearly.
- Commit guard: check whether it is blocking only files owned by this session.
- Schema/query errors: check whether the workflow should inject live schema
  instead of asking the LLM to discover it manually.

Fix the misleading contract when possible. Do not just teach the agent to retry.

### 5. Close the Loop

After a fix, force a validation signal instead of waiting:

1. Trigger the relevant event when supported, for example
   `trigger.metrics-snapshot`.
2. Re-read the metric row or workflow/session row.
3. Check alert closure: `metric_alerts.resolved_at`.
4. Check semantic event closure: the opener and terminal event share the trace,
   the terminal event persists a closure link, and any claimed human result has
   channel-delivery evidence. `metric.alert_judged` proves owner judgment, not
   recovery or project success.
5. If the value is still bad, continue the investigation; do not declare done.

## Repetition Rule

If you run the same diagnostic shape twice in one session, stop and simplify:

- Turn it into one bounded query.
- Add a tiny helper function/script if it is likely to recur.
- Move live data collection into the workflow if LLM manual collection is
  unreliable.

The goal is less repeated command-writing, not a larger investigation ritual.

## Known-Good Patterns

### Open Alerts

```sql
SELECT a.id, a.metric_id, m.owner, m.priority, m.current, m.target,
       m.threshold, m.alert_op, a.created_at, a.resolved_at, a.message
FROM metric_alerts a
LEFT JOIN metrics m ON m.id = a.metric_id
WHERE a.resolved_at IS NULL
ORDER BY COALESCE(m.priority, 'P9'), a.created_at DESC
LIMIT 30;
```

### Recent Workflow Failures

```sql
SELECT wr.startedAt, wr.workflow, wr.status, wr.runId, s.sessionId, s.agent,
       substr(coalesce(wr.result_reason, wr.result_summary, s.error, ''), 1, 240) AS reason
FROM workflow_runs wr
LEFT JOIN sessions s ON s.workflowRunId = wr.runId
WHERE wr.startedAt > ?
  AND wr.status IN ('error', 'escalated')
ORDER BY wr.startedAt DESC
LIMIT 20;
```

### Metric Validation After Fix

```sql
SELECT id, owner, priority, current, target, threshold, alert_op, updated_at
FROM metrics
WHERE id = ?;
```

```sql
SELECT id, metric_id, resolved_at, created_at, message
FROM metric_alerts
WHERE metric_id = ?
ORDER BY created_at DESC
LIMIT 5;
```

## Anti-Patterns

- Guessing a DB column and retrying after `no such column`.
- Running unbounded transcript grep/cat commands.
- Treating `metric.alert_judged` as closure. It is only owner judgment.
- Declaring a fix before a new measurement shows recovery.
- Committing unrelated dirty files to satisfy a guard.
- Tuning a metric threshold because it is noisy before proving what it measures.

## Completion Checklist

Before `finish(success)`, your summary must state:

1. What signal started the investigation.
2. The root cause, with source/transcript/DB evidence.
3. What changed, if anything.
4. What validation signal was triggered or observed.
5. Whether the loop is closed or what remains open.
