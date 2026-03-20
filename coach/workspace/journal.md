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
