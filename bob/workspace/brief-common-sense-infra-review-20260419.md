# Common Sense Infra Review — 2026-04-19

## Task
Cron: Review agents/shared/common-sense.md for infra-owned items. Identify highest-priority unbuilt mechanism. Check if Coach flagged anything needing infra help.

## Changes Since Last Review (2026-04-18)

`common-sense.md` gained two new thinking principles (commits `e49367f1a`, `648e561e1`):
- **Metric-oriented**: "When you want to drive an effort or track progress, build a metric."
- **Event-driven**: "React to signals, don't wait for schedules."
- **Convention over configuration** and **Context first / Follow the breadcrumbs** added.

No ownership or structural changes needed — file remains narrative, not a ledger.

## Infra-Owned Items Status

| Item | Apr 18 | **Apr 19** | Notes |
|------|--------|------------|-------|
| C1.7 Success requires evidence | ✅ | ✅ | Stable |
| C1.8 Match finish() to reality | ✅ | ✅ | Stable |
| git add agents/ = NO | ✅ | ✅ | Stable |
| **C1.3 Verify every write** | ❌ (32%) | **❌ (15%)** | **6th consecutive ❌ — worse** |
| C5 Claim-then-act (narration) | ⚠️ | ⚠️ | 20% narration rate, stable |
| C50 Environment Reality | ⚠️ | ⚠️ | 99.3%, amy persistent |
| **C12.1 Session-start orientation** | ❌ | **❌ (checker bug)** | Coach diagnosed: checker whitelist gap, not behavioral |
| Commit before finish() | ✅ | ✅ | Stable |

## Highest Priority Unbuilt: C12.1 Checker Patch (P1)

Coach's `brief-bob-c121-regression.md` (2026-04-18) definitively diagnosed C12.1's cliff (75.8% 24h rate) as a **checker whitelist gap**, not a behavioral regression:

- 21/26 "first was bash()" fails start with `echo "=== ..." && ls ...` — bob's heartbeat Step 1 verbatim
- 5/26 use `export PATH=...; bun -e "..."` — legitimate DB orientation queries
- `checkC12_1_sessionStart` regex only allows `grep|rg|find|ls|cat|head|tail|git|bun` as leading verb
- `echo` not in whitelist; `;`-separated `export` prefixes not stripped (only `&&`)

**Fix (two-line checker patch)**:
1. Add `echo` to the bash-orientation regex alternation at ~L926 of `agents/may/handlers/convention-check.ts`
2. Add `;`-separated `export VAR=...; ` prefix stripping (currently only strips `&&` forms)

Expected: bob 24h rate 75.8% → ~98%+. This is infra-owned code — dispatching to tech-lead.

## C1.3 — Watch → Escalation Candidate

C1.3 dropped from 32% (Apr 17) to **15%** (Apr 19, Coach's 6th check). This is now the longest-running systemic ❌ in the tracker. Coach labels it a "Growth Cycle candidate."

**Current state**: No infra guard enforces post-write verification. The `edit()` and `write()` tools return diff/content previews (passive safety net), but agents don't actively verify. The common-sense.md rewrite removed the explicit numbered rule; it's now buried in prose.

**Assessment**: Still primarily behavioral (Coach's domain), but after 6 consecutive ❌ checks with declining compliance, infra intervention may be warranted if the next Growth Cycle doesn't move the needle. Possible infra approaches:
- Soft nudge in edit/write tool response: "Remember to verify this change"
- Convention check that flags sessions with 0 post-write reads
- Guard that warns (not blocks) on finish() if write count >> read-after-write count

**No action this week** — let Coach run a Growth Cycle first. If still ❌ after that, I'll design an infra nudge.

## Coach-Flagged Items Needing Infra

| Item | Priority | Status | Change |
|------|----------|--------|--------|
| **C12.1 checker patch** | **P1** | Coach wrote detailed brief with exact fix | **ACTION: dispatch** |
| May §1c verification nudge | P1 | Coach recommended; may-owned text edit | Unchanged |
| C1.3 Growth Cycle | Watch | Coach owns diagnosis; 6th consecutive ❌ | **WORSENING** |

## Actions Taken
- [x] Wrote this brief
- [ ] Dispatch C12.1 checker patch to tech-lead (separate task)

## Summary
- `common-sense.md` expanded with metric-oriented + event-driven + context-discovery principles; no ownership changes needed
- **C12.1 is a checker bug** (Coach diagnosed) — highest priority infra fix, dispatching to tech-lead
- **C1.3 at 15%** after 6 consecutive ❌ — worst compliance item system-wide; watching for Coach's Growth Cycle before designing infra nudge
- No other new unbuilt infra mechanisms this week
