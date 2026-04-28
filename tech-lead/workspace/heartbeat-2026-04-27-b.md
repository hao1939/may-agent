# Tech-Lead Heartbeat — 2026-04-27

## Build Health
- No tsconfig in project root (agent-config repo, not a build project)
- `npm run check` not available — no scripts in package.json
- All metrics healthy

## Bug Fixed
- **research-intake cron missing handlerConfig fields**: `agent` and `task` were missing from the `research-intake` handler's `handlerConfig` in `agents/may/cron.json`. This would cause the verify-wrap workflow to fail silently (no agent or task to run). Fixed by copying the values from the cron's top-level `message` and `agent` fields.

## Inbox Triage
| Item | Action |
|------|--------|
| C7.1 path violations (P0) | Acknowledged — constraint already in SOUL.md. Using /app/ going forward. |
| amy-kimi 429 errors (3 dupes) | Dismissed — rate limit issue, not code bug |
| requests.db zero tables | Dismissed — verified it now has `requests` table |
| Handler audit: 21 never-fired crons | These are event-only handlers (no intervalMs, only `on` triggers). They fire when events occur, not on timers. Not dead — working as designed. |
| Gym runner bugs | Not my domain — gym team issue |
| Stale metrics in may.db | P2, deferred |
| Bob/coach ENOENT errors | P2, intermittent, deferred |

## Observations
- 446 gym scenarios at 55MB — largest directory in the repo. Worth monitoring growth.
- amy-kimi has 31 workspace session files — minor bloat but not critical.
