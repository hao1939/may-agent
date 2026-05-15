---
name: blocked-capability-escalation
description: What to do when you discover a capability is missing, a tool doesn't exist, or a command is unavailable
trigger: Any time a tool call reveals that a capability doesn't exist (e.g., "command not found", "no such tool", process manager unavailable, permission denied)
---

# Blocked Capability Escalation

## When This Applies
You've just discovered that something you need doesn't exist or isn't available:
- `systemctl` / `pm2` / service manager not installed
- A tool or command you expected doesn't exist in this environment
- A restart/deploy/admin capability is missing
- Permission denied on an operation you need

## The Procedure (4 steps — all mandatory)

### Step 1: Name the gap
State exactly what's missing and what you were trying to accomplish.
> Example: "I need to restart the web server, but `systemctl` is not available (exit code 127) and PID1 is docker-init, so there's no system service manager."

### Step 2: Search for a workaround (spend ≤2 tool calls)
Try ONE alternative approach:
- Different command that achieves the same goal (e.g., `kill -HUP` instead of `systemctl restart`)
- Different tool that's available (check `which`, `type`, or `ls /usr/bin/`)
- Manual equivalent (e.g., stop process + start process instead of restart)

If the workaround works → use it, report what you did, done.

### Step 3: If no workaround — escalate concretely
Pick exactly ONE:

**Option A — Handoff to Hao:**
```
agents.send("may", "ESCALATION: I need [capability] to [goal]. Tried [alternative], which also failed because [reason]. Hao: please [specific ask].")
```
Or use handoff() if available.

**Option B — Create a todo:**
Write a concrete item to `workspace/todo.md`:
```
- [ ] BLOCKED: [goal] requires [capability] which is unavailable. Proposed solution: [specific proposal]. Discovered in session [session_id].
```

**Option C — Delegate to another agent:**
If another agent might have the capability (e.g., tech-lead for infrastructure):
```
agents.send("[agent]", "[specific request]")
```

### Step 4: Confirm your escalation was executed
Before finishing the session, verify:
- [ ] Did I actually send the handoff / write the todo / send the delegation? (Check tool output, exit code 0)
- [ ] My finish() summary mentions the escalation and what's still blocked

## Banned Conclusions
These phrases mean you failed this skill:
- ❌ "Nothing actionable"
- ❌ "All healthy" (when something was blocked)
- ❌ "Cannot be done" (without Step 3)
- ❌ Any finish() that doesn't mention the gap you discovered

## Examples from Past Failures

**Bad (s_1773461301049_206):**
> Discovered systemctl and pm2 unavailable → concluded "All healthy. Nothing actionable."

**Good alternative:**
> Discovered systemctl and pm2 unavailable → tried `kill -HUP $(pgrep node)` as workaround → that worked / that also failed → created todo: "BLOCKED: Need process restart capability. Propose adding a restart script or documenting the container restart procedure."
