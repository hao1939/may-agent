# H-041: The Decision Topology — Why Structure × Scope × Task Fit Determines MAS Quality

**Status**: Partially validated — HURTS predictions 86% accurate; HELPS predictions untested (EXP-025 partial, n=1). Sycophancy gating (EXP-025 strict) 3/3 confirms materialization gate mechanism.
**Priority**: High — operationalizes H-040 into a predictive framework with empirical grounding
**Last updated**: 2026-04-04 (sycophants-dilemma strict results + 4 external validations integrated)
**Proposed by**: Bob (Architect)
**Date**: 2026-04-02

## Hypothesis

**Multi-agent system quality is determined by the topology of decisions — who makes them (structure), what information they have (scope), and whether decisions are needed at all (task fit).** This goes beyond H-040's "eliminate decisions" principle by identifying *when* elimination helps and *when* it hurts.

### The Three-Variable Equation

```
MAS_Quality = Structure(authority_levels) × Scope(communication_budget) × TaskFit(decision_necessity)
```

Where:
- **Structure** = who has authority to make which decisions (hierarchy vs flat)
- **Scope** = who communicates with whom, when, and at what cost (bounded vs broadcast)
- **TaskFit** = whether the task's decision points are eliminable or essential

### The Key Refinement of H-040

H-040 says "eliminate decisions." But EXP-009 (464 real workflow sessions) reveals the boundary condition:

| Task Type | Workflow (decisions eliminated) | Non-Workflow (decisions preserved) | Winner |
|-----------|-------------------------------|-----------------------------------|--------|
| **Structured/repeatable** (QA, code review) | 100% good (QA), 81% good (coder) | 86% good (QA), 35% good (coder) | **Workflow wins** |
| **Exploratory/creative** (training, skill testing) | 38% good (coach), 33% good (optimizer) | 32% good (coach), 60% good (optimizer) | **Non-workflow wins** (optimizer) or mixed |
| **Error rate** (all tasks) | **2.6%** | 17.7% | **Workflow wins 6.8x** |

**The pattern**: Workflow decision-elimination dramatically reduces errors (6.8x) and helps structured tasks (+46pp for coder). But it hurts exploratory tasks where the decisions *are the work* — optimizer dropped from 60% to 27% under workflows.

### The Decision Classification

Not all decisions are equal. The topology matters:

1. **Eliminable decisions** — decisions with a known-correct answer that the agent shouldn't be making at runtime
   - "Should I read the file before editing?" (Always yes → eliminate with workflow)
   - "Which test command to run?" (Pre-specified → eliminate with context)
   - "Should I follow this convention?" (Always yes → eliminate with structure)
   - **Effect of elimination: pure benefit, no cost**

2. **Essential decisions** — decisions that ARE the task, requiring genuine judgment
   - "Is this approach promising enough to pursue?" (Requires exploration)
   - "What hypothesis best explains this data?" (Requires synthesis)
   - "How should I decompose this complex task?" (Requires planning)
   - **Effect of elimination: removes the agent's value**

3. **Navigation decisions** — meta-decisions about how to proceed, neither eliminable nor essential
   - "Should I try approach A or B?" (Could be pre-resolved if decomposition is good)
   - "Do I have enough information to proceed?" (Could be gated by a workflow check)
   - "Should I ask for help or continue?" (Could be policy-based)
   - **Effect of elimination: benefit if replaced by good policy, cost if replaced by bad policy**

### The Topology Prediction

For a given task, count:
- N_elim = eliminable decisions
- N_ess = essential decisions  
- N_nav = navigation decisions

```
Expected benefit of structuring = α × N_elim + β × N_nav - γ × N_ess
```

Where α > 0 (eliminating eliminable decisions always helps), β can be positive or negative (navigation decisions may or may not benefit from structure), and γ > 0 (constraining essential decisions always hurts).

**H-040 is correct when N_elim + N_nav >> N_ess** (most pipeline tasks).
**H-040 is wrong when N_ess >> N_elim + N_nav** (exploration, creative synthesis).

## Evidence: Eight Convergent Sources

### Internal Evidence (our system)

**1. EXP-009: Workflow Effectiveness Analysis (464 sessions)**
- Workflows reduce errors 6.8x — eliminable decisions (infrastructure, format, protocol) are successfully removed
- QA vet-skill: 100% good — almost purely eliminable decisions
- Coder code-review-loop: 81% good — mix of eliminable (when to review) and essential (how to fix)
- Coach training sprints: 38% good — dominated by essential decisions (teaching judgment)
- Optimizer skill-lifecycle: 27% good under workflow vs 60% without — essential exploration decisions constrained by structure

**2. KE-007 + KE-002 + KE-013 (our verified knowledge)**
- Workflows outperform text rules because workflows eliminate decisions; rules add them (H-040)
- But now we know: workflows outperform ONLY on tasks where the eliminated decisions were eliminable

### External Evidence (recent papers)

**3. DD#484: OrgAgent — Hierarchy as Structure**
- 3-layer hierarchy (governance/execution/compliance) improves F1 by up to +102.73% while reducing tokens by 74.52%
- But FAILS on MuSR (multistep soft reasoning) — creative/ambiguous tasks where essential decisions dominate
- **Maps to H-041**: OrgAgent adds structure (authority levels), which helps when decisions are eliminable (who decides what) but hurts when tasks need fluid reasoning (all decisions are essential)

**4. DD#485: CASCADE — Scoped Communication**
- Gate-triggered scope expansion: start narrow, expand only on failure
- Communication budgets as explicit penalties
- **Maps to H-041**: CASCADE adds scope control, which eliminates navigation decisions ("should I broadcast this?") by replacing them with a policy ("try local → validate → escalate")

**5. CR#270: Structure × Scope Synthesis**
- Neither structure alone nor scope alone is sufficient
- The two are orthogonal controls — structure determines authority, scope determines information flow
- **Maps to H-041**: This is the two-variable version; H-041 adds the third variable (TaskFit) which explains when the combination fails

**6. DD#481: Sequential > Coordinator > Shared**
- Sequential topology outperforms shared-memory by 44% (Cohen's d = 1.86)
- **Maps to H-041**: Sequential topology minimizes navigation decisions (each agent only decides "what to pass to the next agent") and eliminates communication scope decisions (you talk to exactly one neighbor)

**7. Karpathy's Agent Tips (HB-0502)**
- "Blame the prompt/orchestration before blaming the model" — most failures are from eliminable decisions that shouldn't be agent decisions at all
- "Design fully autonomous persistent loops" — autonomous loops work when N_ess is low
- "Remove yourself from the flow" — eliminate human decision points too

**8. DD#479: Reliability Limits**
- Multi-agent ≤ single agent without new exogenous signals
- **Maps to H-041**: Structure and scope create "virtual exogenous signals" by constraining the decision space. Governance decisions in OrgAgent effectively provide new information (which execution mode to use) that wouldn't exist in a flat system. But this only helps if the governance decision eliminates more decisions than it adds.

## Predictions

### P1: Task-type determines optimal architecture
- **Structured tasks** (N_elim >> N_ess): Full workflow + strict hierarchy = best
- **Exploratory tasks** (N_ess >> N_elim): Minimal structure + wide scope = best  
- **Mixed tasks** (balanced N): Adaptive structure (CASCADE-style gates) = best
- **Test**: Classify 50 tasks by decision type. Measure quality under workflow vs non-workflow. Predict from classification which will benefit.
- **Expected**: >80% classification accuracy

### P2: The optimal workflow eliminates ALL eliminable decisions and NONE of the essential ones
Current workflows are binary (on/off). A decision-aware workflow would:
- Hard-code eliminable decisions (always read before edit, always verify after change)
- Leave essential decisions to the agent (which approach to take, when to stop)
- Apply gate policies to navigation decisions (try X first, escalate if validation fails)
- **Test**: Design a "topology-aware" workflow for coder tasks. Compare against current code-review-loop.
- **Expected**: +10pp improvement over current workflow

### P3: Optimizer's workflow performance will improve when workflow constraints are loosened
EXP-009 shows optimizer at 27% with workflow vs 60% without. If we replace rigid workflow steps with scope policies (CASCADE-style gates), optimizer should improve.
- **Test**: Design a "soft workflow" for optimizer that provides gates but not step sequence.
- **Expected**: >50% good rate (between 27% rigid and 60% unconstrained)

### P4: The governance layer's value scales with N_elim / N_total
For tasks with high eliminable-decision fraction, adding a governance layer (OrgAgent-style) provides large gains. For tasks with low eliminable fraction, governance overhead exceeds benefit.
- **Test**: In the next month, measure governance overhead (tech-lead session time) vs quality improvement per task type.
- **Expected**: Positive correlation (r > 0.5) between eliminable-decision fraction and governance benefit

### P5: CASCADE-style gate expansion reduces navigation decisions without constraining essential ones
Navigation decisions ("should I involve another agent?") are neither eliminable nor essential. CASCADE's gate-triggered expansion replaces them with a policy: try local, validate, escalate.
- **Test**: Implement gate-based scope expansion in our postboard system for one agent.
- **Expected**: Reduces coordination overhead by 30%+ while maintaining quality

## Connection to Prior Hypotheses

- **H-040 (Reliability Inversion)**: H-041 is the operationalized version. H-040 says "eliminate decisions." H-041 says "eliminate *eliminable* decisions; preserve *essential* decisions; policy-gate *navigation* decisions."
- **H-039 (Decomposition Bottleneck)**: Good decomposition converts essential decisions into eliminable ones (by pre-resolving scope and approach). Bad decomposition creates new navigation decisions.
- **H-035 (Boundedness Principle)**: Bounded tasks have fewer decisions overall, but specifically fewer navigation decisions. Essential decisions remain but are clearer.

## The Meta-Insight: Architecture as Decision Pre-Resolution

Every architectural choice in a MAS is a decision made at design time to eliminate decisions at runtime:
- **Hierarchy** pre-resolves authority decisions ("who decides?")
- **Scope budgets** pre-resolve communication decisions ("who to talk to?")
- **Workflows** pre-resolve sequence decisions ("what to do next?")
- **Skills** attempt to pre-resolve quality decisions ("how to do it well?") — but fail because quality decisions are often essential, not eliminable
- **Context files** pre-resolve information decisions ("what do I need to know?")

The architect's job is to classify decisions and match each to the right pre-resolution mechanism. This is what H-039's decomposition bottleneck really is — the orchestrator's ability to identify which decisions are eliminable and pre-resolve them through structure, scope, and workflow.

## Testing Plan

### Phase 1: Decision Classification ($0)
1. Take 30 recent sessions (mix of agents, tasks, verdicts)
2. For each, identify decision points and classify as eliminable/essential/navigation
3. Correlate N_elim/N_total ratio with verdict quality
4. **Pass criteria**: r > 0.4 between eliminable fraction and good outcomes

### Phase 2: Topology-Aware Workflow ($2-3)
1. Design a coder workflow that hard-codes eliminable decisions, leaves essential decisions open, and gates navigation decisions
2. Run 5 tasks with topology-aware workflow vs standard code-review-loop
3. **Pass criteria**: topology-aware workflow ≥ code-review-loop on quality, with fewer total operations

### Phase 3: Soft Workflow for Exploratory Tasks ($1-2)
1. Design a "soft workflow" for optimizer: provides validation gates but not step sequence
2. Run 5 skill-lifecycle tasks with soft workflow
3. **Pass criteria**: Good rate > 40% (between 27% rigid and 60% unconstrained)

## Design Principle: The Asymmetric Default (formerly H-044)

*Merged from H-044 on 2026-04-04. When R is uncertain, under-structuring is safer than over-structuring.*

### Claim

When the decision landscape of a task is unknown (R is uncertain), defaulting to **lower structure** (agent mode) produces higher expected quality than defaulting to **higher structure** (workflow mode).

### The Asymmetry

| Direction | Cost | Mechanism | Observed Impact |
|-----------|------|-----------|-----------------|
| Over-structuring (workflow on low-R task) | **High** (γ × N_essential) | Constrains essential decisions → wrong output | -33pp (optimizer: 60% → 27%) |
| Under-structuring (agent on high-R task) | **Low** (α × N_eliminable) | Fails to eliminate eliminable decisions → slower output | -14pp (QA: 100% → 86%) |

Over-structuring penalty is **2.4× larger** than under-structuring penalty. Quality failure (wrong work) costs more than efficiency failure (slow work) because wrong output propagates downstream while slow output merely delays.

### Practical Rule

Default to agent mode for new/unclassified tasks. Apply workflow only after R is estimated from ≥5 observations. This is the information-theoretic analog of the bias-variance tradeoff: structure = bias (systematic misfit risk), no structure = variance (inconsistency risk). Under uncertainty, lower bias wins.

### Boundary Conditions

H-044's rule breaks when:
1. **R is confidently high** (> 0.7) — apply workflow immediately
2. **Efficiency > quality** in cost function — time-critical settings
3. **Structure provides safety properties** — verification loops, evidence gates

### Supporting Evidence
- EXP-009: 2.4× asymmetry ratio (observational)
- Anthropic "Building Effective Agents": "Start with the simplest solution possible"
- CASCADE (DD#485): Starts low-structure, escalates via gates
- Karpathy: "Don't create frameworks, create prompts"

## EXP-025 Extension: Sycophants-Dilemma Strict Results (2026-04-04)

The strict two-phase workflow on sycophants-dilemma scenario achieved 3/3 (100%) pass rate vs 3/6 (50%) baseline. This confirms a key H-041 mechanism: **the materialization gate forces the agent to commit to a classification BEFORE having the option to delete**. The gate converts what was an essential decision (judgment under social pressure) into two eliminable decisions:
1. "Classify this file as keep/delete" (eliminable — follows explicit criteria)
2. "Delete only files classified as SAFE-TO-DELETE" (eliminable — follows Phase 1 output)

The regular workflow (classify-then-act without hard gate) achieved the same 50% as baseline — classification without enforcement doesn't change the decision topology. Only the **hard gate** between phases changes R.

## External Validation (2026-04-04 batch)

**9. DD#512: Self-Driving Portfolio (50-Agent MAS)**
- 50 specialized agents with methodological diversity (not stochastic diversity)
- IPS (Investment Policy Statement) as constitutional constraint = governance pre-resolution
- Meta-agent rewrites other agents' code = automated elimination of recurring eliminable decisions
- Researcher agent prevents convergence = preserves essential exploration decisions
- **Maps to H-041**: The most sophisticated implementation of H-041's framework in production — structure (3-layer hierarchy), scope (vote-and-critique pipeline), task fit (methodological diversity ensures essential decisions remain diverse)

**10. DD#513: WMAS — World-Centered MAS**
- Formalizes shared world model > agent-local beliefs for institutional domains
- 6-dimension world classification predicts when structure helps (Type I institutional = canonical)
- Our shared knowledge library IS a ground semantic layer; hypotheses ARE the causal knowledge layer
- **Maps to H-041**: WMAS's world type classification = H-041's task fit variable. Type I (our domain) = high N_elim, low N_ess. WMAS predicts our design should benefit from heavy structuring — consistent with H-041.

**11. CASCADE (arXiv:2604.00451): Scoped Communication**
- Explicit communication budgets with scope escalation
- Start local, expand only when local validation fails
- **Maps to H-041**: Scope variable operationalized. CASCADE = policy for navigation decisions ("should I expand communication?").

**12. LLM Cooperation in Games (arXiv:2604.00487)**
- LLM agents default to cooperation (fairness-driven), not Nash equilibria
- Multi-round context enables richer strategic behavior
- **Maps to H-041**: LLM default cooperation means under-structuring is EVEN SAFER than over-structuring, because agents won't defect. Strengthens the Asymmetric Default principle.

**Merged hypotheses**: H-060 (hierarchical MAS) and H-061 (constrained communication) archived on 2026-04-04. Both were specific instances of H-041's Structure and Scope variables respectively. Their evidence is now cited above as sources 9-12.

## References
- H-040: The Reliability Inversion (generalized by H-041)
- H-039: The Decomposition Bottleneck
- H-035: The Boundedness Principle
- H-044: The Asymmetric Default (now merged into this document)
- H-059: Cadence Skill Effectiveness (empirically supported extension)
- EXP-009: Workflow Effectiveness Analysis (464 sessions, observational)
- DD#484: OrgAgent (hierarchy empirics)
- DD#485: CASCADE (scoped communication)
- CR#270: Structure × Scope convergence synthesis
- DD#481: Sequential > Coordinator > Shared
- DD#479: Reliability Limits (exogenous signal requirement)
- KE-002, KE-006, KE-007, KE-009, KE-013 (verified knowledge base)
- HB-0502-karpathy-agent-tips (practitioner alignment)
