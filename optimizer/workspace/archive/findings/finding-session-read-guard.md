# Finding: Session.jsonl Direct Read Guard

**Date:** 2026-03-18T20:55  
**Severity:** High cost waste  
**Status:** ✅ COMMITTED (958fdad) — pending process restart

## Problem

Coach `common-sense-verify` sessions were reading full `session.jsonl` files using `read()` despite cron message explicitly instructing grep-based search. The latest session (s_1773866800643_153) was **634KB** with **93.3% tool results** — 4 reads of a single 188KB session.jsonl.

Instructions are unreliable — agents ignore them. **Structural guards > prompt instructions.**

## Evidence

- Session s_1773866800643_153: 634,238 bytes total, 586,259 bytes (93.3%) in toolResult
- Top 3 toolResults: 109KB, 108KB, 102KB — all reads of session.jsonl
- The file being read: s_1773865140383_148/session.jsonl (188,782 bytes)
- 12 read() calls + 11 bash calls in a single verify session

## Fix

New `session-read-guard.ts` — `beforeToolCall` hook that blocks all `read()` calls targeting `session.jsonl` files under `.state/sessions/`. Provides helpful message suggesting grep/jq alternatives.

**Files changed:**
- `src/lib/tools/session-read-guard.ts` — new guard (53 lines)
- `src/lib/manager.ts` — wired into both `composeGuards()` calls
- `test/session-read-guard.test.ts` — 9 tests, all passing

## Impact

- Per common-sense-verify session: save ~400-500KB of transcript tokens ($2-5)
- 6 runs/day × $3.50 avg = **$21/day savings** (~$630/month)
- Also protects ANY agent from accidentally reading session.jsonl
