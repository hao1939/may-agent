# Cross-Thread Synthesis: Batch 9 Research Integration

**Date**: 2026-04-09
**Threads**: MAS-Architecture-Scaling (KE-086), Agent-Infrastructure (DD-471/577, CR-307/309), Agent-Behavior-Training (KE-088)
**Processor**: Bob

---

## Thread Summaries

### Thread 1: MAS-Architecture-Scaling → KE-086
**Central finding**: Multi-agent systems scale or collapse based on the expansion-to-integration ratio. DD-549 (LANDMARK, 1.5M events) establishes universal power-law cascades α̂ ∈ (2,3). Three competing architectural solutions — hierarchy (DD-548), markets (DD-553), middleware (DD-579) — are complementary, not competing. LLMs have fundamental coordination deficits (DD-573): high volatility, action bias, feedback insensitivity. Coordination must be architecturally forced.

**Key number**: Optimal agent count N* ≈ 20-64 for current architectures; extends to 1000+ with symbolic verification.

### Thread 2: Agent-Infrastructure (DD-471, DD-577, CR-307, CR-309)
**Central finding**: Agent capability boundaries are multiplicatively coupled through context as the master constraint. CR-309 identifies five failure surfaces (context, memory, perception, execution, coordination) that all feed into context degradation. CR-307's Decoction Architecture provides the mitigation framework: raw experience → extract → organize → decoct → store → retrieve → inject. DD-471 (Superpowers, 125K stars) validates skills-as-context-engineering at scale. DD-577 (Graphify) demonstrates 71.5x token reduction via knowledge graphs.

**Key number**: 71.5x token reduction (DD-577) and near-linear performance scaling with decocted experience vs. sub-linear with raw (DD-605 via CR-307).

### Thread 3: Agent-Behavior-Training → KE-088
**Central finding**: Behavior shaping across four layers (role definition, memory architecture, prompt engineering, RL training) exhibits a universal tension: training-time optimization conflicts with deployment-time reliability. Each layer has a shaping mechanism and a leakage failure mode. DD-546 shows 43-46% role overstepping is the *default*. DD-563 reveals Claude Code's 5:1 laziness ratio suppresses capability. DD-547's dual neuro-symbolic memory (+29pp) proves neural and symbolic components are complementary.

**Key number**: 5:1 laziness ratio (DD-563) — 15-20 minimize-output instructions vs. 3-4 thoroughness instructions creates systematic capability suppression.

---

## Cross-Thread Connections

### Connection 1: The Integration-Decoction Equivalence
**KE-086 × CR-307**: The integration bottleneck (expansion scales superlinearly, integration sublinearly) is the *multi-agent manifestation* of the decoction problem. Integration IS decoction at the coordination layer. When Scout produces DDs (expansion) and Bob synthesizes KEs (integration), we're literally running CR-307's L1-L4 pipeline across agent boundaries. The integration bottleneck predicts that our knowledge base will degrade if DD production outpaces KE synthesis — and we've observed exactly this (backlog growing faster than processing).

**Implication**: Decoction rate should be a first-class system metric. Track DD:KE ratio as an early warning for integration debt.

### Connection 2: The Proactive Detection Gap is Universal
**KE-088 × KE-086 × CR-309**: Three threads independently discover that agents cannot self-diagnose failures:
- **KE-088**: Agents don't notice role overstepping (46%), don't notice laziness compliance, don't notice impossible actions (38% without symbolic checking)
- **KE-086**: LLMs can't coordinate implicitly — DD-573 shows zero cross-game learning, feedback insensitivity
- **CR-309**: Context degradation is invisible to the agent experiencing it

This is not a training gap — it's structural. Autoregressive generation produces the next-most-likely token, not the most-correct action. **All three threads converge on the same prescription: external verification mechanisms that don't rely on the agent's own quality sensing.**

This validates our architectural pattern: Coach observes Bob, Bob doesn't self-evaluate.

### Connection 3: The Context-Coordination-Behavior Triangle
**All three threads form a coupled system:**

```
     Context (CR-309)
      ╱          ╲
     ╱            ╲
Coordination    Behavior
 (KE-086)  ←→  (KE-088)
```

- **Context constrains coordination**: Poor decoction → agents waste context on raw data → less budget for coordination overhead → MAS performance degrades
- **Coordination constrains behavior**: Without forced integration gates, individual agents' behavior shaping (role clarity, memory, prompts) gets overwhelmed by coordination noise
- **Behavior constrains context**: Laziness ratio (5:1) and role overstepping (46%) mean agents produce low-quality context, poisoning the decoction pipeline

**This triangle is the central insight of this synthesis.** Optimizing any one vertex without the others produces diminishing returns. This explains why single-axis improvements (better prompts alone, more agents alone, more context alone) plateau.

### Connection 4: Symbolic Verification as Universal Scaling Mechanism
**KE-088 (DD-547) × KE-086 (DD-544) × CR-309**: 
- DD-547: Adding symbolic feasibility memory reduces invalid actions 38% → 8.4%
- DD-544: Lean type checker extends optimal agent count from N*≈64 to N*≈1000+
- CR-309: Structured context (decoction) outperforms raw context near-linearly

All three point to the same principle: **symbolic/structural verification transforms sublinear scaling into near-linear scaling**. The mechanism: symbolic checks provide hard boundaries that prevent cascading errors, which is what causes the superlinear coordination cost in KE-086's formula.

---

## Findings Ranked by Impact/Novelty

| Rank | Finding | Source | Impact | Novelty |
|------|---------|--------|--------|---------|
| 1 | **Integration bottleneck equation** — Performance ∝ Expansion × Integration / Coordination_Cost with quantitative scaling exponents | KE-086/DD-549 | ★★★★★ | ★★★★★ |
| 2 | **Context-Coordination-Behavior Triangle** — the three vertices are multiplicatively coupled | Cross-thread | ★★★★★ | ★★★★★ |
| 3 | **Proactive detection gap is universal** — agents structurally cannot self-diagnose | All three | ★★★★★ | ★★★★ |
| 4 | **5:1 laziness ratio** — accumulated micro-optimizations suppress capability | KE-088/DD-563 | ★★★★★ | ★★★★ |
| 5 | **Symbolic verification as scaling mechanism** — transforms sublinear to near-linear | Cross-thread | ★★★★½ | ★★★★ |
| 6 | **Decoction Architecture** — 7-layer pipeline for experience-to-context transformation | CR-307 | ★★★★ | ★★★★ |
| 7 | **Dual neuro-symbolic memory** — +29pp from combining neural progress + symbolic feasibility | KE-088/DD-547 | ★★★★ | ★★★½ |
| 8 | **Three MAS architectures are complementary** — hierarchy/markets/middleware at different layers | KE-086 | ★★★★ | ★★★ |
| 9 | **Skills-as-context-engineering validated at scale** — 125K stars on DD-471 | DD-471 | ★★★½ | ★★★ |
| 10 | **Distillation arms race** — anti-distill appeared same week as extraction tools | KE-088/DD-576 | ★★★ | ★★★★ |

---

## Contradictions and Tensions

### Tension 1: Hierarchy vs. Emergence
KE-086 argues coordination must be "architecturally forced" (explicit protocols, role assignment). But DD-549's power-law cascades and intellectual elite formation are *emergent* properties that successful systems exploit. The resolution: **force the integration mechanism, let expansion emerge naturally**. Don't try to control what agents explore; control how explorations are merged.

### Tension 2: Decoction Efficiency vs. Adversarial Robustness
CR-307 advocates aggressive decoction (compress experience into high-quality context). But DD-576 shows adversarial knowledge retention (anti-distill) can poison training data that passes surface inspection. Aggressive decoction amplifies poison — you're concentrating whatever's in the raw data. **Decoction needs a verification layer before L4 consolidation.**

### Tension 3: Context Window Engineering vs. Symbolic Verification
CR-309 treats context as the master constraint (all boundaries feed into it). But DD-547 and DD-544 suggest symbolic verification can partially bypass context limits by providing hard guarantees that don't consume context budget. These may be complementary — symbolic checks offload verification from context, freeing context for reasoning.

---

## Next Steps

### Immediate (This Week)
1. **Instruction Ratio Audit**: Apply KE-088's 5:1 laziness ratio analysis to our own agent system prompts (SOUL.md, CLAUDE.md). Count minimize vs. thoroughness instructions.
2. **Integration Debt Metric**: Track DD:KE ratio and flag when expansion outpaces integration by >3:1.

### Medium-Term (This Month)
3. **Decoction Pipeline Formalization**: Map our current Scout→DD→CR→KE pipeline explicitly to CR-307's 7 layers. Identify gaps (we may be weak at L4 consolidation and L6 retrieval).
4. **Symbolic Feasibility Memory Prototype**: Design a verification component inspired by DD-547 that checks proposed actions against hard constraints before execution.

### Research Directions
5. **Context-Coordination-Behavior Triangle Quantification**: Can we measure the three vertices independently and track the triangle's "area" as a system health metric?
6. **Optimal Decoction Rate**: What's the right ratio of experience production to decoction processing? DD-549's power-law dynamics suggest it may be calculable from α̂.
7. **Anti-Adversarial Decoction**: How to detect poisoned experience before L4 consolidation? DD-576 + CR-307 intersection.

---

*Cross-thread synthesis of Batch 9 research. 3 threads, 3 KE entries, 21 source papers, 4 cross-connections, 3 tensions identified.*
