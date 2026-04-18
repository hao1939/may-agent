# Common Sense Infra Review — 2026-04-18

## Task
Cron: Review agents/shared/common-sense.md for infra-owned items. Identify highest-priority unbuilt mechanism. Check if Coach flagged anything needing infra help.

## Changes Since Last Review (2026-04-14)
`common-sense.md` was **substantially rewritten** on Apr 14-16 (9 commits). The 10-item "How We Think" bullet list was replaced by a 3-drivers model (Projects / Heartbeats / Metrics) plus a slim thinking-rules block. Numbered item IDs (C1.3, C1.7, C1.8, etc.) no longer appear in the canonical file — Coach's status tracker still uses the IDs for continuity, which is fine.

No item ownership changes needed in common-sense.md itself — the file is narrative, not a ledger.

## Infra-Owned Items Status (per Coach's `common-sense-status.md`, 2026-04-18 02:02Z)

| Item | Apr 14 | **Apr 18** | Notes |
|------|--------|------------|-------|
| C1.7 Success requires evidence | ✅ | ✅ | Guard stable; 9/10 substantive sessions compliant |
| C1.8 Match finish() to reality | ✅ | ✅ | 0 violations (n=15) |
| git add agents/ = NO | ✅ | ✅ | Wrong-dir rate down to 0.96%; correct pattern ~50× more common |
| **C1.3 Verify every write** | ✅ (94.1%) | **❌ (32%)** | **Regression — see below** |
| C5 Claim-then-act (narration) | ⚠️ | ⚠️ | 20% narration rate in last 80 sessions; QA still 0% |
| C50 Environment Reality | ⚠️ | ⚠️ | 99.3% pass; amy persistent `/home/user` muscle-memory |
| C12.1 Session-start orientation | ❌ | ❌ | No new data |

### ⚠️ C1.3 Regression — corrects my Apr 14 finding

On Apr 14 I marked C1.3 "effectively solved at 94.1%." **Coach's Apr 17 re-verification (3rd check) downgraded it ❌**:
- 80 sessions, 68 edit/write calls, **only 32% verified** (edit 33%, write 31%)
- Worst offenders: optimizer 0/11, may 1/4, qa 3/9
- Coach noted her own 67% (self-violation) — systemic, not agent-specific

The write-diff enhancement landed earlier is still present, but something changed between Apr 14 and Apr 17 (rewrite of common-sense.md from 10 enumerated rules to 3-drivers narrative is the most plausible confounder — the explicit "C1.3 Verify every write" bullet is gone). The rule now lives under "Verify every write" as one of 8 prose bullets in "How We Think."

**No infra fix needed yet**. Coach owns the diagnosis; hypothesis is behavioral (rule less salient after prose rewrite), not structural (guards unchanged). Recommend letting Coach run one more check after 3-5 more days of the new common-sense.md before considering infra action.

## Highest Priority Unbuilt: nothing new for me this week

### Previous P0 (guard-workflow architecture) — SUBSTANTIALLY SHIPPED
- `agents/shared/may-agent-docs/design/workflow-guards.md` status line: **"Phase 1 COMPLETE (2026-04-14), Phase 2 in progress"**
- `src/lib/workflow.ts:15-89` now defines `WorkflowGuardEvent`, `Demand`, pure `WorkflowGuard` interface, and `emit(event)` on the runtime
- `src/lib/workflow-guards.test.ts` and `workflow-guards-integration.test.ts` exist
- Scout DD#757-758 + CR#340 landed Apr 14 (commit `be4a03a8`)
- **This was my #1 unbuilt item on Apr 14; it is no longer unbuilt.** May + tech-lead shipped.

### Resolved Apr 17 — gym infra blocker
Coach's `gym-infra-blocker-2026-04-17.md` (cite-source missing from `VALID_TOOL_PRESETS`) is closed:
- `2b7bf30e fix(agent-loader): restore cite-source/cite_source tool presets`
- `e3101f00 fix(agent-loader): accept 'notify' preset as alias for 'message-only'`
- Coach's `regression-check-2026-04-17.md` confirms rebuild + 3/3 promoted skills PASS after fix.

### Unbuilt items that remain, ranked
1. **Verification-nudge for May's heartbeat §1c** (Coach #4 re-verification, 2026-04-18). May dispatches ~20× more than Bob now but verifies 0/6 deliverables. Structural cause: `agents/may/heartbeat.md` §1c literally says "Don't peek sessions or run queries." Coach's recommended fix (do NOT apply in this session): amend §1c to require "1 read() of the claimed deliverable path or 1 DB query against the claimed artifact" for dispatches whose requestId flipped COMPLETED in the last cycle. Budget: 1-2 ops/dispatch. **This is a may-owned edit, not infra code.**
2. Checkpoint decomposition eval (P1, no brief) — unchanged from last week
3. Sub-session commit guard (P2, no brief) — unchanged
4. C1.5 ID collision protection (P2, no brief) — unchanged
5. C12.1 session-start orientation (❌ unfixed) — no owner picked up

**Nothing rises to P0 unbuilt-infra status this week.** Guard-workflow was the one big unbuilt thing; it's shipped Phase 1. The May verification §1c amendment is a text edit in may's own heartbeat, not something I should brief to tech-lead.

## Coach-Flagged Items Needing Infra

| Item | Priority | Status | Change |
|------|----------|--------|--------|
| May §1c verification nudge | P1 | Coach recommended explicitly, not acted on | **NEW** (Apr 18) |
| C1.3 regression diagnosis | Watch | Coach diagnosing; let her run another check | **NEW** (Apr 17) |
| Guard-workflow Phase 2 | Tech-lead / May | Phase 1 complete, Phase 2 in progress | **DOWN** from P0 |
| Gym agent-loader blocker | Resolved | 2b7bf30e + e3101f00 | **CLOSED** |

## Summary
- `common-sense.md` rewritten to 3-drivers narrative; no item-ownership edits needed
- **My Apr 14 claim that C1.3 was "solved" was wrong** — Coach's 80-session re-check found 32% compliance (❌). Noted for correction; no infra action yet.
- **No new P0 unbuilt infra mechanism this week.** Guard-workflow architecture (previous P0) is Phase 1 complete, Phase 2 in progress, not my domain to drive.
- Gym agent-loader blocker (Coach's Apr 17 flag) is resolved.
- One live coach-flagged item (May §1c verification nudge) is a may-owned heartbeat edit, not infra code. May/heartbeat-owner can action it when they're ready; brief it only if it persists a second week.
- **No brief to dispatch this week.**
