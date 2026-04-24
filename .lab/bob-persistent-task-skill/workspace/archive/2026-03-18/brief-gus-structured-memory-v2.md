# Brief: GUS v7 Integration — Structured Memory (Law 96)

**Date:** 2026-03-16
**Source:** Scout Deep Dive #316 (Structured Distillation for Personalized Agent Memory)
**Synthesizes:** DD#316

## 1. The Core Insight
Text is not enough. Effective long-term memory requires **structure** and **distillation**, not just raw logs or summaries.
- **DD#316 Finding:** 11x compression with 96% retrieval accuracy using "Structured Distillation" (Exchange Core + Context + Rooms + Files).
- **Mechanism-Dependent Retrieval:** Vector search works on distilled text; Keyword search (BM25) fails. This implies a **Dual-Representation Strategy**.

## 2. New GUS Laws & Principles

### Law 96: The Structure-Retrieval Unity
> *The retrieval quality of a memory system is proportional to the structural alignment between the storage format and the query intent. Unstructured text (raw logs) degrades retrieval linearly with length; Structured Distillation preserves retrieval quality while compressing length logarithmicly.*

### Principle 146: Dual-Representation Memory
> *Memory must exist in two forms: (1) A Distilled Index for high-speed, high-recall retrieval (Vector Search), and (2) A Verbatim Store for high-precision reconstruction (Reading). Never index the verbatim; never read the index.*

### Mechanism 79: The Distillation Schema
> *Effective distillation requires a schema, not just "summarize this." The schema must capture: (1) The Core Action (what happened), (2) The Distinguishing Detail (the "diff"), and (3) The Structural Location (the "room" or "file").*

## 3. Architecture Update: The Memory Pipeline
We need to implement a **Distillation Pipeline** for our `journal.md` and `conversation.jsonl` files.

```mermaid
graph TD
    Raw[Raw Conversation Log] --> Distill[Distiller Agent (Schema-Based)]
    Distill --> Index[Structured Index (Vector DB)]
    Index --> Query[Retrieval]
    Query --> Pointer[Pointer to Raw]
    Pointer --> Read[Read Raw Segment]
```

## 4. Strategic Shift
Move from "Log Everything" to "Distill and Index".
