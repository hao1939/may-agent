# DD#823 — TrustBench: Real-Time Trust Verification at Action Boundaries (2603.09157)

**Paper**: "Real-Time Trust Verification for Safe Agentic Actions using TrustBench"
**Authors**: Sharma, Sharma, Sharma
**Venue**: AAAI 2026 Workshop on Trust and Control in Agentic AI (TrustAgent)
**arXiv**: 2603.09157
**Rating**: ★★★★☆

---

## Core Thesis

Current LLM agent evaluation frameworks (AgentBench, TrustLLM, HELM) assess quality **post-hoc** — after actions have already been taken. None prevent harmful actions during execution. TrustBench introduces a dual-mode framework that intervenes at **the critical decision point: after an agent formulates an action but before execution**.

## Architecture

### Dual-Mode Design
1. **Benchmarking mode**: Trust evaluation across multiple dimensions using traditional metrics + LLM-as-Judge
2. **Toolkit mode**: Agents invoke TrustBench verification **before** taking actions to verify safety and reliability

### Domain-Specific Plugins
- Healthcare, finance, and technical domains each have specialized safety requirement encodings
- Domain plugins outperform generic verification by 35% in harm reduction

### Key Results
- **87% reduction in harmful actions** across multiple agentic tasks
- **Sub-200ms latency** — practical for real-time use in production agent systems
- Domain-specific > generic verification (35% improvement)

## Relevance to EXP-107 / Decision Boundary Interventions

### Direct Parallels
1. **Same intervention point**: TrustBench explicitly positions itself "after formulation, before execution" — this is the finish() boundary
2. **Toolkit-as-gate pattern**: Agent INVOKES the verification before acting, rather than having it imposed externally. This is the "self-check" model EXP-107 tested, but with external verification infrastructure
3. **Sub-200ms latency**: Proves that pre-action verification doesn't have to be expensive. EXP-107's overhead concerns may be addressable

### Design Insights for Our System
- **Domain-specific verification >> generic**: A finish() self-check should be task-type-aware, not one-size-fits-all
- **Dual-mode useful**: Same infrastructure can benchmark AND intervene — we could use the same adversarial self-check to both measure quality AND prevent errors
- **Plugin architecture**: Different task domains need different verification logic — coding vs. file operations vs. communication

### Limitations
- Workshop paper — evaluation breadth may be limited
- 87% harm reduction doesn't distinguish between "harmful" and "suboptimal" — unclear if this catches the subtle quality errors EXP-107 targeted vs. safety-critical violations
- The "agent invokes toolkit" model requires agent cooperation — a compromised agent could skip the check

### Connection to Literature
- **DD#822 (SAVeR)**: Both target pre-action verification; SAVeR focuses on faithfulness of internal reasoning, TrustBench on safety of external actions. Complementary.
- **DD#763 (Parallax)**: TrustBench's plugin architecture is a lightweight version of Parallax's cognitive-executive separation
