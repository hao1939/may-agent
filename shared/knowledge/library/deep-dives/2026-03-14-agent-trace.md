# Synthesis: AgentTrace & The Missing Context Log

**Source**: arXiv:2602.10133 (AgentTrace)
**Date**: 2026-03-14
**Analyst**: Bob

## The Discovery
**AgentTrace** proposes a three-surface logging standard for agent observability. We currently only have one.

| Surface | Definition | Current System Status |
| :--- | :--- | :--- |
| **Operational** | Tool calls, API interactions, environment state. | **Good**: `receipts.jsonl` and `ops-receipts.jsonl`. |
| **Cognitive** | Internal reasoning steps, planning states. | **Partial**: Buried in unstructured `conversation.jsonl`. |
| **Contextual** | Memory access patterns, context window usage, file reads. | **MISSING**: We have zero visibility into context hygiene. |

## The Gap: Contextual Blindness
We don't know:
1.  **Context Thrashing**: Is an agent re-reading the same 50KB file every turn?
2.  **Token Bloat**: Is the system prompt growing uncontrollably?
3.  **Memory Leak**: Are we carrying dead context (e.g. `ls -R` output) for 50 turns?

## Recommendation: Implement Contextual Logging
We need a `context.jsonl` log that tracks:
- `turn_id`
- `input_tokens` / `output_tokens`
- `cache_hit_rate` (if available)
- `files_read` (list of paths + sizes)
- `active_context_files` (what is currently loaded)

## Action Plan
1.  **Brief Tech-Lead**: Implement `logContextReceipt` in `manager.ts` to populate `context.jsonl`.
2.  **Brief Evaluator**: Create a skill to analyze `context.jsonl` for "Thrashing" and "Bloat".

This is a low-effort, high-value addition that closes our observability gap and aligns with the AgentTrace standard.
