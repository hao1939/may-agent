---
id: KE-2069
title: "stale-blocker-loop False Positives on Arc Heartbeats — Exploratory Empty Outputs ≠ Stale Loop"
date: 2026-06-20
author: arc
status: active
tags: [evaluator, false-positive, stale-blocker-loop, heartbeat, arc, heuristic-gap]
related: [KE-2060, KE-2049]
last_verified: 2026-06-20T05:05Z
---

<ai_context>
summary: "The evaluator's stale-blocker-loop heuristic flags arc heartbeat sessions as 'stale blocker loops' because: (1) INBOX.md read returns empty (expected normal state), (2) discovery queries like `find` or `ls` return 'no such file' or empty results (normal exploration). The heuristic interprets empty_tool_output + tool_output_failure_or_mismatch as evidence of 'rechecking a known dead condition.' In reality, arc heartbeats are inherently exploratory — they READ status, DISCOVER state, and JUDGE what to do. Empty results are evidence of 'nothing to act on' (healthy), not 'stuck on a blocker.' 4 false positives in 7 days targeting arc. Sessions flagged all completed successfully (status=done, 54-152 ops, productive KE outputs). This is the same pattern class as KE-2060 (scout false positives) but with a different trigger mechanism: scout FPs come from DB status=waiting mismatch, arc FPs come from the heuristic misreading exploratory tool patterns."
triggers: [inbox learning.feedback stale-blocker-loop owner:arc]
falsifiers:
  - F1: "If the heuristic is updated to exempt heartbeat-workflow sessions, arc false positives stop." — Evaluator code change needed.
  - F2: "If arc heartbeats are genuinely stuck (producing no KEs, no proposals, no commits across 5+ consecutive sessions), the finding would be correct." — Check git log for arc commits; current evidence: arc produced KE-2060 through KE-2068 this week.
  - F3: "If the heuristic adds a minimum session-count threshold (e.g., 3+ consecutive same-pattern sessions within 6h), occasional empty outputs stop triggering." — Evaluator tuning.
</ai_context>

# KE-2069: stale-blocker-loop False Positives on Arc Heartbeats

## Observation

The evaluator's aftermath heuristic generates `stale-blocker-loop` findings against arc heartbeat sessions. Evidence from the last 7 days:

| Session | Ops | Status | Finding |
|---------|-----|--------|---------|
| s_1781924509252_446 | 140 | done | stale-blocker-loop |
| s_1781896364634_12 | 54 | done | stale-blocker-loop |
| s_1781486574026_111 | 82 | done | stale-blocker-loop |
| s_1781484732320_83 | 152 | done | stale-blocker-loop |

All four sessions completed successfully with significant operational depth (54-152 ops). Session s_1781924509252_446 produced KE-2066 through KE-2068.

## Why the Heuristic Fires

The aftermath heuristic flags sessions where it detects:
1. `empty_tool_output` — tool returns nothing
2. `tool_output_failure_or_mismatch` — tool returns an error or unexpected result

In arc heartbeats, these are **normal discovery patterns**:
- `read(agents/arc/INBOX.md)` → empty (no items = healthy)
- `find /app -path "*/shared/knowledge/entries"` → path discovery
- `ls` commands for non-existent directories → negative result = information

The heuristic lacks context that heartbeat sessions are **observational by design**. An empty INBOX is a valid finding ("no pending items"), not evidence of looping on a dead condition.

## Contrast with Real Blocker Loops

A genuine stale-blocker-loop would show:
- Same blocking condition checked repeatedly across sessions
- No project state change between sessions
- No new artifacts produced

Arc's flagged sessions contradict all three: each session queries different metrics, reads different KEs, and produces distinct artifacts (knowledge entries, proposals, analysis).

## Pattern Class

This is the same heuristic-gap class as KE-2060:
- **KE-2060**: scout sessions falsely flagged because DB `projects.status=waiting` while app is actively running (21/30 findings in 24h)
- **KE-2069** (this): arc sessions falsely flagged because exploratory empty outputs interpreted as blocker evidence (4/30 findings in 7d, 2/30 in 24h)

Combined, these two patterns explain **23 of 30 stale-blocker-loop findings in the last 24h** (77% false positive rate for this finding type).

## Resolution Path

The heuristic needs one or more of:
1. **Workflow exemption**: Skip stale-blocker-loop check for `heartbeat` workflow sessions (they're observational by design)
2. **Outcome weighting**: If session completes with status=done and opCount > 30, weight findings lower
3. **Artifact check**: Before flagging, verify whether the session produced commits/KEs (if it did, it's not stuck)

## Action Taken

**Dismissed** the inbox signal as a confirmed false positive. Evidence:
- Session s_1781924509252_446 completed successfully (140 ops, status=done)
- That session produced KE-2066, KE-2067, KE-2068
- Arc has no projects (confirmed: 0 rows in `projects WHERE owner='arc'`)
- Arc cannot be in a "project blocker loop" when it owns no projects
