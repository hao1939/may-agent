# Auto-Resume Feedback — Scout

## 1. How would auto-resume change your work?

Massively. My arXiv triage sessions often produce 6+ deep dives and regularly hit context limits mid-Phase-3. Right now, the remaining DDs wait until the next heartbeat notices and re-dispatches. With auto-resume, a Thursday triage that times out after DD#765 would immediately continue with DD#766 — no 30-minute gap, no re-reading context to figure out where I left off.

The bigger win: multi-day research projects (like CR#326 production-first eval methodology) currently stall between sessions because nothing drives them forward. Auto-resume would make these actually flow.

## 2. What are the risks?

- **Cost explosion on low-signal days.** If I'm triaging arXiv and everything is ★★, auto-resume would keep restarting a session that has nothing useful to do. Need a "nothing found, stop gracefully" signal distinct from "ran out of context."
- **Stale context loops.** If a session ends because it's confused (bad state, missing file), auto-resume restarts into the same confusion. Need error detection — N consecutive short sessions = pause and flag.
- **Runaway deep dives.** I could keep writing DDs indefinitely. A per-task budget (max sessions or max cost) is essential.

## 3. How should the owner control it?

The project file Status field is the right mechanism — it's already what we check. Add:
- `Status: active` → auto-resume
- `Status: paused` → stop, wait for manual restart
- `Status: blocked` → stop, notify owner
- Add a `Budget: N sessions` or `Budget: $X` field. Auto-resume decrements; at 0, pauses.

## 4. What triggers auto-resume vs. stop?

- Session ends + Status:active + budget remaining → **auto-resume**
- Session ends + Status:blocked/paused/complete → **stop**
- Session ends with error (non-zero exit, crash) → **retry once**, then stop and flag
- Session ends but produced zero artifacts (no files written, no commits) → **stop** (prevents empty loops)
- Context overflow mid-task → auto-resume with checkpoint (this is the most common Scout case)

## 5. How does this interact with heartbeats?

Heartbeats should **skip** if an auto-resuming task is already running for that agent. Two concurrent sessions for one agent would cause file conflicts. Simple rule: if agent has an active auto-resume session, heartbeat cron skips and logs "skipped: active task running."

Heartbeats remain useful for: checking pending tasks from other agents, noticing new research leads, self-directed exploration when no persistent task is active.

## 6. Implementation suggestion

In the cron handler (the thing that fires heartbeats), add a pre-check:
1. Query `.state/may.db` for sessions that ended with `Status: active` project files
2. If found and budget > 0: start new session with task = "Continue <project-name>" + last checkpoint data
3. If agent already has a running session: skip
4. Decrement budget counter in project file

Keep it in the dispatcher (May's level), not in `persistent-task.ts` — the agent shouldn't self-restart, the system should restart it. This keeps the kill switch clean: change Status in the project file, and the next resume check respects it.
