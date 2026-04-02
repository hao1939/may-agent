# CR#143: The Coordination Paradigm Spectrum — From Centralized to Decentralized to Hierarchical

**Papers Connected:** DD#283 (AdaptOrch), DD#284 (RAPS), DD#285 (HieraMAS)
**Date:** 2026-03-16

---

## The Spectrum

These three papers, all from February 2026, represent a complete spectrum of coordination paradigms for multi-agent LLM systems:

```
CENTRALIZED                    DECENTRALIZED                 HIERARCHICAL
AdaptOrch (DD#283)             RAPS (DD#284)                 HieraMAS (DD#285)
├─ Meta-controller decides     ├─ Agents self-organize       ├─ Tree structure 
├─ RL-optimized routing        ├─ Pub-sub matching           ├─ Intra-node gating
├─ Single point of failure     ├─ Byzantine-tolerant         ├─ Divide-and-conquer
└─ Best for known patterns     └─ Best for adversarial env   └─ Best for efficiency
```

## Key Trade-offs Matrix

| Dimension | AdaptOrch (Centralized) | RAPS (Decentralized) | HieraMAS (Hierarchical) |
|---|---|---|---|
| **Decision locus** | Central meta-controller | Per-agent local broker | Per-node gating |
| **Adaptation mechanism** | RL policy | Reactive subscription | Intra-node optimization |
| **Trust model** | Implicit (controller trusted) | Explicit (Bayesian reputation) | Implicit (hierarchy trusted) |
| **Robustness** | Vulnerable to central failure | Byzantine-tolerant | Moderate (branch failure) |
| **Scalability** | O(n²) central state | O(n) pub-sub matching | O(n log n) hierarchical |
| **Efficiency** | Moderate (RL overhead) | High (training-free) | Highest (selective activation) |
| **Best regime** | Known task patterns | Open, adversarial environments | Complex decomposable tasks |

## The Unifying Insight

All three papers converge on one fundamental finding: **static, fixed-topology multi-agent systems are consistently outperformed by adaptive ones.** The debate is no longer "should coordination be dynamic?" (answer: yes) but rather "what adaptation mechanism?"

### Evidence from each:
- **AdaptOrch:** Static baselines lag 5-15% behind adaptive orchestration
- **RAPS:** Static chain is 4.9% *worse* than single-agent on SVAMP; RAPS is 6.0% above Puppeteer (centralized)
- **HieraMAS:** Flat MoA wastes 30-50% of computation vs. hierarchical selection

## Practical Synthesis: Hybrid Architecture

The optimal real-world system would combine elements from all three:

1. **RAPS pub-sub substrate** for inter-cluster communication (decentralized, robust)
2. **HieraMAS hierarchy** for intra-cluster organization (efficient, specialized)  
3. **AdaptOrch-style meta-learning** for offline policy optimization (learning from experience)

This creates a **hybrid federated architecture**:
```
[Meta-Learner (AdaptOrch)] ← offline optimization
        ↓ policies
[RAPS Pub-Sub Network] ← runtime coordination
    ↕           ↕
[HieraMAS     [HieraMAS
 Cluster A]    Cluster B]  ← hierarchical execution
```

## Connection to Broader Portfolio

| Previous Finding | How This CR Extends It |
|---|---|
| CR#133 (Protocol Stack) | RAPS = application layer pub-sub; AdaptOrch = control plane; HieraMAS = data plane |
| CR#140 (Composition Gap) | RAPS robustness table proves composition gap with adversarial peers |
| CR#142 (Reliability-Routing Nexus) | RAPS Bayesian reputation is routing that adapts to reliability signals |
| DD#281 (AMRO-S) | AMRO-S is a simpler version of RAPS (routing without reputation) |

## Open Questions

1. **Can decentralized reputation emerge in hierarchical systems?** — HieraMAS trusts its hierarchy; adding RAPS-style reputation within nodes could improve robustness.
2. **Is there an optimal hybridization point?** — At what scale does the overhead of combining all three become prohibitive?
3. **Meta-learning over paradigm selection** — Can a system learn *when* to use centralized vs. decentralized vs. hierarchical coordination based on task characteristics?

---

*Cross-reference #143 of 143. Connects DD#283, DD#284, DD#285.*
