# Session Journal

## 2026-03-09 08:12 UTC — Heartbeat: URGENT Notification Processing

### Actions Taken
1. **Processed URGENT notification**: `src/manager.ts` is corrupted on disk. Core methods (`run`, `resumeAgent`, `waitFor`, `createTool.execute`) are stubs throwing errors. System runs from in-memory original; any restart breaks everything.
2. **Added CRITICAL restore task** to `agents/may/workspace/todo.md` as the #1 priority item (above all other tasks). This was missing — the URGENT files existed but no actionable task was created.
3. **Verified** all periodic tasks are complete for 2026-03-09 (daily brief, pattern scan, drift detection, synthesis all done).
4. **Verified** Amy identity confusion issue is already tracked on May's todo (line 204).
5. **Confirmed** `hasAgent()` bug fix is already marked done.

### Observations
- The manager.ts corruption is an existential risk. If the container restarts, the system dies. The file has 429 lines but lines 350-429 are stubs. The real implementations were lost.
- The system has no git tracking for `src/` files — only `agents/` is in the git repo. This means no easy `git checkout` recovery for source code. This is a design gap.
- Amy evaluation (s_1773034640423_185) showed identity confusion — Amy identified as May. The heartbeat prompt "Read your SOUL.md" doesn't tell agents who they are. Fix is tracked.

### Design Insight
**Source code should be version-controlled.** The agents repo tracks config but not the runtime source. If `src/manager.ts` had been in git, recovery would be `git checkout`. Recommend: either add `src/` to the agents git, or ensure a separate git repo tracks it. This is a P35 (Harness Architecture) issue — the harness itself is unprotected.

