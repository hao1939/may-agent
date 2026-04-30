# Eval-Poller Throughput Increase

## Change Made
File: `agents/may/handlers/eval-poller.ts`

- Line 21: `MAX_SESSIONS_PER_RUN` changed from `8` → `20`
- Line 22: `MAX_AGE_MS` changed from `6 * 60 * 60 * 1000` (6h) → `48 * 60 * 60 * 1000` (48h)

## Rationale
The eval pipeline was not dead, just throttled. Coverage was at 6.7% because:
1. Only 8 sessions processed per poller run
2. Only sessions from the last 6 hours were eligible

With 20 sessions/run and a 48h window, coverage should climb toward 50%.

## Verification
TypeScript compilation shows no new errors from this change (all errors are pre-existing missing dependency issues unrelated to eval-poller).
