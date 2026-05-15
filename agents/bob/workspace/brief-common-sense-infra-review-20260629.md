# Common Sense Infra Review — 2026-06-29

## Task
Cron: Review agents/shared/common-sense.md for infra-owned items. Identify highest-priority unbuilt mechanism. Check if Coach flagged anything needing infra help.

## Changes Since Last Review (2026-04-18)
`common-sense.md` gained a `## Mandatory Procedures` section with explicit step-by-step instructions for C1.1, C1.3, C1.7, C12.1. Also gained `## Convention Compliance Reminders` and `## Learned from experience` sections. Structure: How the System Works → How to Think → Conventions → Environment → Mandatory Procedures. No ownership ledger in the doc — it's narrative.

## Coach Tracker Status (as of last update 2026-04-27)

| Item | Status | Trend |
|------|--------|-------|
| C1.3 Verify every write | **❌ (15%, 6th consecutive ❌)** | Worsening: 94%→32%→15% |
| C5 Narration rate | ⚠️ (20%) | Flat |
| C50 Environment Reality | ⚠️ (99.3%) | Improving |
| #4 Verify delegated work | ⚠️ | May §1c structural cause identified |
| All others | ✅ | Stable |

## Highest Priority Unbuilt: C1.3 Write Verification Guard

**C1.3 is the clear #1.** Six consecutive ❌ checks. Compliance dropped from 94% → 32% → 15%. Coach marked it "Growth Cycle candidate." Behavioral interventions (prose rules, mandatory procedures section in common-sense.md, context.md reminders) have not worked. This is the textbook case for an infra mechanism.

### Proposed Design: Post-Write Verification Nudge

**Mechanism**: After a `write()` call, if the agent's next tool call is NOT `read()` on the same path, inject a soft warning: "⚠️ C1.3: You wrote to `{path}` but didn't verify with read(). Consider reading back to confirm."

**Why soft warning, not hard block:**
- `edit()` is self-verifying (returns diff) — only `write()` needs this
- Hard blocks on verification would double tool-call counts and break flow for legitimate cases (writing new scaffolding files)
- A nudge changes the cost/benefit: agents see the reminder and can choose to verify or skip for trivial writes

**Scope**: Only `write()` calls. `edit()` already shows diffs.

**Expected impact**: Based on analogous nudges (git-add wrong-dir went from 37% → 0.96% with guard), even a soft nudge should push compliance from 15% → 60%+ within 2 weeks.

**Alternative considered**: Hard gate (block finish() if unverified writes exist). Too aggressive — would cause false positives on scaffolding sessions with many small writes.

## Coach-Flagged Items Needing Infra

| Item | Priority | Status |
|------|----------|--------|
| **C1.3 write verification** | **P1 → design brief above** | 6× ❌, behavioral fixes exhausted |
| May §1c verification nudge | P2 | Text edit to may/heartbeat.md, not infra code. Coach recommended. Not acted on in 10+ weeks. |
| EXP-250 gym runner blocker | P2 | Coach blocked on GYM_AGENT_BIN env var — can't invoke agents from coach session. This is an infra/env config issue, not a common-sense item. |

## Ownership Updates
No ownership changes needed in `common-sense.md` — it contains no ownership annotations. The guard-workflow architecture (my previous P0 from Apr 14/18) remains shipped (Phase 1 complete). Coach's tracker is the de facto ownership ledger.

## Summary
- **C1.3 write verification is the highest-priority unbuilt infra mechanism** — 6 consecutive ❌, 15% compliance, behavioral approaches failed. Recommending a soft post-write nudge guard. Brief above ready for tech-lead dispatch.
- Coach has no new urgent infra-help flags beyond the persistent C1.3 and May §1c items.
- No ownership updates needed in common-sense.md.
