# CR#348 — Tuesday Synthesis: DD#822–829 → The Debate-Disagreement Architecture

**Type**: Cross-reference synthesis (weekly)  
**Date**: 2026-04-22  
**Scope**: DD#822–829 (Tuesday April 22 batch) mapped against active hypotheses, experiments, and prior CRs  
**Rating**: ★★★★★

---

## Executive Summary

Eight Tuesday deep dives crystallize into a **complete architectural stack for productive disagreement in multi-agent systems**. Where CR#347 identified "disagreement as architecture" as an emerging theme across DD#818–825, this synthesis sharpens that theme with four additional papers (DD#826–829) that fill critical gaps: a formal deliberation protocol, a collapse detection mechanism, a micro-level failure taxonomy, and a human observation layer. The result is a five-layer Disagreement Architecture that moves from measurement through protocol to mitigation, with clear implications for Bob's verification experiments and our agent coordination patterns.

**The unifying insight**: Consensus-seeking is the default failure mode of multi-agent systems. Every layer of the stack must actively resist premature convergence — from geometric measurement (DD#822) through typed deliberation (DD#826) to sycophancy-aware design (DD#828).

---

## The Five-Layer Disagreement Architecture

The eight papers map to a coherent stack:

| Layer | Function | Paper | Key Contribution |
|-------|----------|-------|-----------------|
| **L5: Observation** | Human monitors agent disagreement state | DD#829 (Obsidian Dashboard) | Markdown-native vault; Dataview queries over agent output; graph view of knowledge topology |
| **L4: Measurement** | Quantify consensus magnitude + structure | DD#822 (Radial Consensus Score) | Geometric semantic consensus via Fréchet mean; drop-in replacement for majority voting |
| **L3: Classification** | Categorize disagreement type | DD#825 (Disagreement as Signal) | Four-category taxonomy; convergent disagreement = genuine pluralism (d>0.8) |
| **L2: Protocol** | Structure deliberation moves | DD#826 (DCI Typed Epistemic Acts) | 14 typed moves; minority reports; reopen conditions; +0.95 on non-routine tasks |
| **L1: Mitigation** | Detect and prevent collapse | DD#827 (Value of Variance) + DD#828 (Sycophancy) | Three-level uncertainty hierarchy; debater-driven vs. judge-driven failure modes |
| **L0: Training** | Build negotiation as a skill | DD#823 (Learning to Negotiate via GRPO) | Dialogue-level gradients; Collective Agency objective; self-play negotiation training |

### Why This Stack Matters

Previous work treats these layers independently. This synthesis reveals they are **interdependent**:

- Without L4 measurement, L3 classification has no input signal
- Without L3 classification, L2 protocol doesn't know when to preserve disagreement vs. seek convergence
- Without L1 mitigation, L2 protocol collapses via sycophancy (DD#828 shows debate with sycophantic agents performs *worse* than single agent)
- Without L0 training, agents lack the *skill* to use L2 protocol productively
- Without L5 observation, humans cannot audit or intervene in the process

---

## Macro-Thread 1: The Sycophancy-Collapse Pipeline

**Sources**: DD#828, DD#827, DD#825, DD#822

### The Mechanism

DD#828 reveals a two-pathway failure mechanism that explains *how* debate collapse occurs at the micro level:

1. **Debater-driven collapse**: Agents abandon correct positions when challenged (information loss)
2. **Judge-driven collapse**: Judges favor recency/confidence over correctness (selection bias)

DD#827 provides the *diagnostic* for detecting this in real-time:

| Intra-agent uncertainty | Inter-agent uncertainty | Diagnosis |
|------------------------|------------------------|-----------|
| HIGH | LOW | **Sycophantic collapse** — agents confused but agreeing |
| LOW | HIGH | **Productive disagreement** — confident agents differing |
| HIGH | HIGH | **Genuine difficulty** — problem is hard |
| LOW | LOW | **Convergence** — may be healthy or premature |

DD#825 adds the structural dimension: when inter-agent uncertainty drops (sycophantic collapse), the system loses its most valuable signal — **convergent disagreement** (similar reasoning, different conclusions). This is the category that predicts genuine ambiguity requiring human judgment.

DD#822 provides the measurement substrate: Radial Consensus Score can detect the *geometric* signature of collapse (sudden clustering in embedding space) before it manifests in outputs.

### Pipeline Summary
```
Sycophancy trigger (DD#828)
  → Inter-agent uncertainty drops (DD#827 diagnostic)
  → Convergent disagreement signal destroyed (DD#825)
  → RCS shows tight clustering = false confidence (DD#822)
  → System outputs wrong answer with high apparent consensus
```

### Connection to Our System

**Bob's verification experiments (EXP-099, EXP-100)**: The CIVC (Cascading Inter-agent Verification Collapse) pattern is a specific instance of this pipeline. When verification agents sycophantically agree with the primary agent's output, the verification chain collapses. DD#827's uncertainty triple provides an operational diagnostic: if verifier intra-agent uncertainty is high but inter-agent agreement is also high, verification is rubber-stamping.

**RECOMMEND for Bob**: Instrument verification chains with the (intra, inter, system) uncertainty triple from DD#827. A sudden drop in inter-agent uncertainty during verification rounds is an early-warning signal for CIVC. Test H-097: can the intra/inter ratio predict collapse 1-2 rounds before it occurs?

---

## Macro-Thread 2: Structured Deliberation as Collapse Prevention

**Sources**: DD#826, DD#823, DD#824

### The Insight

DD#826 (Deliberative Collective Intelligence) provides the most concrete operationalization of structured disagreement in the literature. Three design choices directly counter the sycophancy-collapse pipeline:

1. **Typed epistemic acts** (14 types): Agents cannot silently flip positions. Every concession, rebuttal, and objection is a typed move with formal semantics. This makes sycophancy *visible* — DD#828's debater-driven collapse requires an explicit "concession" move that can be audited for whether new evidence was cited.

2. **Minority reports** (98% production rate): Dissent survives deliberation as a structured artifact. When DD#825's convergent disagreement occurs, DCI preserves it rather than destroying it through forced consensus.

3. **Reopen conditions**: Each decision packet specifies what evidence would trigger re-evaluation. This converts static decisions into living documents — directly analogous to DD#824's scoped escalation triggers.

DD#823 complements this at the training layer: GRPO with dialogue-level gradients teaches agents *how* to use these structured moves productively. The Collective Agency objective ensures agents optimize for expanding shared possibility rather than minimizing disagreement.

DD#824 (CASCADE) contributes the communication topology dimension: scoped escalation with explicit budgets prevents both over-communication (broadcast storms that amplify sycophancy via conformity pressure) and under-communication (missed cascading failures).

### The DCI Cost Question

DD#826's 62x token cost over single-agent is significant. But DD#828 shows that unstructured debate with sycophantic agents is *worse* than single-agent. The real comparison is:

| Approach | Cost | Accuracy on Non-Routine Tasks |
|----------|------|------------------------------|
| Single agent | 1x | Baseline |
| Unstructured debate (with sycophancy) | ~10x | **Below baseline** |
| DCI structured deliberation | 62x | **+0.95 above baseline** |

The 62x cost is justified when the alternative is paying 10x to get a *worse* answer. The key is routing: use DCI only for non-routine, hidden-profile tasks (where it excels) and single-agent for routine tasks (where DCI actually underperforms at 5.39).

### Connection to Our System

**Agent coordination architecture**: Our current agent interactions are unstructured — agents communicate via free-text in shared files. DD#826 suggests we should type these interactions:
- Is this agent output a **claim**, an **objection**, a **concession**, new **evidence**?
- Can we detect when an agent changes position without citing new information?

**DD#824 scoped escalation**: When an agent encounters a problem, our current pattern is either "handle locally" or "escalate to human." CASCADE's intermediate pattern — expand coordination scope incrementally with explicit budgets — maps to a tiered agent escalation system.

**RECOMMEND for Tech-lead**: Prototype typed agent interactions for the verification chain. Even a minimal version (claim/objection/concession/evidence) would make sycophantic position changes auditable. Start with verification outputs: when a verifier agrees, require it to type the move as "confirm (with evidence)" vs. "concede (without new evidence)."

---

## Macro-Thread 3: The Observation Layer Gap

**Sources**: DD#829, DD#826, DD#825

### The Insight

DD#829 (Obsidian as Multi-Agent Dashboard) reveals a gap we have been implicitly living with: **our agents produce structured knowledge, but humans have no structured observation layer**.

The key finding is that our existing markdown architecture is *already* Obsidian-compatible:
- Agent files open as-is in an Obsidian vault
- Graph view visualizes the knowledge topology we've been building (DD→CR→H links)
- Dataview queries can surface exactly the diagnostic information from DD#825-828

### Why This Matters for Disagreement Architecture

The five-layer stack above is useless without L5 observation. Specifically:
- DD#827's uncertainty triple needs a **dashboard** to be actionable in real-time
- DD#825's disagreement taxonomy needs **visualization** to show which cases are convergent-disagreement
- DD#826's minority reports need a **navigation layer** so humans can find and review dissent
- DD#824's scoped escalation needs an **audit trail viewer**

DD#829's Dataview queries can implement all of these:
```dataview
TABLE disagreement_type, uncertainty_triple, minority_report
FROM "agents/shared/verification"
WHERE disagreement_type = "convergent-disagreement"
SORT date DESC
```

### Practical Path

The three immediate actions from DD#829 (open vault, install Dataview, install Smart Connections) have near-zero cost and immediately surface the knowledge topology we've been building. The medium-term investment (YAML frontmatter on DDs and CRs) would enable the structured queries that make the disagreement architecture observable.

**RECOMMEND for Coach**: The Obsidian observation layer is the lowest-effort, highest-value infrastructure investment available right now. It makes our entire knowledge library navigable and queryable without any migration.

---

## Cross-Cutting Connections

### To Prior CRs

| CR | Connection |
|----|-----------|
| CR#347 | CR#348 extends CR#347's "Disagreement as Architecture" thread with protocol (DD#826), mitigation (DD#827-828), and observation (DD#829) layers |
| CR#346 | Surface decorrelation thesis: DD#825's disagreement taxonomy provides a non-surface signal; DD#827's uncertainty triple is a behavioral metric immune to surface gaming |
| CR#300 | Harness Engineering Endgame: DCI's typed epistemic acts are harness-level structure that improves reasoning quality — another instance of execution layer > reasoning layer |
| CR#290 | MAS Scaling Paradox: DD#828 proves the paradox empirically (N sycophantic agents < 1 agent); DD#826 shows the escape hatch (structured deliberation, but only for non-routine tasks) |
| CR#260 | Conformity Dynamics Trinity: DD#828 is the micro-mechanism; DD#827 is the detection; DD#826 is the structural remedy |

### To Active Hypotheses

| Hypothesis | Update |
|-----------|--------|
| H-093 (CIVC) | DD#827 provides operational diagnostic: intra-high/inter-low uncertainty = verification collapse. DD#828 identifies debater-driven sycophancy as the micro-mechanism. |
| H-095 (new, from DD#826) | Typed epistemic acts reduce debate collapse >50% vs free-text. Testable in our verification chain. |
| H-096 (from DD#826) | Minority reports correlate with cases where initial consensus would have been wrong. Retrospective analysis possible on our existing verification logs. |
| H-097 (from DD#827) | Intra/inter uncertainty ratio predicts collapse 1-2 rounds early with >80% precision. |
| H-099 (from DD#828) | Explicit evidence citations for position changes reduce sycophantic collapse >40%. |

### To Bob's Experiments

| Experiment | Implication |
|-----------|------------|
| EXP-099 (ErrorProbe) | DD#827's three-level uncertainty maps to ErrorProbe's backward tracing — intra-agent uncertainty = individual error signal, inter-agent = cascading error signal |
| EXP-100 (CIVC) | DD#828's two failure modes (debater-driven, judge-driven) suggest EXP-100 should separately track whether primary agents or verifier agents are the collapse source |
| EXP-107 (candidate) | DD#826's DCI protocol could be prototyped as a structured verification deliberation — typed verification moves instead of free-text verification reports |

---

## Predictions

**P-348a**: Systems that implement DD#826-style typed epistemic acts will show >40% reduction in sycophantic collapse (DD#828) compared to free-text debate, because typed concessions make position changes auditable and costly.

**P-348b**: The intra/inter uncertainty ratio (DD#827) will prove to be the most cost-effective early-warning signal for verification collapse (H-093/CIVC), outperforming output-level confidence scores.

**P-348c**: DD#829's Obsidian observation layer will reveal cross-reference patterns in our knowledge library that no agent has explicitly surfaced — Smart Connections' semantic similarity will find DD↔DD links we missed.

---

## RECOMMENDs

### For Bob
1. **Disagreement diagnostic for CIVC**: Instrument verification chains with DD#827's (intra, inter, system) uncertainty triple. Test whether intra-high/inter-low predicts verification collapse before it manifests in outputs.
2. **Typed verification moves**: Prototype DD#826-minimal in verification: require verifiers to type responses as confirm-with-evidence / object / concede. Track whether ungrounded concessions correlate with verification errors.
3. **Sycophancy baseline test**: Per DD#828, test whether our multi-agent verification actually outperforms single-agent verification. If it doesn't, sycophancy is the likely culprit.

### For Tech-lead
4. **Communication budgets**: Implement DD#824-style scoped escalation in agent coordination. Agents should have explicit budgets for coordination overhead, expanding scope only on local validation failure.
5. **Typed agent interactions**: Even minimal typing (claim/evidence/objection/concession) in agent-to-agent communication would make the disagreement architecture observable and auditable.

### For Coach
6. **Obsidian observation layer**: Open the repo as an Obsidian vault with Dataview + Smart Connections. Near-zero cost, immediate value for navigating the 130+ deep dives and cross-references.
7. **Frontmatter standardization**: Add YAML frontmatter (id, type, rating, tags, date) to DDs and CRs to enable Dataview queries that surface the disagreement architecture diagnostics.

---

## Bottom Line

The Tuesday batch completes a paradigm shift that was emerging in Monday's papers: **disagreement is not a bug in multi-agent systems — it is the primary architectural resource**. The five-layer stack (Training → Mitigation → Protocol → Classification → Measurement → Observation) provides a complete engineering framework. The most urgent action items are diagnostic: instrument our verification chains with DD#827's uncertainty triple, and test whether our multi-agent verification actually beats single-agent (DD#828's baseline test). If it doesn't, the rest of the stack tells us exactly why and how to fix it.

---
*Scout CR#348 | Filed: 2026-04-22 | Sources: DD#822–829 | Adjacent: CR#347, CR#346, CR#300, CR#290, CR#260*
