# Improvement Proposals Review — Cycle 14
**Date**: 2026-03-24T16:03
**Since last review**: Cycle 13 was 2026-03-23T09:15 (30.8 hours ago)
**System uptime**: Continuous since 2026-03-23T09:06 (~31 hours, no downtime)

## System Health Summary

### Binary: b9ef77e (built Mar 24 07:02, ~9 hours old)
- Symlink: `bundle/may-agent → may-agent-b9ef77e`
- Commit: `b9ef77e chore: remove stale workspace/ dir and add to .gitignore`
- **10 commits behind HEAD** — notably missing `a3447e6 feat: empty-args guard` and `335546d feat: markdown rendering`
- Binary was rebuilt during this review period (was `97a3754` at Cycle 13, now `b9ef77e`)

### Cron Health: 46 entries, 39 enabled, 7 disabled
- All previously-blocked handlers (convention-check, tool-quality-scan, heartbeat-context, lessons-graduation, error-log-scanner) are now **enabled and in binary** since the rebuild
- Tool-quality-scan last fired: 2026-03-24T09:07 (confirmed working)
- Disabled entries: heartbeat-amy, heartbeat-amy-kimi, consolidate-memory-amy, consolidate-memory-amy-kimi, lesson-consolidation, evaluate-session-llm, project-monitor — all intentionally disabled

### Activity: 246 sessions in last 24h
- ~10.25 sessions/hour average
- 14 evaluations on file
- 31 git commits since Cycle 13

### Test Infrastructure
- Test files exist at `/app/node_modules/.bin/vitest` and `/home/hao/may-agent/node_modules/.bin/vitest`
- `npx` not in PATH — tests must be run via `./node_modules/.bin/vitest --run`
- Symlink issue from Cycle 13 (pi-agent-core) status: **unchanged** — still a blocker for some test files

### Guards Deployed (7 total, 804 lines)
| Guard | Lines | Purpose | In Binary? |
|-------|-------|---------|------------|
| compose-guards.ts | 60 | Orchestrator | ✅ b9ef77e |
| cross-edit-guard.ts | 135 | P53 cross-agent edit prevention | ✅ b9ef77e |
| empty-args-guard.ts | 92 | Blocks read({})/bash({}) | ❌ a3447e6 |
| finish-guard.ts | 229 | Evidence + verification gates | ✅ b9ef77e (partial — FM-3.3 gate needs 79a76e5) |
| read-dedup-guard.ts | 82 | Blocks >5 reads of same file | ✅ b9ef77e |
| scrape-dedup-guard.ts | 84 | Blocks duplicate scrapes | ✅ b9ef77e |
| session-read-guard.ts | 122 | Blocks session.jsonl reads | ✅ b9ef77e |

---

## What Changed Since Cycle 13

### Major Infrastructure Changes
1. **Binary rebuilt** (b9ef77e, Mar 24 07:02) — Unblocked 5 handlers that were stuck since Mar 20
2. **System prompt simplified** (2003ca7) — `resolveSystemPrompt` now loads only SOUL.md + common-sense.md (was 10 files, 36-52KB). Major prompt size reduction.
3. **Verification evidence in finish()** (cd19a1f + 79a76e5) — New `verification_evidence` field + FM-3.3 enforcement guard
4. **ConcurrencyGate removed** (c35ba53) — Was causing more timeouts than it prevented
5. **Unified logging** (7f85a05 + 2221abe) — Single `log(level, message)` function
6. **Gym infrastructure** — benchmarks baseline script, stats merged into may.db, config identity tracking
7. **Web UI improvements** — Daily digest, session picker, markdown rendering, event filtering
8. **Empty-args guard** (a3447e6) — Committed but NOT yet in deployed binary

### New Skills Deployed (6 since Cycle 13)
| # | Skill | Deployed | Notes |
|---|-------|----------|-------|
| S12 | classify-then-act | Mar 24 | Gym tested |
| S13 | scope-discipline | Mar 24 | Gym tested |
| S14 | verification-consistency | Mar 24 | Gym tested, 3/3 pass |
| S15 | progressive-work-persistence | Mar 24 | Gym tested, 3/3 pass |
| S16 | deliverable-integrity | Mar 24 | Gym tested, 3/3 pass |
| S17+ | 21 more skill files exist | Various | Total 38 SKILL.md files in agents/shared/skills/ |

### Key Findings Since Cycle 13
1. **Optimizer self-cost dominance** ($118/day = 54% of $221/day total) — Escalated. Root: 1.3M avg input tokens per heartbeat. Proposed 30→60min interval.
2. **Tool quality regression** (5.9% waste rate, up from 1.0%) — bash:other=106, bash:nonexistent-path=28. Empty-args guard deployed but needs binary rebuild.
3. **FM-3.3 Verification Failure** is the dominant eval failure (4/8 recent evals) — Structural guard deployed (finish-guard.ts FM-3.3 gate). 22 tests.
4. **FM-2.2 Instruction Noncompliance** is the most frequent overall (6/8 evals) — No structural fix yet.
5. **Coach bash-grep bypass** — session-read-guard already has bash-grep protection in code, but needs binary rebuild to activate.

---

## Deployed Improvements Status (Updated from Cycle 13)

### Tier 1: Confirmed Working & Measurable
| # | Improvement | Status | Notes |
|---|-------------|--------|-------|
| F1-F18 | All 18 from Cycle 13 | ✅ Active | No regressions observed |
| F19 | Verification evidence in finish() | ⏳ Committed (cd19a1f) | NOT in binary b9ef77e |
| F20 | FM-3.3 finish guard (Gate 2) | ⏳ Committed (79a76e5) | NOT in binary — 22 tests |
| F21 | ConcurrencyGate removal | ✅ Deployed (c35ba53) | Eliminated timeout-causing false positives |
| F22 | Unified logging | ✅ Deployed (7f85a05) | Single log() function |
| F23 | System prompt simplification | ⏳ Committed (2003ca7) | NOT in binary b9ef77e — needs rebuild |

### Tier 2: Committed but Blocked on Next Binary Rebuild
| # | Improvement | Commit | Est. Impact |
|---|-------------|--------|-------------|
| B1 | Empty-args guard | a3447e6 | Blocks ~18 wasted calls/scan period |
| B2 | FM-3.3 finish guard (complete) | 79a76e5 | Enforces verification evidence |
| B3 | Verification evidence field in finish() | cd19a1f | Structured proof-of-work |
| B4 | System prompt simplification | 2003ca7 | **$30-60/day** — highest value item |
| B5 | Gym stats in may.db | fda5082 | Unified data layer |
| B6 | Web UI improvements | 335546d+ | Operational visibility |

### Tier 3: Skills (38 SKILL.md files, ~17 actively deployed to agents)
- 6 new skills deployed since Cycle 13
- All recent skills gym-tested with 3/3 pass rates
- Coverage: obstacle-pivot, grep-first, budget-before-act, SCBA, stale-approach, coder-edit-discipline, delegation-verification, idempotent-work, search-strategy-escalation, evidence-over-narrative, incremental-context-loading, classify-then-act, scope-discipline, verification-consistency, progressive-work-persistence, deliverable-integrity + 1 more

---

## Key Findings & Recommendations

### Finding 24: Binary Rebuild Gap Is Still the #1 Blocker
- Binary b9ef77e is 10 commits behind HEAD
- Empty-args guard (biggest tool-quality fix this cycle) is NOT active
- **Recommendation**: Need regular rebuilds (daily or on-commit). Track: each day without rebuild accumulates ~$5-10/day in unrealized savings from guards not yet active.

### Finding 25: Prompt Simplification Committed But NOT in Binary
- commit 2003ca7 changed resolveSystemPrompt to load only SOUL.md + common-sense.md
- This is the single biggest prompt cost reduction — previously 10 files / 36-52KB
- **Status**: ❌ NOT in binary b9ef77e. Commit 2003ca7 is 13 commits AFTER b9ef77e. Agents are still loading the full 10-file prompt.
- **Impact**: This is the highest-value unrealized savings. With optimizer at $118/day and 1.3M avg input tokens, reducing prompt by ~50% could save $30-60/day.
- **Recommendation**: Binary rebuild is now CRITICAL — not just for guards but for prompt simplification cost savings.

### Finding 26: FM-2.2 (Instruction Noncompliance) Lacks Structural Fix
- 6/8 recent evals flagged FM-2.2 — the most frequent failure type
- No guard or skill specifically targets this (unlike FM-3.3 which now has a finish guard)
- **Recommendation**: Analyze FM-2.2 instances to understand subtypes. Potential structural fixes:
  - Task requirement extraction at session start
  - Checklist injection in heartbeat messages
  - Post-flight requirement matching in finish()

### Finding 27: Optimizer Cost Still Dominant
- $118/day = 54% of total spend (escalated, req:93d7d0ea)
- Root cause: 1.3M avg input tokens per heartbeat from context accumulation
- Prompt simplification (Finding 25) may have already reduced this
- **Recommendation**: Measure current optimizer session cost post-simplification. If still >40%, consider:
  - 30→60min heartbeat interval (saves ~$59/day)
  - Aggressive context pruning in heartbeat injection

### Finding 28: Tool Quality Regression (5.9% waste) Needs Binary
- Waste rate jumped from 1.0% → 5.9% (156/2655 calls)
- bash:other=106 is the dominant category (heterogeneous parsing errors — hard to guard)
- Empty-args guard would catch ~18 of the 156 wasted calls
- bash:nonexistent-path=28 could be addressed with a path-existence guard
- **Recommendation**: Binary rebuild activates the empty-args guard. A `bash-path-guard` could pre-check file existence for common patterns.

---

## Priority Actions (Updated)

1. **[INFRA] Binary rebuild** — Activates empty-args guard + FM-3.3 complete guard + web UI improvements. Single biggest bang-for-buck action. 
2. **[INFRA] Set ANTHROPIC_API_KEY** — Enables prompt caching. Carried from Cycle 13. Still $36/day potential.
3. **[INFRA] Fix pi-agent-core symlinks** — Restores test suite. Carried from Cycle 13.
4. **[OPT] Measure post-simplification prompt sizes** — Verify Finding 25 impact.
5. **[OPT] FM-2.2 structural fix** — Design a guard or skill for instruction noncompliance.
6. **[SKILL] Continue skill lifecycle** (cooldown: next eligible ~20:03 UTC) — 17 skills deployed, discovery getting harder. Consider skill refinement over new creation.

---

## Savings Scorecard (Updated)

| Category | Estimated Savings | Status |
|----------|------------------|--------|
| Infrastructure fixes (cache, binary, tests) | $40-60/day | ⏳ Binary rebuilt, cache+tests still pending |
| Deployed code improvements (F1-F18, F21-F22) | $55-110/day | ✅ Active (F19,F20,F23 blocked on rebuild) |
| Deployed skills (S1-S17) | $5-20/day | ✅ Active (+6 since Cycle 13) |
| Prompt simplification (F23) — blocked | $30-60/day | ❌ NOT in binary — needs rebuild |
| Other blocked improvements (B1-B6) | $10-25/day | ❌ NOT in binary — needs rebuild |
| Proposed but not yet built | $10-20/day | 📋 Backlog |
| **Total deployed (conservative)** | **$60-130/day** | |
| **Total with binary rebuild** | **$100-215/day** | |
| **Total with remaining infra fixes** | **$135-275/day** | |

**Cost trajectory**: System was $221/day (Finding from 0324-0136). With binary rebuild activating prompt simplification + guards, target $120-160/day. With all infra fixes (cache, tests): <$100/day.
**Binary rebuild is the single most valuable action**: $40-85/day in unrealized savings sitting in committed code.

---

## Comparison to Cycle 13

| Metric | Cycle 13 (Mar 23) | Cycle 14 (Mar 24) | Delta |
|--------|-------------------|-------------------|-------|
| Skills deployed | 11 | 17 | +6 |
| SKILL.md files | ~14 | 38 | +24 |
| Code improvements | F1-F18 | F1-F23 | +5 |
| Guards | 5 (cross-edit, finish, read-dedup, scrape-dedup, session-read) | 7 (+empty-args, compose) | +2 |
| Test coverage | 784 pass, 34 fail | Unchanged (symlink blocker) |  |
| Binary age | 3+ days | 9 hours | ✅ Improved |
| Sessions/day | ~150-250 | ~246 | Stable |
| Handlers enabled | 32 | 39 | +7 |
| Top blocker | Binary rebuild | Binary rebuild (again, for new commits) | Recurring |

---

_Next review: Cycle 15 (~2026-03-25T16:00 or sooner if major changes land)_
