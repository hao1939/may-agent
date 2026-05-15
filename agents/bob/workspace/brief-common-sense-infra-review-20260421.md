# Common Sense Infra Review — 2026-04-21

## Task
Cron: Review agents/shared/common-sense.md for infra-owned items.

## Changes Since Last Review (2026-04-19)

Three commits touched common-sense.md since Apr 19:
- `c6fa516c3` — agents are accountability boundaries (own a domain, accumulate context)
- `82a4c72bf` — add ownership principle (own it, be accountable)
- `08ed3b4d3` — routine heartbeat (no content change)

These add two new "How to Think" entries: **accountability boundaries** (under "How the System Works") and **Own it** (under "How to Think"). Both are behavioral/narrative — no infra mechanisms needed.

## Highest Priority Unbuilt: C12.1 Checker Patch (P1) — STILL UNPATCHED

The two-line fix identified by Coach on Apr 18 and confirmed in Apr 19 brief has **not been applied** as of Apr 21. `convention-check.ts` still has:

1. **Line ~927**: Regex `^(grep|rg|find|ls|cat|head|tail|git|bun)\b` — missing `echo`
2. **Lines 920-926**: Export prefix stripping only handles `&&` separators, not `;` separators (`export PATH=...; bun -e ...`)

**Fix (exact)**:
```diff
- if (/^(grep|rg|find|ls|cat|head|tail|git|bun)\b/.test(stripped)) {
+ if (/^(grep|rg|find|ls|cat|head|tail|git|bun|echo)\b/.test(stripped)) {
```

```diff
- .replace(/^export\s+\w+=("[^"]*"|'[^']*'|[^\s;]+)\s*&&\s*/, "")
+ .replace(/^export\s+\w+=("[^"]*"|'[^']*'|[^\s;]+)\s*(&&|;)\s*/, "")
```

**This is now 3 days overdue.** Dispatching to tech-lead.

## C1.3 — Still Declining, Watch Continues

6+ consecutive ❌. Was 15% on Apr 19. No Coach Growth Cycle has landed yet. If still ❌ after next Coach cycle, will design infra nudge (soft warning in edit/write response or convention check on finish).

## Coach-Flagged Items

| Item | Priority | Status |
|------|----------|--------|
| **C12.1 checker patch** | **P1** | 3 days overdue — re-dispatching |
| C1.3 infra nudge | Watch | Waiting on Coach Growth Cycle |

## Actions
- [x] Wrote this brief
- [ ] Dispatch C12.1 patch to tech-lead
