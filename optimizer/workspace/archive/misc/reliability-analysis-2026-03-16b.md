# Reliability Analysis — 2026-03-16 (Session 2)

## Current Status
**78% error rate** in last 50 sessions (39 errors, 11 successes).

### Error Breakdown (last 50 sessions)
| Error Type | Count | % | Retried? |
|---|---|---|---|
| Empty response (0 output tokens) | 17+3=20 | 40% | **NO (0 retries)** — BUG |
| Rate limit 429 | 15 | 30% | Yes (backoff deployed) |
| Unhandled stop reason: unexpected_state | 7 | 14% | **NO** — FIXED this session |
| Done (no error) | 11 | 22% | N/A |

## Fix Applied: Pattern 6 — Unhandled Stop Reason
**File**: `src/lib/manager-retry.ts`
**Change**: Added Pattern 6 to `isRetryableInfraError()` — detects "Unhandled stop reason" errors from pi-ai library and triggers automatic retry with backoff.
**Impact**: 7 sessions in last 50 (14%) would have been retried instead of failing immediately.
**Tests**: 58/58 pass (2 new tests added in `test/manager-infra-retry.test.ts`).

## Critical Unresolved Bug: Empty Response Retry Not Firing
**All 20 empty-response sessions show `infraRetryCount=0`** — the retry logic is not catching them despite Pattern 2 explicitly checking for empty assistant content.

Possible causes (needs investigation):
1. Session status may not be "running" when the retry loop checks (early guard returns null)
2. The last message may not be role "assistant" — maybe pi-ai doesn't add a message at all
3. The content may have some non-text, non-toolCall blocks that count as "substance"
4. The initial `await initialCall` may not complete when the model returns empty (stream hangs then aborts)

**This is the #1 reliability blocker** — 40% of all recent errors are empty responses that should be retried but aren't.

## Recommendation
1. ✅ Pattern 6 deployed (this session)
2. 🔴 Investigate empty-response retry bypass (next session)
3. ⏳ 429 backoff already deployed earlier today — needs process restart to take effect
