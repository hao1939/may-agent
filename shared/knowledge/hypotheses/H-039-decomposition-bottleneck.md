# H-039: The Decomposition Bottleneck — MAS Quality Is Bounded by Orchestrator Decomposition Skill

**Status**: Archived — reclassified as truism/design principle (2026-04-07)
**Priority**: Archived
**Proposed by**: Bob (Architect)
**Date**: 2026-04-02
**Resolution**: This is a truism — "orchestrator quality bounds system quality" is unfalsifiable and trivially true. The formal model (Q(system) ≈ Q(decomposition) × Q_bounded + ...) repackages KE-013's finding in math without adding testable predictions beyond what KE-013 and KE-007 already establish. Core insight distilled to one paragraph: **System quality is bounded by task decomposition quality, not agent execution capability. Workflows work because they ARE automated decomposition. Invest in the orchestrator, not the executor.** P(H) = 0.44.

## Hypothesis

**The quality ceiling of a multi-agent system is set by the orchestrator's ability to decompose tasks into bounded subtasks, not by the capability of the executing agents.** This is the dual of the Selection Bottleneck (DD#463): just as selector quality determines whether generator diversity helps, **decomposer quality determines whether delegation helps**.

Formally:
```
Q(system) ≈ Q(decomposition) × Q_bounded + (1 - Q(decomposition)) × Q_unbounded
```

Where:
- Q(decomposition) = fraction of work successfully decomposed into bounded subtasks [0,1]
- Q_bounded ≈ 0.90 (KE-013: bounded tasks achieve ~90% good)
- Q_unbounded ≈ 0.40 (KE-013: unbounded tasks achieve ~40% good)
- Q(system) therefore ranges from 0.40 (no decomposition) to 0.90 (perfect decomposition)

**The 50pp quality range is entirely controlled by decomposition quality, not agent capability.**

## The Dual Bottleneck Framework

DD#463 proved the **Selection Bottleneck**: in generate-then-select pipelines, selector quality determines whether diversity helps. Below s*, diversity hurts. Above s*, diversity helps.

H-039 proposes the **Decomposition Bottleneck**: in orchestrate-then-execute pipelines, decomposer quality determines whether delegation helps. Below d*, delegation hurts. Above d*, delegation helps.

These are duals:
| | Selection Bottleneck (DD#463) | Decomposition Bottleneck (H-039) |
|---|---|---|
| **Stage** | Post-generation aggregation | Pre-execution planning |
| **Quality variable** | Selector skill s | Decomposer skill d |
| **Threshold** | s* (crossover) | d* (break-even) |
| **Below threshold** | Diversity hurts (synthesis destroys signal) | Delegation hurts (unbounded tasks degrade quality) |
| **Above threshold** | Diversity helps (selection captures best) | Delegation helps (bounded tasks hit 90%) |
| **Measured in our system** | Not directly (we don't do generate-then-select) | Yes: d ≈ 0.44 (50/114 call tasks were bounded in EXP-007) |

## Evidence (4 convergent sources)

### 1. KE-013 / EXP-007: Direct measurement
- 90% good on bounded tasks, 41% on unbounded
- Coder receives well-decomposed tasks from tech-lead → +23pp on calls
- Optimizer/Bob receive poorly-decomposed tasks → -39pp on calls
- **Interpretation**: Tech-lead is a better decomposer for coder tasks. Nobody is a good decomposer for optimizer/bob tasks.

### 2. DD#463: Selection Bottleneck (theoretical framework)
- Proved that aggregation quality dominates generator quality
- The formal framework transfers: decomposition quality should dominate executor quality
- The Weak-Model Paradox (adding a weaker model improves results) maps to: adding simpler subtasks improves system results by making decomposition easier

### 3. DD#400 Law 1: Coordination Overhead (Amdahl's Law)
- Maximum speedup bounded by serial fraction + communication tax
- **Reinterpretation**: the "serial fraction" is the fraction that CANNOT be decomposed into bounded subtasks
- Good decomposition reduces the serial fraction → more parallelizable → more benefit from MAS

### 4. DD#483: AI-Scientist-v2 (PATS architecture)
- Progressive Agentic Tree Search decomposes "write a paper" into bounded phases
- Each phase has LLM-evaluated completion criteria → bounded by definition
- Without this decomposition (v1), output was noise
- PATS is an empirical demonstration that decomposition quality is THE variable

### 5. Our verified knowledge (KE-002, KE-006, KE-007)
- KE-002: Text rules don't fix judgment → can't improve decomposition via prompts
- KE-006: Skills don't change tool patterns → skills operate on execution, not decomposition
- KE-007: Workflows are the only reliable intervention → workflows ARE decomposition (they break open-ended work into bounded steps)

**KE-007 reinterpretation**: Workflows don't work because they "enforce behavior." They work because they perform decomposition that the orchestrator failed to do. A workflow is automated decomposition.

## The d* Threshold

By analogy with DD#463's s*, there exists a decomposition quality threshold d*:

```
d* = (Q_single - Q_unbounded) / (Q_bounded - Q_unbounded)
```

If a single agent achieves Q_single on the undelegated task, delegation only helps when the decomposer creates bounded subtasks at rate > d*.

**Estimation for our system:**
- Q_single for hub agents ≈ 0.55 (average of tech-lead 44%, may 54%, bob 51%)
- Q_bounded ≈ 0.90, Q_unbounded ≈ 0.40
- d* ≈ (0.55 - 0.40) / (0.90 - 0.40) = 0.15 / 0.50 = **0.30**

So delegation helps our system whenever >30% of delegated subtasks are bounded. EXP-007 measured 44% bounded rate (50/114), which is above d* — delegation IS helping on net. But the 56% unbounded tasks are dragging the average down substantially.

**Optimal strategy**: Increase decomposition rate from 44% → 70%+ bounded. This would shift system quality from ~62% to ~75%+.

## Predictions

### P1: Agent-level quality is a proxy for decomposition quality
The per-agent quality gap (QA 96%, coder 52%, optimizer 25% on calls) reflects how well tasks TO that agent are decomposed, not the agent's intrinsic capability. **Test**: Give optimizer well-decomposed bounded tasks → predict >80% good.

### P2: The hardest decomposition problems are recursive
Tasks like "diagnose why coach is underperforming" require judgment to decompose — it's an unbounded task about generating bounded tasks. This creates a recursive bottleneck. **Prediction**: Meta-tasks (improving the system itself) will always have lower quality than object-level tasks because decomposition of meta-work is itself meta-work.

### P3: Model upgrades help decomposition more than execution
Better models should improve orchestrator decomposition quality more than they improve agent execution quality. **Test**: When a model upgrade occurs, measure the change in decomposition rate (% bounded tasks) vs change in bounded-task quality. Prediction: decomposition rate increases >10pp; bounded quality changes <5pp.

### P4: The Coder Paradox generalizes
Any agent receiving well-decomposed tasks via delegation will outperform its own autonomous sessions. **Test**: Route scout tasks through a decomposition step. Prediction: quality improves despite scout already being at 95% on jobs (because some job tasks are poorly self-decomposed).

## Connection to Architecture Redesign

The architecture redesign (agents/shared/may-agent-docs/design/architecture-redesign.md) proposes an EventBus model. H-039 suggests the critical question isn't the communication pattern — it's: **who decomposes, and how well?**

Implications:
1. The Manager layer is the decomposer. Its quality IS the system's quality ceiling.
2. Investing in better decomposition (smarter task breakdown, bounded-task templates, decomposition workflows) has 3-5× more leverage than any other intervention.
3. Workflows should be understood as "decomposition macros" — they encode known-good task decompositions so the orchestrator doesn't have to reinvent them each time.

## Testing Plan

### Phase 1: Retrospective ($0)
1. Classify all 7-day call tasks by quality of decomposition (bounded/mixed/unbounded) using more granular criteria
2. For each agent, compute decomposition rate (% of incoming tasks that are bounded)
3. Correlate decomposition rate with agent quality
4. **Pass**: r > 0.7 between decomposition rate and good%

### Phase 2: Interventional ($3-5)
1. Take optimizer's 5 most common call task types
2. Create decomposition templates that break each into 2-3 bounded subtasks
3. Run 20 sessions with templates vs 20 without
4. **Pass**: Template sessions >70% good vs historical 25%

### Phase 3: Meta-decomposition ($0)
1. Analyze manager's task-routing decisions
2. Classify which routes involve decomposition vs pass-through
3. Correlate decomposition effort with downstream quality
4. **Pass**: Tasks that manager decomposed achieve >20pp higher quality than pass-through

## Implications If Supported

1. **Workflows are our highest-leverage investment** — not as behavior enforcement, but as decomposition infrastructure
2. **The manager/orchestrator is the critical component** — improving manager > improving any individual agent
3. **Agent specialization matters less than task decomposition** — a "dumber" agent on a well-decomposed task beats a "smarter" agent on a poorly-decomposed task
4. **The "right" architecture question changes**: from "how should agents communicate?" to "how should tasks be decomposed?"
5. **KE-007, KE-013, H-035 are all expressions of the same principle** — the Decomposition Bottleneck subsumes them

## References
- KE-013: Task boundedness drives delegation quality
- KE-007: Workflows as only reliable intervention
- H-035: The Boundedness Principle
- DD#463: Selection Bottleneck (formal framework)
- DD#400: Seven Laws of Multi-Agent Coordination
- DD#483: AI-Scientist-v2 (PATS as decomposition)
- EXP-007: Delegation quality gap analysis
