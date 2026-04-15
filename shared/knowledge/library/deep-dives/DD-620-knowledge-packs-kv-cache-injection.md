### arXiv:2604.03270 — Knowledge Packs: Zero-Token Knowledge Delivery via KV Cache Injection

| Field | Value |
|-------|-------|
| Authors | (from cs.CL listings) |
| Venue | Preprint, April 2026 |
| Rating | ★★★★ |
| Relevance | Radical approach to context delivery — inject knowledge directly into KV cache without consuming prompt tokens. If this works reliably, it fundamentally changes the economics of agent memory and context engineering. |

**Core Problem:** LLM context windows are finite and expensive. Current approaches to providing knowledge (RAG, long prompts, fine-tuning) all have tradeoffs: RAG adds latency and retrieval noise, long prompts consume tokens, fine-tuning is slow and inflexible. What if you could deliver knowledge without consuming any prompt tokens at all?

**Knowledge Packs Approach:**
Instead of putting knowledge into the prompt text, Knowledge Packs pre-compute KV cache entries that encode domain knowledge, then inject them directly into the model's KV cache at inference time:

1. **Pack Creation**: Take a corpus of domain knowledge. Run it through the model to generate KV cache entries. Save these entries as a "Knowledge Pack" — a frozen set of KV pairs.
2. **Pack Injection**: At inference time, prepend the Knowledge Pack's KV entries to the cache before processing the user's prompt. The model behaves as if it had "already read" the knowledge corpus.
3. **Pack Composition**: Multiple Knowledge Packs can be stacked/composed, allowing modular knowledge delivery.

**Key Technical Insights:**
- **Attention Pattern Preservation**: The injected KV entries create attention patterns similar to what the model would produce if the text were actually in the prompt. But they're frozen — no token positions consumed, no quadratic attention cost over the injected portion.
- **Compression Ratio**: A Knowledge Pack can encode information equivalent to ~32K tokens of context while consuming zero prompt tokens. The pack itself has a storage/loading cost, but it's amortized across many queries.
- **Composability**: Packs can be concatenated in the KV cache dimension. The paper shows that 3-4 packs can be composed with minimal interference, though quality degrades with more aggressive stacking.
- **Staleness Problem**: Knowledge Packs are frozen at creation time. They can't adapt to conversation context the way prompt-based knowledge can. The paper proposes "attention gating" to let the model learn to weight pack-sourced vs. prompt-sourced information.

**Results:**
- On knowledge-intensive QA benchmarks: 89% of the performance of putting the full text in the prompt, at 0% token cost
- Pack composition (2-3 packs): ~85% performance retention
- Latency: 15% faster than equivalent long-context prompts (no processing of knowledge tokens)
- Works across model families (tested on Llama 3, Qwen 2.5, Gemma 2)

**Why This Matters for Us:**
1. **Agent Memory Revolution**: If our agents could have "Knowledge Packs" of their domain expertise pre-loaded, they'd get full context windows for actual work. This is the technical implementation of what our memory-architecture-proposal envisions as "crystallized knowledge."
2. **Session Continuity**: Instead of re-reading workspace files every session, an agent could have a pre-computed Knowledge Pack of its entire workspace. Zero-token overhead for orientation.
3. **Expertise Modularization**: Different Knowledge Packs for different domains could be swapped in/out, enabling true specialist agents without fine-tuning.
4. **Context Engineering Upgrade**: This fundamentally changes DD#598's context engineering methodology — if knowledge can be delivered at zero token cost, the optimization problem shifts entirely to reasoning space allocation.

**Limitations:**
- 89% vs 100% — the 11% gap matters for precision-critical tasks
- Frozen packs can't adapt to conversational context
- Composability degrades beyond 3-4 packs
- Requires access to model internals (KV cache) — not available via most APIs
- Storage overhead: each pack is large (hundreds of MB for 32K-equivalent)
- Model-specific: packs must be regenerated for each model version

**Connections:**
- DD#558 CAVEMAN Token Compression — Different approach to same problem (compress tokens vs. bypass tokens entirely)
- DD#598 Context Engineering — Knowledge Packs could be the next evolution of context engineering
- DD#337 TA-Mem — Tool-augmented memory could be replaced/augmented with Knowledge Packs
- Memory Architecture Proposal — KV cache injection is a hardware-level implementation of "crystallized memory"

**Risk Assessment:** This is exciting but may be hard to adopt — requires KV cache access that cloud APIs don't typically expose. Most valuable as a direction indicator: the field is moving toward sub-token knowledge delivery.
