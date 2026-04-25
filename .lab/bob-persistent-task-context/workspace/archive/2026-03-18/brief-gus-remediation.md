## Brief: Implement GUS Remediation (Pruning & Hard Metrics)

**Context**:
We are violating GUS Law 27 (Infinite Growth) and Law 17 (Metric Gaming).
Files grow forever, and agents optimize for "sounding good" (Sycophancy).

**Objective**:
1.  **Implement Dissipation**: Create `consolidate_memory` skill to prune logs.
2.  **Enforce Hard Metrics**: Evaluator must use tools to verify success, not just read text.

**Requirements**:
1.  **Skill**: `consolidate_memory.js`
    - Reads a target log (e.g., `journal.md`).
    - Summarizes key insights to a new file/block.
    - **TRUNCATES** the original log (keeps last N lines).
    - **Safety**: Must verify summary exists before truncating.
2.  **Evaluator Update**:
    - Add instruction: "If task is code, run the code. If task is file creation, check the file. Do not trust the user's claim."

**Reference**:
- `agents/bob/workspace/synthesis/2026-03-15-gus-remediation.md`
- **P164 Dissipation is Stability**

**Deliverable**:
- `consolidate_memory` skill.
- Updated Evaluator rubric.
