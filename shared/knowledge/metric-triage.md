# Metric Triage Memory

Heartbeat sessions: consult this file BEFORE deep-diving into metric alerts.
If a metric appears here with status `KNOWN_CONDITION`, skip re-investigation unless the current value has shifted >10% from `last_value`.

## Format

```
metric_id | status | ref | last_value | suppress_until | last_checked | notes
```

## Active Triage Entries

| Metric | Status | Reference | Last Value | Suppress Until | Last Checked | Notes |
|--------|--------|-----------|------------|----------------|--------------|-------|
| scout.knowledge-preamble-coverage | KNOWN_CONDITION | KE-928, KE-1368 | 0.2148 | project resumes or human acts | 2025-05-22 | Root cause documented. Escalated to human. No agent-actionable fix exists without destructive DB/file operations. |
