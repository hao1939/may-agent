## Philosophy Check: Session Model Simplification

### Aligned ✅
- **P1 Simplest Thing**: Removing "idle" state, sub-agent persistence, and followUp routing logic drastically reduces system complexity.
- **P11 File System as Memory**: The new model strictly enforces this. Agents can't rely on hidden in-memory state; they must write to files to "remember". This makes the system more observable and robust.
- **P12 Context Isolation**: Fresh task sessions guarantee zero pollution from previous runs. Debugging becomes easier ("Replay this task" is reliable).
- **P40 Agents Do Cognitive Work**: Offloads state management to the filesystem and infra, letting agents focus purely on the task at hand.

### Drift ⚠️
- **Loss of Steering**: Removing `followUp` for task sessions kills `steer`. While "Explicit Intent" (Cancel/Retry) is cleaner, it might be expensive for long-running tasks (e.g., "Pause" or "Stop that specific file").
  - *Mitigation*: Accept this cost for now. If long tasks become common, re-introduce a limited "Control Signal" (not full chat) later.

### Recommendations
- **Approve**. The simplification aligns perfectly with "Phase 2: Harden".
- **Watch**: Monitor token usage. Fresh sessions mean re-reading context every time. Ensure caching (preamble caching) is working effectively.
