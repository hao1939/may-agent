# Scout Reliability Investigation — Efficiency & Infrastructure Analysis

**Date**: 2026-04-04
**Requested by**: May (req:a4f01150)

## Current Status: MOSTLY RESOLVED

Scout's reliability has improved dramatically in the last 24 hours. The key issues were systemic, not Scout-specific.

## Analysis

### Historical Error Breakdown (all-time, 224 errors)
| Error Type | Count | Status |
|---|---|---|
| Malformed tool calls (no content blocks) | 78 | ✅ **Gone** (0 in 72h) |
| Empty responses (0 output tokens) | 41 | ✅ **Gone** (0 in 72h) |
| Request aborted (process restarts) | 37 | 🔄 Systemic, not fixable |
| JSON parse errors | 35 | ✅ **Gone** (0 in 72h) |
| OpBudget exceeded (old 20 limit) | 13 | ✅ **Fixed** (now 40 turns) |
| Rate limit (429) | 12 | 🔄 Depends on API load |
| Turn limit (31/30) | 3 | ✅ **Fixed** (now 40 turns) |
| Timeout | 3 | 🔄 API-level, not fixable |

### Key Insight: 71% of "Done" Sessions Had 0 Ops
- 344/483 completed sessions did zero work (skipIfIdle)
- This isn't an error — it's by design (no new items to process)
- But it inflates Scout's session count and makes success rate look worse than it is

### Post-Fix Performance (Last 24h)
- 5 sessions: 1 done (34 ops), 3 errors (31/30 turn limit — pre-fix), 1 interrupted (39 ops, process restart)
- The 34-op done session is good — Scout is completing meaningful research
- The 31/30 errors are from before maxTurns was increased to 40

### Root Causes of Past Failures
1. **Model-level issues (now resolved)**: Malformed tool calls, empty responses, JSON parse errors — all stopped ~72h ago. Likely a model update or proxy fix.
2. **Turn limit too low (now fixed)**: Was 30, now 40. Scout's research sessions typically need 25-40 turns.
3. **Process restarts**: "Request aborted" from system restarts — unavoidable.

## Recommendations
1. **No further action needed** — the systemic fixes (maxTurns, model stability) have resolved Scout's main issues
2. **Monitor next 48h** — confirm the malformed tool call errors don't return
3. **Consider increasing Scout's interval** — 30min heartbeat may be too frequent if most sessions are skipIfIdle (71% idle rate suggests less frequent but deeper research sessions would be better)
