# Common Sense Infra Review — 2026-04-09

## Task
Cron: Review agents/shared/common-sense.md for infra-owned items. Identify highest-priority unbuilt mechanism. Check if Coach flagged anything needing infra help.

## Changes Since Last Review (2026-04-08)
- **common-sense.md**: Unchanged (same 10 items under "How We Think")
- No ownership changes needed

## Infra-Owned Items Status

| Item | Status | Mechanism |
|------|--------|-----------|
| C1.7 Success Requires Evidence | ✅ BUILT | finish-guard.ts Gate 2 (FM-3.3) |
| C1.8 Match finish() to reality | ✅ BUILT | finish-guard.ts Gate 0 (ghost deliverables) |
| git add agents/ = NO | ✅ BUILT | .gitignore + pre-commit hook |
| C1.3 Verify every write | ⚠️ REGRESSED | edit() diff preview + finish-guard backstop — but rate dropped to 72.1% |
| C12.1 (session-start orientation) | ❌ REGRESSED | Dropped to 59.4% despite WORKSPACE_PATTERN fix deployed Apr 8 |

## Current Convention Health (last 12h — all recent checks)

| Convention | Pass Rate | N | Δ from Apr 8 | Notes |
|-----------|-----------|---|---------------|-------|
| C12.1 (session-start) | **59.4%** | 4076 | **−37.8pp** | Severe regression |
| C1.3 (verify-writes) | **72.1%** | 4076 | **−22.5pp** | Dropped below 90% trigger |
| C1.1 (read-before-edit) | 80.7% | 4076 | −12.0pp | Down from 92.7% |
| C1.7 (evidence at finish) | 97.6% | 3508 | — | Stable |

### C1.3 by agent (current):
| Agent | Rate | N | Status |
|-------|------|---|--------|
| amy | 0% | 13 | ❌ New agent, no verification |
| optimizer | 56.8% | 572 | ❌ Down from ~93% |
| amy-kimi | 57.8% | 180 | ❌ New, low |
| scout | 63.6% | 280 | ⬇️ Regressed from 81.9% |
| coach | 67.0% | 782 | ⬇️ Regressed from 93.5% |
| bob | 67.8% | 686 | ⬇️ Regressed from 98.7% |
| tech-lead | 70.2% | 369 | ⬇️ Regressed from 95.9% |
| qa | 93.7% | 490 | ✅ Stable |
| may | 93.9% | 554 | ✅ Stable |

**Every agent except qa and may regressed on C1.3.** This is a system-wide collapse, not an individual agent issue.

## Key Findings from Coach Since Yesterday

### 1. FM-3.3 Trend: Guard Has NO Training Effect (NEW)
Coach's `fm33-trend-analysis.md` conclusively shows:
- FM-3.3 rate per session is **increasing** (27% → 58% → 65% → 70% over 5 weeks)
- Guard-catch rate improved (9% → 73%) — the guard works as a safety net
- But agents never learn to verify proactively — each session starts fresh
- **Conclusion: "The guard blocks, the agent recovers, but the next session repeats the exact same pattern"**

### 2. Bob FM-3.3 Concentration is a Measurement Artifact (NEW)
Coach's `bob-fm33-concentration-analysis.md`:
- 17 reported FM-3.3 records = only 9 unique incidents (1.9x duplication from Phase 1/2 sibling eval)
- Bob's true all-time FM-3.3 rate (13.6%) is **lowest** of any high-volume agent
- Evaluator selection bias: Bob has 64 LLM-evaluated sessions/day vs 0-2 for most agents

### 3. C1.5 Ghost Deliverable Regression (NEW)
Coach's `bob-c15-ghost-analysis.md`:
- C1.5 dropped from 100% → 81.8%
- Root cause: ID collisions from concurrent sessions → rename/delete → original deliverable path invalid
- **Infra implication**: Convention checker assumes deliverable paths are stable, but concurrent KB work invalidates them

### 4. Sub-Session Commit Guard Gap (CONFIRMED)
Coach's commit tracker found 1/9 sessions violated commit-before-finish:
- Phase 2 sub-sessions spawned by workflows bypass the commit guard
- Guard only enforces on top-level sessions
- **Infra fix needed**: Apply commit guard to all sessions with writes

### 5. Commit Guard Regression is Measurement Artifact (RESOLVED)
The auto-commit rate jump (17%→47%) was caused by new `chore(auto): commit before sync` infrastructure commits from federation sync. Real rate is 8%→21%.

## Highest Priority Unbuilt Mechanism: C2.3 Auto-Readback — NOW URGENT

### Status Change: Monitor → Build

Yesterday I said "Continue monitoring; build auto-readback if C1.3 drops below 90%." **C1.3 is now at 72.1%.** The trigger has been tripped.

**Combined evidence for action:**
1. C1.3 system-wide at 72.1% (down from 94.6% — 22.5pp drop)
2. Coach's FM-3.3 trend analysis proves guard has zero training effect
3. Coach explicitly concluded: "Needs auto-readback or structural enforcement in the tool layer"
4. All coaching approaches exhausted (EXP-020/055/055b/056 — 0% behavioral fix)
5. V4 brief already written: `agents/bob/workspace/brief-infra-c23-auto-readback-v4.md`

**However**: The 72.1% rate comes from 4076 sessions in 12h, which is much higher volume than previous days (~793 total in 48h). Need to verify whether this is a genuine regression or a measurement expansion (e.g., convention checker now evaluating sessions that weren't checked before). The fact that ALL agents regressed simultaneously suggests a **measurement change**, not a behavioral change.

### Recommendation
1. **Investigate measurement first**: Check if convention-check.ts was modified recently or if evaluation scope expanded. A simultaneous −22pp across ALL agents is more consistent with changed measurement than changed behavior.
2. **If confirmed genuine**: Escalate auto-readback brief to tech-lead as P0. The v4 brief is ready.
3. **If measurement artifact**: Update the trigger threshold against the new baseline and continue monitoring.

## Coach-Flagged Items Needing Infra

| Item | Priority | Status | Brief |
|------|----------|--------|-------|
| C2.3 Auto-readback | **P1→P0** | Brief ready (v4) | `agents/bob/workspace/brief-infra-c23-auto-readback-v4.md` |
| Sub-session commit guard | P2 | No brief yet | Phase 2 sub-sessions bypass guard |
| C1.5 ID collision protection | P2 | No brief yet | Concurrent KB sessions cause ghost deliverables |
| FM-3.3 fabricated evidence | P3 | Monitor | 1/11 errors; cross-reference tool history is complex |

## Ownership Updates
No changes to common-sense.md ownership. All items correctly categorized.

## Summary
- **common-sense.md**: Unchanged, no ownership updates needed
- **System-wide convention regression**: C1.3 72.1% (−22.5pp), C12.1 59.4% (−37.8pp), C1.1 80.7% (−12pp). Only qa and may stable.
- **Caveat**: 4076 sessions in 12h (vs ~793/48h previously) suggests measurement scope changed — verify before acting
- **Coach proved guard has no training effect**: FM-3.3 rate increasing despite guard (70% of sessions)
- **Highest priority unbuilt**: C2.3 auto-readback — trigger tripped (C1.3 < 90%). V4 brief ready. Pending measurement verification.
- **New infra gaps**: Sub-session commit guard, C1.5 ID collision protection
