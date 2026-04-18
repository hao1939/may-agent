# Auto-Resume Feedback — Tech Lead

## 1. How would auto-resume change your work?

Massively. Right now persistent tasks stall for 30min between iterations. A multi-iteration refactor that needs 4 coder rounds takes 2+ hours wall-clock but only ~8 minutes of actual work. Auto-resume would make persistent tasks actually persistent — they'd finish in minutes instead of hours.

## 2. What are the risks?

- **Runaway cost**: A confused task loops 50 iterations doing nothing useful. Mitigation: cap auto-resumes per project (e.g., max 10 consecutive resumes without owner review).
- **Error amplification**: Task hits a real blocker, keeps retrying the same broken approach. Mitigation: 2 consecutive error-status sessions → pause, notify owner.
- **Resource contention**: Multiple auto-resuming tasks compete for the same agent. Mitigation: one active auto-resume per agent at a time; queue the rest.

## 3. How should the owner control it?

The project file Status field is the right interface. `active` → keep going, `paused` → stop resuming, `blocked` → stop and notify. Add a `maxResumes: N` field so owners can set a ceiling per project. Owner can also write steering notes in the project file that the next session reads.

## 4. What triggers resume vs. stop?

- Session ends normally + Status:active → **resume**
- Status:blocked or paused → **stop**
- Session ends with error → **resume once** (transient failures happen). Two consecutive errors → **stop + notify owner**
- Context overflow → **resume** (this is the normal case — work exceeded context window)
- Project file missing or deleted → **stop**

## 5. How does this interact with heartbeats?

Heartbeats should check: "do I have an active auto-resuming task?" If yes, skip lens/exploration — the task IS the work. Heartbeat becomes a quick status check: read project file, confirm auto-resume is running, done. No conflict because the auto-resumed sessions are worker sessions (coder), not the owner agent.

## 6. Implementation suggestion

Simplest path: add a check in `evaluation-sync.ts` (already runs on cron). After evaluating sessions, scan `agents/*/workspace/projects/*.md` for `Status: active`. If the project's last worker session ended >2min ago, spawn a new persistent-task session. This reuses existing cron infra — no new handler needed. ~30 lines of code.

Alternative: hook into session cleanup in `manager.ts`. When a session completes, check if it was part of a persistent task and auto-spawn the next iteration. Tighter loop but more invasive.

I'd start with the cron approach — it's simpler and naturally rate-limited by cron interval.
