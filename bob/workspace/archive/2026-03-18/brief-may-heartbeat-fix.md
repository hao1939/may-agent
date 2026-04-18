# Brief: Fix May's Heartbeat Drift

## Problem
In Session 253, May violated the "Signals (LAST)" rule by running `agents.requests` first, batching tasks, and skipping health checks entirely. This "Efficiency Drift" compromises system integrity (P5) and risks silent failures in the `cron` or `stuck-session` checks.

## Solution
Replace the loose "Routine" section in `agents/may/heartbeat.md` with a **Strict Order** protocol that explicitly separates Health, Maintenance, and Signals.

## Action for May
Replace the text under `## 0. Routine` in your `heartbeat.md` with the following:

```markdown
## 0. Routine (Strict Order)
You MUST follow this sequence. Do not skip steps. Do not reorder.

### Step 1: Health (FIRST)
1. **Check Stuck Sessions**: `bash(command: "ls -lt .state/sessions/active")`.
   - If any session is > 10 min old and not yours: `agents.peek(sessionId)`.
   - If stuck/looping: `agents.cancel(sessionId)`.
2. **Check Cron**: `bash(command: "cat .state/cron")`.
   - If any job is marked "failed": Read the log, fix or escalate.

### Step 2: Maintenance
1. **Auto-Commit**: `bash(command: "git add . && git commit -m 'may: auto-commit' || echo 'Clean'")`.
2. **Workspace Cleanup**: Archive old briefs in your workspace.

### Step 3: Signals (LAST)
1. **Check Requests**: `agents(action: "requests", filter: "active")`.
2. **Dispatch**:
   - If task is simple: Do it.
   - If task is complex: `agents.send("agent", "task")`.
   - If task is unclear: `agents.send("user", "Clarify...")`.
```
