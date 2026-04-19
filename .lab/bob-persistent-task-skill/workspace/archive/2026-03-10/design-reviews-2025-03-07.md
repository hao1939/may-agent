# Design Reviews (2025-03-07)

## Document 1: Rolling Compaction
**Source:** `agents/may/workspace/rolling-compaction-design.md`

### Assessment
The proposed **Option C (Manager-Level Compaction After Idle)** is structurally sound and aligns with our philosophy of "Disk as Truth, Memory as Context" (P11).

### Strengths
- **Correct Separation of Concerns:** It correctly identifies that the "Full History" (Disk) and "LLM Context" (Memory) have different lifecycles. Disk is append-only; Memory is a sliding window.
- **Safety:** By performing compaction *only* when the session is `idle`, it avoids race conditions where new messages might be arriving during the compaction process.
- **Zero Library Changes:** Avoiding changes to `pi-agent-core` is a significant win for maintainability (P1).

### Risks & Gaps
1. **The "Resume" Spike:** The design notes that on restart, the full history is loaded into memory only to be compacted immediately.
   - *Risk:* If a session has 10k messages, loading them all might crash the process OOM before compaction can even run.
   - *Recommendation:* Prioritize the "Future optimization" (saving `session-compact.jsonl`) to **Phase 1**. If we can't load the state, we can't compact it.
2. **Data Loss on Crash:** If the process crashes *during* the `replaceMessages` operation, is the in-memory state consistent?
   - *Mitigation:* Since the disk `session.jsonl` is untouched, a crash simply means we reload from disk on restart. This is safe.

### Verdict
**APPROVED**. Proceed with Option C. Add a specific TODO to stress-test the "Resume Spike" scenario with >5k messages.

---

## Document 2: Detached Sub-Agent
**Source:** `agents/may/workspace/detached-subagent-design.md`

### Assessment
This is a critical infrastructure upgrade that moves us from "process-per-task" (heavy, rigid) to "agent-as-service" (flexible, steerable). It correctly leverages the existing socket infrastructure.

### Key Questions Answered

**1. Does the existing socket protocol handle `steer` and `cancel`?**
**Yes.** `run/ui/socket.ts` already listens for JSON commands and emits them to the event bus. `may.ts` (the runner) connects the event bus to the agent loop.
- `steer` → `bus.command({type: "steer", ...})` → `agent.steer()`
- `cancel` → `bus.command({type: "cancel", ...})` → `agent.abort()`
The infrastructure is ready; the design correctly identifies we just need to *send* these commands from the parent.

**2. Who cleans up zombie detached processes?**
**Gap Identified.** The design relies on the parent calling `cancel` or `process.kill`.
- *Risk:* If the parent process crashes (e.g., OOM), the detached child process might run forever (or until its task completes).
- *Recommendation:* Detached agents should have a "parent heartbeat" or "suicide timer" (e.g., if no socket connection for 1 hour, exit). Or simpler: The `launcher` should scan for orphaned `may.ts` processes on startup and kill them.

**3. SESSION_ID env var — collision risk?**
**Low Risk.** `generateId()` uses `Date.now() + counter`.
- Since the parent generates the ID, there is zero collision risk *within* the parent's tree.
- Cross-process collision is theoretically possible if two parents spawn at the exact same millisecond, but extremely unlikely.
- *Refinement:* Add the parent's PID to the session ID prefix (e.g., `s_{parentPid}_{timestamp}`) to guarantee uniqueness.

**4. Is the 4-phase implementation plan correctly ordered?**
**Yes.** Phase 1 (Core) correctly targets the minimum viable primitives (`spawnDetachedAgent`, `socket-client`). Phase 2 (Interaction) adds the value.

**5. Which agent should implement this?**
**The Coder**, orchestrated by the **Optimizer**.
- This is a complex refactor involving `src/`, `run/`, and `agents/`.
- It requires precise "surgical edits" (P37) to `manager.ts` and `subagents` tool defs.

### Verdict
**APPROVED with One Condition**: Add a "Zombie Cleanup" strategy (either launcher-based cleanup or a timeout in the detached process).

---

## Summary of Recommendations

1. **Rolling Compaction**: Move "Load from compacted state" to Phase 1 to prevent OOM on resume.
2. **Detached Agents**: Add a mechanism to kill orphaned detached processes if the parent dies.
