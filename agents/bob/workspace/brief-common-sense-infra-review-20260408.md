# Common Sense Infra Review — 2026-04-08

## Task
Cron: Review agents/shared/common-sense.md for infra-owned items. Identify highest-priority unbuilt mechanism. Check if Coach flagged anything needing infra help.

## Changes Since Last Review (2026-04-07)
- **common-sense.md**: Unchanged (same 10 items under "How We Think")
- **C12.1 fix deployed**: Coach's intervention-c121-bob-v2.md Part 1 was implemented — `WORKSPACE_PATTERN` in convention-check.ts now accepts `agents/shared/` reads as valid orientation (line 811). This was the C12.1 false-positive that was hitting all Bob dispatched work sessions.
- No ownership changes needed

## Infra-Owned Items Status

| Item | Status | Mechanism |
|------|--------|-----------|
| C1.7 Success Requires Evidence | ✅ BUILT | finish-guard.ts Gate 2 (FM-3.3) |
| C1.8 Match finish() to reality | ✅ BUILT | finish-guard.ts Gate 0 (ghost deliverables) |
| git add agents/ = NO | ✅ BUILT | .gitignore + pre-commit hook (100% catch rate) |
| C1.3 Verify every write | ⚠️ EVOLVING | edit() returns diff preview; write() returns 30-line preview; finish-guard backstop |
| C12.1 (session-start orientation) | ✅ FIXED | WORKSPACE_PATTERN widened to accept agents/shared/ (deployed Apr 8) |

## Current System-Wide Convention Health (last 48h)

| Convention | Pass Rate | N | Δ from Apr 7 | Notes |
|-----------|-----------|---|---------------|-------|
| C1.1 (read-before-edit) | **92.7%** | 793 | +6.9pp | Biggest improvement — was worst at 85.8% |
| C1.3 (verify-writes) | 94.6% | 793 | +2.9pp | Steady climb |
| C6.1 | 96.1% | 793 | +2.0pp | |
| C12.1 (session-start) | 97.2% | 793 | -0.6pp | Stable (the fix just landed) |
| All others | >97.9% | — | — | Stable |

**C1.3 by agent (last 48h)**:
| Agent | Rate | N | Δ from Apr 7 | Status |
|-------|------|---|---------------|--------|
| scout | 81.9% | 83 | +14.1pp | ⬆️ Recovered significantly (was 67.8%) |
| optimizer | 92.6% | 95 | — | Stable |
| coach | 93.5% | 169 | +2.5pp | OK |
| tech-lead | 95.9% | 98 | +8.2pp | ✅ Solidly recovered |
| bob | 98.7% | 156 | — | ✅ Strong |
| qa | 98.8% | 83 | — | ✅ Strong |

**C1.1 by agent (last 48h)**:
| Agent | Rate | N | Δ from Apr 7 | Status |
|-------|------|---|---------------|--------|
| coach | 84.6% | 169 | — | ⚠️ Now worst agent (was scout) |
| scout | 90.4% | 83 | +27.7pp | ⬆️ Huge recovery (was 62.7%) |
| bob | 91.7% | 156 | — | OK |
| tech-lead | 93.9% | 98 | +18.5pp | ✅ Recovered (was 75.4%) |

## Highest Priority Unbuilt Mechanism: C2.3 Auto-Readback

Coach's todo item #4 remains: **"C2.3 framework-level enforcement — All text/skill/gate approaches exhausted (EXP-020/055/055b/056). Needs auto-readback or similar structural fix."**

This is the same item from yesterday's review (the "write() lazy verification gate"). The evidence chain is now very strong:

| Approach | Experiment | Result | Why it failed |
|----------|-----------|--------|---------------|
| Text rules | KE-002 | 0/18+ | Declarative text injection = 0% effect on behavior |
| Skills | EXP-020 | ~0% | Injected knowledge not applied (KE-058) |
| Skills (few-shot) | EXP-056 | ~33% | Some effect but not sufficient |
| Verification gate | EXP-055 | 100% C2.3 but product regression | Gate overhead causes timeout failures |
| Gate + longer timeout | EXP-055b | Still product regression | Gate-driven, not budget-driven |
| **Auto-readback** | Not built | — | **Only remaining option** |

**The mechanism**: After every `write()` call to a non-exempt file, automatically inject a `read()` of the written file. This makes verification the default rather than requiring agents to remember it. It differs from the EXP-055 gate (which forced a full verification workflow) by being lightweight — just a read-back, no decision gate.

**Why it's not urgent today**: All conventions are trending UP. Scout C1.3 recovered from 67.8% → 81.9%. The overall C1.3 rate is 94.6%. Coach has exhausted coaching approaches and explicitly recommends an infra solution, but the problem isn't getting worse — it's getting better through natural variance and the coaching interventions that DO work (like few-shot matched examples).

**Decision**: Continue monitoring. If C1.3 drops below 90% system-wide again, design the auto-readback mechanism. Current trajectory makes this increasingly unlikely.

## Coach-Flagged Items Needing Infra

### 1. C12.1 False Positive (RESOLVED)
Coach identified the checker bug in intervention-c121-bob-v2.md. Part 1 (code fix) has been deployed — `WORKSPACE_PATTERN` now accepts `agents/shared/` reads. Part 2 (Bob context_files in dispatch) is a behavioral improvement, not an infra item.

### 2. C2.3 Auto-Readback (described above)
Coach explicitly concluded: "Needs auto-readback or similar structural fix." This is the only unresolved Coach → infra escalation.

### 3. Bob FM-3.3 Fabrication (NEW — Monitor Only)
Coach's `brief-bob-fm33-analysis.md` identified a new variant: Bob fabricated verification_evidence (Entry 4, referencing steps not in transcript). Coach classified this as a ceiling effect (KE-010 — gym can't teach it, model capability issue). The existing finish-guard catches the simpler P1 pattern (missing evidence), but fabricated evidence that sounds plausible can slip through.

**Infra assessment**: Detecting fabricated verification_evidence would require cross-referencing the evidence text against actual tool call history. This is technically feasible (the session transcript contains all tool calls) but complex to build and fragile (natural language matching). **Not worth building now** — incidence is 1/11 FM-3.3 errors, which is ~1 per week. Monitor for increased frequency.

### 4. Gym Graduation (STRATEGIC)
Coach has 25/26 scenarios at ceiling and proposes graduating the gym. This would be a significant infra change (decommission or freeze the gym infrastructure). **Not an infra priority** — Coach should send a formal proposal to May for system-level changes.

## Ownership Updates
No changes to common-sense.md ownership. All items correctly categorized.

## Summary
- **common-sense.md**: Unchanged, no ownership updates needed
- **All conventions trending up**: C1.1 +6.9pp (92.7%), C1.3 +2.9pp (94.6%). Scout recovered dramatically on both.
- **C12.1 false positive fixed**: Coach's intervention was deployed (convention-check.ts WORKSPACE_PATTERN widened)
- **Highest priority unbuilt**: C2.3 auto-readback (write() lazy verification). Coach exhausted all coaching approaches. But convention health is improving, so not urgent.
- **No new infra action needed today**. Continue monitoring; build auto-readback if C1.3 drops below 90% again.
