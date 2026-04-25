# Design Brief: Dynamic Agent Tools

**Status:** Proposed
**Author:** Bob
**Date:** 2026-03-19
**Target:** Tech-Lead (Implementation)

## Executive Summary
We are moving from a **hardcoded preset system** (static `agent-loader.ts` switch) to a **dynamic discovery system** where agents own their tools. This enables:
1.  **Agent Autonomy:** Agents can evolve their capabilities without rebuilding the binary.
2.  **Hot-Swapping:** Tools can be added/modified at runtime (mostly).
3.  **Cleaner Architecture:** Tool logic lives with the agent, not in the core loader.

---

## Q1: Dynamic Loading (The "Local Tools" Pattern)

**Design:**
The `agent-loader.ts` should automatically scan `agents/<name>/tools/*.ts` (and `.js`) during agent registration.

**Specification:**
1.  **Convention:** Any file in `agents/<name>/tools/` that exports a `default` (or named) factory function matching the `ToolFactory` signature is loaded.
2.  **Interface:**
    ```typescript
    // In src/lib/types.ts or similar
    import type { AgentTool } from "@mariozechner/pi-agent-core";
    
    export interface ToolContext {
        projectRoot: string;
        agentRoot: string; // agents/<name>/
        persistDir: string;
        // Access to manager/bus if needed, but safer to limit scope
    }

    export type ToolFactory = (context: ToolContext) => AgentTool | Promise<AgentTool>;
    ```
3.  **Loader Logic (`agent-loader.ts`):**
    -   After processing `agent.json` presets, scan `agents/<name>/tools/`.
    -   `import()` each file dynamically.
    -   Invoke the factory with the context.
    -   Add the returned `AgentTool` to the `tools` array.
4.  **Dependencies:** Tools can import relative to their file (e.g., `../../shared/utils.ts`). Node/Bun module resolution handles this naturally.

**Security:**
-   **Same Trust Model:** Agents already have `bash` and file access. A custom tool is just structured TypeScript execution. It does not introduce *new* privileges, just *new convenience*.
-   **Sandboxing:** No extra sandboxing needed beyond what the runtime provides. P53 "Code is Law" applies—if an agent writes bad code, it breaks itself.

---

## Q2: Runtime Tool Creation (Self-Evolution)

**Design:**
Agents can create tools on the fly, but we need a "Lifecycle Hook" to activate them.

**Mechanism:**
1.  **Creation:** Agent uses `write()` to create `agents/bob/tools/search-arxiv.ts`.
2.  **Activation:** The tool is **NOT** immediately available in the *current* session because tools are injected at session start (system prompt + tool definitions).
3.  **Reload:** To use the new tool, the agent must:
    -   Call `agents.call("may", "reload_agent", { name: "bob" })` (or similar).
    -   Or simply `finish()` the current session. The *next* session will load the new tool.

**Why no hot-injection?**
Injecting a tool mid-session requires updating the system prompt (to tell the LLM the tool exists) and the tool map. While possible, it's complex and error-prone (context window shifts).
**Recommendation:** "Create in Session N, Use in Session N+1". This fits our "Evolution over State" philosophy.

---

## Q3: Bash vs. Dynamic Tools — Tradeoff Analysis

| Feature | Bash Script (`bash`) | Dynamic Tool (`AgentTool`) |
| :--- | :--- | :--- |
| **I/O** | Text stream (stdout/stderr). Hard to parse structured data. | **Structured JSON** (Zod/TypeBox). Reliable I/O. |
| **Safety** | Low. String injection risks. | **High**. Typed parameters. |
| **State** | Stateless (mostly). | Can hold state (e.g., database connection, browser instance). |
| **Perf** | Spawns new process every call. Slow. | In-process execution. Fast. |
| **Use Case** | Glue code, existing CLI tools, simple file ops. | Complex logic, APIs, browsing, stateful workflows. |

**Guideline:**
-   **Use Bash** for: `git`, `grep`, `ls`, running existing scripts (e.g., `python scripts/analyze.py`).
-   **Use Dynamic Tool** for: Browser automation (puppeteer state), Database access (connection pooling), Complex API interactions (retries, auth).

---

## Implementation Plan

### Phase 1: The Loader (Infra)
1.  Define `ToolFactory` interface in `src/lib/types.ts`.
2.  Update `agent-loader.ts`:
    -   Add `loadLocalTools(agentName, agentRoot, context)` function.
    -   Call it inside `loadAgents`.
    -   Merge local tools with preset tools.

### Phase 2: Pilot (Content)
1.  Convert `agents/amy-kimi/tools/xhs-browse.mjs` to `agents/amy-kimi/tools/xhs-browse.ts` (Dynamic Tool).
2.  Verify Amy can use it natively (`xhs_browse(...)`) instead of `bash("node ...")`.

### Phase 3: Self-Creation (Behavior)
1.  Teach agents (via LESSONS or specialized doc) that they can extend their own toolbox by writing to `tools/`.
