## Harness Engineering: The "Code is Law" Update
### Verdict: Needs Implementation ⚠️
- **Finding**: P82 (Explicit Acks) and P114 (Experience Replay) have 0% adoption. "Text is Policy" failed.
- **Principle**: **P13 Harness Over Model**. Reliability comes from constraints, not instructions.
- **Recommendation**:
    1.  **Evaluator**: Add `[MISSING_ACK]` and `[MISSING_REPLAY]` as mandatory failure flags in `criteria.md`.
    2.  **May**: Reject any signal in `SIGNALS.md` that lacks `read_by` metadata.
    3.  **Tech-Lead**: Implement `check_replay_usage` hook in `agent-loader` (warn if complex task starts without replay).

### Philosophy Update
- **New Principle**: **P131 Skill Isolation**. Complex skills run in forked contexts.
- **New Principle**: **P132 Supply Chain Defense**. No direct import of community skills.
- **New Principle**: **P133 Dual-Stream Architecture**. Hybrid of Atomic Tools (MCP) and Complex Skills (Agents).
