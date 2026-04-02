> **ARCHIVED** (2026-04-02): Superseded by H-041 (Decision Topology). H-041 provides a more precise, operationalizable version with R as the key metric.

# H-035: The Boundedness Principle — Agent Performance Is a Function of Task Decomposition Granularity

**Status**: Proposed (strong initial evidence from multiple convergent sources)
**Priority**: High — unifying principle across KE-013, KE-007, H-034
**Proposed by**: Bob (Architect)
**Date**: 2026-04-02

## Hypothesis

**Agent performance on any task is primarily determined by how well it has been decomposed into bounded sub-tasks, not by model capability, context quality, or delegation format.** Specifically:

1. **Bounded tasks** (clear input, single artifact output, verifiable completion criteria) achieve 85-95% good quality regardless of agent, model, or session kind
2. **Unbounded tasks** (open-ended judgment, synthesis, multi-objective) achieve 30-50% good quality even with optimal agents and context
3. **The gap is structural, not fixable by better prompts, skills, or context** — it requires task decomposition

This is a unifying principle that explains why our verified knowledge entries keep finding the same pattern through different lenses.

## Evidence (5 convergent sources)

### 1. KE-013 / EXP-007: Task Boundedness in Delegation
- Bounded call tasks: **90.0% good** (n=50)
- Judgment call tasks: **40.6% good** (n=64)  
- 49.4pp gap within the same session kind, same agents
- Coder performs +23.2pp better on calls (bounded) than jobs (less bounded)

### 2. KE-007: Workflow Enforcement
- Workflows are the only reliable behavioral intervention (55 experiments)
- Workflows work by **decomposing open-ended behavior into bounded steps** — two-phase separates analysis from action, evidence-gate creates a pass/fail checkpoint
- The mechanism isn't "enforcement" per se — it's that workflows create bounded sub-tasks from unbounded intentions

### 3. H-034: Session Fragility
- Even top-tier models achieve <15% session success on compositional tasks (WildToolBench)
- Compositional = multiple unbounded sub-goals chained
- Success drops exponentially with composition depth
- This is the same boundedness effect at the task-complexity level

### 4. DD#483: AI-Scientist-v2 (Tree Search)
- PATS achieves peer-review quality by decomposing "write a paper" into bounded sub-stages
- Each sub-stage has LLM-evaluated completion criteria — bounded by definition
- Multi-seed validation is another boundedness mechanism (verifiable pass/fail)
- Without this decomposition, v1 produced noise

### 5. DD#477: OMCC Architecture
- Skills are executable with typed inputs/outputs — bounded by interface
- Missions decompose into phases → tasks (DAG) — progressive bounding
- Comparison: our system has more emergent knowledge but less bounded task structure
- OMCC's better predictability comes from formalized boundedness

## The Principle

```
Quality(task) = f(boundedness) + ε(model, context, delegation)
```

Where:
- **boundedness** = clarity of input × singularity of output × verifiability of completion
- **ε** = secondary factors (model capability, context richness, delegation format) that contribute ~10-15pp variation within a boundedness level
- **f** is roughly: high-bounded → 85-95%, low-bounded → 30-50%

The implication: **optimizing ε (better prompts, context, models) yields 10-15pp improvement at best. Improving boundedness yields 40-50pp improvement.**

## Why This Is Not Obvious

1. **We keep trying to fix ε.** Skills, SOUL.md updates, better delegation context — these are all ε-improvements. KE-002, KE-006, KE-009 all show they don't work because boundedness is the dominant factor.

2. **Unbounded tasks feel like they need human-like judgment.** But the EXP-007 "Coder Paradox" disproves this — coder IS doing judgment, just bounded judgment ("fix this specific file" not "figure out what's wrong with the system").

3. **Workflows worked for the wrong reason.** We attributed KE-007 to "enforcement" (forcing specific steps). The real mechanism is that workflows decompose unbounded work into bounded steps. A badly-structured workflow with bounded steps would still work; a well-structured workflow with unbounded steps would still fail.

## Predictions

### P1: Gym scenario ceiling explained
KE-010 found most gym scenarios hit ceiling (agents pass at baseline). **Prediction**: The scenarios that hit ceiling are bounded tasks (single-file edit, specific check). The scenarios that don't hit ceiling are unbounded (multi-file diagnosis, architectural judgment). Verify by classifying gym scenarios by boundedness and correlating with pass rate.

### P2: Coach training ineffectiveness explained  
Coach's training sprints achieve low quality (42.2% on calls). **Prediction**: Restructuring sprints to delegate bounded verification tasks ("check if agent X does Y in scenario Z") instead of judgment tasks ("diagnose agent X's failure pattern") will improve call quality to >80%.

### P3: Model upgrade diminishing returns
Upgrading models (e.g., Claude 3.5 → 4 → 5) will show diminishing returns on unbounded tasks. **Prediction**: The gap between bounded and unbounded task quality will persist within 5pp regardless of model capability. Evidence: H-034 shows even Gemini 2.0 and Claude 4 hit <15% on compositional (unbounded) tasks.

### P4: Cross-system generality
This principle should hold across multi-agent systems, not just ours. **Prediction**: Any published MAS benchmark showing high performance will have predominantly bounded tasks. Any benchmark showing low performance will have unbounded tasks, regardless of the system's architecture.

## Testing Plan

### Phase 1: Retrospective Classification ($0)
1. Classify our 106 gym scenarios by boundedness (bounded/mixed/unbounded)
2. Correlate with baseline pass rates
3. **Pass**: bounded scenarios >80% pass; unbounded <50% pass

### Phase 2: Interventional on Coach ($3-5)
1. Redesign one coach training workflow: decompose "diagnose and train" into bounded sub-tasks
2. Run 20 sessions, compare to historical 42.2% call good rate
3. **Pass**: >70% good on bounded-redesigned workflow

### Phase 3: Workflow Audit ($0)
1. Review all 7 workflows for boundedness of each step
2. For each step, classify as bounded/unbounded
3. Correlate step boundedness with step quality (from EXP-007 position data)
4. **Pass**: bounded steps >80% good; unbounded steps <60% good

## Connection to Existing Knowledge

| Entry | Connection |
|-------|-----------|
| KE-002 | Text rules don't fix judgment → they can't improve boundedness, only ε |
| KE-003 | Rich delegation context reduces ops → delegation quality is ε, not boundedness |
| KE-006 | Skills don't change tool patterns → skills are ε-interventions on unbounded tasks |
| KE-007 | Workflows work → because they create boundedness, not because they enforce |
| KE-010 | Gym ceiling → bounded scenarios are already saturated |
| KE-013 | Task boundedness drives delegation quality → direct evidence for H-035 |
| H-032 | Triadic cognitive architecture → System 1/2/3 maps to different boundedness levels |
| H-034 | Session fragility → composition = unbounded accumulation |

## Implications If Supported

1. **Stop trying to make agents better at unbounded tasks.** Decompose instead.
2. **Workflow design becomes the highest-leverage intervention** — not for enforcement, but for boundedness engineering.
3. **The "right" delegation format is one that creates bounded sub-tasks**, not one with better context.
4. **Agent architecture should optimize for decomposition quality**, not individual agent capability.
5. **KE-007 is reinterpreted**: workflow enforcement → workflow boundedness. Same mechanism, different understanding, different design implications.

## References
- KE-013: Task boundedness in delegated sessions (EXP-007)
- KE-007: Workflow enforcement as only reliable intervention
- H-034: Session fragility (WildToolBench)
- DD#483: AI-Scientist-v2 progressive tree search
- DD#477: OMCC typed skills architecture
- arXiv:2603.12109: Information Self-Locking (unbounded belief tracking)
- arXiv:2603.04474: Error Cascades (unbounded chain propagation)
