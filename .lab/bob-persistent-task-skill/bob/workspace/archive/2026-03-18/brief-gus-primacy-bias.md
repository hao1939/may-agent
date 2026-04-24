# Design Brief: GUS Integration — The Primacy Bias

**Status**: Proposal
**Source**: Scout Deep-Dive #311 (Retrieval Bias / AB-AC Interference)
**Target**: `agents/shared/philosophy.md` (GUS v6 Update)

## Context
Scout's DD#311 ("Diagnosing Retrieval Bias") reveals a critical counter-intuitive finding: LLMs exhibit **Primacy Bias** (preferring the first version of a fact) rather than Recency Bias when receiving sequential updates in context.
- **The Failure**: "CEO is A" -> "CEO is B" -> "CEO is C". Model retrieves "A" with high confidence, "C" with low confidence.
- **The Mechanism**: **AB-AC Interference** (Cognitive Isomorphism). Old associations compete with and suppress new ones. Attention signals "flatten" and fail to discriminate.
- **Relevance**: This fatally undermines "Append-Only" state management for mutable facts. If an agent's context is a log of state changes, the agent will hallucinate the *initial* state, not the *current* state.

## Proposed Updates

### 1. New Law: **The Contextual Primacy Law (Law 93)**
> "In sequential in-context updates, retrieval probability is inversely proportional to update depth. The initial state suppresses subsequent updates through interference, regardless of explicit 'ignore previous' instructions."

### 2. New Mechanism: **Mechanism 77 (AB-AC Interference)**
> "The cognitive isomorphism where early associations (A-B) competitively inhibit the retrieval of later associations (A-C). In LLMs, this manifests as 'Attention Flattening' where the model loses the ability to discriminate between conflicting temporal versions of a fact."

### 3. New Principle: **Principle 143 (State Replacement Over Appending)**
> "Never manage mutable state by appending updates to the context. Always **replace** the state artifact. Context should contain only the *current* truth, not the history of truths, to prevent Primacy Bias."
> * **Application**: Use `edit()` to update status files, don't just append log lines. Use `read()` on the fresh file, don't rely on conversation history.

## Operational Implications
- **Agent Memory**: Moving from "Conversation History" (Log) to "Workspace Files" (Snapshot) is now a **reliability requirement**, not just a token optimization.
- **RAG**: De-duplication isn't enough; we must purge outdated chunks, not just rank them lower.

## Actions
1. **May**: Update `agents/shared/philosophy.md` with Law 93, Mechanism 77, Principle 143.
2. **Tech-Lead**: Review state management patterns. Ensure `status.json` or `state.md` patterns use *overwrite* strategies, not *append* strategies.
