# Empty Assistant Error Metric Gap — 2026-05-13

## Signal

Dev heartbeat found recent sessions marked `status='error'` with `error IS NULL`, empty summaries, and transcripts ending in an empty assistant message. Examples in the latest window:

- `s_1778653096587_81` (`may` project driver): 2-line transcript, empty assistant content, `status='error'`, `error=NULL`.
- `s_1778653096608_82` (`evaluator-aftermath`): 2-line transcript, empty assistant content, `status='error'`, `error=NULL`.
- `s_1778653092748_80` (`arc` heartbeat): assistant made one tool call, received a result, then transcript ended with an empty assistant message and `status='error'`.

The active metric `session.empty-assistant-stop-count-1h` exists, but its `source_query` and `source_command` are both `NULL`, so it cannot measure this pattern through the snapshotter. Its current value was `0` while the recent transcript check showed at least three fresh examples.

## Evidence Queries

Recent session distribution used to scope impact:

```sql
SELECT agent, status, COUNT(*) AS c
FROM sessions
WHERE startedAt > (unixepoch()*1000 - 21600000)
GROUP BY agent, status
ORDER BY agent, status;
```

Metric definition check:

```sql
SELECT id, name, source_query, source_command, current
FROM metrics
WHERE id IN (
  'session.first-turn-error-count-1h',
  'session.empty-assistant-stop-count-1h',
  'handler.failed-count'
);
```

Transcript spot-check command:

```bash
python3 - <<'PY'
import json
for sid in ['s_1778653096587_81','s_1778653096608_82','s_1778653092748_80']:
    p=f'/app/.state/sessions/history/{sid}/session.jsonl'
    print('\n==', sid, '==')
    with open(p) as f:
        lines=f.readlines()
    print('lines', len(lines))
    for line in lines[-8:]:
        obj=json.loads(line)
        print({k: obj.get(k) for k in ['role','name','error','status']})
        c=obj.get('content') or obj.get('message') or obj.get('data')
        print(repr(c)[:500])
PY
```

## Root Cause Hypothesis

The metric was registered as an active concept but not wired with a measuring recipe. This creates a false-green blind spot: empty-assistant/provider-stop sessions become ordinary session errors, while the specific detector remains pinned at `0`.

## Proposed Remediation

Register a `source_query` for `session.empty-assistant-stop-count-1h` that counts recent `session.end` rows where the session ended as `error` with no explicit error string and the transcript/finish metadata indicates an empty assistant stop. If direct transcript inspection is not available to SQLite, replace the metric with a handler-side recorder that emits an event when the runtime sees an assistant final message with no text, no tool call, and an error outcome.

A conservative DB-only interim query that catches the currently observed false-green class:

```sql
SELECT COUNT(*)
FROM sessions
WHERE startedAt > (unixepoch()*1000 - 3600000)
  AND status = 'error'
  AND error IS NULL
  AND opCount <= 1;
```

This interim query is intentionally approximate and should be validated against transcript samples before using it as an alerting metric, because not every low-op null-error session is necessarily an empty assistant stop.

## Next Step

Dev should either add a proper metric measurement path for `session.empty-assistant-stop-count-1h` or open an approved work item for the runtime owner if transcript-level detection cannot be implemented from the metric snapshotter alone.
