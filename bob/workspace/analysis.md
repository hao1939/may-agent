# Analysis of Recent Agent Evaluations

**Date:** 2026-03-22
**Scope:** 10 most recent evaluations (s_1772672368249... to s_1772634362875)

## Executive Summary

The previous optimism about Coder's improvement was premature. The **"Blind Overwrite"** pattern has resurfaced (s_1772672288075_15), causing data corruption risk. Additionally, a new critical infrastructure issue has emerged: **Data Loss / Missing Transcripts**, where 50% of recent sessions (5/10) failed to persist their `session.jsonl`, causing evaluation failures.

## Critical Issues

### 1. Data Loss / Missing Transcripts (System Stability)
**Status:** 🔴 CRITICAL (New)
**Observation:** 5 out of the 10 most recent sessions (s_1772550...) failed because `session.jsonl` was missing. Only `meta.json` existed.
**Impact:** The meta-loop is blinded. We cannot evaluate, debug, or learn from sessions that leave no trace. This suggests a crash or hard abort that bypasses the flush-to-disk mechanism.
**Affected Agents:** Evaluator, Bob, Optimizer.

### 2. Blind Overwrite / Truncated Reads (Coder)
**Status:** 🟠 HIGH (Regression)
**Observation:** In s_1772672288075_15, Coder read `domain.md`, received a truncated view (due to token limits), and then **rewrote the file based on the truncated view**, risking content loss.
**Analysis:** The previous fix (lessons.md instructions) is insufficient. The agent ignores the warning when under pressure.
**Recommendation:** We need a **structural fix**. The `write` tool should perhaps reject overwrites of large files if the read was recent and truncated, or we need a `patch` tool that doesn't require full-file context.

### 3. Role Violation: May Writing Files (May)
**Status:** 🟡 MEDIUM
**Observation:** In s_1772633428624_0, May attempted to write `src/cron-tool.ts` using `exec` (`cat > file` or heredoc).
**Violation:** May is designed as a supervisor (read-only exec). She should delegate all code changes to Coder.
**Fix:** Structural enforcement. The `exec` tool for May should aggressively block write patterns (`>`, `sed -i`, `cp`, `mv`).

## Evaluator Health Check

- **False Negatives:** The single QA evaluation in this batch (s_1772672368249_16) was accurate (Verdict: Good). The "truncat" keyword bug seems absent in this sample, but monitoring must continue.
- **Visibility:** The evaluator cannot see sub-agent work in delegated sessions (s_1772634362875_0). It scores May based on verification results but explicitly notes it cannot evaluate Coder's safety because the transcript is in a separate file.

## Agent Scorecard (Last 10 Runs)

| Agent | Verdicts | Issues |
|-------|----------|--------|
| **Coder** | 1 Good, 1 Acceptable | **Regression:** Blind overwrite of `domain.md` (s_1772672288075_15). |
| **QA** | 1 Good | Doing well. Previous low scores likely false negatives. |
| **May** | 2 Good/Acceptable | **Role Violation:** Trying to write files via `exec`. |
| **Master** | 1 Acceptable | Struggling with file navigation (`find /home/user`). |
| **Evaluator** | 2 Failed | **Data Loss:** Failed because session logs were missing. |
| **Bob** | 2 Failed | **Data Loss:** Failed because session logs were missing. |
| **Optimizer** | 1 Failed | **Data Loss:** Failed because session logs were missing. |

## Recommendations

1.  **Investigate Persistence Failure:** Why are `session.jsonl` files missing for 50% of sessions? Is the process crashing before write?
2.  **Structural Fix for May:** Update May's `exec` tool wrapper to strictly forbid shell redirection (`>`) and write commands.
3.  **Revisit Blind Overwrite:** Instructions aren't working. We need a tool-level protection or a better editing tool (e.g., `replace_block` or `patch`) that doesn't tempt full-file rewrites.
