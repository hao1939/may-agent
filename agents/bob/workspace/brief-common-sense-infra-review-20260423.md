# Common Sense Infra Review — 2026-04-23

## Task
Cron: Review agents/shared/common-sense.md for infra-owned items.

## Changes Since Last Review (2026-04-21)

No substantive changes to common-sense.md since Apr 21. The doc was streamlined earlier (accountability boundaries, "Own it" principle) — all behavioral/narrative, no new infra mechanisms needed.

## Highest Priority Unbuilt: C12.1 Checker Patch — **5 DAYS OVERDUE (P0)**

File: `/app/agents/may/handlers/convention-check.ts`

**Line 643** — BASH_ORIENTATION regex missing `echo`:
```diff
- const BASH_ORIENTATION = /^(grep|rg|find|ls|cat|head|tail|git|bun)\b/;
+ const BASH_ORIENTATION = /^(grep|rg|find|ls|cat|head|tail|git|bun|echo)\b/;
```

**Line 654** — export prefix stripping only handles `&&`, not `;`:
```diff
-        .replace(/^(cd\s+[^\s;]+\s*&&\s*|export\s+\w+=("[^"]*"|'[^']*'|[^\s;]+)\s*&&\s*)*/g, "");
+        .replace(/^(cd\s+[^\s;]+\s*(&&|;)\s*|export\s+\w+=("[^"]*"|'[^']*'|[^\s;]+)\s*(&&|;)\s*)*/g, "");
```

This causes false C12.1 violations when agents use `export PATH=...;` (semicolon) or `echo` for orientation. Originally identified by Coach on Apr 18. **Escalate to P0 — dispatch to tech-lead immediately.**

## C1.3 — Still Declining, No Infra Intervention Yet

C1.3 (verify-writes) has been failing for 6+ consecutive checks. Coach's last growth cycles focused on other patterns (FM-1.3 for bob, EXP-203). No Coach Growth Cycle has targeted C1.3 yet. **Decision: if still red after next Coach heartbeat cycle, design a soft nudge (warning injected into write() response reminding agent to read-back).**

## Coach-Flagged Items Needing Infra

| Item | Priority | Status | Notes |
|------|----------|--------|-------|
| **C12.1 checker patch** | **P0** | 5 days overdue | Two-line fix, verified location. Dispatch NOW. |
| C1.3 infra nudge | P2 (watch) | Waiting on Coach cycle | Design if still red in 2 days |

## Ownership Updates

No ownership changes needed. common-sense.md remains human-controlled (propose-only). All items in doc are behavioral guidance — infra enforcement is in convention-check.ts and guards.

## Actions
- [x] Wrote this brief
- [ ] **P0**: Dispatch C12.1 two-line patch to tech-lead (file: `/app/agents/may/handlers/convention-check.ts`, lines 643 + 654)
