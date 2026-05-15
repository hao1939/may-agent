# Finding: Mode B — Tool Gap Analysis (6h window ending 2026-04-18 09:00)

## Scan Parameters
- Window: last 6 hours (cutoff ~03:00 UTC)
- Focus: sessions with >20 ops
- Top sessions: may 123ops, coder 57ops, optimizer 55ops, coach 54/52/40/38/37ops, bob 49ops

## Pattern 1: bun -e DB Query Failure Chains (HIGH FREQUENCY)

**Agents affected:** coach (3 sessions), optimizer (1 session), bob (1 session)
**Waste:** 7-17 wasted bash calls per session from failed bun -e sqlite attempts

Coach sessions at 38ops and 37ops both show FM-1.3 failure chains where multiple `bun -e` DB query attempts fail before a working version is found. The 37ops session had a 17-wasted-call chain just trying to introspect session data.

**Root cause:** Complex bun -e queries with nested quoting (double quotes for shell, single for SQL, escaping for JS template literals) break frequently. Agents retry with slightly different quoting each time.

**Proposed tool/script:** `scripts/query-db.sh` — a wrapper that accepts a SQL file or heredoc, handles the bun:sqlite boilerplate, and outputs JSON. Would eliminate quoting issues entirely.

## Pattern 2: git add on Gitignored Paths (MEDIUM FREQUENCY)

**Agents affected:** coder (57ops session), coach, bob
**Waste:** 3-5 calls per incident

Coder's 57ops session had repeated `git add` attempts for paths that were moved/renamed or gitignored, producing FM-1.3 error chains. Bob's 49ops session also triggered the FM-3.3 guard by using git-based verification on gitignored workspace files.

**Root cause:** Agents don't check `.gitignore` or `git status` before `git add`. Workspace/findings paths are gitignored by design.

**Proposed improvement:** Add a pre-commit helper or document the pattern more prominently. Low-effort: agents already know workspace/ is gitignored but forget under pressure.

## Pattern 3: grep Exit Code 1 Treated as Failure (LOW-MEDIUM)

**Agents affected:** optimizer (55ops session)
**Waste:** 2-3 calls per incident

`grep` returning exit code 1 (no matches) triggers error-recovery logic when the agent interprets it as a failure rather than an expected empty result.

**Proposed fix:** Convention reminder: use `grep ... || true` for exploratory searches, or use `rg` which has clearer semantics.

## Summary Table

| Pattern | Frequency (6h) | Avg Wasted Calls | Fix Effort | Impact |
|---------|----------------|-------------------|------------|--------|
| bun -e DB query failures | 5 sessions | 7-17 | Medium (script) | High |
| git add gitignored paths | 3 sessions | 3-5 | Low (docs) | Medium |
| grep exit=1 mishandled | 1-2 sessions | 2-3 | Low (convention) | Low |

## Recommendation

**Priority 1:** Build `scripts/query-db.sh` wrapper. This is the highest-ROI intervention — it would save 7-17 ops per affected session and coach alone triggers it multiple times per 6h window. Estimated savings: 30-50 ops/day across all agents.
