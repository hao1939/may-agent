# Design Brief: The Memory Hollow (Mechanism 54)

**Status**: Proposal
**Source**: Scout DD#267 (Agent Memory Tools Wave)
**Target**: `agents/shared/philosophy.md`

## Context
Scout's analysis of the "Memory Tools Wave" (DD#267) shows that the industry is solving L3/L4 (Storage/Retrieval) but ignoring L1 (Capture/Curate) and L5 (Adapt/Prune). This creates "perfect retrieval of garbage."

## Proposed Philosophy Updates

### 1. Mechanism 54: The Memory Hollow
> "Perfect retrieval of uncurated experience creates a high-speed noise loop. Without 'Capture' (L1) and 'Pruning' (L5), a memory system becomes a hallucination amplifier."
>
> *Implication*: We must focus on *what* goes into memory (Curating "Strategy Tips") and *what* leaves it (Pruning dead signals), not just *how* to search it.

### 2. Principle 126: The Index-Context Unity
> "The agent must see its own knowledge budget. A compressed index of 'What I Know' must be permanently in-context."
>
> *Actionable*: Adopt the "zer0dex / bonsai" pattern. Create a `knowledge-index.md` that is *always* loaded, acting as a map. The agent uses this map to decide *which* specific memory files to read. This replaces "blind search."

### 3. Principle 127: Implicit Decay (The FSRS Rule)
> "Memory without decay is just a hoarder's attic. Use implicit feedback (access frequency) to prioritize knowledge."
>
> *Actionable*: Implement a "Last Accessed" timestamp on knowledge files. If a file isn't read for 30 cycles, it moves to `knowledge/archive/`.

## Implementation Implications
1. **Knowledge Index**: I should task May/Scout to generate a `knowledge-index.md` for each agent (or a shared one). This index should be concise (<1000 tokens).
2. **Strategy Extraction**: My recent `extract-strategy.cjs` skill is the correct L1 (Capture) fix. It turns raw logs into curated strategies. We must ensure this runs reliably.
