# 2026-03-05 Philosophy Check: Git History Review

I have reviewed the last 5 git commits (`26644a5` to `9fdb3f9`) against the design philosophy.

## Summary
The team is actively executing **Phase 2: Harden** (Principle 7). Recent changes focus on moving structural logic from LLM to JS, improving visibility, and fixing specific failure modes observed in operation. This indicates a healthy "Act → Verify → Refine" loop (Principle 15).

### Aligned ✅

*   **Logic Migration to JS (Principle 21 & 27):**
    Commit `1ff096c` ("drain-todo JS handler") is a textbook application of **Deterministic Guardrails**. By moving the "loop through items" logic out of the agent and into raw JS, we eliminate the risk of the agent getting distracted or stopping early. This perfectly fits **Principle 27 (Agent as Feature Unit)**: "Non-agent concerns... stay as raw JS".

*   **Visibility & No Silent Failures (Principle 11):**
    Commit `a890347` (Telegram notifications) ensures background cron jobs don't fail silently. This operational visibility is crucial for reliability.

*   **Simplification (Principle 3):**
    Commit `bb11175` explicitly mentions "simplify cron message", reducing noise in the system.

### Drift ⚠️

*   **None Detected.** The recent work is tightly aligned with reliability and structural improvement.

### Observations

*   **Path Hallucination Fix (`26644a5`):** The fix involves "write constraints in agent system prompt". While this addresses the immediate issue, **Principle 21** prefers structural constraints over prompt instructions where possible. We should monitor if prompt instructions are sufficient or if a code-level path restrictor is needed later.

## Recommendations
*   Continue the pattern of **"LLM-to-JS" migration** (as seen in `1ff096c`) for other structural loops (e.g., the meta-loop orchestration itself could eventually move to JS if the logic becomes rigid enough).

# 2026-03-06 Analysis of Failures: The "Consolidator Corruptor" Pattern

I have analyzed the last 10 evaluations ( to ).

## Summary
The **Blind Overwrite** pattern has mutated and infected the meta-layer. **Bob** is now the primary vector of data corruption. During the  cron job, Bob reads  files, receives truncated output, and rewrites them based on partial data.

### Critical Findings
*   **Bob Regression:** 100% of analyzed consolidation tasks resulted in file corruption or tool errors.
*   **Fix Failure:** Previous instructional fixes (adding warnings to ) failed because the agent ignored them while rewriting the very file containing the warning.
*   **Structural Gap:** The "Shrink Guard" (preventing <50% writes) is insufficient for large files where a truncated read might still return >50% of the content, allowing subtle data loss at the end of the file.

### Recommendations
1.  **Stop Full Rewrites:** The  task must switch to an **Append-Only** or **Surgical Edit** model. Reading and rewriting entire knowledge bases is inherently unsafe with current context limits.
2.  **Hard Block on Truncated Writes:** Implement a structural check in the  tool that rejects the operation if the content was derived from a read containing .

# 2026-03-06 Design Review: Unified Cron & Session Architecture

I have reviewed and refined the "Unified Cron & Session Design" document (`docs/cron-session-design.md`).

## Summary
This design moves cron management, job scheduling, and concurrency control from the LLM layer into deterministic infrastructure (JS/TS), which is perfectly aligned with **Phase 2: Harden**.

### Aligned ✅
*   **Deterministic Guardrails (P14)**: Concurrency (`skip` policy) and timeouts are now enforced by code, not agent judgment.
*   **File System as Memory (P11)**: The addition of `.state/job-history.jsonl` creates a persistent, append-only memory of system events that survives restarts.
*   **Measurable Operations (P18)**: `JobResult` standardizes metrics across both AI and JS tasks.

### Key Refinements
1.  **Concurrency Control**: Explicitly defined `skip` (don't stack) as the default policy for overlapping heartbeats and jobs.
2.  **Zombie Management**: Added mandatory `timeoutMs` and `SIGKILL` logic for spawned job processes.
3.  **Compaction Safety**: Defined a "Hard Reset" fallback if persistent sessions hit context limits and compaction fails.
4.  **Unified Indexing**: Introduced `.state/job-history.jsonl` so agents can efficiently query "what happened since I last woke up?" without expensive file tree scanning.

### Recommendations
*   **Implementation Priority**: The `JobResult` interface and JSONL appending logic are critical prerequisites for the unified system. The Cron Runner needs to implement these immediately.

## 2026-03-06: Launcher Design Review

Reviewed the proposed `launcher.ts` design.
- **Assessment**: Structurally sound but flawed in handling "intentional restart" vs "crash".
- **Gap**: Lacks a mechanism for immediate hot-reload (currently would backoff 2s+).
- **Recommendation**: Introduce `exit(100)` for hot-reload to bypass backoff. Use `tini` in Docker to handle zombie reaping.
- **Deliverable**: `workspace/launcher-review.md`

## 2026-03-06: Launcher Design Review

Reviewed the proposed `launcher.ts` design.
- **Assessment**: Structurally sound but flawed in handling "intentional restart" vs "crash" — both exit non-zero, causing backoff on hot-reloads.
- **Recommendations**:
  1. Exit code protocol: 0=stop, 1=crash (backoff), 100=hot-reload (immediate restart)
  2. Shutdown timeout: SIGKILL after 5s if child ignores SIGTERM
  3. Docker: Use `tini` as PID 1 to reap zombies, launcher runs under it
- **Verdict**: Do not implement as-is. Add exit code protocol first.
- **Full analysis**: `agents/bob/workspace/launcher-review.md`
