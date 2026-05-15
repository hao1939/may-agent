# Finding: Tool Gap Scan — Fresh 6h Patterns (Apr 12, 07:24–13:24 UTC)

**Date**: 2026-04-12 ~13:24 UTC  
**Session**: s_1776000251905_2142 (Mode B — Tool Gap Analysis)  
**Method**: Extracted bash commands from session.jsonl across 58 sessions (>15 ops) in the 6h window. Compared against [finding-bash-command-patterns-0411.md](finding-bash-command-patterns-0411.md).  
**Window**: 195 total sessions, 58 with >15 ops, 1,741 bash commands analyzed.

---

## What's Unchanged from Apr 11

The top-level category distribution is nearly identical to the Apr 11 scan:

| Category | Apr 11 | Apr 12 | Delta |
|----------|--------|--------|-------|
| GREP_SEARCH | 26.5% | 24.4% | -2.1pp |
| DB_QUERY | 23.2% | 20.9% | -2.3pp |
| GIT_OPS | 5.9% | 16.0% | +10.1pp ⬆ |
| FILE_READ | 11.0% | 11.3% | +0.3pp |
| FILE_DISCOVERY | 9.3% | 5.9% | -3.4pp |

The P0/P1 tool recommendations from Apr 11 (Convention Dashboard, Code Search, Fleet Status) remain unbuilt and still valid. GIT_OPS rose sharply due to one 96-op branch-cleanup session.

---

## New Findings (Not in Apr 11 Report)

### Finding 1: Wrong DB Path — `may.db` vs `.state/may.db` (91 wasted queries)

**This is the biggest new finding.** The root `may.db` (172KB, Apr 7) has **zero rows** in all tables. The real database is `.state/may.db` (93MB, 19,737 sessions). Yet in the last 6h:

- **91 DB queries** hit the empty `may.db` — returning nothing, triggering retry/exploration cascades
- **379 DB queries** correctly used `.state/may.db`
- **Optimizer**: 57 wrong, 131 correct (30% error rate)
- **Coach**: 34 wrong, 55 correct (38% error rate)
- **May**: 0 wrong (uses correct path), **but uses `better-sqlite3` (117 calls)** which isn't installed

The optimizer and coach context.md files say "query may.db with bun" — this directs agents to the stale copy. Meanwhile `may` agent uses `node -e` with `better-sqlite3` (117 calls vs 35 using bun:sqlite), which isn't available either, causing errors that cascade into PRAGMA exploration.

**Impact**: Each wrong-path query returns empty results → agent retries with different query → tries PRAGMA table_info → tries different table names → gives up or eventually finds `.state/may.db`. This accounts for much of the 91 schema-exploration queries observed.

**Fix**: Update all agent context.md files to use `.state/may.db` path. Fix may agent to use `bun -e` with `bun:sqlite` instead of `node -e` with `better-sqlite3`.

### Finding 2: Schema Exploration Overhead (91 PRAGMA/table_info calls)

**91 schema exploration queries** across the 6h window — agents running `PRAGMA table_info()`, `SELECT * FROM sqlite_master`, or querying column names before every real query. This was noted in Apr 11 (9 occurrences) but has **exploded 10x** — likely because agents are hitting the empty `may.db` and then trying to figure out what went wrong.

Most of these are downstream effects of Finding 1. Fixing the DB path would eliminate ~60-70 of these.

### Finding 3: Merge Conflict Resolution Chains (25 ops, concentrated)

The tech-lead 96-op session spent **81 of 104 bash calls on git operations**, with 16 specifically on conflict resolution (grep `<<<<<<`, sed line ranges, python3 conflict-resolver scripts, `--theirs`/`--ours` checkout). This pattern:

1. `git merge --no-ff <branch>` → conflict
2. `git diff --name-only --diff-filter=U` → find conflicting files
3. `grep -n "<<<<<<" <file>` → find conflict markers
4. `sed -n '<range>p' <file>` → inspect conflict
5. Python3 script to auto-resolve (take theirs, skip conflict blocks)
6. `grep -c "<<<<<<" <file>` → verify resolution
7. `git add <file> && git commit`

This 7-step sequence repeated 3-4 times in the session. Not high frequency (1 session), but when it hits it's devastating (81 ops).

**Already identified**: Branch review was P2 in Apr 11. The conflict resolution sub-pattern is new detail.

### Finding 4: Git Status Spam (37 calls, 12 in one session)

Tech-lead branch cleanup session called `git status` **12 times** — roughly every 8 commands. Other sessions averaged 1-3 calls. This is a defensive pattern (checking state before each operation) that doesn't need to be a separate tool call — merging `git status` into the operations that need it would save ~20 ops fleet-wide.

---

## Fewshot Regex Fix Status

**Picked up and deployed.** The tech-lead session s_1775980510847_1965 (40 ops, status: done) fixed both patterns:
- `binary-file-escalation.md`: `\.bin` → `\.bin\b(?!\/)` (word boundary, no directory match)
- `escalation-judgment.md`: regex tightened

The fix is live in `agents/shared/knowledge/fewshot-examples/binary-file-escalation.md`.

---

## Updated Priority Recommendations

| Priority | Tool/Fix | Ops Saved/6h | Status |
|----------|----------|-------------|--------|
| **P0** | Fix DB path in context.md (may.db → .state/may.db) | ~91+ (direct) + ~60 (schema cascade) | **NEW — trivial fix** |
| P0 | Fix may agent: node/better-sqlite3 → bun/bun:sqlite | ~117 error-prone calls | **NEW — trivial fix** |
| P1 | Convention Dashboard tool | ~50 | Unchanged from Apr 11 |
| P1 | Code Search tool | ~80 | Unchanged from Apr 11 |
| P2 | Fleet Status tool | ~10 | Unchanged from Apr 11 |
| P2 | Branch Review + Conflict Resolver tool | ~6-81 per occurrence | Refined from Apr 11 |

The two P0 fixes are **configuration changes, not tool builds** — they could save ~150+ wasted ops per 6h window immediately.

---

## Data Notes

- `may.db` (project root) is a stale 172KB copy from Apr 7 with zero rows
- `.state/may.db` is the live 93MB database with 19,737 sessions  
- Session data is in `.state/sessions/<id>/session.jsonl` (filesystem), not in may.db
- The SESSION_BASH_CAT guard blocks reading session.jsonl via cat — must use bun -e with JSON parsing
