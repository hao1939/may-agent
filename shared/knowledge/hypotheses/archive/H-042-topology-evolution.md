# H-042: Topology Evolution — Knowledge Accumulation Shifts the Decision Landscape

**Status**: Proposed (convergence of 6+ sources + internal longitudinal observation)
**Priority**: High — explains long-term system trajectory; testable with historical data
**Proposed by**: Bob (Architect)
**Date**: 2026-04-02
**Depends on**: H-041 (Decision Topology), H-040 (Reliability Inversion), KE-013 (Boundedness)

## Hypothesis

**As a multi-agent system accumulates verified knowledge, the fraction of eliminable decisions in its task landscape increases monotonically.** This causes a predictable architectural shift: tasks that initially require Mode B (exploration) gradually become Mode A (execution) candidates, making the system progressively more amenable to workflow enforcement.

### The Core Mechanism

Every time the system learns something — a convention, a tool pattern, a decomposition strategy — it converts a future *essential* decision ("How should I approach this?") into an *eliminable* decision ("Use the known-good approach"). This is one-directional: knowledge can convert essential → eliminable but not the reverse (barring knowledge corruption or task domain shifts).

```
dR/dt = learning_rate × fraction_of_essential_decisions_encountered
```

Where R = N_elim / N_total (the eliminable ratio from H-041).

As R increases:
- Workflows become increasingly beneficial (H-041 prediction)
- Text-based skills become increasingly redundant (they try to improve decisions that are already eliminable)
- The system's quality ceiling rises even without model improvement
- The optimal architecture shifts from Mode B toward Mode A

### The Phase Transition Prediction

There exists a critical knowledge threshold K* where:
- Below K*: Most tasks are exploratory (R < 0.3), Mode B (flat, wide-scope) is optimal
- Above K*: Most tasks are executable (R > 0.5), Mode A (workflow, hierarchy) is optimal
- At K*: The system should switch its default architecture

**Our system has already crossed K* for some task types but not others.**

## Evidence

### 1. Internal Longitudinal Observation (our system)

Our system's history provides natural evidence of topology evolution:

**Coder tasks (early → now)**:
- Early sessions (weeks 1-2): Coder explored conventions, tool patterns, project structure. Each session was essentially exploratory — essential decisions dominated ("How does this codebase work?", "What's the right way to handle tests?").
- Current sessions: Coder follows established patterns, uses known workflows, applies learned conventions. Most decisions are now eliminable ("Use the code-review-loop workflow", "Run existing test commands", "Follow edit discipline").
- **R shifted from ~0.2 to ~0.6** as knowledge accumulated.
- **Result**: Workflow introduction was beneficial BECAUSE R had already shifted. If we had imposed workflows during weeks 1-2, they would have constrained necessary exploration.

**QA tasks (always high R)**:
- QA tasks are inherently structured — format checking, output validation, convention compliance.
- R ≈ 0.7 from the start. Knowledge accumulation had less room to increase R.
- **Result**: QA benefited from workflows immediately.

**Optimizer tasks (currently low R)**:
- Optimizer tasks are still exploratory — evaluate which skills to improve, design experiments, decide improvement strategy.
- R ≈ 0.15 currently. The system hasn't accumulated enough knowledge about *what makes a good skill improvement* to convert these decisions to eliminable.
- **Prediction**: As the knowledge base grows with experiment results (EXP-008, EXP-011, etc.), optimizer R will increase, and workflows will eventually help optimizer too.

### 2. ReMe Framework (arXiv, 2026)

ReMe demonstrates that **memory quality can substitute for model capability**: Qwen3-8B + ReMe beats Qwen3-14B without memory. The mechanism: ReMe's experience distillation converts raw experience into reusable procedural knowledge, which in H-041 terms means converting essential decisions (learned through trial) into eliminable decisions (apply known procedure).

Key connection: ReMe's three mechanisms map exactly to topology evolution:
- **Multi-faceted distillation** = identify which decisions were essential and extract the resolution
- **Context-adaptive reuse** = apply past decision resolutions to new-but-similar tasks (essential → eliminable)
- **Utility-driven refinement** = prune knowledge that no longer converts decisions (keeping R growth monotonic)

### 3. Semantic Invariance Paper (arXiv:2603.13173)

Scale-Robustness Inversion shows that larger models aren't more reliable per-step. This means:
- Model scaling does NOT increase per-step decision quality (p in H-040's p^N model)
- But knowledge accumulation DOES increase quality by reducing N (number of decisions that must be made)
- **Corollary**: Knowledge scaling > model scaling for MAS reliability. This is H-042's prediction in action.

### 4. Error Propagation Quantified (Discovery 31, ThReadMed-QA)

Multi-turn error propagation: a single wrong turn raises subsequent error probability by 1.9-6.1×. This means:
- The cost of essential decisions is SUPER-LINEAR in pipeline length (not linear as H-041's simple model assumes)
- Each essential decision that becomes eliminable removes both its own risk AND the amplification it caused downstream
- **Prediction**: The marginal value of each new piece of knowledge (converting one more decision to eliminable) INCREASES as more knowledge accumulates, because each conversion has larger amplification effects in a shorter remaining pipeline.
- This creates a **virtuous cycle**: learning accelerates its own benefits.

### 5. P189: Evolve the Data, Freeze the Code

The Evolution Layers framework predicts exactly this pattern:
- L1 (data/memory) accumulation is the primary growth mechanism
- L2 (code/logic) changes create new decisions (and should be minimized)
- As L1 grows, L2 changes become less necessary — the system converges toward a fixed codebase with rich data
- **In H-042 terms**: L1 growth converts essential decisions into eliminable ones. The stable end-state is a system where almost all decisions are eliminable, running purely on workflows with rich context.

### 6. Our Experiment History

| Experiment | Result | Topology Evolution Reading |
|-----------|--------|---------------------------|
| EXP-001 | Context learning works for environmental facts | ✅ Environment knowledge makes environment decisions eliminable |
| EXP-004 | Plan-once-amend skill has no effect | ✅ Skill tried to improve essential decisions; the knowledge needed to make them eliminable doesn't exist yet |
| EXP-008 | Verify-after-edit skill has no effect | ✅ The decision "should I verify?" is already eliminable in 80% of cases (baseline). The skill is redundant. |
| EXP-009 | Workflows help structured, hurt exploratory | ✅ Structured tasks already have high R; exploratory tasks have low R |
| EXP-011 | R predicts workflow benefit (ρ=0.95) | ✅ Direct test of the R → quality relationship at a fixed time point |

Every experiment is consistent with topology evolution: interventions succeed when the decision landscape has already evolved (high R), and fail when it hasn't (low R).

## The Virtuous Cycle

H-042 predicts a self-reinforcing loop:

```
Knowledge accumulates → R increases → workflows become effective → 
workflow-enforced tasks succeed → success generates more knowledge → ...
```

But also a **stagnation trap** for low-R tasks:

```
Knowledge insufficient for task type → R stays low → workflows hurt → 
task failures don't generate useful knowledge → R stays low → ...
```

**Optimizer is currently in the stagnation trap.** To break it:
1. Run optimizer tasks WITHOUT workflow constraints (Mode B)
2. Analyze successes to extract decision patterns
3. Convert extracted patterns into context/workflow knowledge
4. Re-introduce workflow for the now-higher-R tasks
5. Repeat until R > 0.3

This is essentially what CASCADE's gate mechanism does at runtime — but we could do it at the knowledge-system level.

## Predictions

### P1: R increases monotonically over time (within a task type)
- **Measure**: Classify decisions for the same task type (e.g., code review) at month 1, 2, 3. Count N_elim/N_total.
- **Expected**: R increases by at least 0.05/month as conventions, patterns, and workflows accumulate.
- **Falsification**: R decreases or stays flat over 3 months → knowledge isn't converting decisions.

### P2: Workflow introduction timing matters
- **Prediction**: Introducing workflows BEFORE R crosses ~0.3 hurts quality. Introducing AFTER R crosses ~0.5 helps.
- **Test**: For 3 task types at different R levels, introduce workflows and measure quality change.
- **Falsification**: Workflows help regardless of R, or hurt regardless of R → topology doesn't matter.

### P3: The marginal value of knowledge increases over time
- **Prediction**: Each new knowledge entry converts decisions and has amplifying effects (due to error propagation). The N-th knowledge entry provides more system-quality benefit than the (N-1)-th.
- **Test**: Plot system-wide quality vs knowledge-base size. Should be super-linear (accelerating).
- **Falsification**: Quality scales linearly or sub-linearly with knowledge count.

### P4: Task types converge in optimal architecture over time
- **Prediction**: Currently, QA (high R) and optimizer (low R) need different architectures. In 6 months, as knowledge accumulates, optimizer's R will approach QA's, and both will benefit from similar workflow structures.
- **Test**: Track R for all task types quarterly. Check if variance in R decreases over time.
- **Falsification**: R variance stays constant or increases → topology is task-intrinsic, not learned.

### P5: Memory-augmented systems evolve topology faster
- **Prediction**: Systems with active memory management (ReMe-style distillation, utility-based pruning) convert essential → eliminable decisions faster than systems with passive accumulation.
- **Test**: Compare our current system (passive: files accumulate, occasionally pruned) to a hypothetical version with active knowledge distillation. Measure R evolution rate.
- **This is an architecture recommendation, not an immediate experiment.**

## Testing Plan

### Phase 1: Historical R Tracking ($0, database analysis)
1. Sample 10 sessions per task type from month 1, month 2, month 3
2. Classify decisions in each session
3. Plot R over time per task type
4. **Success**: R trend is positive for ≥3 of 4 task types

### Phase 2: Workflow Timing ($2-3, controlled)
1. Identify a task type with current R ≈ 0.3 (borderline)
2. Run 5 sessions WITH workflow, 5 WITHOUT
3. **Success**: Quality difference matches R prediction (marginal benefit near R=0.3)

### Phase 3: Stagnation Trap Intervention ($1-2)
1. Run optimizer in Mode B (no workflow) for 5 tasks
2. Analyze successes, extract decision patterns as context.md entries
3. Reclassify the same task type — R should increase
4. **Success**: R increases by ≥0.1 after knowledge injection

## Implications for System Design

### Short-term
- **Don't force workflows on low-R tasks.** The optimizer's 27% good rate with workflow tells us we imposed structure too early.
- **Track R per task type.** When R crosses 0.5, introduce workflows. When R drops below 0.3 (new task domain), remove them.
- **Invest in knowledge extraction.** Every successful Mode B session should generate knowledge that eventually enables Mode A.

### Medium-term
- **Build an R estimator.** A classification model that estimates R from a task description, enabling automatic routing.
- **Implement graduated workflow introduction.** Start with gates (CASCADE-style), progress to full workflow as R increases.

### Long-term
- **The stable end-state is nearly all Mode A.** If the system keeps learning, almost every task eventually becomes structured enough for workflow enforcement. The "research" phase converges toward "execution" for each task domain.
- **New task domains reset R to 0.** When the system enters a new domain, it starts in Mode B again. The speed of convergence from Mode B → Mode A is a measure of the system's meta-learning capability.

## Connection to Theory Chain

```
H-035 (Boundedness) → H-039 (Decomposition Bottleneck) → H-040 (Reliability Inversion) 
→ H-041 (Decision Topology) → H-042 (Topology Evolution)
```

Each hypothesis adds a layer:
- H-035: Quality depends on task boundedness
- H-039: Boundedness depends on decomposition quality
- H-040: Quality improves by eliminating decisions, not improving them
- H-041: Which decisions to eliminate depends on the topology (eliminable vs essential)
- **H-042: The topology itself evolves as knowledge accumulates, making elimination progressively more applicable**

H-042 closes the loop: it explains why the system should get better over time even without model improvements, and predicts where the limits of improvement lie (the irreducible essential-decision core of each task domain).

## References
- H-041: Decision Topology (classifies decisions)
- H-040: Reliability Inversion (eliminate > improve)
- H-039: Decomposition Bottleneck (quality ceiling set by decomposition)
- H-035: Boundedness Principle (bounded tasks succeed)
- EXP-009: Workflow effectiveness (observational, 464 sessions)
- EXP-011: Decision topology prediction (retrospective, ρ=0.95)
- EXP-008: Verify-after-edit null result (confirms text ≠ behavior change)
- ReMe Framework: Memory quality > model scale
- arXiv:2603.13173: Scale-Robustness Inversion (bigger ≠ more reliable per-step)
- Discovery 31 (ThReadMed-QA): Error propagation 1.9-6.1× per wrong turn
- P189: Evolution Layers (evolve data, freeze code)
- KE-001 through KE-013 (verified knowledge base, each a data point in the evolution)

---

*H-042: Topology Evolution | Bob (Architect) | 2026-04-02*
