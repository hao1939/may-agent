# Dev Heartbeat

## OUTPUT FORMAT (MANDATORY — EVEN IN WORK SESSIONS)
Your FIRST output must be:
```
GOAL: [one sentence]
PLAN:
1. [action]
2. [action]  
3. [action]
DONE WHEN: [criteria]
```
This format is required in EVERY session — heartbeats, work sessions, project iterations. No exceptions.

## Priority Order
1. **Check work queue**: read `shared/work-queue.md` section "## Approved" — pick top unchecked item and implement it
2. **Check error metrics**: query session.error-rate-6h, handler.success-rate
3. **Find failures**: query recent failed sessions and handler errors
4. **Pick highest-impact**: which failure pattern affects the most sessions?
5. **Investigate**: read session logs, trace the error through code
6. **Fix**: patch the workflow/handler/skill
7. **Verify**: syntax-check, ensure no regressions

## Queries to Start With (when DB access is available)
If you have the `query_db` tool in your environment, these queries are the fastest way to start:
```sql
-- Recent failures
SELECT sessionId, agent, status, error, startedAt FROM sessions WHERE status='error' ORDER BY startedAt DESC LIMIT 5;

-- Handler failures
SELECT event_type, data, timestamp FROM events WHERE event_type='handler.failed' ORDER BY timestamp DESC LIMIT 5;

-- Long/high-op sessions (inefficiency)
-- opCount is live again for current workflow sessions (KE-1236); use it for recent-window effort checks.
-- For historical windows crossing the 2026-05-07 → 2026-05-09 freeze, prefer duration_ms because older opCount rows may be structural zeros.
SELECT sessionId, agent, opCount, startedAt, endedAt, (endedAt - startedAt) AS duration_ms
FROM sessions
WHERE opCount > 10
ORDER BY startedAt DESC
LIMIT 5;

-- Current metrics health
SELECT id, name, current, target, threshold, alert_op, updated_at FROM metrics WHERE status='active';

-- Unmeasured metrics (no recent snapshot)
SELECT m.id, m.name
FROM metrics m
LEFT JOIN metric_snapshots ms
  ON m.id = ms.metric_id
 AND ms.measured_at > (unixepoch()*1000 - 3600000)
WHERE ms.metric_id IS NULL AND m.status='active';

-- Unresolved metric alerts (metric_alerts schema: id, metric_id, alert_type,
-- message, resolved_at, created_at; join metrics for names/owners/status)
SELECT ma.id, ma.metric_id, m.name, ma.alert_type, ma.message, ma.created_at
FROM metric_alerts ma
LEFT JOIN metrics m ON m.id = ma.metric_id
WHERE ma.resolved_at IS NULL
ORDER BY ma.created_at DESC
LIMIT 20;
```

## If you do NOT have DB access (fallback that works with bash/read)
Use this fallback to still do a useful heartbeat:

1. **Scan recent investigations** (find recurring failure patterns):
   - `ls -lt agents/*/workspace/investigations | head`
   - `sed -n '1,120p' agents/dev/workspace/investigations/<file>.md`

2. **Search for recent errors in workspace artifacts** (logs, stack traces):
   - `grep -R --line-number --exclude-dir=.git --exclude-dir=node_modules --exclude-dir=.state "error" agents/*/workspace | head -200`

3. **Audit for broken instructions** (like missing tools) and fix local docs:
   - Ensure your heartbeat steps only reference tools you actually have.

## Low-Signal Heartbeat Discipline
When the Approved queue is empty and metrics are healthy, do not create a new
investigation artifact just to prove activity. Instead:

1. Triage pending events explicitly in `finish()` as acted/delegated/dismissed/escalated.
2. Check `git status --short`; if there is dirty state, classify it as source work,
   intentional generated runtime files, or a risk that needs escalation before committing.
3. Stage and commit only intentional source/docs/artifact files. Do not include incidental
   `*/last-session.md` or `shared/*.log` runtime updates unless they are the explicit
   deliverable; clean or escalate them before `finish()` so the guard is satisfied without
   noisy generated-file commits.
4. Only write a new artifact when it records a clear follow-up task, owner, falsifiable
   observation, or code/doc change. Routine healthy checks can be evidenced directly from
   tool outputs in `verification_evidence`.

## Low-Signal Closeout Checklist
Recent aftermath reviews flagged dev heartbeats that ran healthy checks but ended without
an explicit judgment. Do this before `finish()` whenever no fix/artifact is warranted:

1. State the Approved queue disposition (`empty` or picked item) with the read/query evidence.
2. Classify every pending inbox event in the finish summary or `completed_items` as acted,
   delegated, dismissed with reason, or escalated.
3. State each owned project disposition (`paused/waiting` with resume trigger not met, or
   active work taken). Do not issue extra project file reads unless the project state itself
   is unclear or actionable.
4. Include the current health evidence: `session.error-rate-6h`, `handler.success-rate`,
   unresolved metric alerts, and unmeasured metrics.
5. Run and cite `cd /app/agents && git status --short`. If you wrote no files, say so and
   classify any dirty paths as unrelated/runtime/other-agent rather than committing them.
   Do not turn pre-existing unrelated dirty paths into a fresh `finish(blocked)` loop;
   close with an explicit non-actionable classification unless a dev-owned write path or
   deliverable from the current session is dirty.
6. Stop after the checklist. Avoid ad hoc multi-file reads or speculative shell probes after
   the canned checks; they have caused malformed-tool and schema-error failures without
   adding value.

## DB and Shell Query Discipline
Aftermath reviews repeatedly flag avoidable heartbeat friction from schema and tooling
assumptions. Keep heartbeat checks boring and known-good:

- Use the canned SQL above unchanged when possible.
- Before any new or uncertain query, inspect the table with `PRAGMA table_info(<table>)`
  or rely on `query_db`'s schema hint, then retry with real columns.
- Message/inbox records are not in a `messages` table. For recent delivered-message
  evidence, use the `events` table (`event_type='message.created'`, JSON in `data`) or
  inspect `notification_messages` with `PRAGMA table_info(notification_messages)` first.
- The `events` table has no `agent` column. For ad hoc inbox/event triage, filter or
  group on `owner`/`source`, parse `data` JSON when needed, or run
  `PRAGMA table_info(events)` before selecting non-canned fields.
- The `sessions` table has no `summary` column. Session summaries are embedded in
  `events.data` for `event_type='session.end'`; use `sessions.outcome/error/status`
  for table-only checks, or query `events` when summary text is needed.
- Do not use `rg` in portable heartbeat commands; this environment may not have ripgrep.
  Use `grep -R --exclude-dir=.state --exclude-dir=node_modules --exclude-dir=.git` or
  `find` with pruned noisy directories instead.

## Metrics Engineering
`query_db` is read-only. Do not attempt to register metrics with SQL from a heartbeat.
If a metric gap is discovered, capture the proposed metric/query in an investigation or
proposal and escalate to the appropriate owner so the system can apply the write safely.
