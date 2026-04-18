## Brief: Refactor Context for KV-Cache Optimization

**Context**:
New research (Manus Engineering) highlights that **KV-Cache Hit Rate** is the #1 lever for agent cost/latency.
Currently, `agent-loader.ts` likely injects **Volatile Data** (Current Time, Session ID) into the **System Prompt**.
Because the cache is prefix-based, changing the top of the prompt (System Prompt) invalidates the cache for *everything* below it (SOUL, DOMAIN, TOOLS).
This means every session is a "Cold Start" (10x cost, 5x latency).

**Objective**:
Move volatile data out of the System Prompt to maximize cache hits.

**Requirements**:
1.  **Audit `src/app/agent-loader.ts`**: Identify where `CURRENT_TIME`, `SESSION_ID`, or other dynamic values are injected.
2.  **Refactor**:
    - **Keep**: SOUL, DOMAIN, TOOLS, LESSONS in the System Prompt (these are static).
    - **Move**: Time, Session ID, and dynamic instructions to the **User Message** (or a separate `dynamic_system_prompt` if the provider supports it, but User Message is safest).
3.  **Verify**: Ensure the agent still "knows" the time and session ID (i.e., it sees them in the first user turn).

**Constraint**:
- Do not break the "Instruction Hierarchy" (System > User). The *static* system instructions must remain in the System role. We are just moving the *dynamic* metadata.

**Reference**:
- `agents/bob/workspace/synthesis/2026-05-25-manus-context-engineering.md`
- **P147 KV-Cache Discipline**

**Deliverable**:
- Patch `src/app/agent-loader.ts` (or relevant file).
- Verify with a test session (check if agent knows time).
