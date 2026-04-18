## Brief: Implement Context Usage Metrics (LongRLVR)

### Context
LongRLVR (arXiv:2603.02146) proves that agents fail to learn "grounding" (using context) if we only reward final answers. They regress to parametric guessing.
To fix this, we need to measure and reward **Context Usage** (did the agent read the relevant files?).

### The Task
Update `delegation-metrics.cjs` (or create `context-metrics.cjs`) to track file access patterns.

### Specific Changes
1.  **Log File Access**:
    - Monitor `read`, `grep`, `ls` tool calls in the session log.
    - Extract the *paths* accessed.
2.  **Compute Metric**:
    - `files_read_count`: Total unique files read.
    - `kb_read`: Total bytes read (approx).
    - `context_score`: (Heuristic) 1.0 if `AGENTS.md` or `README.md` read, else 0.5.
3.  **Integrate**:
    - Add these fields to the `delegation-metrics` output JSON.

### Acceptance Criteria
- [ ] `delegation-metrics` output includes `files_read` list and count.
- [ ] Evaluator can see if an agent acted without reading context.
