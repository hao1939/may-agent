# CR#160: Knowledge Update Dynamics — When Models Can't Forget What They First Learned

**Cross-Reference Synthesis connecting DD#311 (Retrieval Bias Under Knowledge Updates), DD#323 (MetaKE), DD#309 (Agentic RAG), DD#324 (AIM), DD#317 (NeuroLoRA)**

## The Unifying Problem

A fundamental tension runs through five seemingly disparate papers from the Monday March 16 batch: **LLMs struggle with knowledge that changes over time.** Whether updates arrive through context (DD#311), through editing (DD#323), through retrieval (DD#309), through logit modulation (DD#324), or through adapter tuning (DD#317), the model's response to evolving information reveals deep architectural constraints.

## The Five Perspectives

### 1. DD#311: Retrieval Bias Under Multiple In-Context Knowledge Updates
**The problem:** When the same fact is updated multiple times in context (A→B→C), LLMs preferentially retrieve the *earliest* version. This "AB-AC interference" mirrors human cognitive psychology — old associations compete with new ones during retrieval.

**Key finding:** The bias is *structural*, not fixable with prompting. Attention patterns flatten as updates accumulate, losing discriminative power between versions. Heuristic interventions from cognitive science yield only modest gains.

### 2. DD#323: MetaKE — Meta-Learning for Knowledge Editing
**The problem:** Direct parametric knowledge editing (changing stored facts) suffers from catastrophic locality failures — edits to one fact corrupt nearby facts. MetaKE uses meta-learning to find edit directions that minimize collateral damage.

**Connection to DD#311:** While DD#311 shows in-context updates fail due to retrieval bias, DD#323 shows parametric updates fail due to entanglement. Both expose the same root issue: **LLMs encode knowledge in distributed, overlapping representations where updates cannot be cleanly isolated.**

### 3. DD#309: Test-Time Strategies for Agentic RAG
**The problem:** RAG agents that retrieve information across multiple rounds face the question: when the knowledge base has been updated, how does the system ensure the latest version is used?

**Connection to DD#311:** DD#309's de-duplication module prevents re-retrieval of the same document, but DD#311 reveals a deeper issue: even when the correct (latest) version is in context, the model may still preferentially attend to earlier-presented information. This means RAG systems need not just retrieval freshness but **in-context recency weighting**.

### 4. DD#324: AIM — AI Model Modulation via Logits Redistribution
**The problem:** AIM modulates model behavior at inference time by redistributing logits — shifting probability mass between tokens to control output quality and focus.

**Connection to DD#311:** DD#311 shows that on error cases, output logits become "weakly discriminative" — the model can't distinguish old from new knowledge in its logit distribution. AIM's logits redistribution could theoretically be adapted to **amplify recency signals** in the logit space, providing a training-free fix for temporal retrieval bias.

### 5. DD#317: NeuroLoRA — Context-Aware Neuromodulation for PEFT
**The problem:** Standard LoRA adapters apply uniform modifications regardless of input. NeuroLoRA dynamically adjusts adapter activations based on context, inspired by biological neuromodulation.

**Connection to DD#311:** NeuroLoRA's context-awareness mechanism could be trained to detect "knowledge update sequences" and dynamically upweight attention to later mentions. This would be a parametric solution to the structural bias DD#311 identifies.

## Emergent Framework: The Knowledge Freshness Stack

These five papers collectively describe a **layered architecture for knowledge freshness**:

```
Layer 4: LOGIT MODULATION (DD#324 AIM)
  → Redistribute output probabilities to favor recent knowledge
  
Layer 3: ADAPTER MODULATION (DD#317 NeuroLoRA)  
  → Dynamically adjust model behavior when update sequences detected

Layer 2: RETRIEVAL ORCHESTRATION (DD#309 Agentic RAG)
  → Ensure freshest documents are retrieved and prioritized

Layer 1: PARAMETRIC EDITING (DD#323 MetaKE)
  → Update stored facts with minimal collateral damage

Layer 0: DIAGNOSIS (DD#311 Retrieval Bias)
  → Understand the fundamental bias before attempting fixes
```

**Key insight:** No single layer is sufficient. DD#311 proves that in-context updates alone fail. DD#323 proves that parametric edits alone cause collateral damage. The complete solution requires orchestrating across all layers — editing parametric knowledge where possible (Layer 1), retrieving fresh context (Layer 2), modulating attention adaptively (Layer 3), and correcting output distributions (Layer 4).

## Implications for Multi-Agent Systems

For agent architectures that maintain shared memory (connecting to DD#316, DD#315 SpectralGuard):

1. **Memory staleness attacks**: An adversary could exploit retrieval bias by ensuring outdated information appears earlier in the agent's context, knowing the model will preferentially use it
2. **Memory compaction failures**: When agent memory is compressed/summarized (DD#316's 11× compression), the temporal ordering of knowledge updates may be lost
3. **Cascade effects**: In multi-agent systems, if one agent propagates stale knowledge due to retrieval bias, downstream agents compound the error

## Open Questions

1. **Can attention-level interventions solve retrieval bias?** DD#311's negative result on heuristics doesn't rule out architectural modifications to attention (e.g., position-aware recency weighting)
2. **Does the AB-AC interference pattern hold for parametric knowledge?** DD#311 tests in-context only — does the same bias exist for knowledge edited into weights?
3. **Optimal layer allocation**: For a given knowledge update scenario, which layer in the freshness stack is most efficient? Trade-offs between edit precision (Layer 1), retrieval cost (Layer 2), and inference overhead (Layers 3-4)?

## Significance: 8.5/10

This synthesis reveals that knowledge update dynamics is an *unsolved problem at every level of the stack*. The cognitive science grounding (AB-AC interference) suggests this may be a fundamental limitation of associative memory architectures — one that requires architectural innovation, not just better prompting or retrieval. The layered framework provides a roadmap for systematic solutions.

## Tags
`knowledge-updates` `retrieval-bias` `knowledge-editing` `RAG` `temporal-reasoning` `cognitive-science` `multi-layer-solution`
