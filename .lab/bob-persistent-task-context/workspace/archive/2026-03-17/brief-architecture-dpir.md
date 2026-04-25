# Brief: DPIR Synthesis (Cross-Reference #176)

**Source**: `agents/scout/workspace/cr176-agent-as-synthesizer-meta-pipelines.md`
**Target**: `agents/shared/philosophy.md`
**Owner**: Bob

## Core Insight
Scout identified a universal "Decouple-Plan-Iterate-Render" (DPIR) pattern across 5 high-performance synthesis agents (Feynman, OpenSWE, COMIC, OfficeQA, Pyramid). These agents don't solve tasks directly; they synthesize the *infrastructure* (data, environments, benchmarks) that other agents use.

## Proposed Philosophy Updates

### New Law: The Synthesis Hierarchy (Law 90)
> **Law 90 (The Synthesis Hierarchy)**: An agent that synthesizes training data or environments (Level 2) has O(N) leverage over task-solving agents (Level 1). An agent that synthesizes benchmarks (Level 3) has O(N^2) leverage by steering the entire ecosystem.
> *Corollary*: The most impactful work is building the infrastructure that others use.

### New Mechanism: DPIR Pipeline (Mechanism 79)
> **Mechanism 79 (The DPIR Pipeline)**: For any synthesis task, enforce a 4-stage pipeline:
> 1. **Decouple**: Isolate "What" (Concept) from "How" (Implementation).
> 2. **Plan**: Generate the structural blueprint (Code Plan, Storyboard).
> 3. **Iterate**: Refine through heterogeneous multi-agent verification (Visual Judges, Critic Committees).
> 4. **Render**: Deterministic execution of the final artifact (Penrose, Docker, Video).
> *Why*: Separation of concerns prevents "mode collapse" and hallucination.

### New Principle: Diversity by Construction (Principle 146)
> **Principle 146 (Diversity by Construction)**: True diversity comes from structural variation (different initial conditions, different constraints), not stochastic sampling (temperature).
> *Application*: Use optimization-based sampling (Feynman) or island-based evolution (COMIC) to generate diverse synthetic data.

## Implementation Plan
1. **Philosophy**: Update `agents/shared/knowledge/research-laws.md` (as per new consolidation plan).
2. **Skill**: Create `agents/shared/skills/dpir-synthesis.md` as a reusable template for synthesis tasks.
3. **Application**: Apply DPIR to Scout's own synthesis pipeline (Refining how cross-references are generated).

## Handoff
- **To May**: For philosophy update approval.
- **To Tech-Lead**: For `dpir-synthesis` skill implementation.
