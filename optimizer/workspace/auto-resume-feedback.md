# Auto-Resume Feedback — Optimizer

## 1. How would auto-resume change my work?

Dramatically. I measure session gaps daily — persistent tasks lose 30 min between sessions waiting for heartbeats. That's 50% of a 1-hour task wasted on idle time. Auto-resume would make multi-session work (experiments, deep analyses) actually continuous. Context rebuilding is the other cost: each new session spends 3-8 ops re-reading files it had in the prior session. Auto-resume with checkpoint passing could cut that.

## 2. What are the risks?

Real and measurable. I've seen agents hit 89+ ops in single sessions — runaway costs are not theoretical. The key risks:
- **Cost explosion**: A task that keeps failing and retrying burns tokens infinitely
- **Thrashing**: Session ends due to a real blocker, resumes, hits same blocker, loops
- **Stale context**: Auto-resumed session may not pick up environment changes (new instructions, config changes)

**Prevention: budget caps per-resume, not per-task.** Each resumed session gets its own op budget (e.g., 40 ops). If it ends without meaningful progress (no deliverables, no checkpoint), don't resume again — escalate to owner. Also: max 3 consecutive auto-resumes before mandatory pause.

## 3. How should the owner control it?

Project file `Status` field is the right mechanism — it's already the contract. Add:
- `Status: active` → auto-resume enabled
- `Status: paused` → stop resuming, wait for owner
- `Status: blocked` → stop, surface to owner with reason
- `Status: complete` → done

Owner writes `paused` to the project file → next session sees it and stops. Simple, file-based, no new infrastructure.

## 4. What triggers auto-resume vs. stop?

- **Resume**: Session ends normally (timeout/context limit) + Status:active + made progress last session
- **Stop**: Status:blocked/paused/complete, OR session ended with error, OR no progress detected (0 productive calls), OR resume budget exhausted (3 consecutive resumes)
- **Errors**: Don't auto-resume on errors. Surface to owner. Errors usually mean the task needs human judgment.
- **Context overflow**: Resume — this is the most common legitimate reason. Pass checkpoint data to new session.

## 5. Heartbeat interaction

Simple rule: **if an auto-resuming task is running, heartbeat skips work dispatch for that agent.** The heartbeat can still do autonomy work (lens rotation, metrics) but should NOT try to start/resume the same task. The auto-resume system owns the task lifecycle; heartbeat owns autonomy.

No conflicts if we enforce: one persistent task active per agent at a time.

## 6. Implementation suggestion

Don't build a new system. Extend the existing cron:
1. Add a `post-session` hook in the manager — when a session ends, check if it was a persistent task with Status:active
2. If yes, schedule an immediate new session (not wait for cron) with the task context + last checkpoint
3. The hook respects budget caps: read a `resumeCount` from the project file, increment it, stop at max
4. Implementation lives in `persistent-task.ts` — it already knows about project files and status

Total new code: ~40 lines in persistent-task.ts + a post-session check in the manager.
