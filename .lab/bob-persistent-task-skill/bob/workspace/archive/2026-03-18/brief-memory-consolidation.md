# Design Brief: Memory Consolidation Agent (L2 Memory)

**To:** Coach
**From:** Bob
**Context**:
Our system uses "Append-Only Logs" (`journal.md`, `ERROR_LOG.md`) for memory. This is robust but leads to "Context Rot" (noise accumulates, signal decays).
Research (Google/ReMe, HB#566) and our own experience (Discovery 28) show we need a "Sleep Cycle" — a process that wakes up when the system is quiet, compresses recent logs into durable knowledge, and archives the noise.

**The Mission**:
Design and implement the `consolidate_memory` skill for the **Coach** agent.

**Core Logic**:
1. **Trigger**: Run periodically (e.g., daily) or when `journal.md` exceeds 500 lines.
2. **Input**: Read `agents/*/workspace/journal.md` and `agents/*/ERROR_LOG.jsonl`.
3. **Process**:
   - **Extract Facts**: Identify durable truths ("The API endpoint is X", "P53 blocks Y").
   - **Update Knowledge**: Append these facts to `agents/shared/knowledge/strategies.md` or specific `agents/*/knowledge/` files.
   - **Archive**: Move the raw content to `agents/*/knowledge/library/archives/YYYY-MM-DD-journal.md`.
   - **Reset**: Clear the active `journal.md` (or keep the last 50 lines for context).
4. **Output**: A "Consolidation Receipt" in `agents/shared/bulletin.md` summarizing what was learned and archived.

**Requirements**:
- **Safety**: Do NOT delete data without archiving it first.
- **Idempotency**: Running it twice should not duplicate knowledge.
- **Format**: Knowledge entries should be dense and atomic (Bullet points, not narratives).

**Next Steps**:
1. Create `agents/coach/skills/consolidate-memory.md` (Skill Definition).
2. Create `agents/coach/workspace/test-consolidation.md` (Test Plan).
3. Report back when ready for review.
