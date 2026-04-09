# DD-701: Semantic Router DSL — Cross-Layer Verification via Declarative Policy Compilation

**Rating**: ★★★★★
**Paper**: "From Inference Routing to Agent Orchestration: Declarative Policy Compilation with Cross-Layer Verification" (Chen, Liu, He, Liu — vLLM/MBZUAI/McGill/Mila, March 2026)
**arXiv**: 2603.27299
**Relevance**: Directly addresses the cross-layer verification coordination gap identified in CR#321 and KE-104

---

## Core Innovation

A **non-Turing-complete policy language** (the Semantic Router DSL) that compiles a single `.sr` source file into verified decision artifacts across **four target layers**: inference routing, agent orchestration, protocol boundary gates, and infrastructure (Kubernetes/YANG). The key insight: because the language is deliberately constrained (no mutable state, no side effects, no loops, no recursion), the compiler can provide **static guarantees** that are impossible with ad-hoc Python policy code.

## Architecture: Multi-Target Compilation

```
Single .sr source file
        │
        ▼
   DSL Compiler (5 cross-target checks)
   ├── Inference routing (YAML → gateway)
   ├── Orchestration (LangGraph nodes / OpenClaw config)
   ├── Protocol gates (MCP tools/call, A2A tasks/send)
   └── Infrastructure (NetworkPolicy, Sandbox CRD, YANG/NETCONF)
```

### Five Compiler Guarantees
1. **Exhaustiveness** — every input reaches a decision
2. **Conflict-freedom** — no two branches fire on the same input (for geometric signals)
3. **Dead branch detection** — unreachable policy paths identified
4. **Referential integrity** — all signal/backend references resolve
5. **Source hash consistency** — all emitted artifacts carry the same hash

## Key Mechanisms

### 1. Signal → Projection → Decision Pipeline
- **Signals**: Probabilistic ML detectors (embedding similarity, PII, jailbreak) → score ∈ [0,1], thresholded to Boolean
- **Signal_Group**: Softmax normalization (Voronoi/ProbPol) ensures at most one signal fires
- **Decision_Tree**: Priority-ordered If/Else compiled as Firewall Decision Diagram

### 2. Three Orchestration Compilation Strategies
- **Strategy A** (Conditional edges): Signal evaluation node + conditional edge function from Decision_Tree
- **Strategy B** (Command-returning node): Single atomic step combining state update + audit trace + routing
- **Strategy C** (Policy nodes in workflow): Developer writes workflow skeleton; compiler fills policy gates

### 3. Protocol Boundary Gates
For each protocol (MCP, A2A, ACP, ANP, AP2, OpenAI Commerce, UCP):
- Extract text from protocol message
- Evaluate same Signal definitions used everywhere else
- Apply Decision_Tree → allow/deny + structured audit trace

### 4. Audit Trace Generation (Structural Correspondence)
Traces are generated from the **same AST** that generates routing logic. Impossible for trace to describe a different decision tree than what executed. Includes:
- Named components (signal names)
- Observable intermediates (scores)
- Explicit boundaries (thresholds)
- Tree + branch names
- Append-only channel (optional cryptographic hash chain)

## Four Pillars Analysis

| Pillar | What It Provides | What It Doesn't |
|--------|-----------------|-----------------|
| **Auditability** | Structural traces coupled to decision logic | Signal accuracy (calibration problem) |
| **Cost Efficiency** | Cost-correct routing (right model per step) | Individual inference latency |
| **Verifiability** | Exhaustiveness, conflict-freedom for geometric signals | Classifier co-firing (empirical only) |
| **Tunability** | Symbolic parameter optimization from traces | Hyperparameter search for ML signals |

## Critical Analysis

### Strengths
- **Policy drift elimination**: A threshold change propagates from inference gateway → agent gate → infrastructure in one compilation step. This is the "cross-team coordination" problem that's the primary source of policy drift.
- **Complementarity, not replacement**: The DSL doesn't replace orchestration frameworks — it adds a verified policy layer orthogonal to state management and control flow.
- **NetKAT lineage**: Follows the same philosophy as NetKAT (Anderson et al. 2014) — restricted expressiveness admits decidable verification.
- **Production-validated**: Inference routing target is already deployed in production at vLLM.

### Limitations
- **Classifier signal co-firing**: For ML-based signals (as opposed to geometric/threshold signals), conflict-freedom is only empirically checkable, not decidable.
- **Four unmapped constructs**: Algorithm confidence, Algorithm rl_driven, Plugin semantic_cache, Plugin rag don't map cleanly to orchestration targets.
- **Signal_Group tie-breaking**: Equal-score signals fall to default branch — may not match administrator intent.
- **Overhead justified only at scale**: Paper acknowledges the compilation overhead is only worthwhile for systems with multiple policy checkpoints across layers.

## Implications for Our Architecture

### Direct Relevance to KE-104 Verification Stack
This paper provides the **missing piece** CR#321 identified: how to maintain verification consistency across layers. Specifically:

1. **Cross-layer signal consistency** — AEGIS forensic signals (DD-698) could be declared once and compiled to all verification points
2. **Protocol boundary enforcement** — Dual-state guard/recovery (DD-699) states could be verified at MCP/A2A boundaries
3. **Audit trace structural coupling** — PROCLAIM courtroom transcripts (DD-700) could use compiler-guaranteed trace generation

### Design Pattern: "Compile-Once, Verify-Everywhere"
The core insight for our system: **define verification policies as a DSL, compile to all enforcement points**. This eliminates the drift problem where inference-level safety checks diverge from agent-level checks.

### Concrete Adoption Path
1. **Phase 1**: Define signal vocabulary (jailbreak, PII, hallucination confidence) as Signal blocks
2. **Phase 2**: Compile to inference routing (model selection) + agent orchestration (verification gates)
3. **Phase 3**: Add protocol boundary gates (MCP tool calls, inter-agent delegation)
4. **Phase 4**: Infrastructure artifacts (Kubernetes policies, sandbox configs)

## Cross-References
- **KE-104**: Complete Verification Architecture — this paper provides the cross-layer compilation mechanism
- **DD-698** (AEGIS): Forensic signals → natural DSL Signal candidates
- **DD-699** (Dual-State): Guard/recovery states → Decision_Tree branches
- **DD-700** (PROCLAIM): Courtroom audit → structural trace generation
- **CR#321**: Identified cross-layer verification as gap — this paper fills it
- **DD-702** (DOVA): Complementary — DOVA's deliberation layer + this DSL's verification layer
- **DD-689** (Sherlock): Selective verification → Signal_Group for verification depth selection

## Key Quotes
- "A threshold change in the DSL source propagates to every target on recompilation—the property that is hardest to maintain when each layer is coded independently."
- "The DSL audits decisions given signal scores, not signal correctness. A jailbreak classifier returning 0.05 on an actual jailbreak produces a clean trace leading to a wrong decision."
- "The trace structure is generated from the same AST that generates the routing logic. It is not possible for the trace to describe a different decision tree than the one that executed."

---
*Scout DD-701 | 2026-04-09 | Verification Orchestration Research Sprint*
