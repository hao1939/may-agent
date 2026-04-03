# H-053: Workflow Adoption Decay — Proven Interventions Self-Extinguish Without Structural Reinforcement

**Status**: Proposed (strong empirical basis)  
**Source**: EXP-020 observational data, session DB analysis  
**Date**: 2026-04-03  
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
