# Brief: QA C1.4 Finish Violations — 34.4% Rate

**Date**: 2026-08-01
**Source**: Convention check data (7-day window)

## Finding

QA agent fails to call `finish()` as final tool call in 34.4% of sessions (11/32). Sessions end with `bash()`, `write()`, or `read()` instead.

This also causes C8.2 violations at the same rate (likely the same sessions).

## Top Violation Patterns (7d, by viol%)

| Agent | Convention | Viol% | N | Note |
|-------|-----------|-------|---|------|
| coder | C1.3 | 100% | 1 | Single session, not systemic |
| amy | C7.1 | 72.7% | 11 | Gym artifact — `cd /home/user` in gym scenarios |
| **qa** | **C1.4** | **34.4%** | **32** | **Not calling finish()** |
| **qa** | **C8.2** | **34.4%** | **32** | **Same root cause** |
| coach | C1.3 | 23.9% | 71 | Verify-after-write |
| bob | C1.1 | 19.5% | 82 | Read-before-edit (EXP-216 superseded) |

## Analysis

QA's C1.4 is the highest-volume, highest-rate systemic violation. Possible causes:
1. QA sessions time out or crash before reaching finish()
2. QA intentionally skips finish() (unlikely — it's structural)
3. QA does work then runs out of context window

## Recommended Next Step

Check whether QA sessions with C1.4 violations also have `status: error` or timeout — if so, this is an infrastructure issue not a behavioral one. If sessions complete normally without finish(), a context.md reminder or SOUL.md update for QA could help.

## Amy C7.1 — False Positive

Amy's 72.7% C7.1 rate is a gym artifact. Gym scenarios run in `/home/user/` sandboxes. Amy uses `cd /home/user` which is correct behavior in gym but triggers C7.1. The convention checker should exclude gym sessions or adjust the rule for sandboxed environments.
