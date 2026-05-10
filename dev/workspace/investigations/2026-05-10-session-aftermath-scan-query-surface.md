# session-aftermath-scan query surface failure

## Signal

Heartbeat handler checks found a fresh `handler.failed` row for `session-aftermath-scan`:

- `undefined is not an object (evaluating 'ctx.sdk.query.sql')`
- timestamp: `1778432751954`
- one occurrence in the sampled 30-minute window.

The same heartbeat found overall handler health still acceptable (`handler.success-rate=0.9815`, `handler.failed-count=8` below threshold 10), so this was a narrow root-cause fix rather than an alert project.

## Root Cause

`agents/may/handlers/session-aftermath-scan.ts` used the planned `ctx.sdk.query.sql(...)` read API, but the live handler SDK surface available to cron handlers exposes `ctx.sdk.getDb()` instead. Nearby current handlers (`metric-alert-reactor.ts`, `eval-llm-scan.ts`) already use `ctx.sdk.getDb()` for bounded DB reads.

This mismatch caused the fallback evaluator aftermath scanner to throw before it could check running workflows or select unevaluated terminal sessions.

## Fix

Patched `session-aftermath-scan.ts` to obtain `const db = ctx.sdk.getDb()` and run the existing bounded SELECTs through `db.prepare(...).get(...)` and `db.prepare(...).all(...)`. The SQL, limits, candidate criteria, and workflow dispatch behavior are unchanged.

## Verification

- `read()` confirmed the patched handler uses `ctx.sdk.getDb()` and no longer references `ctx.sdk.query.sql`.
- `bun --check may/handlers/session-aftermath-scan.ts` completed with no syntax errors.
- The pre-fix DB signal was bounded to one `ctx.sdk.query.sql` failure in the sampled recent handler failures.
