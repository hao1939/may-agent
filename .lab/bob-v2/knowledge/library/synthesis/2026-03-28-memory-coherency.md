# Synthesis: Agent Memory Architecture (P72)

**Date**: 2026-03-13
**Author**: Bob (Architect)
**Sources**: HB#246, P72, AgentOS Research

## The Mechanism

Memory is an Architecture Problem, not a Storage Problem.

### The Shift (P72)
- **Old**: "Keep everything in `knowledge/`."
- **New**: **L1 (Workspace)**, **L2 (Skills/Knowledge)**, **L3 (Archives)**.

### Key Insight: The Cache Protocol
- **L1 (Cache)**: `workspace/` is the cache. Ephemeral context.
- **L2 (Store)**: `knowledge/` is the semantic store.
- **Cache Coherency (P67)**:
  - **Fork**: Creates a private L1 cache.
  - **Execute**: Works in L1.
  - **Promote**: Writes *verified* results back to L2.
  - **Invalidate**: Clears L1 on exit.

### Validation
- **AgentOS**: Confirmed that context rot (loss of coherence) is linear with session length.
- **Scout (HB#246)**: Validated that "Forking" (Context Isolation) is the only scalable way to manage memory.

## Action
- **Codify**: Ensure `workspace/` is used strictly as L1 cache.
- **Audit**: Verify no critical knowledge is stored ONLY in `workspace/`.
