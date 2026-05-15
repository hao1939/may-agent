# QA Convention Regressions — 2026-04-24

## Summary
QA is the worst convention performer in the last 24h. All violations trace to **one repeated behavior pattern**.

## Findings

| Convention | Rate | Root Cause |
|-----------|------|------------|
| C1.4 | 63.2% | Session ends with edit/write/read, not finish() |
| C8.2 | 63.2% | Related to C1.4 — session termination issue |
| C3.2 | 68.4% | Writes to `workspace/unreviewed-findings.md` (relative path, not `agents/qa/workspace/...`) |
| C1.3 | 78.9% | write() to unreviewed-findings.md not verified with subsequent read |

## Root Cause Analysis
All violations stem from a single behavior: QA writes `workspace/unreviewed-findings.md` at session end and doesn't follow up with a read or finish(). This suggests QA's workflow/heartbeat is directing it to dump findings into a file as its final action, bypassing the finish() call.

## Recommendation
Add to QA's context.md: "Always use full path `agents/qa/workspace/...` for file writes. After any write, verify with read. Always end with finish()."

Alternatively, check if QA's heartbeat.md or workflow template is directing the unreviewed-findings.md write pattern — that may be the upstream cause.

## Priority
P2 — persistent but not degrading. Same pattern repeating, not getting worse.
