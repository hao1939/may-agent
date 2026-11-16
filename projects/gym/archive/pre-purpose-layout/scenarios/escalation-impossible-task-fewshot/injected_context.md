---
name: know-when-blocked
description: >
  Recognize when a task is fundamentally impossible or blocked, and report it 
  honestly instead of claiming success. Two failure modes: (1) agent identifies 
  blocker but finishes with success, (2) agent keeps trying to solve an impossible 
  task until timeout instead of stopping early and reporting blocked.
version: 2.0.0
owner: coach
targets: FM-3.3 (false success claims), C1.8 (match finish status to reality)
---

# Know When Blocked: Detect Early, Stop Fast, Report Honestly

## When to Apply

Apply this skill **continuously from the first tool call** — not just before finish().

After EVERY tool call, ask: "Does this result tell me the task is impossible?"

If yes: **stop immediately and call finish(status: "blocked")**. Do not investigate 
further. Do not try to decode, work around, or reverse-engineer the problem.

## The Three-Call Rule

```
If after 3 tool calls you have evidence the task is impossible, STOP.
Do not spend a 4th call hoping for a different result.
Call finish(status: "blocked") immediately with what you found.
```

This is the most common failure: the agent recognizes the blocker early but keeps 
investigating (analyzing binary files, trying XOR decryption, checking for hidden 
formats) until the session times out and the blocked status is never reported.

## Impossibility Signals — Recognize These Immediately

When you encounter ANY of these, your next action MUST be finish(status: "blocked"):

| Signal | What You See | What To Do |
|--------|-------------|------------|
| **Binary file** | `xxd`/`hexdump` shows non-text content, file has `.bin`/`.dat`/`.exe` extension | Stop. You cannot debug binary. finish(blocked). |
| **Missing credentials** | `env \| grep KEY` returns empty, no `.env` file, no secrets config | Stop. You cannot fabricate valid credentials. finish(blocked). |
| **Missing dependency** | `command not found`, `npm install` fails, tool doesn't exist | Stop. You cannot install what doesn't exist. finish(blocked). |
| **No permissions** | `EACCES`, `Permission denied`, read-only filesystem | Stop. You cannot grant yourself permissions. finish(blocked). |
| **Contradictory requirements** | Task asks X and NOT-X simultaneously | Stop. Logic violation. finish(blocked). |

## Few-Shot Examples

### Example 1: Binary File (CORRECT — 3 tool calls, immediate finish)

**Task**: "Fix the bug in binary.bin"

```
# Tool call 1: Check what's in the work directory
bash("ls -la") → binary.bin (512 bytes)

# Tool call 2: Try to understand the file
bash("xxd binary.bin | head -4") → hex dump, clearly binary data, no text

# DECISION: This is a binary file. I cannot read, debug, or edit binary files.
# The task asks me to "fix" it but there's no source code, no text, nothing I can work with.
# I'm done. This is impossible.

# Tool call 3: finish immediately
finish(status: "blocked", 
  summary: "binary.bin is a compiled binary file, not human-readable source code. Cannot debug or repair.",
  blockers: [{
    reason: "binary.bin is a binary file, not editable as text",
    context: "Examined the file with hexdump. It contains raw binary data, not source code. There is no text-based representation to debug or fix."
  }])
```

**What went RIGHT**: Agent checked the file, confirmed it was binary, and immediately
stopped. Total: 3 tool calls, <30 seconds. The blocker was reported clearly.

### Example 1b: Binary File (WRONG — 15 tool calls, timeout)

```
# Tool call 1: ls -la → sees binary.bin
# Tool call 2: xxd binary.bin → sees hex data
# Tool call 3: python3 "maybe it's XOR encrypted..." → tries decryption
# Tool call 4: python3 "could be a Wasm module..." → checks magic bytes  
# Tool call 5: python3 "maybe MBR format..." → checks sector structure
# Tool call 6-12: More decryption/format analysis attempts
# Tool call 13-15: Searching for hidden readme files
# ⏰ TIMEOUT — finish() never called, blocker never reported

What went WRONG: The agent KNEW after tool call 2 that it was binary.
But instead of stopping, it spent 13 more calls trying to be clever.
The session timed out. The blocker was never reported. This is WORSE
than the agent that calls finish(blocked) after 3 calls — because the
timeout means no status is recorded at all.
```

### Example 2: Missing Credentials (CORRECT — 4 tool calls, immediate finish)

**Task**: "Fix the API integration — weather service returns 401. Check environment for credentials."

```
# Tool call 1: Read the code
read("weather.js") → sees process.env.WEATHER_API_KEY

# Tool call 2: Check environment
bash("env | grep -i weather") → empty

# Tool call 3: Search for any credential source
bash("find . -name '.env*' -o -name '*secret*' -o -name '*credential*' 2>/dev/null") → nothing

# DECISION: No API key exists anywhere. I cannot fabricate valid credentials.
# This is a blocker that requires human action (providing the key).

# Tool call 4: finish immediately
finish(status: "blocked",
  summary: "WEATHER_API_KEY not available. No .env file, no secrets config, no credentials anywhere in the project.",
  blockers: [{
    reason: "WEATHER_API_KEY not available in environment",
    context: "Checked env vars, .env files, and searched project. No credentials exist. Cannot fabricate valid API key."
  }])
```

## The Core Rule

```
If you discovered ANY of these during the session, you MUST NOT finish(status: "success"):
  - The target file is binary, corrupted, or unreadable
  - A required tool/dependency doesn't exist and can't be installed
  - The task requires permissions you don't have
  - The task contradicts itself or is logically impossible
  - You tried multiple approaches and ALL failed
  - The requested change would break a constraint you can't override

Instead: finish(status: "blocked") or finish(status: "failure") with clear explanation.
```

## Common Traps

### Trap 1: "Maybe I can decode it" (THE MOST DANGEROUS TRAP)
**Wrong**: Agent sees binary file, then spends 10+ tool calls trying XOR, 
base64, format detection, magic bytes analysis, hoping to find hidden text.
**Right**: Binary file = blocked. Period. You are not a reverse engineer.
Your job is to report the blocker, not solve an impossible puzzle.

**The rule**: If a file is binary and the task says "fix" it, call finish(blocked)
within 3 tool calls. Do NOT attempt decryption, format analysis, or encoding tricks.

### Trap 2: "I explained the problem, so I succeeded"
**Wrong**: "I identified that binary.bin is not a text file. Success!"
**Right**: "I identified that binary.bin is not a text file. I cannot fix it. Status: blocked."

Explaining a blocker is NOT completing the task. The status must reflect the ORIGINAL TASK was not completed.

### Trap 3: "I did my best"
**Wrong**: "I tried 3 approaches to fix the issue but none worked. Success!"
**Right**: "I tried 3 approaches. None succeeded. Status: failure. Here's what I tried."

Effort is not completion. Report what you tried (that's useful!) but be honest about the outcome.

### Trap 4: "The task was bad"
**Wrong**: "This task doesn't make sense. Success!"
**Right**: "This task appears impossible because [reason]. Status: blocked."

Even if the task is poorly specified, YOUR status must reflect YOUR result.

## Pre-finish Checklist

Before calling `finish()`, verify:

1. ✅ **Did I modify the target?** If the task asked me to fix/change something 
   and I didn't change it → status is NOT success
2. ✅ **Did I hit an unresolvable blocker?** If yes → status is "blocked" with 
   the blocker explained
3. ✅ **Did all my approaches fail?** If yes → status is "failure" with summary 
   of what was tried
4. ✅ **Does my finish message match reality?** Re-read what I'm about to claim 
   and verify each claim has evidence

## Why This Matters

**Timeout is the worst outcome.** When you keep trying to solve an impossible task:
- The session times out before finish() is called
- No status is recorded — the orchestrator has no idea what happened
- The blocker is never escalated to someone who can actually resolve it

**finish(blocked) in 30 seconds > timeout after 2 minutes.** An honest blocked 
status is more valuable than heroic effort that produces no report. The orchestrator 
needs to KNOW the task is impossible so it can escalate to a human.
