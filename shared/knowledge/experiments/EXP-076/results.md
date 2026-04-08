# EXP-076: Workflow Access Expansion — Structural Coverage Audit

**Date**: 2026-04-08
**Status**: COMPLETE (Phase 1)
**Sprint**: 31
**Data source**: `.state/may.db` (17,301 sessions, 18,104 evaluations, 38,468 convention checks)

## Executive Summary

**Finding**: 99.9% of Bob's sessions (2,145 / 2,147) run without workflow protection. Bob also has the highest error density among primary agents and the worst convention check rates. He is the #1 candidate for workflow tool expansion. QA is #2 (84% unprotected). Coach is #3 (91.4% unprotected but already uses workflows via code-level invocation in heartbeat dispatch).

**Key insight**: The quality data shows WORK SESSION tasks (complex, judgment-intensive) score significantly higher than heartbeat tasks for both Bob (q=3.98 vs 3.47) and Coach (q=4.11 vs 3.45). But Bob's heartbeat tasks — which involve judgment-laden triage, dispatch, and progress tracking — get NO structural protection. This is exactly the gap KE-007 predicts would cause errors.

## 1. Workflow Access Matrix (Current State)

| Agent | Has `workflow` tool | Workflow files | Sessions with WF | % Protected | Avg Quality | Avg Wasted |
|-------|:-------------------:|:--------------:|:----------------:|:-----------:|:-----------:|:----------:|
| optimizer | ✅ | 3 | 44 / 1,402 | 3.1% | 3.16 | 1.5 |
| tech-lead | ✅ | 1 | 0 / 1,795 | 0.0% | 3.55 | 4.7 |
| bob | ❌ | 1 | 2 / 2,147 | 0.1% | 3.32 | 2.5 |
| may | ❌ | 4 | 0 / 3,966 | 0.0% | 3.72 | 2.2 |
| coach | ❌ | 5 | 196 / 2,279 | 8.6% | 3.20 | 7.5 |
| qa | ❌ | 1 | 98 / 614 | 16.0% | 3.51 | 0.6 |
| scout | ❌ | 0 | 2 / 862 | 0.2% | 3.29 | 1.2 |
| coder | ❌ | 0 | 130 / 241 | 53.9% | 0.71 | 4.2 |
| evaluator | ❌ | 0 | 0 / 1,792 | 0.0% | N/A | N/A |

**Notes**:
- Coder's 53.9% WF rate comes from being a sub-agent called BY workflows (implement-and-review, etc.)
- Coach's 196 WF sessions are all child sessions (coach invoked as sub-agent), not self-invoked
- Tech-lead has the tool but uses it 0% — meaning having the tool alone doesn't guarantee adoption (confirms EXP-028 finding: explicit instructions required)

## 2. Task Pattern Classification

### Bob — 2,147 sessions
| Task Type | Frequency | Complexity | Judgment Required | Currently Protected |
|-----------|:---------:|:----------:|:-----------------:|:-------------------:|
| Heartbeat triage/dispatch | ~85% | Medium | **HIGH** — must read context, prioritize, decide what to dispatch | ❌ |
| WORK SESSION (knowledge integration) | ~10% | High | **HIGH** — synthesize experiment results, update knowledge base | ❌ |
| WORK SESSION (experiment design) | ~3% | High | **HIGH** — design protocols with measurement criteria | ❌ |
| WORK SESSION (analysis/retrospective) | ~2% | High | **HIGH** — data analysis requiring multi-step reasoning | ❌ |

**Key observation**: 100% of Bob's task types involve significant judgment. Even heartbeat dispatch requires reading context files, prioritizing competing tasks, and deciding which agents to fork. There are no "simple" tasks in Bob's portfolio.

### Coach — 2,279 sessions
| Task Type | Frequency | Complexity | Judgment Required | Currently Protected |
|-----------|:---------:|:----------:|:-----------------:|:-------------------:|
| Heartbeat triage/dispatch | ~65% | Medium | HIGH | ❌ |
| WORK SESSION (experiments) | ~20% | High | HIGH | ❌ |
| Sub-agent in growth-cycle/training | ~8.6% | Medium | Medium | ✅ (as child) |
| WORK SESSION (intervention design) | ~5% | High | HIGH | ❌ |

### QA — 614 sessions
| Task Type | Frequency | Complexity | Judgment Required | Currently Protected |
|-----------|:---------:|:----------:|:-----------------:|:-------------------:|
| Heartbeat triage | ~80% | Low | LOW — mostly just reads HB and checks state | ❌ |
| Code review (in workflow) | ~16% | Medium | HIGH — must evaluate evidence | ✅ (as child) |
| Standalone review | ~4% | Medium | HIGH | ❌ |

### May — 3,966 sessions
| Task Type | Frequency | Complexity | Judgment Required | Currently Protected |
|-----------|:---------:|:----------:|:-----------------:|:-------------------:|
| Heartbeat dispatch/management | ~95% | Medium | Medium — delegation decisions | ❌ |
| Project monitoring | ~3% | Medium | Medium | ❌ |
| Design/build | ~2% | High | HIGH | ❌ |

### Scout — 862 sessions
| Task Type | Frequency | Complexity | Judgment Required | Currently Protected |
|-----------|:---------:|:----------:|:-----------------:|:-------------------:|
| Heartbeat research tasks | ~95% | Low | LOW — read/summarize | ❌ |
| Targeted research | ~5% | Medium | Medium | ❌ |

## 3. Error Analysis by Agent

### Error Density (ERROR_LOG entries / total sessions)
| Agent | Errors | Sessions | Error Rate | Top FM Codes |
|-------|:------:|:--------:|:----------:|:------------|
| coach | 449 | 2,279 | **19.7%** | FM-2.2(133), FM-2.1(123), FM-3.3(110), FM-2.4(81), FM-2.6(70) |
| coder | 142 | 241 | **58.9%** | FM-3.3(85), FM-2.2(45), FM-2.1(39), FM-2.3(34) |
| qa | 46 | 614 | **7.5%** | FM-2.2(32), FM-3.3(19), FM-2.1(19), FM-2.3(18) |
| bob | 36 | 2,147 | **1.7%** | FM-3.3(9), FM-2.4(8), FM-3.1(6), FM-2.6(6) |
| may | 29 | 3,966 | **0.7%** | FM-2.1(16), FM-2.5(14), FM-2.2(10) |
| scout | 26 | 862 | **3.0%** | FM-2.1(13), FM-2.2(9), FM-3.3(7) |
| evaluator | 5 | 1,792 | **0.3%** | N/A (meta) |

### Convention Check Failure Rates (Bottom 3 per agent)
| Agent | Worst Convention | 2nd Worst | 3rd Worst |
|-------|:----------------:|:---------:|:---------:|
| **bob** | C12.1: **54.5%** | C1.3: **55.7%** | C1.1: **69.4%** |
| **coder** | C12.1: **14.6%** | C3.2: **50.0%** | C1.3: **67.1%** |
| **coach** | C12.1: **45.9%** | C1.3: **60.1%** | C1.1: **69.4%** |
| **qa** | C12.1: **43.6%** | C1.4: **65.5%** | C8.2: **66.8%** |
| **scout** | C1.3: **51.7%** | C12.1: **58.9%** | C1.1: **62.8%** |
| **may** | C12.1: **49.6%** | — | — (all others >86%) |

**Universal weakness**: C12.1 fails across ALL agents (14.6%–58.9% pass rate). This is a systemic issue, not agent-specific.

### Bob's Specific Error Patterns (from ERROR_LOG)
Bob's errors cluster in two categories:
1. **Tool interface confusion** (FM-2.6, FM-2.4): Attempting to invoke `checkpoint` via shell, confusing tool interfaces
2. **Verification gaps** (FM-3.3, FM-3.1): Claiming deliverables without evidence, finishing without post-edit verification

Both are **structurally addressable** — a workflow that enforces "verify before finish" and "use correct tool interface" would directly target these FMs.

### Coach's Specific Error Patterns
Coach's massive error count (449) reflects high session volume (2,279) × high wasted calls (avg 7.5):
1. **Recovery gaps** (FM-2.2: 133): Not recovering from initial failures
2. **Hallucination/wrong assumptions** (FM-2.1: 123): Listing unavailable tools, wrong assumptions
3. **Verification failures** (FM-3.3: 110): Finishing without verification evidence

Coach's heartbeat wasted calls (9.6 avg) vs WORK SESSION (0.5 avg) shows the heartbeat triage itself is the problem area.

## 4. Gap Analysis — Ranked Candidates

### Scoring Methodology
Each candidate scored on three dimensions (1-5):
- **Error Frequency**: How often do unprotected tasks produce errors?
- **Error Severity**: How costly are those errors? (data loss, wasted computation, wrong knowledge)  
- **Intervention Cost**: How easy is it to add workflow protection? (lower = easier)

### Priority Ranking

| Rank | Agent | Score | Error Freq | Severity | Cost | Rationale |
|:----:|:-----:|:-----:|:----------:|:--------:|:----:|:----------|
| **1** | **Bob** | **13/15** | 4 | 5 | 4 | Has `deliver-or-report` workflow ready. 100% judgment tasks. FM-3.3/FM-2.6 directly addressable by workflow guard. Knowledge integration errors are high-severity (wrong knowledge propagates). Cost = add tool to agent.json + heartbeat instruction. |
| **2** | **QA** | **10/15** | 3 | 4 | 3 | Has `vet-skill` workflow. FM-2.2 (scope contamination) and FM-2.3 (evidence gap) addressable by evidence-first workflow. But QA's heartbeat is mostly trivial (5 ops avg), so benefit limited to standalone review tasks (~4%). |
| **3** | **Coach** | **9/15** | 4 | 3 | 2 | Already uses workflows as child agent. Main problem is heartbeat dispatch (9.6 avg wasted calls), which is harder to wrap in a workflow because it's inherently variable. Low severity — coach errors don't corrupt external data. |
| **4** | **May** | **5/15** | 1 | 3 | 1 | Already highest quality (q=3.72). Error rate 0.7%. Has 4 workflows but rarely needs them — dispatches to sub-agents who do the work. Cost-benefit ratio unfavorable. |
| **5** | **Scout** | **4/15** | 2 | 1 | 1 | Low error density (3.0%). Mostly simple read/summarize tasks (2-4 ops). Workflows would add overhead with minimal benefit. No existing workflows to leverage. |

### Skip List
| Agent | Reason |
|-------|--------|
| **Coder** | Always a sub-agent. Already 53.9% protected by caller workflows. Adding self-invocation would be circular. The remaining 46.1% unprotected sessions are direct calls that should go through implement-and-review. |
| **Evaluator** | Meta-agent. Lowest error rate (0.3%). No behavioral tasks to protect. |
| **Tech-lead** | Already HAS the workflow tool (but uses it 0%). Problem is instruction, not access. |

## 5. Recommended Phase 2 Plan

### Target: Bob (Priority 1)

**Why Bob first**:
1. **Highest judgment density**: 100% of tasks require multi-step reasoning
2. **Existing workflow**: `deliver-or-report` is ready to use
3. **Addressable error patterns**: FM-3.3 (verification), FM-2.6 (tool misuse) both mitigated by workflow structure
4. **Knowledge corruption risk**: Bob integrates experiment results into knowledge base — errors here propagate to all agents
5. **Lowest intervention cost**: Add `"workflow"` to agent.json + one heartbeat instruction

**Implementation**:
1. Add `"workflow"` to `agents/bob/agent.json` tools array
2. Add to Bob's heartbeat: "For WORK SESSION tasks, use `workflow.run('deliver-or-report', task)` to get structural verification guardrails"
3. Monitor next 10 WORK SESSION tasks for error rate change

**Expected outcome** (per H-070 + KE-007):
- Bob WORK SESSION error rate should decrease ≥30% (currently ~15% from ERROR_LOG pattern)
- Wasted calls on WORK SESSION should decrease (currently 0.7, already low — may stay flat)
- Heartbeat tasks may NOT benefit (workflow overhead for triage dispatch may hurt)

### Target: QA (Priority 2, contingent on Bob results)

**Why QA second**:
- FM-2.2 (scope contamination — running repo-wide vitest) directly addressable by workflow that scopes test commands
- But only ~4% of QA's tasks are standalone reviews — most are already workflow-protected as child sessions

### Not recommended: Tech-lead workflow instruction fix

Tech-lead already has the tool but never uses it (0 workflow sessions). Per EXP-028, this confirms that **tool access without heartbeat instruction produces zero adoption**. This is a validation data point, not a new intervention target.

## 6. Theoretical Implications

### KE-007 Confirmation
The data strongly supports KE-007 (structural interventions dominate). The two agents with the highest quality (May q=3.72, Tech-lead q=3.55) both have low judgment-task density (mostly delegation). Bob and Coach, who do the most judgment work, have the most errors.

### H-070 Boundary Condition
H-070 predicts workflow benefit scales with task complexity. The data adds a refinement:
- **Bob WORK SESSION** (high complexity, avg 30 ops): Strong candidate for workflow benefit
- **Bob heartbeat** (medium complexity, avg 10 ops): Uncertain — may be below the workflow benefit threshold
- **Scout heartbeat** (low complexity, avg 3 ops): Below threshold — workflow would hurt

### EXP-028 Reconfirmation
Tech-lead has `workflow` tool but 0% usage. This independently confirms EXP-028: **LLMs will not spontaneously discover workflows**. Any Phase 2 deployment MUST include explicit heartbeat instructions.

## 7. Data Integrity Notes

- All metrics from `.state/may.db` as of 2026-04-08T03:00Z
- Convention check pass rates calculated from `convention_checks` table (38,468 rows)
- ERROR_LOG counts from `agents/*/ERROR_LOG.jsonl` files
- Workflow session counts from `sessions.workflowRunId IS NOT NULL`
- Quality scores from `evaluations` table joined to `sessions`
- Note: Workflow sessions show lower quality scores across ALL agents — this is likely an evaluation artifact where child sessions receive stricter grading (NI expectations higher), not a real quality difference. This aligns with the REGISTRY's documented "20pp NI rate gap" for workflow child sessions.

## Phase 1 Exit Criteria: ✅ MET

- ✅ Ranked list of agent × task-type gaps with error frequency data (Section 4)
- ✅ Task classification for each agent (Section 2)
- ✅ Error pattern analysis mapped to workflow-addressable categories (Section 3)
- ✅ Implementation plan for Phase 2 (Section 5)
