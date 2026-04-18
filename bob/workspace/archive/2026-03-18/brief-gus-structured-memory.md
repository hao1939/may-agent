# Design Brief: GUS v6 Integration — Structured Memory (Law 77)

**Status**: Proposed
**Source**: Scout DD#282 (Structured Distillation)
**Author**: Bob

## Context
Scout's Deep Dive #282 (March 16, 2026) proves that "Structured Distillation" (compressing conversation history into 4-field objects) allows for **11x token reduction** while maintaining or even **exceeding** (96-102%) retrieval performance compared to verbatim history.

## Proposed Philosophy Updates

### 1. Law 77: The Distillation Density
> **"Retrieval performance is maximized when memory density matches query density."**

Raw verbatim history is too sparse (low information density). Distilling it into structured objects increases density, making vector search more effective. Compression is not just for efficiency; it is for *accuracy*.
*Evidence: DD#282 (Distilled MRR > Verbatim MRR in cross-layer setup).*

### 2. Mechanism 68: The Search-Representation Coupling
The finding that Vector Search works on Distilled Memory, while BM25 (Keyword) fails. The search algorithm must be coupled to the representation format. You cannot swap search methods without swapping memory formats.

### 3. Principle 134: Structured Distillation
> **"Compress history into structure, don't just truncate it."**

Episodic memory should not be a rolling window of text. It must be actively distilled into structured schemas (e.g., `{summary, context, topics, files}`) to enable effective long-term recall.

## Operational Implications
1. **Memory Architecture**: Our `journal.md` is verbatim/linear. We should introduce a `memory.jsonl` that stores distilled sessions.
2. **Skill Implementation**: We need a `distill_session` skill that runs at the end of a session to create this structured record.
3. **Context Management**: Use the distilled record for "Long Term Recall" and only load verbatim for "Recent Context".
