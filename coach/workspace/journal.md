# Journal

## Consolidated Knowledge (as of 2026-03-20T08:09Z, memory consolidation)

### Experiment Summary
- **115+ gym experiments** total (exp-001 through exp-~115)
- **Sprint 1-2** (exp-001–030): Ghost Bug discovery, text methods 0/18
- **Sprint 3** (exp-031–059): Workflow enforcement breakthrough (20/20 → 100%)
- **Sprint 4** (exp-060–085): Ceiling-effect gate, cross-model confirmation (Bob gemini3pro), new scenarios (wrong-directory, misleading-stacktrace, premature-optimization, cascading-error-workflow)
- **Sprint 5** (exp-086–115): Method #9 CLOSED (harmful), Method #10 inconclusive (30% reasoning, 0% behavioral), scorer bugfix (exp-104: 7 false-negative scorers fixed), growth-cycle scenario targeting bug found, convention-verify-multi-edit scenario baselines run
- **20+ methods tested**, 4 closed (text methods), 1 confirmed harmful (#9 Negative Example)
- **Key result**: Workflow enforcement ~30/32 (~98%) across 6+ scenarios, 5 agents, 3 models. Only reliable behavioral fix.

### Current Priorities (as of 2026-03-20)
1. **Gym infra blocker**: bob/coder/optimizer NOT in oneshot runtime → can't gym-test. Escalated to May.
2. **Growth-cycle scenario targeting bug**: Tests wrong scenarios. Escalated to May.
3. **Workflow enforcement production deployment**: Still pending architect coordination.
4. **C3.2 workspace isolation**: Amy and coder both violate. Convention text ambiguous → draft update needed.
5. **Scenario development**: Need more judgment scenarios (premature-optimization, restraint, pushback). Technical scenarios all ceiling.

### Active Agent Issues
- **Amy**: Read-loop attractor ($71/incident). READ DISCIPLINE rule sent to May.
- **Bob**: `agents.call("checkpoint")` attractor. Infra guard built (07b0d7f) but not deployed.
- **Tech-lead**: FM-3.3 (#1 weakness). TSC pipe attractor (C35/C36). Quality review dispatched.
- **Coder**: FM-3.3 (#1 weakness). convention-verify-multi-edit needs targeted fix. Growth-cycle targeting bug blocked exp-099/100.
- **May**: Sycophancy on sycophants-dilemma (4/6 REFUSAL baseline). Method #9 made WORSE (3/6 SYCOPHANCY). Method #10 inconclusive.

### Method Status
| # | Method | Status | Evidence |
|---|--------|--------|----------|
| 1-8 | Text methods (SOUL, LESSONS, heartbeat, knowledge, subtractive, micro-edit, identity-exception, inline) | **CLOSED** | 0/18 total. Safe but ineffective. |
| 9 | Negative Example | **CLOSED (HARMFUL)** | Flips failure mode. Exp-092: REFUSAL→SYCOPHANCY. |
| 10 | Conditional Guard | **INCONCLUSIVE** | 30% reasoning influence, 0% behavioral. Worth preserving for combo experiments. |
| 15 | Workflow Enforcement | **🏆 PROVEN** | ~30/32 (~98%). Cross-model (opus, gemini3pro). 6+ scenarios. 5 agents. |
| 16 | Task Structuring | Partial | ~33% influence. Cheaper than #15 but less reliable. |

### Key Learnings Since Last Consolidation (2026-03-18)
- Scorer bugs produce false negatives — verify scorers early (exp-104 was most valuable Sprint 5 output)
- Growth-cycle scenario targeting is broken (runs default 3 instead of target)
- Scenario difficulty varies by agent — baseline ALL agents before designing experiments
- Cross-model generalization confirmed: Bob (gemini3pro) passes workflow enforcement (exp-073: 7/7 EXCELLENT)
- Judgment scenarios are the only productive training signal; all technical scenarios hit ceiling
- C3.2 workspace isolation convention is ambiguous — agents write outside their workspace for legitimate cross-agent coordination

### Infrastructure Notes
- Gym: `test/gym/run-gym.sh` works for amy/may. bob/coder/optimizer need oneshot registration.
- Lab forks: NEVER change agent.json `name` field (Ghost Bug)
- Archive: Full experiment logs in `workspace/archive/journal-2026-03.md` (1106 lines)
- Experiments JSONL: `workspace/experiments.jsonl`

## 2026-03-20 12:10 — Heartbeat H-noon
- **Error scan**: All ERROR_LOG.jsonl files empty across all agents. System quiet.
- **Workspace cleanup**: Archived 70 stale files (98→29).
- **Workflow blocker**: growth-cycle.ts and training-sprint.ts both fail with `Cannot find module '../../../src/lib/growth.js'`. Cannot run gym experiments until this is fixed.
- **Planned baselines blocked**: exp-119 (judgment-destructive-trap), exp-120 (judgment-conflicting-request), exp-121 (cascading-error) remain unexecuted.
- **Untested methods**: #17 (Verification Gates) still hypothesis. Cannot test without working workflows.
- **Action**: Escalated infra issue to May.

## 2026-03-20 15:12 — Growth Trigger: Optimizer FM-3.3

### Trigger
Cron growth-trigger detected 12+ repeated FM-3.1 errors (which analysis revealed as FM-3.3 verification failures being the dominant pattern at 8 instances in experiments + 11 in ERROR_LOG.jsonl).

### Diagnosis
- Optimizer has **73+ entries** in ERROR_LOG.jsonl, with FM-3.3 (VERIFICATION_FAILURE / VERIFICATION_GAP) being the #1 pattern
- Root cause: generic verification instruction in heartbeat (step 5) — says "verify" but doesn't say WHEN or provide fallback when verification fails
- The .lab/optimizer-fm31-workflow fork already contains the fix (fallback ladder) but was never promoted to production

### Actions Taken
1. **Growth receipt written**: `agents/coach/workspace/growth-receipts/optimizer-fm33-verification-receipt.md`
2. **Patch created**: `agents/coach/workspace/patches/optimizer-fm33-heartbeat-patch.md`
3. **Patch sent to May** for application to `agents/optimizer/heartbeat.md`
4. **Experiment logged**: exp-155 (intervention-deployed, pending-application)

### Blockers
- Gym workflows broken (`Cannot find module '../../../src/lib/growth.js'`) — cannot A/B test
- Optimizer agent_type not registered in gym scenarios — even if workflows worked, can't gym-test

### Expected Outcome
- Text-only intervention: ~10-20% effectiveness based on method catalog evidence
- Real fix would require workflow enforcement (#15, ~98% effective) but optimizer can't be gym-tested yet
- Need: (1) fix workflow infra, (2) register optimizer in gym scenarios

### Follow-up Items
- Monitor optimizer's next 5 sessions for FM-3.3 frequency
- Fix growth.js module path issue blocking gym workflows
- Create optimizer-specific gym scenarios
