# DD#824 — Mozi: Governed Autonomy with HITL Checkpoints at Decision Boundaries (2603.03655)

**Paper**: "Mozi: Governed Autonomy for Drug Discovery LLM Agents"
**Authors**: Cao, Liu, Zhang, Liu, Li, Feng, Bai, Chen, Xie, Li
**arXiv**: 2603.03655
**Rating**: ★★★☆☆

---

## Core Thesis

Tool-augmented LLM agents in high-stakes domains (drug discovery) suffer from **unconstrained tool-use governance** and **poor long-horizon reliability**. Early-stage hallucinations **multiplicatively compound** into downstream failures. Mozi introduces a dual-layer architecture combining free-form reasoning for safe tasks with structured execution for long-horizon pipelines.

## Architecture

### Layer A: Control Plane
- Governed supervisor-worker hierarchy
- Role-based tool isolation
- Execution constrained to action spaces
- Reflection-based replanning

### Layer B: Workflow Plane
- Canonical stages as stateful, composable skill graphs
- **Strict data contracts** between stages
- **Strategic HITL checkpoints at high-uncertainty decision boundaries**
- Trace-level audibility

### Design Principle
> "Free-form reasoning for safe tasks, structured execution for long-horizon pipelines"

## Relevance to Decision Boundary Interventions

### Key Insight: Multiplicative Error Compounding
The paper's core observation — that "early-stage hallucinations multiplicatively compound into downstream failures" — directly explains why:
1. Short-horizon gym tasks don't show the problem (insufficient compounding)
2. Production long-horizon tasks do (errors amplify across steps)
3. Decision boundary intervention value scales with horizon length

### HITL Checkpoints as Decision Gates
Mozi places human-in-the-loop checkpoints specifically at "high-uncertainty decision boundaries" — the system identifies which decision points are riskiest and gates them. This is a more targeted version of EXP-107's approach: rather than checking every finish(), identify which finish() calls are at high-uncertainty boundaries and only check those.

### Selective Intervention Pattern
- Not every action needs verification — only high-uncertainty decision points
- This addresses the overhead concern: if you can identify which decisions are risky, you only pay the verification cost where it matters
- Connects to H-107's finding that difficulty moderates overhead harm — easy tasks shouldn't be checked, hard tasks should

## Limitations for Our Context
- Drug discovery domain — transferability to coding agents unclear
- HITL model requires human availability — we need automated equivalent
- Paper focuses on workflow-level gates, not individual action verification

## Connections
- **DD#822 (SAVeR)**: Both address belief propagation, but SAVeR repairs within agent, Mozi gates between stages
- **DD#823 (TrustBench)**: Both use pre-action verification, but TrustBench is generic, Mozi is domain-specific
