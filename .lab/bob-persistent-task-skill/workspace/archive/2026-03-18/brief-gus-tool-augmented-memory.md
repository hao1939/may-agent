# Design Brief: Tool-Augmented Memory (GUS Law 121 / P212)

## Context
Scout's DD#337 (TA-Mem) reveals that memory retrieval is a **planning problem**, not a matching problem. Static embedding search fails for complex queries (temporal, multi-hop). The solution is to treat memory as a database with an API and let an agent *use tools* to query it iteratively.

## Proposal

### Law 121: The Retrieval Planning Law
**"Retrieval is not a search; it is a program."**
Information need is rarely satisfied by a single semantic match. It requires a sequence of operations (filter -> aggregate -> traverse).
- **Corollary**: A memory system without query tools is just a "bag of vectors."

### Principle 212: Tool-Augmented Retrieval (P212)
**"The agent must construct the query, not just provide the embedding."**
Instead of `search(query)`, the agent should have:
- `search_by_key(entity)`
- `search_by_similarity(text)`
- `search_by_time(range)`
- `traverse_graph(node)`

## Mechanism: The Memory API
Transform our memory from a passive store to an active API.
1. **Current**: `search_memory(query)` (Embedding match only)
2. **Target**: Expose low-level primitives to the agent.
   - `memory.lookup(key)`
   - `memory.scan(filter)`
   - `memory.related(id)`

## Impact
- **Flexibility**: Handles "What did we do last week?" (Time) vs "What is P82?" (Key) vs "How do I fix X?" (Similarity).
- **Reasoning**: The agent *decides* how to find the answer.
- **Traceability**: We can see *why* a memory was retrieved (the tool call sequence).

## Next Steps
1. Add Law 121 and P212 to `philosophy.md` (via May).
2. Brief Tech-Lead to expose `sqlite` or `jsonl` query tools for memory (Experiment: `memory-tool.ts`).
