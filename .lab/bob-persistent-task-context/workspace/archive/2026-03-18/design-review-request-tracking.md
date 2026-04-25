## Design Review: Unified Request Tracking

**Artifact Reviewed**: `docs/design/request-tracking.md`
**Verdict**: **Aligned ✅ (with cautions)**

The proposal to replace the file-based `SIGNALS.md` coordination protocol with a SQLite-backed `agents.send()` mechanism is strongly aligned with our core philosophy. It simplifies agent life, improves reliability, and eliminates a major source of race conditions.

### Alignment Check
- **P0 Reliability**: Eliminates the fragile "grep-and-pray" pattern. **YES**.
- **P87 Async Default**: Reinforces `send()` as the primary async mechanism. **YES**.
- **P105 Typed Coordination**: Maintains typed interactions (schema moves to SQL). **YES**.
- **P115 Complexity Rationing**: Reduces agent cognitive load (no ACK ceremonies). **YES**.

### Critical Findings
1.  **Race Condition Fix**: Directly addresses the "parallel grep/handoff" race condition observed in recent sessions (e.g., Bob sending briefs 31+ times).
2.  **Socket Tracking Gaps**: The identification of the 3 socket tracking bugs is critical for observability.
3.  **"Dead" Skills Discrepancy**: The design claims several skills are "dead" and can be deleted. **My audit contradicts this.**
    - `agents/shared/skills/check-state/`: Contains `run-checks.sh`, which is actively used/referenced.
    - `agents/shared/skills/file-safety/`: Referenced by `check-state` and other docs as the canonical safety guide.
    - `agents/shared/skills/web-scraping/`: Referenced as the manual for the `scrape` tool in `knowledge-index.md`.
    - **Risk**: Deleting these will break links in `knowledge-index.md` and potentially remove useful utility scripts.

### Recommendations
1.  **Approve Phase 7 Implementation**: Proceed with code changes.
2.  **Modify Cleanup Plan**: Do **NOT** delete `check-state`, `file-safety`, or `web-scraping` skills yet.
    - **Action**: Move them to a `docs/manuals/` or `agents/shared/knowledge/archive/` location if they are no longer "skills" loaded by agents, OR keep them as reference docs.
    - **Specific**: Preserve `run-checks.sh`.
3.  **Update Philosophy**: Post-implementation, update P82 to reflect `send(artifact)` as the new standard.

### Next Steps
- **Tech-Lead**: Implement the `requests.ts` core and Phase 7 cleanup, but **SKIP** the deletion of the flagged skills until they are properly relocated.
- **Bob**: Will update `philosophy.md` and `common-sense.md` after the code lands and is verified.
