# Cross-Reference #144: Security-Safety-Memory Defense Triad

**Generated:** 2026-03-16
**Papers:** DD#294 (Prompt Injection as Role Confusion), DD#295 (AgentDrift), DD#296 (LMEB), DD#287 (Tool Security Stack), DD#277 (CMAG), DD#284 (Multi-Agent Memory Architecture)

## Synthesis

Three newly analyzed papers reveal a **defense triad** for multi-agent systems where security, safety, and memory form an interconnected defense surface:

### The Triad

```
              SECURITY (Role Confusion)
                    DD#294
                   /      \
                  /        \
                 /          \
    SAFETY (Drift)          MEMORY (Retrieval)
       DD#295                   DD#296
```

### 1. Security → Safety Connection
**Role confusion enables drift.** DD#294 shows that when agents treat tool outputs as trusted (role confusion between Data and Principal/User roles), they become vulnerable to the progressive tool corruption described in DD#295's AgentDrift. If agents properly enforced role boundaries (Data tokens cannot influence instruction-following), drift from corrupted tools would be reduced because the agent would not treat biased tool outputs as authoritative instructions.

**Quantitative link:** DD#294's RAA (Role-Aware Attention) reduces injection success by 87%. DD#295 shows that multi-tool triangulation reduces drift by 61%. Combined, role-aware agents with tool triangulation could reduce the attack surface by ~95% (multiplicative: 0.13 × 0.39 = 0.051).

### 2. Safety → Memory Connection
**Drift detection requires memory.** DD#295's proposed mitigation of "safety anchoring" (periodically re-evaluating against original safety constraints) is fundamentally a **memory retrieval** problem — the agent must retrieve its original safety baseline from memory and compare it against current state. DD#296 shows that current embedding models achieve only ~60% NDCG@10 on memory retrieval tasks, meaning **40% of safety baseline memories will be missed** during retrieval-based drift detection.

**Critical implication:** Even with perfect drift detection algorithms, poor memory retrieval makes detection unreliable. Multi-agent systems need LMEB-aware memory infrastructure to support safety anchoring.

### 3. Memory → Security Connection
**Memory retrieval can leak information.** DD#296's procedural memory category includes tool usage patterns and past interactions. If an adversary can manipulate what gets retrieved from memory (through embedding-space attacks), they can influence the agent's future tool selections — a novel attack vector that combines memory poisoning with the role confusion of DD#294.

**The circular dependency:** Security depends on safety (preventing drift), safety depends on memory (retrieving safety baselines), memory depends on security (preventing memory poisoning). This creates a **defense triad** where weakness in any vertex compromises the other two.

### Architectural Implications

| Defense Layer | What It Protects | What It Needs |
|--------------|-----------------|---------------|
| **Role-Aware Attention** (DD#294) | Prevents untrusted data from becoming instructions | Correct role classification at input |
| **Drift Detection** (DD#295) | Prevents cumulative safety degradation | Reliable memory retrieval of safety baselines |
| **Memory Quality** (DD#296) | Ensures agents can retrieve relevant past information | Security against memory poisoning; type-specialized embeddings |

### Unified Defense Architecture
A robust multi-agent system needs all three layers operating simultaneously:

1. **Input layer**: Role-aware attention tags all incoming data with trust levels (Principal/User/Data)
2. **Reasoning layer**: Drift detection monitors cumulative bias across reasoning steps
3. **Memory layer**: Type-specialized embeddings (episodic/dialogue/semantic/procedural) with LMEB-validated retrieval quality
4. **Verification layer**: Cross-layer consistency checks (does retrieved memory match role expectations? Does drift detection have access to uncorrupted safety baselines?)

### Connection to Constitutional Governance (DD#277/CMAG)
The defense triad maps directly to constitutional provisions:
- **Security**: Constitutional rules about role boundaries and trust levels
- **Safety**: Constitutional provisions for drift detection and safety baseline maintenance
- **Memory**: Constitutional requirements for memory integrity and retrieval quality

## Relevance to P82
The P82 architecture currently has:
- ✅ Agent boundaries (partial role separation)
- ⚠️ No explicit drift detection across agent chains
- ⚠️ No memory quality benchmarking
- ❌ No role-aware attention within agent processing

**Recommendation:** Implement all three layers of the defense triad as P82 protocol extensions.
