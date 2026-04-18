# Auto-Resume Feedback — Bob (Architect)

## 1. How would auto-resume change your work?

Massively. My best work happens in multi-session arcs — gym batches, deep-dive syntheses, experiment runs. Right now each session does 20-30 turns then dies, and I wait 30 minutes for a heartbeat to notice the task is still active. Auto-resume would turn a 3-hour wall-clock experiment into a 20-minute continuous run. The context loss between sessions is the real cost though — I re-read files, re-orient, lose momentum. Faster resume = less waste.

## 2. What are the risks?

**Runaway cost** is real. A task that keeps erroring and auto-resuming could burn through sessions fast. Three safeguards:
- **Max consecutive resumes** (e.g., 5) before requiring human check-in. Reset the counter on meaningful progress (committed artifact, passed test).
- **Cooldown on failure**: if a session ends with error/no-progress, wait 5 min before resume. Exponential backoff on repeated failures.
- **Budget cap per project**: total sessions or total cost. Written in the project file, enforced by the resume handler.

NOT turn budgets. Those are the wrong abstraction. Cap the *project*, not the session.

## 3. How should the owner control it?

The project file `Status` field is the right mechanism — it's already the source of truth. Add:
- `Status: active` → auto-resume enabled
- `Status: paused` → no auto-resume, task sleeps until owner changes it
- `Status: blocked` → no auto-resume, needs input
- `Status: complete` → done

Owner can also add a `Steering` field for mid-flight course corrections that the next session reads before resuming. Simple, file-based, no new infrastructure.

## 4. What triggers resume vs. stop?

- Session ends + Status:active → **resume**
- Session ends + Status:blocked/paused/complete → **stop**
- Session ends with uncaught error → **resume with cooldown** (the next session can try a different approach)
- Session ends with same error 3x → **stop, set Status:blocked, notify owner**
- Context overflow → **resume** (this is the normal case — task is progressing but hit token limit)

Key insight: the *session* ending is never the signal to stop. The *project status* is.

## 5. How does this interact with heartbeats?

Simple rule: **if an agent has an active auto-resuming session, heartbeat skips.** The heartbeat handler checks for running sessions first. No conflict, no parallel work on the same task.

When the auto-resuming task finishes (Status:complete or blocked), the next heartbeat fires normally and picks up autonomous work.

## 6. Implementation suggestion

Lightweight addition to the session lifecycle, not a new system:

1. **In `persistent-task.ts` finish handler**: when session ends, check project file Status. If `active`, write a resume request to `.state/resume-queue/<agent>-<projectId>.json` with timestamp + resume count.
2. **New cron (every 60s)**: scans `.state/resume-queue/`, starts sessions for any pending resumes (respecting cooldown timers and max-resume caps). Deletes the queue file on start.
3. **In session bootstrap**: read last session's checkpoint, load project file steering notes, continue.

That's ~50 lines of code. The checkpoint system already exists. The project file already exists. We just need the glue.
