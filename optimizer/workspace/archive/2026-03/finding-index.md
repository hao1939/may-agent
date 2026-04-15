# Finding Index — 2026-03-24T16:03

## Active Findings (in workspace/)

| Finding | Status | Impact | Key Insight |
|---------|--------|--------|-------------|
| **improvement-proposals-review-0324** | 📊 Cycle 14 review | — | 18 commits behind binary. $40-85/day unrealized savings blocked on rebuild |
| **tool-quality-regression-0324-1510** | ✅ Guard built | $5-10/day | 5.9% waste rate. empty-args-guard.ts (16 tests). Needs binary rebuild |
| **fm33-verification-guard** | ✅ Guard built | Quality | finish-guard.ts Gate 2 (22 tests). Needs binary rebuild |
| **llm-to-js-scan-0324-0136** | ⚠️ Escalated | $59/day | Optimizer $118/day (54%). Proposed 30→60min interval |
| **analysis-review-0324-1303** | 📊 Latest analysis | Quality | FM-2.2 dominant (6/8), FM-3.3 persistent (5/8) |
| **prompt-caching-broken-opus** | ⛔ BLOCKED: ANTHROPIC_API_KEY | $36-90/day | Code ready (7c86665), needs env var |
| **meta-json-cost-gap** | ⚠️ Sent to tech-lead | Breaks cost tracking | PersistedSession has no usage field → $0 |
| **coach-cost-dominance** | ⚠️ Sent to May | $30-45/day | Unbounded heartbeats |
| **scout-synthesis-loop** | ⚠️ Sent to May | $50-78/day | Self-referential synthesis |
| **bash-bypass-fix-0324-0910** | ✅ Built | $5-10/day | session-read-guard bash protection. Needs binary rebuild |

## Key Blockers (Priority Order)

1. **Binary rebuild** — 18 commits behind. Blocks prompt simplification ($30-60/day), empty-args guard, FM-3.3 guard, verification evidence field. **Single highest-value action.**
2. **ANTHROPIC_API_KEY** — Enables prompt caching ($36-90/day). Escalated repeatedly.
3. **Test infrastructure** — pi-agent-core symlinks still broken. 69/115 test files fail at runtime.

## Summary Stats

- **38 SKILL.md files** in agents/shared/skills/ (~17 actively deployed)
- **7 guards** in src/lib/tools/ (804 total lines, only 4 in binary)
- **20 deployed code improvements** (F1-F18, F21, F22)
- **6 blocked code improvements** (B1-B6, needing binary rebuild)
- **246 sessions/day**, ~10.25/hour

## Archived (41 files in archive/findings/)
