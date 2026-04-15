# Error Epidemic Investigation Report — 2026-03-16

**Author**: Optimizer  
**Investigation span**: 2026-03-16 18:00–21:16 UTC (13+ sessions)  
**Status**: FIX ON DISK — BLOCKED ON PROCESS RESTART  
**Consolidated from**: 11 WIP files (see appendix)

---

## Executive Summary

The system has been running at **60-73% session error rate** since ~17:00 UTC. **98% of these errors are false positives** — the agent successfully called `finish()` but the system overwrote the success status with an error due to empty API responses on post-finish LLM calls. Six bug fix commits exist on disk but the process hasn't been restarted to load them.

## Root Cause #1: Finish-Then-Error False Positives

**What happens**: After an agent calls `finish()` (declaring task complete), the system makes additional LLM calls. When these return empty (0 output tokens — common with API instability), `manager-retry.ts` overwrites the session status from "done" to "error", discarding the agent's successful completion.

**Evidence** (from 100-session sample):
- 66/100 sessions marked as errors (66% error rate)
- 65/66 (98%) had `finish()` called successfully before the error
- Only 1/66 was a genuine error

**Fix commits** (6 total, all after process start at 17:05 UTC):
| Commit | Fix |
|--------|-----|
| `5cd3063` | Clear unhandled-stop-reason error when finish() already called |
| `aa6f2d9` | Clear empty-response error when finish() already called |
| `3c35d88` | Post-loop empty response retry must check for finish tool |
| `efc4249` | Extend finish-tool bypass to in-loop empty response retry |
| `934f3e1` | Skip empty-response retry when finish tool already called |
| `d0e8014` | Post-loop empty response retry bypass |

## Root Cause #2: Pending Trigger Cascade (May-specific)

**What happens**: When May's heartbeat errors, `cron.ts` calls `checkPendingTrigger(entry)` which immediately fires another heartbeat. This creates a tight loop where May fires every ~30-45 seconds instead of every 10 minutes.

**Evidence**: May had 35 sessions in last 100 (expected ~6-7 for the time period), with 97% error rate. She was firing 6-11 times per 10-minute window.

**Fix**: Remove `checkPendingTrigger(entry)` from the failure handler in `fireHeartbeat()` (line ~292 in `src/app/cron.ts`).

## Per-Agent Impact

| Agent | Sessions | Error Rate | Nature |
|-------|----------|------------|--------|
| May | 37/38 | 97% | All finish-then-error false positives |
| Amy/Amy-Kimi | 5-6 | 83-100% | Empty response |
| Coach | 4/5 | 80% | Empty response |
| Optimizer | 4/5 | 80% | Empty response |
| Tech-Lead | 6/29 | 21% | Lower rate (unclear why) |
| QA/Evaluator | 0/4-5 | 0% | Unaffected |

## Financial Impact

- **Direct waste**: ~$0.20/wasted session × ~15 sessions/hour = ~$3/hour
- **May re-fire waste**: ~17 extra sessions/hour × ~$0.20 = ~$3.40/hour
- **Total**: ~$6-7/hour, ~$150/day while unfixed
- **Post-finish LLM calls** (unnecessary): ~$0.032 each × 3-4 per session

## Current Status (21:16 UTC)

**73% error rate persists** (22/30 most recent sessions are errors). The 6 fix commits remain unloaded. Process has been running since 17:05 UTC.

## Resolution Path

1. **IMMEDIATE**: Process restart to load the 6 fix commits → expected to drop error rate from 73% to ~2%
2. **FOLLOW-UP**: Fix the pending-trigger cascade in `cron.ts` to prevent May re-fire storms
3. **MONITORING**: Post-restart, verify error rate drops; check for remaining genuine errors

## Escalation History

- 18:56 UTC — Handed off to May for restart request
- 20:30 UTC — Second escalation with detailed evidence
- 20:45 UTC — Third escalation noting 98% false-positive rate
- Process restart requires Hao's authorization

---

## Appendix: Consolidated WIP Files

These 11 files were consolidated into this report:
1. `wip-empty-response-deep-dive.md` — Initial investigation (58% error rate finding)
2. `wip-empty-response-epidemic-2026-03-16b.md` — Epidemic-level analysis (70% error rate peak)
3. `wip-empty-response-investigation-2026-03-16c.md` — Continued investigation (56% rate)
4. `wip-error-rate-summary.md` — Summary: 66% rate, 98% false positives
5. `wip-finish-then-error-impact-2026-03-16.md` — Detailed false-positive analysis
6. `wip-may-100pct-error-2026-03-16c.md` — May-specific 100% error rate
7. `wip-may-context-pressure-2026-03-16.md` — May context pressure analysis
8. `wip-may-error-cascade.md` — Pending trigger cascade root cause
9. `wip-process-restart-needed.md` — First restart urgency doc
10. `wip-restart-urgency-2026-03-16.md` — Second restart urgency doc
11. `wip-restart-urgency-2026-03-16d.md` — Third restart urgency doc
