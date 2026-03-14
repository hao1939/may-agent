# Synthesis: The Harness Convergence
**Date:** 2026-03-13
**Sources:** HB#234 (Harness Engineering), HB#235 (Minimal Architecture), HB#236 (OpenAI Guide), AgentOS Paper.

## The Pattern
The industry is converging on a three-layer architecture for robust agent systems. The terminology varies, but the structural boundaries are identical.

| Layer | OpenAI Guide | AgentOS | Harness Eng. | Our System |
|-------|--------------|---------|--------------|------------|
| **L1** | Model | Kernel | Policy Gen. | **Channel** (LLM) |
| **L2** | Instructions | Skills | Decision | **Gateway** (Prompts/Router) |
| **L3** | Tools | Modules | Execution | **Runtime** (Tools/FS) |

## Key Insights

### 1. The "Harness" is the Moat
As models commoditize, the value shifts to the **Harness** (L3) — the runtime environment that guarantees safety, persistence, and state management.
-   **OpenAI**: "Maximize single-agent capability; multi-agent adds complexity." (Validates our P79 Ralph Loop).
-   **Harness Eng**: "Tool layer keeps changing; engineering paradigm is the stable investment."
-   **AgentOS**: The OS itself becomes the coordination layer.

### 2. Context Rot is the New Bottleneck
"Context Rot" (Amnesia) is the primary failure mode for long-running agents.
-   **Symptom**: Variable names drift, logic disconnects.
-   **Fix**: "Fresh Context" (GSD pattern) — 200k tokens per task, destroy after use.
-   **Implication**: Our "persistent session" model (ChatSession) needs a "Refresh" mechanism. We should not keep a session open forever.

### 3. Memory ≠ Logs
Storing raw execution logs is "lazy memory".
-   **Trend**: Trajectory-Informed Memory. Extract **Tips** (Strategy / Recovery / Optimization) from logs.
-   **Action**: We need a "Distillation" step in our Growth Cycle.

## Recommendations

### 1. Adopt "Harness" Terminology
Rename "Runtime" to "Harness" in our mental model. It emphasizes *control* and *safety* over just *execution*.

### 2. Implement "Session Refresh" (P86)
Added P86 to `philosophy.md` for "Refresh or Fork". If a task session exceeds 20 turns, summarize and restart (or fork).

### 3. Hard-Gate External Skills
With 824+ malicious skills in the wild, **P53 (Write Protection)** must extend to **Skill Import**.
-   **Rule**: Never run an external skill without `verify-skill` passing.
-   **Rule**: Isolate skill execution (we already do this via tool boundaries, but could be stricter).

## Verdict
Our architecture is sound. We are ahead of the curve on "Agent as Skill" and "File-System as Truth". We are behind on "Context Management" and "Memory Distillation".
