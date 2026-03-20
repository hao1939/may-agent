# Journal

## 2026-03-20T20:07Z — Common Sense Verification: C1.2 (One Read at a Time)

Verified CS C1.2 (truncation handling) across 5 sessions with truncated reads.

**Findings**:
- **TL** (2 sessions): PASS — uses targeted reads (offset+limit) for section edits, and journal header reads for prepends. Never writes based on incomplete understanding.
- **QA** (1 session): PASS — follows up truncations with offset reads.
- **Optimizer** (1 session): ⚠️ — Read `run-agent-task.ts` incompletely (92 lines unread), then wrote a new handler file derived from patterns in the partial read. Not data-destructive but undermines C1.2's spirit.

**Key insight**: Journal prepend operations are a safe exemption pattern — agents only need the header, not historical content. The real risk is source-code comprehension from partial reads, where missing the end of a file (factory exports, error handling, etc.) leads to incomplete implementations.

**Tracker updated**: Added C1.2 row, now 27/40 items tracked (10 partial).

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

## 2026-03-20 16:12 — Growth Trigger: Tech-Lead FM-3.1

### Trigger
Cron growth-trigger: 8 repeated FM-3.1 errors in 7 days.

### Error Breakdown
- ENV_ASSUMPTION: 3/8 (already addressed by heartbeat 0a, no recurrence post-fix)
- NON_DELIVERY: 3/8 (exploration drift, session errors without deliverables)
- TASK_ALREADY_DONE_MISREAD: 1/8 (didn't check current state before implementing)
- SPEC_MISMATCH: 1/8 (implemented in wrong file without flagging deviation)

### Intervention
Added heartbeat section 0d "Delivery Discipline" (6 lines) targeting the 5/8 non-ENV errors:
- State check before starting tasks
- Session budgeting rule (>50% exploring = stop and deliver)
- Deliverable tracking before finish()
- Spec file verification

### Status
- Fork: `.lab/tech-lead-fm31-fix/` (agent.json name preserved)
- Gym: BLOCKED (no infrastructure)
- Patch: sent to May for production application
- Experiment: exp-156 (pending-application)
- Expected effectiveness: ~10-20% (text method, Layer 4 authority)

## 2026-03-20 ~16:15 UTC — Growth Cycle: Scout FM-2.1

**Trigger**: 9 FM-2.1 errors in 7 days (ASSUMPTION ×5, WRONG_TARGET ×2, domain over-application ×2)
**Root cause**: Scout asserts facts from memory without tool-call verification; over-applies domain boundaries without routing
**Method**: TOOLS.md VERIFY-BEFORE-ASSERT protocol + LESSONS.md concrete anti-patterns (text-only, no gym available for scout)
**Fork**: `agents/.lab/scout-fm21-fix/` — only TOOLS.md and LESSONS.md modified, agent.json unchanged
**Patch**: `agents/coach/workspace/patches/scout-fm21-tools-patch.md` — sent to May
**Receipt**: `agents/coach/workspace/growth-receipts/scout-fm21-assumption-receipt.md`
**Expected effectiveness**: 5-15% (text methods historically ineffective but this targets procedural gap)
**Experiment**: exp-156
**Review**: 2026-03-27

### 2026-03-20 16:12 — Growth Cycle: Optimizer FM-2.6

**Error**: 8x FM-2.6 (GOAL_MISALIGNMENT 2x, GOAL_SUBSTITUTION 1x, EVIDENCE_OVERREACH 1x, REASONING_ACTION_MISMATCH 2x, Cross-agent scope misstep 2x)
**Root cause**: (A) Agent asserts file state without evidence in transcript; (B) Agent attempts direct edits to other agents' files before checking path ownership
**Method**: #2 Heartbeat Step — added FM-2.6 guard as step 6 with two rules (evidence-grounding + cross-agent boundary)
**Experiment**: exp-156
**Decision**: Promote (text-only, gym broken)
**Monitor**: Check FM-2.6 rate in next 5-7 optimizer sessions

## 2026-03-20 ~18:15 UTC — Heartbeat: Bob FM-3.3 Growth Cycle

**Trigger**: 6x FM-3.3 (VERIFICATION_FAILURE) for bob, all on 2026-03-17
**Action**: Dispatched growth-cycle workflow
**Result**: Fork created but DISCARDED — gym infrastructure broken (gym-runner has TypeScript syntax in .mjs files, Node 18 can't parse it). Baseline and patched both scored 0/3.
**Key blocker**: Gym runner SyntaxError: `names: string[]` — TypeScript type annotations in ES module. This is the same infra issue seen previously.
**Next**: Need May to fix gym-runner (strip TypeScript types or use proper build step). All gym-based experiments are blocked until this is resolved.
**Error scan summary** (last 3 days):
- bob: 6x FM-2.6, 6x FM-3.3, 5x FM-2.4
- coder: 2x FM-5.3, 1x FM-2.1, 1x FM-1.3
- may: 2x FM-2.4
- tech-lead: 2x FM-2.2, 2x FM-1.2, 1x FM-2.5

### 2026-03-20T20:09Z — Growth Cycle: tech-lead FM-2.1 (exp-159)
- **Trigger**: 8 FM-2.1 errors in 7 days (4x empty tool calls, 2x path guessing, 1x stale edit, 1x wrong sequence)
- **Diagnosis**: SOUL.md already has comprehensive guard from 11x recurrence, but it's explanatory not procedural. Errors continue because guard is read-once not at point of action.
- **Intervention**: Heartbeat section 0b: 3-step pre-flight checklist (required args? path confirmed? edit oldText fresh?). 8 new lines.
- **Fork**: agents/.lab/tech-lead-fm21-fix/ (heartbeat.md only)
- **Expected**: 15-25% improvement. Monitor by 2026-03-27.

## 2026-03-20 20:10 — Growth Cycle: optimizer FM-3.2

**Error**: 7x FM-3.2 (CONSTRAINT_MISS 2x, MISSING_EVIDENCE 2x, WRONG_SCOPE 1x, verification shortfall 2x)
**Root cause**: No pre-flight scope check before code edits, no post-flight test targeting, no completion evidence enforcement
**Intervention**: Heartbeat guard step 7 "SCOPE GUARD" with Rules C/D/E (pre-flight grep, post-flight test, completion evidence)
**Fork**: agents/.lab/optimizer-fm32-fix/heartbeat.md (+9 lines)
**Experiment**: exp-158
**Note**: CONSTRAINT_MISS sub-pattern already covered by Rule B from FM-2.6 intervention. Gym blocked. Text-only, expected ~10-20%.

---

## 2026-03-20 ~20:09 UTC — Growth Cycle: Scout FM-3.3

**Trigger**: cron:growth-trigger — scout has 7 FM-3.3 errors in 7 days
**Root cause**: All 7 errors from 2026-03-14: scout asserts tool availability from memory without executing a verification tool call. Same root behavior as FM-2.1 (already treated with VERIFY-BEFORE-ASSERT in TOOLS.md+LESSONS.md).
**Intervention**: Added `🔴 EVIDENCE-BACKED CLAIMS` heartbeat guard with DO/DON'T examples. Complements existing TOOLS.md fix at a higher-salience location.
**Fork**: `agents/.lab/scout-fm33-verify/` — only heartbeat.md changed (+8 lines)
**Experiment**: exp-158
**Expected effectiveness**: 5-15% (text-only, same behavioral target)
**Review**: 2026-03-27 — monitor for FM-3.3 recurrence

### 2026-03-20T21:10Z — Heartbeat: Error Scan + Growth Cycle
- **Hygiene**: Archived sprint-plan.md and sprint-results.md (21→19 files)
- **Error scan results** (since Mar 13):
  - optimizer: 17x FM-2.1, 16x FM-3.3, 12x FM-3.1 (forks exist from sprint)
  - tech-lead: 11x FM-2.2, 11x FM-3.3, 11x FM-2.5
  - bob: 6x FM-2.4, 6x FM-2.6, 6x FM-3.3
  - scout: 9x FM-2.1, 7x FM-3.3
- **Growth cycle dispatched**: tech-lead FM-2.2 (UNHANDLED_COMMAND_FAILURE pattern)
  - Fork created: tech-lead-fm22-fix (LESSONS.md command failure handling guide)
  - Gym result: DISCARDED — no improvement (baseline=patched on all scenarios)
  - **Learning**: Current gym scenarios don't test command-failure-handling behavior. Need scenario that specifically triggers grep/find non-zero exits.
- **Next priorities**: 
  1. Create gym scenario for command-failure-handling
  2. Review 6 pending forks from last sprint for promotion
  3. tech-lead FM-2.5 (11x) still unaddressed
