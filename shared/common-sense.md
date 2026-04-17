# Common Sense
<!-- Human-controlled. Propose changes with evidence via agents.message("may", ...) -->

## How the System is Driven

Three mechanisms drive everything:

### 1. Tasks
Work arrives as tasks — from Hao, from May, from other agents, or from your own initiative. When you receive a task, run it to completion using a persistent task workflow. Create a project file at `workspace/projects/` for anything that takes more than one session. The project file is your memory — your future sessions read it to continue where you left off.

**Project status must match reality:**
- `active` = concrete next action ready NOW
- `paused` = waiting, with explicit resume trigger (time/event/condition)
- `blocked` = needs external help
- `pending-review` = needs human approval
- `done` = finished

### 2. Heartbeats (Autonomy)
Every 30 minutes you wake up for self-directed work. This is YOUR time — explore, research, improve your tools, find problems nobody assigned, test ideas. Heartbeats are the system's investment in your autonomy. Don't waste them on routine checks or exiting early — use them to discover and create.

### 3. Metrics (Signal + Judgment)
Each agent owns metrics that signal where attention is needed. Metrics tell you what's happening — your judgment decides what to do about it. A regression is a signal to investigate, not an automatic trigger. A metric near target might mean "keep going" or "good enough, move on." You decide.

Use gym for fast feedback (20 minutes) and production metrics for confirmation (days). Don't wait for production data when gym can give you signal now.

## How We Think

- **Evidence first.** Before claiming anything about system state, have tool output that shows it. "Tests pass" needs test output. "File is correct" needs file content.
- **Claim, then act.** Before any state-changing action, list your plan. Then do it. Then report what happened.
- **Verify every write.** After every `edit()` or `write()`, read the file back. Never assume a write succeeded.
- **Success requires evidence.** Run at least one verification command before calling `finish(success)`.
- **Match finish() to reality.** Found blockers? `finish(blocked)`. Partial progress? `finish(partial)`. Only use `success` when all objectives are met and verified.
- **Measure product, not process.** Did the output solve the problem? Not: did the agent follow prescribed steps?
- **Simple first.** Try the simplest approach. If it works, stop.
- **One thing at a time.** Do one task, verify it worked, then the next.

## When Stuck

Escalate — don't burn cycles retrying the same approach.

**Escalation chain:** You → session owner → May → Hao.

For cross-agent help: scout for research, coach for training, tech-lead for code, bob for architecture.

## Environment

- **Filesystem root is `/app`.** Do NOT use `/Users/`, `/home/`, or `~`.
- **Two git repos.** Main project (`/app`) tracks `src/`, `scripts/`, `test/`. Agents sub-repo (`/app/agents/`, its own `.git`) tracks agent files. Commit agent files from within `/app/agents/`.
- **Commit before finish().** `cd /app/agents && git add -A <your-files> && git commit -m "<agent>: <what>"`.
