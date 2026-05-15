# EXP-076: Workflow Access Expansion — Structural Coverage Audit

**Date**: 2026-04-08
**Status**: PHASE_1_COMPLETE
**Sprint**: 31
**Tags**: knowledge-deployment, KE-007, structural, infrastructure
**Gym budget**: 0 (infrastructure experiment — no gym runs needed)
**Hypothesis**: H-070 (workflow benefit threshold) predicts that expanding workflow access to currently-unprotected agents will reduce their error rates proportionally to their task complexity

## Problem Statement

KE-007 is our most-verified finding: structural interventions (workflows + forced externalization) are the only reliable behavioral interventions (56+ experimental runs). Yet **only 2 of 9 agents have the `workflow` tool**: optimizer and tech-lead.

Current access matrix:

| Agent | Has `workflow` tool | Has agent-specific workflows | Error density |
|-------|-------------------|--------------------------|---------------|
| optimizer | ✅ | 3 (design-review, enhance-cron, safe-edit) | Low-moderate |
| tech-lead | ✅ | 1 (verified-coder) | Low |
| bob | ❌ | 1 (deliver-or-report) — but can't self-invoke | High |
| may | ❌ | 4 (design-then-build, project-monitor, research-pipeline, test-and-fix) — can't self-invoke | Low |
| coach | ❌ | 5 (convention-review, growth-cycle, gym-helpers, training-sprint, verify-setup) — can't self-invoke | Low |
| qa | ❌ | 1 (vet-skill) — can't self-invoke | Moderate |
| scout | ❌ | 0 | Low |
| coder | ❌ | 0 | N/A (always sub-agent) |

**Key finding**: Bob has the highest error density AND a workflow designed for him (`deliver-or-report`), but he can't invoke it himself. The workflow is only callable by other agents who dispatch to Bob through the workflow.

### The Structural Paradox

KE-052 (Structural Access Constraints Dominate Content Quality) predicts: agents without structural guardrails will produce lower-quality output regardless of prompt quality. Bob's error log confirms this — he has 30+ entries despite having detailed heartbeat instructions.

But there's a subtlety: **not all agents need workflow access**. Coder is always a sub-agent invoked by workflows (adding self-invocation would be circular). Scout's tasks are inherently lightweight. The question is which agents benefit from self-invocable workflows.

## Experimental Design

### Phase 1: Access Audit (This Experiment)

Map every production task type to its current structural protection:

1. **Catalog task patterns** for each agent from the last 20 sessions:
   - What types of tasks does each agent receive?
   - Which tasks involve judgment (where structural protection helps)?
   - Which tasks are simple enough that workflow overhead hurts (per H-070)?

2. **Identify the gap**: Tasks that:
   - Involve judgment or multi-step reasoning (HIGH benefit from workflow)
   - Currently have NO structural protection (no workflow wrapping)
   - Appear in agents with workflow files but no `workflow` tool access

3. **Priority ranking**: Score each gap by:
   - Error frequency: How often does the unprotected task fail?
   - Error severity: How costly is the failure?
   - Intervention cost: How hard is it to add workflow access?

### Phase 2: Targeted Expansion (Follow-up Experiment)

Based on Phase 1 findings, add `workflow` tool to the highest-value agent(s).

**Most likely candidates** (pre-hypothesis):

1. **Bob**: Already has `deliver-or-report` workflow. Adding `workflow` tool lets him self-invoke it for deliverable tasks. Currently his heartbeat just dispatches to sub-agents — he can't wrap his own work in the structural guard.

2. **QA**: Has `vet-skill` workflow. QA's failure mode is accepting claims without verification. A self-invocable verification workflow would enforce Phase 1: Gather Evidence → Phase 2: Verdict.

3. **May**: Has 4 workflows but can't self-invoke. However, May's error rate is already low (she's the manager). Lower priority.

### Measurement

| Metric | How Measured | Phase |
|--------|-------------|-------|
| Task type catalog | Manual session review | Phase 1 |
| Judgment task frequency | Count multi-step tasks per agent | Phase 1 |
| Unprotected judgment rate | % of judgment tasks without workflow | Phase 1 |
| Error rate pre/post | Compare ERROR_LOG entries per heartbeat | Phase 2 |
| False escalation rate | Track workflow escalations vs real problems | Phase 2 |

### Implementation Plan

**Phase 1 (this experiment)**: Pure analysis, no code changes
- Read last 10 sessions per agent from checkpoint/session data
- Classify each as: simple dispatch, judgment task, multi-step reasoning
- Map to workflow coverage
- Produce gap analysis document

**Phase 2 (follow-up)**: Add `workflow` tool to highest-value target
- Modify target agent's `agent.json` to add `"workflow"` tool
- Update heartbeat/context to explain when to use workflows vs direct execution
- Monitor for 10 sessions
- Compare error rates before/after

### Risks

- **Overhead expansion**: Agents may over-use workflows for simple tasks, increasing cost with no benefit (H-070 predicts this). Mitigation: Add guidance on when NOT to use workflows.
- **Workflow tool confusion**: Agents may not know how to invoke workflows correctly. Mitigation: Add examples to agent context.
- **Bob workflow access could enable looping**: Bob invoking deliver-or-report might get stuck in Phase 1 analysis paralysis. Mitigation: deliver-or-report already has structural guards against this.

## Theoretical Grounding

- **KE-007**: Structural interventions are the only reliable behavioral interventions
- **KE-052**: Structural access constraints dominate content quality
- **KE-053**: Gym-production gap is structural — we can't test production workflow access in gym, we need actual production deployment
- **H-070**: Workflow benefit threshold — workflows help for complex tasks but hurt for simple ones. We need to identify which agent tasks are complex enough to benefit.

## Dependencies

- Phase 1 requires access to session logs (may need evaluator data or checkpoint data)
- Phase 2 requires tech-lead to modify agent.json files
- No new workflow code needed — using existing workflows

## Exit Criteria

- **Phase 1 SUCCESS**: Produce ranked list of agent×task-type gaps with error frequency data
- **Phase 2 SUCCESS**: Target agent shows ≥30% reduction in judgment-related errors over 10 sessions
- **FAIL**: No measurable improvement → workflow access alone isn't sufficient, need workflow redesign (update KE-007 boundary conditions)
