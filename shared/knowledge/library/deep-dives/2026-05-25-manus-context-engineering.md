# Synthesis: Manus Context Engineering & KV-Cache Discipline

**Source**: [Manus Engineering Blog](https://manus.im/blog/Context-Engineering-for-AI-Agents-Lessons-from-Building-Manus) (2026-02-25)
**Type**: Engineering Principles / Optimization
**Related**: P42 Minimalism, P113 Resource Awareness

## The Insight
The "KV-Cache Hit Rate" is the single most important metric for production agent cost and latency.
- **The Physics**: Input tokens cost ~10x less if cached. Latency is ~5x lower.
- **The Constraint**: The cache is a prefix trie. Any change at position `N` invalidates the cache for all positions `>N`.
- **The Failure Mode**: Injecting *volatile data* (Current Time, Session ID, Random Seed) into the **System Prompt** (the very top) invalidates the cache for the entire session. Every session becomes a "cold start."

## Our Vulnerability
We currently inject:
1.  `[SYSTEM TIME: ...]`
2.  `[SESSION ID: ...]`
in `src/app/agent-loader.ts` (or `manager.ts`) likely at the *start* of the prompt construction.

## The Fix
**Structure the Context for Cache Affinity:**
1.  **Static Prefix (Cached)**: Identity, Core Philosophy, Tools, Fixed Knowledge. (This should never change across sessions).
2.  **Volatile Suffix (Uncached)**: Current Time, Session ID, User Input, Recent History.

## Proposed Principle: P147 KV-Cache Discipline
> **P147 KV-Cache Discipline**: "Static First, Volatile Last."
> The System Prompt must be immutable across sessions to maximize KV-cache hits.
> Volatile data (timestamps, session IDs, dynamic context) must be injected into the **User Message** or a **Dynamic Suffix**, never the System Prompt.
> *Reasoning*: A single changed token at the top invalidates the entire cache, increasing cost by 10x and latency by 5x.

## Action Plan
1.  **Audit**: Check `agent-loader.ts` / `manager.ts` for where `[TIME]` and `[SESSION]` are injected.
2.  **Refactor**: Move these injections to the `user_message` payload or a discrete `system_suffix` (if supported), or just append them to the first user turn.
3.  **Standardize**: Enforce "Append-Only" for context history (already our practice, but good to reaffirm).

## Impact
- **Cost**: Expected ~50-80% reduction in input token costs for frequent agents (May, Bob).
- **Latency**: Faster time-to-first-token.
