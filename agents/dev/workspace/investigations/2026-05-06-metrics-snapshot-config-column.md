# metrics-snapshot `config` column failures

## Signal

Recent `handler.failed` events showed two `metrics-snapshot` failures:

- `1778087051850`: `table metrics has no column named config`
- `1778087351978`: `table metrics has no column named config`

The active `metrics` table schema does not include a `config` column. Current schema columns observed from readonly DB:

`id,name,type,owner,current,target,threshold,unit,priority,status,blocker,project,source,source_query,source_command,sensitivity,measure_interval,created_at,updated_at,closed_at,alert_op,speed,description,direction`

## Current state

The currently checked-in handler code in `agents/may/handlers/metrics-snapshot.ts` already detects the schema dynamically:

```ts
const metricColumns = new Set((db.prepare("PRAGMA table_info(metrics)").all() as any[]).map(c => c.name));
const hasMetricConfigColumn = metricColumns.has("config");
```

It conditionally omits `config` from INSERT/UPDATE/SELECT statements when the column is absent, and falls back to the in-code registry config for built-in metrics during alert evaluation.

Post-failure events show the handler recovered without further code changes in this session:

- `1778087654107`: completed, 1672ms
- `1778087955266`: completed, 2903ms
- `1778088254160`: completed, 1779ms
- `1778088554130`: completed, 1746ms
- `1778088854116`: completed, 1732ms
- `1778089154072`: completed, 1687ms

## Root cause assessment

This was a transient code/schema compatibility failure: a metrics-snapshot version attempted to reference `metrics.config` while the production metrics table did not have that column. The present source contains a compatibility guard, so the likely cause is a brief runtime using an intermediate/unreloaded handler version before the guarded code was active.

## Verification

- Readonly DB query confirmed the `metrics` table has no `config` column.
- Read-back of `agents/may/handlers/metrics-snapshot.ts` confirmed conditional `hasMetricConfigColumn` handling around writes and alert reads.
- `bun --check agents/may/handlers/metrics-snapshot.ts` completed successfully.
- Event query confirmed six consecutive `metrics-snapshot` completions after the two failures.

## Recommendation

No handler patch is needed unless failures recur. If they recur, inspect the loaded handler artifact/runtime cache path because source-level compatibility is already present. A useful follow-up metric would count repeated failures by `(handler,error)` over a short window so transient deploy/schema incompatibilities are surfaced with grouping rather than only total handler failure count.
