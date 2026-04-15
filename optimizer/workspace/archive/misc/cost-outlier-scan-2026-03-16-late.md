# Cost Outlier & Error Rate Scan — 2026-03-16 21:45 UTC

## Summary
Scanned last 100 sessions from the most recent ~2 hours.

## Key Findings

### Error Rate: 73% reported, 2% actual
- **100 sessions analyzed**, 73 marked as "error" (73%)
- **71 of 73 errors are false positives** — `finish()` was called successfully but subsequent empty model responses caused the session to be incorrectly marked as failed
- **True error rate: 2%** (2 sessions where finish was genuinely never called)
- Both true errors: "empty response (0 output tokens)" — upstream API flakiness

### Pattern Detail
- After `finish()` completes, the model returns 4 empty assistant messages
- The stale process doesn't have the `hasFinishToolCall()` guard, so it marks these as errors
- Fix is on disk (6+ commits) but **process has not been restarted**

### Per-Agent Breakdown (last 40 sessions)
| Agent | Errors | Total | Rate | Notes |
|-------|--------|-------|------|-------|
| may | 14 | 14 | 100% | All false positives (finish called) |
| tech-lead | 5 | 10 | 50% | Mix of false positives and successes |
| amy-kimi | 4 | 4 | 100% | "unexpected_state" — kimi model issue |
| coach | 2 | 3 | 67% | False positives |
| scout | 2 | 2 | 100% | False positives |
| amy | 2 | 2 | 100% | False positives |
| qa (gpt52) | 0 | 3 | 0% | GPT doesn't produce empty post-finish responses |
| coder | 0 | 1 | 0% | — |

### Action Required
**Process restart is the #1 priority.** The fix on disk would:
- Reduce reported error rate from 73% to 2%
- Stop false-positive error marking for sessions where finish was called
- Eliminate wasted retry attempts after successful completion
