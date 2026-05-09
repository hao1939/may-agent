---
id: finish-blocked-hygiene-reduction
owner: dev
status: active
type: milestone
priority: P1
workflow: project
iteration: 0
---

# Finish-Blocked Hygiene Reduction

## Goal

Reduce sessions that reach `finish()` with uncommitted/dirty worktree changes, because this is now the largest live driver of broad evaluator low-quality classifications and a recurring source of workflow friction.

## Signals

- Dev heartbeat investigation `agents/dev/workspace/investigations/2026-05-09-evaluator-low-quality-driver-refresh.md` found `uncommitted_changes` was the largest 24h broad low-quality bucket at 179/629 evaluated sessions.
- Fresh heartbeat validation found the finish/uncommitted signature at 233 evaluations in the last 24h.
- Current top sources for the signature are `workflow:scout-heartbeat` (53), `closed-loop-steward` (41), `workflow:may-heartbeat` (32), `workflow:metric-alert-triage` (28), `workflow:project` (27), and `workflow:dev-heartbeat` (21).
- `evaluator.low-quality-rate-24h=0.7472` remains high as a dashboard/friction metric, while `evaluator.substantive-low-quality-rate-24h=0.1447` is much lower; this project targets the hygiene/friction gap rather than hiding it.

## Current State

The problem is cross-workflow rather than a single agent habit. Existing heartbeat guidance asks agents to classify dirty state and commit intentional deliverables, but finish-blocked sessions still dominate broad low-quality attribution. Closed projects such as `workflow-reliability` and `handler-reliability` do not currently own this narrower finish hygiene problem.

This project starts from measurement and source attribution, then should patch the highest-volume workflow/prompt/guard paths so agents get exact, actionable cleanup instructions before a successful finish is attempted or before evaluator classifies the session as a generic low-quality output.

## Plan

1. **Reproduce the top sources**: sample recent `workflow:scout-heartbeat`, `closed-loop-steward`, and `workflow:may-heartbeat` transcripts with the finish/uncommitted signature to identify whether dirty paths are intentional deliverables, generated runtime files, or unrelated ambient state.
2. **Patch the highest-leverage source**: update the relevant workflow/handler/guard prompt to give exact safe next actions for dirty files, preserving the rule to avoid broad `git add` and not stage unrelated agent work.
3. **Add or propose tracking**: if the runtime metric registry is accessible through the safe event/write path, register a `session.finish-blocked-uncommitted-count-24h` metric; otherwise keep the SQL in this project as the validation query.
4. **Validate reduction**: compare the 24h finish/uncommitted count and top-source distribution before and after the first patch.

## Validation

Use this read-only validation query:

```sql
SELECT COUNT(*) AS n
FROM evaluations e
JOIN sessions s ON s.sessionId = e.sessionId
WHERE e.createdAt > (unixepoch()*1000 - 86400000)
  AND e.issues LIKE '%finish%uncommitted%';
```

Source attribution:

```sql
SELECT s.source, COUNT(*) AS n
FROM evaluations e
JOIN sessions s ON s.sessionId = e.sessionId
WHERE e.createdAt > (unixepoch()*1000 - 86400000)
  AND e.issues LIKE '%finish%uncommitted%'
GROUP BY s.source
ORDER BY n DESC
LIMIT 10;
```

Initial baseline from 2026-05-09 heartbeat: total `233`; top sources `workflow:scout-heartbeat=53`, `closed-loop-steward=41`, `workflow:may-heartbeat=32`, `workflow:metric-alert-triage=28`, `workflow:project=27`, `workflow:dev-heartbeat=21`.

## Journal

### 2026-05-09 — Opened from dev heartbeat

Opened because routine heartbeat evidence showed healthy handlers and no dev-owned alerts, but the prior substantive driver refresh plus fresh DB validation identified a durable cross-workflow reliability problem. The next concrete action is transcript sampling for the top sources, then a narrow workflow/guard prompt patch rather than more evaluator calibration.

### 2026-05-09 — First hygiene prompt patch

Fresh validation during the next heartbeat showed the 24h finish/uncommitted signature at `239`, with top sources `workflow:scout-heartbeat=55`, `closed-loop-steward=41`, `workflow:may-heartbeat=33`, `workflow:metric-alert-triage=30`, `workflow:project=27`, and `workflow:dev-heartbeat=21`. Sampled recent evaluated sessions confirmed the repeated issue is evaluator-classified `finish blocked by uncommitted changes`; the auth-failure event for `s_1778330703266_10` was a separate provider-token problem, not a finish hygiene root cause.

Patched the shared heartbeat prompts and gate re-prompts to reuse a single explicit finish-hygiene block, and patched the `metric-alert-triage` and `project` worker prompts to require git-status classification, explicit-path staging, no broad `git add .`, read-back evidence, post-commit clean-status checks, and partial/blocked finish when unrelated dirty paths remain. Next validation is another 24h comparison of the validation/source-attribution queries after these prompt changes have runtime exposure.
