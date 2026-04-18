## Brief: Log Viewer Implementation

**Why**: AgentGym-RL (arXiv:2509.08755) and Manus Engineering emphasize **Visual Trajectory Analysis**. Debugging via raw `.jsonl` logs is inefficient. We need to *see* the "Thought → Action → Observation" loop clearly to identify inefficiencies and loops.

**What**: Create a simple HTML/JS log viewer for `session.jsonl` files.
1.  **Input**: Reads `.state/sessions/<session_id>/session.jsonl`.
2.  **Output**: Generates a static HTML report (or runs a local server) showing:
    *   **Timeline**: Each turn as a distinct block.
    *   **Thought**: The agent's reasoning (collapsed by default).
    *   **Action**: Tool calls (highlighted).
    *   **Result**: Tool outputs (truncated, expandable).
    *   **Color Coding**: Success (green), Error (red), Warning (yellow).

**Action**: Delegate to Master (via `gemini-cli`) to implement `scripts/log-viewer.html`.
