# Design Review: Task Completion Notifications

## Summary
**Verdict:** ✅ **Approved with minor hardening recommendations.**

The design correctly identifies the Manager (infrastructure) as the owner of notification delivery, relieving agents of "chore" work (P40). The use of a fallback file (`.state/undelivered-notifications.jsonl`) combined with `fs.watch` provides a robust, spec-file based coordination mechanism (P16) that survives process restarts (P10).

## Strengths
1.  **Philosophy Alignment (P40, P15):** Correctly offloads routing and delivery reliability to the infrastructure layer. Agents just dispatch and listen.
2.  **Crash Recovery (P10):** addressing the "lost callback" problem by removing callbacks entirely and relying on durable state (registry + fallback file) is the correct architectural choice.
3.  **Cross-Process Bridge:** The JSONL fallback file is a simple, effective solution for the detached sub-agent problem without introducing a complex message queue (P1: Simplest Thing That Works).
4.  **Error Taxonomy:** The distinction between transient infra errors (retry) and semantic errors (notify) is excellent and prevents silent failures (P6).

## Risks & Recommendations

### 1. Startup Race Condition
**Risk:** If `drainUndeliveredNotifications()` triggers immediately on startup (via `fs.watch` or initial scan) *before* `resumeAgent()` has fully populated the `activeSessions` map, notifications might fail to route and be written back to the fallback file (loop) or dropped.
**Recommendation:** Ensure `resumeAgent` (and the population of `activeSessions`) completes *before* the initial drain of the fallback file. The startup sequence should be: `Load Registry -> Resume Agents -> Start Watcher/Drain`.

### 2. `fs.watch` Reliability
**Risk:** `fs.watch` is notoriously flaky across platforms (especially Docker mounted volumes or specific Linux kernels). It can miss events.
**Recommendation:** Explicitly treat `fs.watch` as a **latency optimization**, not a reliability guarantee. The heartbeat-based drain (polling) is the true reliability layer. Ensure the polling interval is frequent enough (e.g., every heartbeat or 10s) to act as a fallback if the watch fails.

### 3. File Concurrency
**Risk:** Multiple detached agents writing to `.state/undelivered-notifications.jsonl` simultaneously could interleave lines or corrupt the file if atomic appends aren't guaranteed by the OS/FS.
**Recommendation:** 
*   **Defensive Parsing:** The reader must handle malformed JSON lines gracefully (log & skip) rather than crashing the manager.
*   **Atomic Write:** Ensure the implementation uses `fs.appendFile` (usually atomic for small writes) or a simple lock/retry mechanism if high volume is expected.

### 4. Dead Letter Handling
**Risk:** If a parent session is gone AND the persistent interface agent is unreachable (or configured differently), a notification could theoretically cycle forever or fill up the log.
**Recommendation:** Add a `retryCount` field to the JSONL record. If delivery fails > 5 times (or whatever threshold), log an error to the system log and drop the notification from the queue to prevent infinite loops.

## Implementation Notes
- **Philosophy P16 (Spec-File):** The `.state/undelivered-notifications.jsonl` file effectively acts as a coordination spec. Keep the schema simple and extensible.
- **Philosophy P8 (Hard Constraints):** If the file system is read-only or full, this will fail. Ensure the manager logs this catastrophically (std/err) since it's a critical infra failure.

## Conclusion
The design is sound. Proceed to implementation, paying attention to the startup sequence and file writing concurrency.
