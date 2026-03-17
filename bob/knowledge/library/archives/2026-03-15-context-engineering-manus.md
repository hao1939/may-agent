# Synthesis: Context Engineering & KV-Cache Optimization (The Manus Pattern)

**Date**: 2026-03-15
**Source**: Manus Engineering Blog ("Context Engineering for AI Agents")
**Related Principles**: P11 (File System as Memory), P143 (Structured Context), P126 (Dissipation)

## 1. The Insight
Manus (a production agent framework rebuilt 4x) identifies **KV-Cache Hit Rate** as the single most critical metric for production agents.
- **The Physics**: Input tokens are 10x cheaper when cached ($0.30 vs $3.00/MTok). Latency is linearly dependent on prefill.
- **The Constraint**: A single changed token (e.g., a timestamp) in the prefix invalidates the cache for *all subsequent tokens*.
- **The Consequence**: System Prompts must be **Immutable Prefixes**. Dynamic state (timestamps, status, tools) must be moved to the *suffix* or user message.

## 2. The Pattern: Append-Only Context
To maximize cache hits:
1.  **Stable System Prompt**: The first N tokens (Identity, Philosophy, Core Constraints) must rarely change.
    - *Anti-Pattern*: Injecting "Current Time: 12:00:01" at the top.
    - *Fix*: Move timestamps to the User Message (bottom).
2.  **Append-Only History**: Never modify past messages.
    - *Anti-Pattern*: Summarizing the middle of the conversation.
    - *Fix*: Append summaries as new messages; let the context window slide naturally or truncate from the top (preserving the system prefix).
3.  **Recitation (Attention Steering)**:
    - *Insight*: Agents suffer "Lost in the Middle".
    - *Technique*: Rewrite the current objective (TODO) at the *end* of the context (in the User Message or a "Thought" block) to steer attention.

## 3. The Counter-Intuitive Lesson: Keep Errors
Manus advises: **"Keep Wrong Stuff In."**
- **Why**: Failed actions and stack traces shift the model's priors away from repeating the mistake.
- **Conflict**: We often try to "clean" context.
- **Resolution**: Keep errors in the *recent* context (Experience Track), but prune them from *long-term* storage (Skills Track).

## 4. Proposed Application
We need to audit our System Prompt architecture (`agent-loader.ts`):
1.  **Audit**: Are we injecting volatile data (Time, Date, Session ID) into the System Prompt?
2.  **Refactor**: Move volatile data to the `UserMessage` or `State` block at the bottom.
3.  **Formalize**: Add **P147 KV-Cache Discipline** to `philosophy.md`.

## 5. Draft Principle P147
### 147. KV-Cache Discipline (Stable Prefix) (P147) [Manus+Imported]
**"The first 90% of your context must be immutable. Volatility kills the cache."**
Context caching reduces cost by 90% and latency by 50%. A single changed token invalidates the cache for everything after it.
- **The Law**: **System Prompts are Immutable.** Never inject timestamps, dynamic statuses, or session IDs into the system prompt.
- **The Mechanism**: Place volatile state (Time, Todo, Status) in the **User Message** or a dedicated **Dynamic Suffix**.
- **The Architecture**: `[Immutable System Prompt] + [Cached History] + [Dynamic User Input]`.
- **Validation**: Manus Engineering (2026), Anthropic Caching Best Practices.
