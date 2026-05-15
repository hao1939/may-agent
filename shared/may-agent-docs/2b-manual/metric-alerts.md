# Metric Alert Manual

Metric alerts are work items, not dashboard decoration. If an alert is visible
to an agent, that agent must judge it and choose one operation.

## Ownership

Alert ownership is resolved by code, not by agent judgement. Every metric has
an owner by convention:

1. `metrics.owner` if set.
2. If `metrics.owner` is empty and `metrics.project` is set and matches a row
   in `projects`, use `projects.owner`.
3. The metric id prefix if it matches an agent name, for example `arc.*`.
4. `may` as the default owner.

System-wide `project.*` metrics with no `metrics.project` are owned by `may`
because they measure the project monitor. Project-scoped metrics are owned by
the project owner because they measure that project.

Do not manually reroute an alert by editing `metrics.owner` during triage. If
ownership is wrong, fix the source metadata that the resolver uses:

- For project-scoped metrics, set `metrics.project` to the project id/path/name
  and make sure the project row has the correct `projects.owner`, unless the
  metric intentionally has its own explicit `metrics.owner`.
- For a system metric with no project, fix the metric definition or owner
  resolver code.

The owner is responsible for judging the alert. For cross-domain metrics, the
owner may delegate, but the owner remains accountable until the alert is fixed,
resolved, downgraded, excepted, or escalated.

A `metric.alert_judged` event means the owner made a judgment. It is not proof
that the alert is closed. Closure still needs a concrete operation and a later
validation signal, usually the next `metrics-snapshot` and `metric.recovered`.

## Priority

- `P0`: safety or system integrity. Must get explicit owner action now.
- `P1`: important health issue. Must get explicit owner action.
- `P2`: normal drift. Visible in heartbeat; act when it matters.
- `P3`: watch only/noisy/accepted exception. Should not interrupt work.

Downgrading is allowed only when the owner has evidence that the alert is not
currently worth interrupting work. Downgrade is not a way to hide unknowns.

## Required Triage

For each open alert:

1. Read the metric row: current value, threshold, target, alert op, owner,
   priority, updated time.
2. Read the latest snapshots and recent related events.
3. Decide whether the breach is real, stale, noisy, impossible, or blocked.
4. Choose exactly one operation below.
5. State the chosen operation and evidence in the session summary.

When running under the `metric-alert-triage` workflow, also end with the exact
structured footer requested by the workflow. That footer is converted into a
durable `metric.alert_judged` event, which is what the steward and UI use for
the closure chain. If the footer is missing, the workflow must not record the
alert as judged.

## Available Operations

### 1. Investigate

Use when the cause is not known yet. This is usually the first step, but it is
not a final operation by itself.

Minimum evidence:

- Current metric row.
- Latest 5-10 snapshots.
- Recent related events or sessions.
- Whether the value is still breaching now.

After investigation, choose one of the final operations below: fix, calibrate,
downgrade, upgrade/escalate, exception, or resolve stale state.

### 2. Fix Root Cause

Use when the metric is real and the owner can correct the cause safely.

Examples: fix a broken handler, restart a stuck workflow, update a project file,
repair a bad query, or add missing measurement.

The operation is not complete until the owner has actually made the change or
started the workflow that can make it. Saying that someone should act later is
not a fix.

Do not manually resolve the alert before the metric recovers. The next
`metrics-snapshot` run is a validation signal; the owner agent remains
responsible for judging whether the issue is actually fixed.

### 3. Calibrate Metric

Use when the metric is valid but the threshold, target, priority, or measurement
is wrong.

Allowed changes must go through the runtime's safe write path. Do **not** open
`.state/*.db` directly from a session, workflow, heartbeat, or shell command.
If you do not have an explicit write tool/workflow in the current environment,
escalate the exact requested metric update to May/human with evidence instead of
running ad hoc SQL.

Keep calibration conservative:

- Changing threshold/target requires evidence from recent snapshots.
- Do not change a metric to make a real problem disappear.

### 4. Downgrade Priority

Use when the metric is real, but there is solid evidence it should not interrupt
current work at its current priority.

Allowed downgrade requires a safe runtime write path; if the current workflow
only has read-only DB access, escalate the requested priority/blocker update to
May/human instead of editing the runtime DB directly.

Rules:

- Downgrade only with evidence, not annoyance.
- Downgrade `P1 -> P2/P3` for noisy or non-urgent drift.
- Downgrade `P0` only if the metric is wrong, obsolete, or misclassified.
- Include a review condition in `metrics.blocker`.

### 5. Upgrade Or Escalate Emergency

Use when the alert is more severe than its current priority, or the owner cannot
safely fix it.

Upgrade priority when the system should react more aggressively. Priority
updates require a safe runtime write path; if unavailable, escalate the requested
priority/blocker update with evidence.

Escalate to human when:

- The fix requires destructive action, data deletion, DB rebuild, or secrets.
- The metric contradicts system state and the owner cannot prove which is wrong.
- The alert has repeated across multiple owner sessions without recovery.
- The right action is a product or policy decision.

Escalation must include: metric id, current value, threshold, evidence checked,
and the decision needed from the human.

Do not "escalate" by sending a queued message to the same owner that is already
running the triage. If the owner is you and the action is safe, do it and choose
`fix_root_cause`. If it requires a human/product decision or unsafe operation,
notify the human with the required decision and choose `upgrade_or_escalate`.

### 6. Resolve Stale Or Transient Alert

Use only when the alert row is stale, duplicate, already recovered, or caused by
a known measurement bug.

Before resolving manually, verify the current value is in range or the alert row
is invalid. Manual alert resolution requires a safe runtime write path; if the
current environment only provides read-only DB tools, escalate the resolution
request and evidence instead of editing `metric_alerts` directly.

Manual resolve must include the reason in the session summary.

### 7. Document Exception

Use when the breach is real but intentionally accepted for now.

An exception should be rare and documented on the metric through a safe runtime
write path. If you only have read-only DB access, escalate the exact exception
text, expiry/review condition, and evidence to May/human instead of writing the
metric row directly.

Do not resolve the alert just because an exception exists unless the owner also
changes the threshold or disables the metric. A visible low-priority alert is
preferable to silent drift.

## Quick Decision Table

| Situation | Operation |
|-----------|-----------|
| Cause unknown | Investigate, then choose a final operation |
| Real issue, safe fix exists | Fix root cause |
| Threshold/target/priority/measurement is wrong | Calibrate metric |
| Alert routed to the wrong owner | Fix `metrics.project`, `projects.owner`, or resolver code |
| Real but non-urgent/noisy with evidence | Downgrade priority |
| More severe than labeled | Upgrade priority |
| Unsafe, destructive, or policy decision | Escalate emergency |
| Alert row stale, duplicate, or already recovered | Resolve stale/transient alert |
| Accepted breach for a known period | Document exception |

## SQL Reference

Use the `query_db` tool for read-only inspection. Inspect schemas before using
unfamiliar columns, and do not open `.state/*.db` from bash or ad hoc scripts.

Read metric:

```sql
SELECT * FROM metrics WHERE id = ?;
```

Read recent snapshots:

```sql
SELECT value, measured_at, note
FROM metric_snapshots
WHERE metric_id = ?
ORDER BY measured_at DESC
LIMIT 10;
```

Read open alert:

```sql
SELECT *
FROM metric_alerts
WHERE metric_id = ?
  AND resolved_at IS NULL;
```

## Legacy Terms

Older prompts may say `fix`, `calibrate`, `resolve`, `exception`, or
`escalate`. Map them to the operations above. `Investigate` is only complete
when followed by a final operation or an explicit escalation.

## Anti-Patterns

- Investigation-only sessions that leave the alert unchanged and unjudged.
- Downgrading because the alert is annoying.
- Resolving a still-breaching metric without fixing or calibrating it.
- Treating heartbeat visibility as acknowledgement.
- Treating a queued self-notification as escalation.
- Assuming `metric_alerts` rows are the source of truth. The metric row and
  snapshots are the measurement; alert rows are lifecycle state.
