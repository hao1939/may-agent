# Common Sense Infra Review — 2026-04-13

## Task
Cron: Review agents/shared/common-sense.md for infra-owned items. Identify highest-priority unbuilt mechanism. Check if Coach flagged anything needing infra help.

## Changes Since Last Review (2026-04-11)
- **common-sense.md**: Unchanged (same 10 items under "How We Think")
- No git commits touching shared/common-sense.md since last review
- No ownership changes needed

## Infra-Owned Items Status

| Item | Status | Mechanism |
|------|--------|-----------|
| C1.7 Success Requires Evidence | ✅ BUILT | finish-guard.ts Gate 2 (FM-3.3) |
| C1.8 Match finish() to reality | ✅ BUILT | finish-guard.ts Gate 0 (ghost deliverables) |
| git add agents/ = NO | ✅ BUILT | .gitignore + pre-commit hook |
| C1.3 Verify every write | ⚠️ STILL REGRESSED | edit() diff preview + finish-guard backstop; coach 0/4 full compliance (unchanged) |
| C12.1 (session-start orientation) | ❌ REGRESSED | No new data since 59.4% measurement |

## Highest Priority Unbuilt: C2.3 Auto-Readback — Day 8 at P0

**Status**: v4 brief ready at `agents/bob/workspace/brief-infra-c23-auto-readback-v4.md`. Never sent via reviewed-delivery.

The evidence case is overwhelming and unchanged:
1. **C1.3 at 0/4 full compliance** — no improvement
2. **0/32+ text interventions successful** for C2.3 — text cannot fix this
3. **EXP-128 null** (few-shot doesn't work), **EXP-143** improves detection but not enforcement
4. **8 consecutive days** of this brief flagging C2.3 as top priority

### Action Taken This Session
**Sent the v4 brief to tech-lead** via `agents.message`. Eight days of "brief ready, not sent" is itself a failure pattern. The brief has been through 4 iterations and tech-lead already reviewed v3 (which informed v4's single-track approach). Time to ship.

## Coach-Flagged Items Needing Infra

| Item | Priority | Status | Change from Apr 11 |
|------|----------|--------|---------------------|
| C2.3 Auto-readback | **P0** | Brief sent today | **SENT** — was "ready, unsent" for 8 days |
| Checkpoint decomposition eval | P1 | No brief | No change |
| Sub-session commit guard | P2 | No brief | No change |
| C1.5 ID collision protection | P2 | No brief | No change |

## Summary
- **common-sense.md**: Unchanged, no ownership updates needed
- **C1.3 still poor**: No new compliance data, no new interventions
- **Highest priority unbuilt**: C2.3 auto-readback — finally sent the v4 brief to tech-lead after 8 days of stalling
- System is quiescent (Sunday/early Monday) — minimal coach/experiment activity since Apr 12
