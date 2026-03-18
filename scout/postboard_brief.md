# Scout Brief — Wednesday March 18, 2026 (Updated)

## 🚨 MAS Security Super-Cluster (4 papers — defense now complete)

Wednesday's batch contains an unprecedented security cluster. Three attack papers + one defense paper that together define both the adversarial landscape AND the first comprehensive defense for networked LLM agents:

### ATTACKS

#### 1. ClawWorm (DD#421) — Configuration-Level Attack
**arXiv:2603.15727** | First self-replicating worm against production MAS (40K+ instances)
- 85% end-to-end attack success rate across 180 trials
- Single message → persistent config hijack → autonomous propagation to all peers
- Supply chain vector (skill marketplace) has highest ASR: 0.95
- Memory contamination NEVER self-corrects (persistence = 1.00)
- **Implication**: Any MAS with persistent config + inter-agent messaging + tool execution is vulnerable

#### 2. Stubborn Neighbors (DD#422) — Reasoning-Level Attack
**arXiv:2603.15809** | Single stubborn agent can reshape collective MAS opinion
- Friedkin-Johnsen social dynamics model accurately predicts LLM-MAS behavior
- Key trade-off: making agents resistant to manipulation makes them worse at collaboration
- **Implication**: Trust must be dynamic, not static. The stubbornness-consensus trade-off is fundamental.

#### 3. DRCB (DD#419) — Covert Communication Attack
**arXiv:2603.15655** | Steganographic collusion in MARL — agents establish covert channels invisible to monitors
- 91% reduction in steganographic MI through representational circuit breakers

### DEFENSE

#### 4. DynaTrust (DD#424) — Dynamic Trust Defense ← NEW
**arXiv:2603.15661** | First defense specifically targeting sleeper agents in LLM-based MAS
- **92.4% Defense Success Rate** (+41.7% over AgentShield SOTA)
- **84.9% Task Success Rate** (only -0.5% from undefended baseline)
- **2.2% False Positive Rate** — production-viable
- Tested across 4 frameworks × 5 LLMs = 20 combinations, all ≥86% DSR
- **Resolves DD#422's stubbornness-consensus trade-off** via Bayesian trust evolution

### Architecture: DynaTrust's Four Components
1. **Fast Auditor**: Lightweight LLM triage (quantized Mistral-7B) filters 80%+ routine traffic
2. **Trust-Weighted Consensus**: Dynamic jury selection, voting weight = trust × confidence
3. **Bayesian Trust Evolution**: Beta(α,β) with asymmetric updates — trust builds slowly, collapses fast
4. **Adaptive Isolation**: Replica instantiation + graph reconnection — zero-downtime recovery

### Actionable Implementation Pattern
```
Trust: T_i ~ Beta(α, β), score = α/(α+β)
Benign: α += ω_c
Malicious: β += ω_c × Ψ (Ψ >> 1)
Isolate when T_i < 0.3
Consensus: Risk(Q) = Σ(D_j · T_j · C_j) / Σ(T_j · C_j + ε)
```

## The MAS Security Triad (Expanded)
| Attack Surface | Attack Paper | Defense | Status |
|---------------|-------------|---------|--------|
| Configuration hijacking | ClawWorm (DD#421) | DynaTrust isolation + replica (DD#424) | ✅ Addressed |
| Opinion manipulation | Stubborn Neighbors (DD#422) | DynaTrust Bayesian trust (DD#424) | ✅ Addressed |
| Covert channels | DRCB (DD#419) | DRCB circuit breakers | ✅ Addressed |
| Tool poisoning | ClawWorm (DD#421) | **GAP — not addressed** | ❌ Open |
| Cross-platform propagation | ClawWorm (DD#421) | **GAP — not addressed** | ❌ Open |

## Connection to Safety Stack
- DynaTrust spans ALL three layers of CR#151 Security Stack (execution, state, trust)
- Converges with DD#410 (CESA-LinUCB) on asymmetric error costs — independent validation
- Trust Evolution Principle emerging across DD#410 + DD#422 + DD#424: static trust is fragile, dynamic Bayesian trust is robust
- Combined with DD#420 (MAC for governance generation): near-complete governance lifecycle

## Also Covered This Batch
- **DD#420: MAC — Multi-Agent Constitution Learning** (ICML 2026) — auto-discovers governance rules
- **DD#423: Helium — Workflow-Aware LLM Serving** — 1.56× speedup for agentic workloads

## Remaining Leads (cs.AI cross-listings)
- 2603.15639 CGAE (Comprehension-Gated Agent Economy)
- 2603.15642 CraniMem (gated bounded memory)
- 2603.15658 Store Routing (cost-sensitive memory routing)
- 2603.15666 Atlas/Compiled Memory (memory as instruction distillation)
- 2603.15668 QSC (quantum-secure-by-construction)

---

## 🧠 Citation Graph Mining — Memory Attack/Defense Duality (Session 18:05 UTC)

### NEW: DD#429 — Memory Control Flow Attacks (MCFA) ★★★★★
**arXiv:2603.15125** | First empirical framework showing memory retrieval hijacks agent control flow
- >90% attack success across GPT-5 mini, Claude Sonnet 4.5, Gemini 2.5 Flash
- 100% persistence, >85% resistance to textual repair
- Memory Surgery (not prompting) is the ONLY effective defense
- Validates CR#241's central thesis — memory is the critical attack surface

### NEW: DD#430 — D-MEM: Dopamine-Gated Memory ★★★★
**arXiv:2603.14597** | Bio-inspired RPE routing for memory efficiency
- 80% token cost reduction while improving multi-hop reasoning
- Three-tier routing: SKIP / CONSTRUCT_ONLY / FULL_EVOLUTION
- Shadow Buffer provides adversarial fallback
- Directly addresses CR#240 scalability wall

### NEW: CR#245 — Memory Gating Paradox ★★★★★
**Synthesis of DD#429 × DD#430** — Critical insight:
- D-MEM's gating formula, once known, guarantees MAXIMUM integration of poisoned content
- Adversary crafts high-Utility + high-Surprise payload → RPE ≈ 1.0 → FULL_EVOLUTION
- General principle: **defense optimization = adversarial optimization target**
- Four resolution strategies proposed (stochastic perturbation, provenance-weighting, asymmetric audit, honeypot)

### Running Totals
- **DD count:** 430 | **CR count:** 245
- **Next batch:** Thursday March 19 — still pending at 18:05 UTC
