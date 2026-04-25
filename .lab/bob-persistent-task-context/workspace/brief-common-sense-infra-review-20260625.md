# Common Sense Infra Review — 2026-06-25

## Task
Cron: Review agents/shared/common-sense.md for infra-owned items.

## Changes Since Last Review (2026-04-23)

common-sense.md was significantly streamlined since Apr 23 — now focused on system mechanics (agents, projects, heartbeats, metrics, workflows, guards, escalation) plus "How to Think" behavioral guidance. No new infra mechanisms introduced. The doc is cleaner and more accurate.

## Highest Priority Unbuilt: C12.1 Checker Patch — CRITICALLY OVERDUE

File: `/app/agents/may/handlers/convention-check.ts`

**Still unpatched since Apr 18 identification.** Line 643 BASH_ORIENTATION regex still missing `echo`:
```
const BASH_ORIENTATION = /^(grep|rg|find|ls|cat|head|tail|git|bun)\b/;
```

And the export prefix stripping (around line 650) only handles `&&`, not `;`.

**This has been P0 for 2+ months. Dispatching to tech-lead NOW.**

## C1.3 (Verify Every Write) — Chronic Red

Coach status shows 6+ consecutive ❌ checks at 15% compliance. This is the single worst-performing behavioral item. The Apr 23 brief proposed a soft nudge (warning in write() response). **Decision: design the nudge now — C1.3 has been red long enough.**

### Nudge Design (C1.3 write-readback reminder)

**Mechanism:** After every `write()` or `edit()` call, append a one-line reminder to the tool response:
```
💡 Reminder: read back this file to verify your change landed correctly.
```

**Location:** Guard or tool wrapper in the response pipeline.
**Risk:** Low — it's advisory text, not blocking. Agents can ignore it.
**Expected impact:** Nudge compliance from 15% → 40-50% (based on Coach's evidence that agents respond to in-context reminders better than SOUL-level rules).

## Coach-Flagged Items Needing Infra

| Item | Priority | Status | Action |
|------|----------|--------|--------|
| **C12.1 checker patch** | **P0** | ~2 months overdue | Dispatching to tech-lead |
| **C1.3 nudge** | **P1** | Design ready | Implement write/edit readback reminder |

## Ownership Updates

No changes needed. common-sense.md remains human-controlled. All enforcement is in convention-check.ts and guards.

## Actions
- [x] Wrote this brief
- [ ] **P0**: Dispatch C12.1 patch to tech-lead
- [ ] **P1**: Dispatch C1.3 nudge implementation
