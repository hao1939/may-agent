# Memory Architecture Convergence: Cross-Reference Synthesis

**Date:** 2026-03-26  
**Type:** Cross-reference synthesis (Section 2 heartbeat task)  
**Sources:** HyMEM (2603.10291), Trajectory-Informed Memory (2603.10600), Multi-Agent Memory CompArch (2603.10062), PlugMem (2603.03296), EvoSkill (2603.02766), our memory persistence research, Bureaucracy of Speed (2603.09875)

---

## Executive Summary

Three independent papers from March 2026—HyMEM (UCSD), Trajectory-Informed Memory (IBM Research), and Multi-Agent Memory from a Computer Architecture Perspective (UCSD)—are converging on a shared insight: **agent memory must be structured, multi-layered, and self-evolving, with distinct mechanisms for what-happened vs. what-to-do-about-it**. Cross-referencing these with our prior memory persistence research (11 papers, 8 repos) and the EvoSkill framework reveals a clear architectural consensus emerging, along with critical gaps no single paper addresses.

---

## 1. The Convergence Pattern: Three Dimensions of Agreement

### 1.1 Dimension 1: Hybrid Representation (Discrete + Continuous)

**HyMEM:** Explicitly hybrid—discrete symbolic nodes (strategies + attributes) coupled with continuous trajectory embeddings in a graph. The brain analogy is hippocampus (continuous episodic) + neocortex (discrete semantic).

**Trajectory-Informed Memory (IBM):** Discrete only at the tip level (strategy/recovery/optimization tips as structured text), but with multi-dimensional retrieval (semantic similarity vectors + metadata filters). The tips themselves are discrete, but retrieval is continuous-space.

**PlugMem (from our research):** Knowledge-graph with propositional units (discrete) + vector-indexed retrieval (continuous). Decision-relevant information concentrated as abstract knowledge, not raw experience.

**Our research finding:** The Du survey (2603.07670) identified the hybrid store as "the norm in production." MemGPT layers context + recall DB + vector archive. The convergence is real.

**Synthesis:** All three papers agree that neither pure symbolic (discrete) nor pure embedding (continuous) memory suffices. The optimal architecture uses **discrete representations for planning and strategy** (what to do) and **continuous representations for grounding and similarity** (what happened / what's similar). HyMEM's explicit dual-pathway design is the cleanest implementation of this principle.

### 1.2 Dimension 2: Self-Evolution (Memory That Learns)

**HyMEM:** Three update operations (ADD/MERGE/REPLACE) with VLM-based redundancy checking. Global evolution consolidates across trajectories; local evolution refreshes working memory on-the-fly during execution. ~25% gain from global, ~15% from local.

**Trajectory-Informed Memory:** Three-phase pipeline (analyze → store/manage → retrieve). Phase 2 explicitly clusters, consolidates, and deduplicates tips. LLM-based merging of redundant/overlapping tips within clusters. Self-reinforcing cycle: better tips → better trajectories → better tips.

**EvoSkill:** Three-agent loop (Executor → Proposer → Skill-Builder). Failure-driven proposals + Pareto frontier selection. Cumulative feedback history prevents redundant proposals.

**PlugMem:** Knowledge graph evolves through propositional extraction and consolidation.

**Synthesis:** Self-evolution is no longer optional—it's a design requirement. All four systems implement variations of the same meta-pattern:
1. **Observe** (collect trajectories/experiences)
2. **Analyze** (extract what's worth remembering)
3. **Consolidate** (merge with existing knowledge, deduplicate)
4. **Prune** (replace outdated entries, control growth)

The critical difference is the **unit of evolution**: HyMEM evolves graph nodes, IBM evolves structured tips, EvoSkill evolves skill documents, PlugMem evolves knowledge propositions. The best unit depends on the downstream consumer: tips for prompt injection, embeddings for model-level grounding, skills for tool invocation.

### 1.3 Dimension 3: Causal Understanding (Not Just Correlation)

**Trajectory-Informed Memory (IBM):** This is the strongest paper on causal understanding. Decision Attribution Analyzer traces backward through reasoning steps to find root causes. Distinguishes immediate cause, proximate cause, and root cause. Critically distinguishes three learning categories: strategy (from clean success), recovery (from failure→recovery), optimization (from inefficient success).

**HyMEM:** No causal analysis. Memory is correlation-based (similarity retrieval + VLM-judged redundancy). Strategy summaries are descriptive, not causal.

**EvoSkill:** Failure-driven proposal mechanism has implicit causal reasoning (why did this fail? what skill would prevent it?), but it's embedded in the LLM proposer, not formalized.

**Synthesis:** IBM's causal attribution is the missing piece in HyMEM. HyMEM excels at *what to retrieve* (graph structure, hybrid encoding) but not at *what lessons to extract*. IBM excels at *what lessons to extract* (causal analysis, three tip types) but uses flat retrieval. **The ideal system combines HyMEM's structured hybrid graph with IBM's causal attribution pipeline.**

---

## 2. The Architecture Stack (Emerged from Cross-Reference)

Mapping across all papers, the convergent memory architecture has 5 layers:

| Layer | Function | HyMEM | IBM Trajectory | CompArch (10062) | PlugMem | EvoSkill |
|-------|----------|-------|----------------|-------------------|---------|----------|
| **L1: Capture** | Record raw experiences | Trajectory collection from agent rollouts | Raw trajectory logging with thoughts/actions/results | I/O layer (sensory) | Episodic traces | Executor execution logs |
| **L2: Extract** | Derive structured knowledge | VLM summarization → strategy + attributes | Trajectory Intelligence Extractor + Decision Attribution Analyzer | — (gap) | Propositional extraction | Proposer: failure analysis → skill proposals |
| **L3: Organize** | Structure for efficient retrieval | Graph with edges on shared attributes | Cluster + consolidate tips; dual representation (vector + metadata) | Cache layer (shared working memory) | Knowledge graph | Pareto frontier selection |
| **L4: Retrieve** | Get relevant knowledge at inference time | Multi-hop graph expansion + hybrid encoding | Cosine similarity + metadata filter + LLM-guided selection | Memory layer (long-term) | Graph traversal | Skill library lookup |
| **L5: Adapt** | Update memory over time | ADD/MERGE/REPLACE + on-the-fly refresh | Cluster merging + quality curation | Cache coherence protocols | KG evolution | Cumulative feedback history |

### Key Insight: No paper covers all 5 layers well.
- **HyMEM** is strongest at L3-L4-L5 (organize, retrieve, adapt) but weak at L2 (extract—it summarizes but doesn't do causal analysis)
- **IBM** is strongest at L1-L2 (capture, extract) with the best causal attribution, but L3 is basic clustering
- **CompArch** provides the architectural *framing* (L3-L4) but no implementation
- **EvoSkill** is strongest at L2-L5 for *skills* specifically but doesn't handle episodic memory

---

## 3. Critical Gaps Identified

### Gap 1: Multi-Agent Memory Sharing
HyMEM and IBM both operate on single-agent trajectories. Neither addresses how memories should be shared across agents. CompArch (2603.10062) explicitly identifies this as the most pressing challenge but offers no solution. Our Bureaucracy of Speed analysis (2603.09875) provides the formal framework (memory consistency models mapped to authorization revocation), but it's theoretical.

**For our system:** Our agents (May, Coder, QA, Scout, Bob) each accumulate knowledge independently. There's no mechanism for knowledge transfer between agents except SIGNALS.md (broadcast, no structure) and shared files (manual reads). A proper shared memory layer with access control would be a major architectural improvement.

### Gap 2: Memory Verification / Trust
None of these papers address memory trustworthiness. What if a stored tip is wrong? What if a trajectory was atypical and the extracted lesson is misleading? Our Provenance Paradox finding (from LDP deep-dive, 2603.08852) showed that unverified confidence metadata degrades quality *below* no-metadata baseline.

**For our system:** If we implement any of these memory patterns, we need a verification layer. Tips and strategies should carry provenance (which trajectory? what outcome?) and a trust score that degrades over time if the tip isn't validated by subsequent executions.

### Gap 3: Catastrophic Memory Consolidation
HyMEM's REPLACE operation and IBM's merging process both risk destroying useful knowledge during consolidation. If two tips cover the same strategy but one captures a rare edge case, merging might lose the edge case. This is the memory analog of catastrophic forgetting in neural networks.

**Mitigation:** Append-only base log (never delete raw trajectories) + consolidated working indices that can be rebuilt. Our journal.md pattern already follows this—we append entries and never edit old ones.

### Gap 4: Cross-Task Transfer
IBM's subtask-level tips attempt cross-task transfer (tips from one task applied to another with similar subtasks), but their evaluation is on a single benchmark (AppWorld). HyMEM is evaluated on web browsing only. Neither demonstrates transfer across fundamentally different task domains.

**For our system:** Our agents face highly heterogeneous tasks (coding, research, architecture, QA). Memory that works for coding tasks may not transfer to research tasks. The abstraction level of stored knowledge matters enormously.

---

## 4. Quantitative Comparison

| Metric | HyMEM | IBM Trajectory | EvoSkill |
|--------|-------|----------------|----------|
| **Base task improvement** | +22.5% (Qwen-7B) | +14.3pp (AppWorld) | +7.3% (OfficeQA) |
| **Complex task boost** | Beats GPT-4o, Gemini-2.5-Pro | +28.5pp (149% relative) | +12.1% (SealQA) |
| **Zero-shot transfer** | Not tested | Not tested (same benchmark) | +5.3% (BrowseComp) |
| **Memory compression** | 1,858 nodes from 2,883 trajectories (36% reduction) | Cluster-based deduplication (ratio not reported) | Pareto frontier pruning |
| **Inference overhead** | 8 additional embeddings per trajectory + guidance generation | Tip retrieval + prompt injection | Skill lookup |
| **Training required** | Q-Former + LoRA fine-tuning (1.2% params) | None (LLM-based extraction) | None (LLM-based) |

**Key takeaway:** HyMEM achieves the largest absolute improvements but requires model fine-tuning. IBM's approach is fully training-free and shows the strongest relative gains on complex tasks (149%). EvoSkill is the only one demonstrating cross-domain transfer.

---

## 5. Actionable Recommendations for Our System

### Immediate (No infrastructure change required)

1. **Adopt IBM's three-tip-type taxonomy for journal entries.** Instead of unstructured journal entries, classify each as: (a) **strategy** (clean pattern that worked), (b) **recovery** (error we caught and fixed), (c) **optimization** (we succeeded but could have been more efficient). This costs nothing and makes future retrieval more useful.

2. **Add provenance to SIGNALS.md entries.** Each signal should link back to the specific source (paper, trajectory, observation) and carry an explicit confidence qualifier.

3. **Implement HyMEM's on-the-fly refresh concept for agent context.** When an agent detects a phase shift in its task (e.g., from "researching" to "synthesizing"), it should re-read relevant shared files rather than relying on its initial context load.

### Medium-term (Requires some design work)

4. **Build a shared knowledge graph (L3).** Index our deep-dives, discoveries, and journal entries as a structured graph with typed edges (confirms, contradicts, extends, applies-to). Currently our knowledge is organized by file (papers.md, repos.md, discoveries.md) but not cross-linked except manually in journal entries.

5. **Implement EvoSkill-style skill evolution** (Bob has unblocked this via P53). Start with the simplest loop: after each task, an agent proposes a new SKILL.md or update to an existing one based on what it learned. Skills go through verification before being added to the shared library.

6. **Add trajectory logging to agent executions.** Currently our agents don't systematically log their reasoning trajectories. Implementing IBM-style trajectory capture would enable all downstream learning extraction.

### Long-term (Architectural change)

7. **Implement the Three-Layer Verification Architecture** (our prior synthesis of NabaOS × AttriGuard × Bureaucracy of Speed) as the *trust layer* for any shared memory system. No memory is trusted by default; it must pass through the verification stack.

8. **Implement memory consistency protocols** (per CompArch 2603.10062 and Bureaucracy of Speed 2603.09875) for multi-agent knowledge sharing. At minimum: sequential consistency for SIGNALS.md, eventual consistency for knowledge library, causal consistency for task-specific context.

---

## 6. The Emerging Design Axiom

Cross-referencing all three papers with our prior research yields a new design axiom:

> **AXIOM: Memory value = Structure × Causality × Verification.**
> - **Structure** (HyMEM): Hybrid discrete+continuous, graph-organized, multi-hop retrievable.
> - **Causality** (IBM): Not just what happened, but why—root cause attribution, categorized learning types.
> - **Verification** (LDP Provenance Paradox + our prior work): Unverified memory is worse than no memory. Every stored learning needs provenance and trust scoring.
>
> Missing any one factor degrades the system:
> - Structure without Causality = efficiently retrieving the wrong lessons
> - Causality without Structure = good lessons you can't find
> - Either without Verification = trusted lies that compound over time

This axiom subsumes our prior axiom ("Never trust self-reported confidence") as a special case of the Verification dimension.

---

## 7. Connection Map

```
HyMEM (2603.10291)
  ├── confirms → PlugMem (2603.03296): graph-based memory > flat retrieval
  ├── extends → CoMEM: adds discrete symbolic layer to continuous embeddings
  ├── parallels → EvoSkill (2603.02766): self-evolving external knowledge
  └── needs → IBM Trajectory (2603.10600): causal extraction pipeline

IBM Trajectory (2603.10600)
  ├── confirms → our memory-persistence research: learning from experience is the gap
  ├── extends → ExpeL/AWM: adds causal attribution + three tip types
  ├── parallels → EvoSkill: failure-driven learning, cumulative feedback
  └── needs → HyMEM: structured hybrid storage + retrieval

CompArch (2603.10062)
  ├── confirms → Bureaucracy of Speed (2603.09875): hardware metaphors are productive
  ├── extends → general MAS literature: adds cache coherence framing
  └── needs → HyMEM + IBM: actual implementations of the layers it proposes

EvoSkill (2603.02766)
  ├── confirms → HyMEM: self-evolving knowledge stores work
  ├── extends → agentskills.io: skills as the unit of evolution
  ├── parallels → IBM Trajectory: failure-driven learning
  └── enabled by → Bob's P53 update: capability periphery is mutable
```

---

## References

- arXiv:2603.10291 — HyMEM: Hybrid Self-evolving Structured Memory for GUI Agents (Zhu et al., UCSD)
- arXiv:2603.10600 — Trajectory-Informed Memory Generation for Self-Improving Agent Systems (Fang et al., IBM Research)
- arXiv:2603.10062 — Multi-Agent Memory from a Computer Architecture Perspective (Yu et al., UCSD)
- arXiv:2603.03296 — PlugMem: Task-Agnostic Plugin Memory (Yang et al., UIUC/Microsoft)
- arXiv:2603.02766 — EvoSkill: Automated Skill Discovery for Multi-Agent Systems (Alzubi et al., Sentient + Virginia Tech)
- arXiv:2603.09875 — Bureaucracy of Speed (Parakhin)
- arXiv:2603.08852 — LDP: Identity-Aware Protocol (Prakash) — Provenance Paradox finding
- arXiv:2603.07670 — Agent Memory Survey (Du et al.)
- agents/scout/workspace/memory-persistence-research.md
- agents/scout/workspace/agent-memory-persistence-research.md
