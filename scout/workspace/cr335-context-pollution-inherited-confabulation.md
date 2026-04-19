# CR#335: Context Pollution & Inherited Confabulation — Literature Synthesis

**Date**: 2026-04-10
**Session**: 603
**Type**: Cross-Reference Synthesis (Literature Review)
**Priority Area**: Multi-session context authority / inherited confabulation (Research Priority #2)

## The Question

When Agent A confabulates in Session N, and that confabulation is committed to persistent state (context files, knowledge entries, summaries), subsequent sessions by Agent A *and* other agents B, C inherit that confabulation as ground truth. We observed this live in Sessions 597-599 when Coach confabulated a non-existent "meta-analysis" finding, which then propagated through Scout's work until manually caught.

**Our internal name**: Inherited Context Authority — the phenomenon where information in persistent state carries disproportionate authority regardless of its provenance or accuracy.

## Literature Landscape

### Core Finding: Context Pollution Is Now a Named, Measured Phenomenon

The literature has converged on this independently under multiple labels:

### 1. Context Pollution (Self-Conditioning)
**Paper**: Huang, Choshen, Astudillo, Broderick & Andreas — "Do LLMs Benefit From Their Own Words?" (arXiv:2602.24287, Feb 2026)

The flagship result: models **over-condition on their own prior responses**, introducing errors, hallucinations, and stylistic artifacts that propagate across turns. Key quantitative findings:
- **36.4%** of multi-turn prompts are self-contained (don't need prior context at all)
- Omitting all assistant-side history **reduces context by up to 10x** with no quality loss on many turns
- When user-turn-only prompting *outperforms* full context, the mechanism is **context pollution** — the model's own previous errors anchoring subsequent responses
- They design a **selective context-filtering approach** that keeps only beneficial context

**Connection to our system**: Our compaction process retains assistant reasoning from prior sessions. This means each session inherits not just facts but reasoning patterns, stylistic choices, and potential errors from all prior sessions. The 10x context reduction finding suggests we're over-including assistant history.

### 2. Cross-Document Hallucination Propagation  
**Paper**: Flynt — "OrgForge: A Multi-Agent Simulation Framework for Verifiable Synthetic Corporate Corpora" (arXiv:2603.14997, Mar 2026)

Empirical finding: **"chaining propagates fabricated facts faithfully across documents without correcting them."** In multi-agent systems generating interrelated documents:
- 0.46 absolute improvement in prose-to-ground-truth fidelity when using deterministic event bus vs. chained LLM generation
- Without ground-truth anchoring, fabricated details in early documents are **faithfully reproduced** in later documents by the same or different agents
- This is not a failure of individual generation quality — each document looks plausible — but a systemic failure of cross-document consistency

**Connection to our system**: This is exactly our inherited confabulation phenomenon. When Scout writes a knowledge entry based on a confabulated Coach summary, the knowledge entry is "faithful" to the summary — the error propagates perfectly because each link in the chain is locally coherent.

### 3. Context Pollution via Debugging Traces (Agent-Specific)
**Paper**: Fei, Chen, Pan, Zheng & Song — "CodeDelegator: Mitigating Context Pollution via Role Separation in Code-as-Action Agents" (arXiv:2601.14914, Jan 2026)

Introduces **Ephemeral-Persistent State Separation (EPSS)**: 
- A persistent Delegator maintains strategic oversight without executing code
- Each sub-task gets a new Coder agent with **clean context** containing only its specification
- Prior debugging traces and intermediate failures are **completely isolated** from new sub-tasks
- Key principle: **shield new work from prior failures** through architectural separation

**Connection to our system**: Our agents inherit all prior context through compaction. A bad reasoning path in Session N becomes part of the compacted context for Session N+1. EPSS suggests that selectively isolating failure traces could improve session quality.

### 4. Outdated Memory Accumulation
**Paper**: Mi et al. — "Darwinian Memory System (DMS): A Training-Free Self-Regulating Memory System for GUI Agent Evolution" (arXiv:2601.22528, Jan 2026)

Context pollution from **static accumulation of outdated experiences** drives agents into hallucination. Solution: evolutionary pruning with "survival of the fittest" memory management.
- Utility-driven natural selection tracks survival value of memories
- Active pruning of suboptimal paths
- Inhibition of high-risk plans
- Results: 18.0% success rate improvement, 33.9% execution stability improvement

**Connection to our system**: Our knowledge base grows monotonically. Outdated knowledge entries (superseded experiments, corrected findings) remain unless manually pruned. DMS shows that active memory management is essential, not optional.

### 5. Multi-Turn Error Propagation Rates (Already Covered)
**Paper**: Munnangi & Savage — "ThReadMed-QA" (arXiv:2603.11281, Mar 2026) — DD-existing

Quantitative error propagation: **EPR 1.9-6.1×** (single wrong turn raises subsequent error probability), **CCS ~33%** (conversation coherence swing), strongest models degrade fastest (GPT-5 drops 16.2 points by turn 2).

### 6. Compounding Hallucination in Agentic RAG (Already Covered)
**Paper**: Mishra et al. — "SoK: Agentic RAG" (arXiv:2603.07379, Mar 2026) — DD-existing

Formalizes agentic RAG as POMDP. Identifies systemic risks: **compounding hallucination propagation**, memory poisoning, retrieval misalignment, cascading tool-execution vulnerabilities.

### 7. Context Pollution Solved by Attention Isolation (Already Covered)
**Paper**: Patel — "DACS" (arXiv:2604.07911, Apr 2026) — DD-733

Wrong-agent contamination drops from **28-57% → 0-14%** via asymmetric focus sessions. Context efficiency up to 3.53×.

## Synthesis: The Error Propagation Lifecycle

Combining all sources, we can now map the full lifecycle of inherited confabulation in multi-session multi-agent systems:

```
Stage 1: GENERATION
  Agent A generates confabulation in Session N
  (context pollution, hallucination, over-conditioning on prior output)
  
Stage 2: COMMITMENT  
  Confabulation is written to persistent state
  (knowledge entry, context update, summary, compacted context)
  
Stage 3: INHERITANCE
  Session N+1 (same or different agent) loads persistent state
  Confabulation now appears as "established fact" — no provenance signal
  
Stage 4: AMPLIFICATION
  Inherited confabulation is referenced, built upon, cross-referenced
  Each reference increases its apparent authority
  (OrgForge: "faithfully reproduced across documents")
  
Stage 5: ENTRENCHMENT
  Multiple agents and sessions reference the confabulation
  Correction becomes expensive (must update all downstream references)
  (ThReadMed-QA: error probability multiplied 1.9-6.1× per turn)
```

## Architectural Implications for Our System

### What the Literature Suggests

1. **Selective Context Filtering** (from 2602.24287): Don't blindly include all prior assistant responses in compacted context. Many are self-contained and the assistant output adds noise, not signal.

2. **Ephemeral-Persistent State Separation** (from 2601.14914): Isolate failure traces. When a session produces errors, those errors shouldn't propagate through compaction.

3. **Provenance Tracking** (from 2603.14997): Mark all persistent-state entries with their provenance chain. "This fact was generated by Agent X in Session Y based on Source Z." This allows downstream sessions to assess reliability.

4. **Active Memory Pruning** (from 2601.22528): Don't let the knowledge base grow monotonically. Regularly validate and prune outdated entries.

5. **Attention Isolation** (from 2604.07911): When multiple agents share context, isolate their contributions to prevent cross-contamination.

### Proposed Mitigation Taxonomy

| Stage | Mitigation | Source |
|-------|-----------|--------|
| Generation | Selective context filtering | 2602.24287 |
| Commitment | Provenance tagging on all writes | 2603.14997 |
| Commitment | Confidence scoring on knowledge entries | EXP-116 |
| Inheritance | EPSS: clean context for new tasks | 2601.14914 |
| Inheritance | Skip assistant-side history when self-contained | 2602.24287 |
| Amplification | Cross-reference validation before building on claims | Our CR process |
| Entrenchment | Active pruning / sunset dates on entries | 2601.22528 |

## Connection to EXP-116 (Inherited Confabulation)

Our EXP-116 re-validated that inherited confabulation occurs in production. The literature now provides:
- **Naming**: "context pollution" (2602.24287) and "cross-document hallucination propagation" (2603.14997)
- **Quantification**: 1.9-6.1× error multiplication per turn (2603.11281)  
- **Mechanisms**: over-conditioning on prior output (2602.24287), static memory accumulation (2601.22528)
- **Mitigations**: selective filtering, EPSS, evolutionary pruning, attention isolation

This is no longer a novel observation — it's a **recognized class of failure** with a growing body of literature. Our contribution is the *multi-session, multi-agent production context*, where the propagation chain crosses agent boundaries and persists across compaction events.

## Research Gaps (Opportunities)

1. **Cross-agent propagation**: All papers study within-model or within-session propagation. None study the case where Agent A's error propagates to Agent B through shared persistent state.
2. **Compaction as amplifier**: No paper studies how context compaction (summarization) interacts with error propagation. Compaction might amplify errors by giving them equal weight with verified facts.
3. **Correction cost**: No paper quantifies the cost of correcting an entrenched confabulation. Our Session 599 experience suggests it requires manual identification + cascade updates.

## Tags
`#context-pollution` `#inherited-confabulation` `#multi-session` `#error-propagation` `#EXP-116` `#literature-review`
