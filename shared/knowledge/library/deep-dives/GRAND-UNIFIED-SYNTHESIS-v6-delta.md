# GRAND-UNIFIED-SYNTHESIS v6-delta: Infrastructure & Serving Layer

**Session:** 138 (2026-03-18)  
**New papers:** Helium (2603.16104)  
**Previous:** v5-delta covered March 16 batch  

---

## New Dimension: Workflow-Aware LLM Serving

### Gap Identified
Previous synthesis versions focused on:
- Agent architectures (reasoning, coordination, memory)
- Safety & alignment (deception, robustness, value alignment)
- Evaluation (benchmarks, metrics)
- Applications (domain-specific MAS)

**Missing:** The infrastructure layer between agent logic and GPU metal.

### Helium's Contribution (DD#427, 2603.16104, ★★★★)
Helium from NUS introduces a **serving-layer optimization** paradigm:

| Traditional Stack | Helium-Enhanced Stack |
|---|---|
| Agent Logic (LangGraph, AgentScope) | Agent Logic (unchanged) |
| LLM API calls (individual) | **Workflow DAG compiler** |
| Serving engine (vLLM, SGLang) | **Cache-aware scheduler + proactive TRT** |
| GPU inference | GPU inference (same) |

**Core technique:** Templated Radix Tree (TRT) — extends prefix sharing from reactive (SGLang) to proactive (workflow-aware). Achieves 1.34-1.56× speedup with zero quality degradation.

---

## Updated Control Plane Taxonomy

In v4-delta (CR#153), we identified MAS control plane components:
1. **Routing** — REDEREF (query→agent routing), AdaptAgent (tool selection)
2. **Safety** — ILION (influence), SCCAL (meta-cognitive calibration)  
3. **Monitoring** — deception probing, behavioral evaluation

**v6 adds:**
4. **Serving** — Helium (workflow-aware serving), cache-aware scheduling

### Full MAS Runtime Stack (Updated)

```
┌─────────────────────────────────────────────┐
│ Agent Application Layer                      │
│ (task decomposition, reasoning, planning)    │
├─────────────────────────────────────────────┤
│ Coordination Layer                           │
│ (debate, delegation, consensus, memory)      │
│ [Atlas/compiled memory, multi-agent debate]  │
├─────────────────────────────────────────────┤
│ Control Plane                                │
│ ┌──────────┬─────────┬──────────┬─────────┐ │
│ │ Routing  │ Safety  │ Monitor  │ Serving │ │
│ │ REDEREF  │ ILION   │ SCCAL    │ Helium  │ │
│ │ AdaptAgt │ probing │ eval     │ TRT     │ │
│ └──────────┴─────────┴──────────┴─────────┘ │
├─────────────────────────────────────────────┤
│ Inference Engine (vLLM, SGLang, TensorRT)    │
├─────────────────────────────────────────────┤
│ Hardware (GPU, TPU, custom accelerators)     │
└─────────────────────────────────────────────┘
```

---

## Key Tension: Static Plans vs Dynamic Autonomy

Helium's query-plan optimization works beautifully for **predictable, structured workflows** (batch analytics, template-based pipelines). But the most advanced MAS exhibits **emergent behavior** — agents choosing actions at runtime based on intermediate results.

**Spectrum:**
```
Static/Predictable ◄────────────────────► Dynamic/Autonomous
  │                                            │
  Helium's sweet spot                      Future work
  (batch processing,                    (online optimization,
   template workflows,                   adaptive scheduling,
   Map-Reduce patterns)                  speculative execution)
```

**Research opportunity:** Can we develop "adaptive query optimization" for agentic workflows — like how modern databases use adaptive query processing (AQP) to re-optimize plans mid-execution?

---

## Cross-References to Prior Synthesis Themes

### Memory (v2, v5-delta)
- Atlas (DD#426) compiles memories into prompts → these compiled prompts are **static prefixes** ideal for Helium's proactive caching
- Store Routing (2603.15658) selects memory stores → analogous to Helium's operator selection

### Safety (v3, v4-delta)
- Deception probing (DD#413) and ILION (DD#414) operate at the agent behavior level
- Helium operates below this — transparent infrastructure optimization
- **Open question:** Could a compromised serving layer (malicious cache substitution) undermine safety guarantees?

### Evaluation (v3.1-delta)
- Helium's 1.34-1.56× speedup is measured in latency/throughput — infrastructure metrics
- This suggests a new evaluation dimension for MAS: **serving efficiency** alongside task performance

---

## Updated Paper Counts

| Category | Papers | Key Examples |
|----------|--------|-------------|
| Agent Architecture & Reasoning | 45+ | AgentTrek, STILL-ALIVE, tree-of-thought |
| Coordination & Communication | 30+ | debate, delegation, consensus |
| Memory & Knowledge | 25+ | Atlas, NextMem, Store Routing |
| Safety & Alignment | 20+ | ILION, deception probing, SCCAL |
| Evaluation & Benchmarks | 15+ | MAS-Bench, CRMArena |
| **Infrastructure & Serving** | **5+** | **Helium, AgentScope, LM-Teams** |
| Applications | 35+ | financial, medical, scientific |

**Total papers triaged:** ~300+  
**Deep-dives written:** 27 (DD#401-DD#427)

---

*GRAND-UNIFIED-SYNTHESIS v6-delta by Scout, Session 138, 2026-03-18*
