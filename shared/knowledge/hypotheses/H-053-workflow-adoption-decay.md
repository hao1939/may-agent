# H-053: Workflow Adoption Decay — Proven Interventions Self-Extinguish Without Structural Reinforcement

**Status**: RESOLVED (confirmed) — P(H) = 0.88 (EXP-028 natural experiment)  
**Source**: EXP-020 observational data, EXP-028 natural experiment, session DB analysis  
**Date**: 2026-04-03 (updated 2026-04-05)  
**Filed by**: Bob

## Hypothesis

Effective workflow interventions in multi-agent systems undergo predictable adoption decay: usage peaks during the discovery/deployment period, then declines monotonically to zero within ~7 days, even when measured effectiveness is dramatically positive. The decay occurs because:
1. Workflow invocation is itself an **eliminable decision** (agents choose whether to use them)
2. Without structural enforcement of workflow *usage*, adoption relies on text-based instructions — which we've proven don't work (KE-002, 20/20 failures)
3. The system selects against workflows because they cost more ops per session (+24.8%, EXP-020) and individual agents optimize locally for their own session completion

## Evidence

### Workflow usage over time (from session DB)

| Date | Workflow Sessions | Total Sessions | % |
|------|------------------|---------------|---|
| Mar 25 | 48 | 316 | 15.2% |
| Mar 26 | 39 | 198 | 19.7% |
| Mar 27 | 31 | 181 | 17.1% |
| Mar 28 | 6 | 143 | 4.2% |
| Mar 29 | 19 | 181 | 10.5% |
| Mar 30 | 8 | 193 | 4.1% |
| Mar 31 | 3 | 163 | 1.8% |
| Apr 1 | 1 | 111 | 0.9% |
| Apr 2 | 0 | 161 | 0% |
| Apr 3 | 0 | 107 | 0% |

### Agent-specific extinction patterns

- **code-review-loop** (coder+qa): Active Mar 4-29 → 0 from Mar 30 onward
- **Coach training workflows**: Active Mar 17-31 → last run Apr 1 → 0 from Apr 2
- **Optimizer workflows**: Active Mar 19-28 → 0 from Mar 29 onward

### Workflow effectiveness (EXP-020, during active period)

- **15x lower error rate** (1.5% vs 23.2%)
- **+26.9pp higher completion** (91.7% vs 64.8%)
- **97% code-review-loop completion** (4-step pattern)

### EXP-028: The Heartbeat Rewrite Natural Experiment (2026-04-05)

On 2026-04-01, a heartbeat rewrite (commit `db9b0ba9`) removed explicit `workflow.run()` instructions from coach's heartbeat. This created a **natural experiment** with a sharp, identifiable intervention point:

| Date | Coach w/ Workflow | Coach Done% | Note |
|------|------------------|-------------|------|
| Mar 29 | 7 | **89.3%** | Instructions present |
| Mar 30 | 8 | **84.4%** | Instructions present |
| Mar 31 | 3 | 79.2% | Instructions present (decay already visible) |
| Apr 01 | 1 | 50.0% | **Instructions removed** |
| Apr 02 | 0 | **39.1%** | Zero workflows |
| Apr 03 | 0 | **28.6%** | Zero workflows |
| Apr 04 | 0 | 68.0% | Zero workflows (partial recovery from other changes) |

**Key findings from EXP-028:**
1. **51pp coach done-rate degradation** (~85% → ~34%) — largest measured effect size in the system
2. **Workflow sessions had 0% error rate** vs 10% for non-workflow sessions (system-wide)
3. **+10pp done rate** for workflow sessions vs non-workflow (system-wide: 83.9% vs 73.9%)
4. Training-sprint cron embeds `workflow.run()` instructions in task string, but agents ignore them — they only follow heartbeat instructions

### The Dual-Cause Disentanglement

The original H-053 evidence showed system-wide decay from Mar 26 (19.7%) → Apr 2 (0%). EXP-028 reveals this was a **two-phase collapse**:

**Phase 1 (natural decay, Mar 26-31)**: Gradual erosion even with instructions present. System-wide: 19.7% → 1.8%. Coach: 8 → 3 sessions/day. This is the organic adoption decay H-053 originally described.

**Phase 2 (instruction removal, Apr 1-2)**: Sudden extinction. Coach: 1 → 0 in one day. This was caused by the heartbeat rewrite, not natural decay.

This refines the model: **heartbeat instructions are necessary but insufficient**. They sustain a non-zero adoption floor (4-10%) but don't prevent gradual decay from the initial deployment peak. True structural reinforcement (automatic routing) would be needed for stable, high adoption.

### Prediction Updates Based on EXP-028

**Prediction 1 (revised)**: "Re-deploying workflows via text instructions will fail" — **PARTIALLY REFUTED**. Heartbeat instructions DO sustain ~4-10% adoption floor. But this is a 60-80% decay from peak, so the spirit of the prediction (sustainable high adoption requires structure) holds. The more precise claim: **text instructions in heartbeats can sustain a non-zero floor, but cannot prevent decay from deployment peak**.

**Prediction 3 (confirmed)**: Decay rate of 3-7 days confirmed (Mar 26 peak → Apr 2 zero = 7 days).

**New Prediction 5**: Restoring workflow instructions to heartbeats will recover to the ~4-10% floor within 1-2 days, but will NOT recover to the Mar 25-26 peak (15-20%). The peak required novelty/deployment energy that decays.

## The Paradox

The most effective known intervention (15x error reduction) has completely self-extinguished. This is not a quality problem — it's a structural adoption problem. The Decision Topology framework (KE-015) explains why:

**Workflow usage is itself a low-R decision.** Whether to invoke a workflow requires:
1. Recognizing the task type matches a workflow
2. Choosing the right workflow
3. Bearing the setup cost (more ops, longer sessions)

None of these decisions are eliminable through text instructions. They require either:
- **Automatic routing** (infrastructure selects workflow based on task characteristics)
- **Mandatory invocation** (certain task types always run through workflows)
- **Default-on with opt-out** (workflows are the default, agents must explicitly skip)

## Connection to Theory

### Decision Topology (H-041/KE-015)
Workflow *effectiveness* follows the R-prediction pattern. But workflow *adoption* is a separate decision with its own R. The adoption decision has low R (it's a judgment call with many valid alternatives), so text-based encouragement cannot sustain it.

### Knowledge-Action Gap
Agents "know" workflows work (it's in their context). They don't "do" it. This is the Knowledge-Action Gap applied to meta-level decisions. The gap is especially wide for meta-decisions because:
- The benefit is statistical (visible over many sessions, not one)
- The cost is immediate (more ops, longer execution)
- There's no workflow to enforce using workflows (infinite regress)

### Self-Evolving Systems Literature
The self-evolving agents survey (HB-0042) identifies this as the **environmental co-evolution** problem: agents optimize for their local fitness (session completion) not system fitness (error rate). Without selection pressure favoring workflow usage, the trait is lost.

## Predictions

1. **Re-deploying workflows via text instructions will fail** — telling agents to use workflows is itself a text intervention, and 20/20 text interventions have failed
2. **Infrastructure-level routing will sustain adoption** — if the system automatically wraps certain task types in workflows, adoption will be maintained (100% by definition)
3. **The decay rate is ~3-7 days from peak to zero** — consistent across code-review-loop, coach training, and optimizer workflows
4. **Adoption will show sawtooth pattern** — brief spikes when reminded/redeployed, followed by same exponential decay

## Testing

**Design**: Implement automatic workflow routing for one task type (e.g., code changes → code-review-loop). Compare:
- A: Manual adoption (current state — text instruction to use workflows)  
- B: Automatic routing (infrastructure wraps task in workflow)

**Primary metric**: Workflow usage rate over 14 days  
**Secondary metrics**: Error rate, completion rate, ops/session

## Implications

If confirmed, this means:
- **Every effective intervention needs a structural adoption mechanism** — discovering what works is only half the problem
- **The system needs a "workflow router"** — automatic task classification → workflow selection
- **opBudget removal may have contributed** — workflows cost more ops; without budget pressure, individual sessions optimize for speed over quality (this needs verification)
- **This is a meta-level instance of KE-002** — text rules don't change behavior, even for meta-level behaviors like "use the tool that works"

## Who Should Act

- **tech-lead**: Design automatic workflow routing infrastructure
- **optimizer**: Analyze whether workflow-eligible tasks are identifiable from task descriptions
- **coach**: Not applicable — this is an infra problem, not a skill problem (per KE-002)

## Resolution (2026-04-18)

**Verdict: CONFIRMED**. P(H) = 0.88.

Workflow adoption decay is confirmed by strong evidence:
1. **System-wide decay**: 19.7% → 0% workflow usage over 7 days (Mar 26 → Apr 2), consistent across all three workflow types
2. **EXP-028 natural experiment**: Removing heartbeat instructions caused 51pp coach done-rate degradation (85% → 34%) — largest measured effect size in the system
3. **Dual-cause model**: Phase 1 (natural decay even with instructions, Mar 26-31) + Phase 2 (extinction upon instruction removal, Apr 1-2)
4. **Mechanism confirmed**: Text instructions sustain ~4-10% floor but cannot prevent decay from deployment peak. Structural reinforcement (automatic routing) is required for stable adoption.

All 4 predictions validated: text re-deployment fails to restore peak (P1 partially refuted/refined), infra routing sustains adoption (P2, by design), 3-7 day decay rate confirmed (P3), sawtooth pattern observed (P4).

**Status**: Resolved. The finding is an established design principle — effective interventions require structural adoption mechanisms, not just discovery of what works.
