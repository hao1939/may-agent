# Common Sense Infra Review — 2026-04-14

## Task
Cron: Review agents/shared/common-sense.md for infra-owned items. Identify highest-priority unbuilt mechanism. Check if Coach flagged anything needing infra help.

## Changes Since Last Review (2026-04-13)
- **common-sense.md**: Unchanged (same 10 items under "How We Think")
- No git commits touching shared/common-sense.md since last review
- No ownership changes needed

## Infra-Owned Items Status

| Item | Status | Change from Apr 13 |
|------|--------|---------------------|
| C1.7 Success Requires Evidence | ✅ BUILT | No change |
| C1.8 Match finish() to reality | ✅ BUILT | No change |
| git add agents/ = NO | ✅ BUILT | No change |
| C1.3 Verify every write | ✅ EFFECTIVELY SOLVED | **Upgraded** — 94.1% pass rate (n=557) after write-diff enhancement |
| C12.1 (session-start orientation) | ❌ REGRESSED | No new data |

### C1.3 Reassessment

C1.3 was flagged for 8+ consecutive reviews as critically poor. **It is now effectively solved** via write-diff enhancement (merged Apr 7):
- **94.1% pass rate** (Phase 3, n=557) — up from 47.3% baseline
- Attribution: context.md nudges drove ~80% of improvement, write-diff contributed ~20% (+9pp)
- Remaining 5.9% failures: mostly scout (new-file writes where diff preview is empty)
- **No further infra intervention needed** unless rate regresses

## Highest Priority Unbuilt: Event-Native Guard-Workflow Architecture

### Previous top priority: C2.3 Auto-Readback
- **Brief sent to tech-lead** on Apr 13 (v4, binary wiring approach)
- **Tech-lead forked** session `s_1776057782806_31` on Apr 13 05:21
- **Status: No code changes landed.** No references to readback/C2.3 in finish-guard.ts or manager.ts
- However: **C1.3 is now at 94.1%** — the original justification for C2.3 (0/4 compliance) is mostly obsolete
- C2.3 as binary wiring may still have marginal value for the remaining 5.9%, but it's no longer P0

### New top priority: Guard-Workflow Architecture (Hao directive Apr 13)
- **RFC exists**: `agents/shared/may-agent-docs/design/guard-workflow-architecture.md`
- **Core idea**: Guards operate at workflow-step level, injecting actions into the workflow DAG (not blocking tool calls within sessions)
- **Hao's 5-step pattern**: (1) agent in workflow → (2) guard triggers on step → (3) actions injected → (4) agent/orchestrator reacts → (5) resume original flow
- **Implementation**: 6 phases, Phase 0 (emit workflow events on bus) is the starting point
- **C2.3 becomes Phase 4 use case**: Post-code verification guard injects verify-wrap after code-change steps
- **KE-174/176 alignment**: Structural enforcement (zero alignment tax, guaranteed compliance) vs. behavioral (10% compliance for interruptive steps)
- **This is architecturally more important than C2.3 alone** — it's the framework that makes all future guard enforcement structural

### Recommendation
1. **Deprioritize C2.3 binary wiring as standalone item** — C1.3 at 94.1% removes urgency
2. **Track Guard-Workflow Architecture Phase 0 as the new P0 infra mechanism** — this is Hao's explicit directive and enables all future structural guards
3. **No action from Bob** — this is tech-lead's domain. The RFC design is comprehensive and ready for implementation.

## Coach-Flagged Items Needing Infra

| Item | Priority | Status | Change from Apr 13 |
|------|----------|--------|---------------------|
| C2.3 Auto-readback | **Deprioritized** | C1.3 at 94.1% removes urgency | **DOWN** from P0 |
| Guard-workflow architecture | **P0 (NEW)** | RFC complete, awaiting implementation | **NEW** — Hao directive |
| Checkpoint decomposition eval | P1 | No brief | No change |
| Sub-session commit guard | P2 | No brief | No change |
| C1.5 ID collision protection | P2 | No brief | No change |

Coach is focused on production observation (EXP-109/EXP-113) with no new infra escalations.

## Summary
- **common-sense.md**: Unchanged, no ownership updates needed
- **C1.3 effectively solved**: 94.1% pass rate after write-diff, no longer a crisis
- **C2.3 deprioritized**: Original justification (0/4 compliance) obsolete at 94.1%
- **New highest priority unbuilt**: Guard-Workflow Architecture (Hao directive) — comprehensive RFC exists, Phase 0 ready for implementation
- **Coach**: No new infra-needing flags
