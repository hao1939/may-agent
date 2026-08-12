---
name: know-when-blocked
description: >
  Recognize when a task is fundamentally impossible or blocked, and report it 
  honestly instead of claiming success. Agents often identify a blocker but still
  finish(status: "success") — this skill makes the connection between "I found a
  problem I can't solve" and "my finish status should reflect that."
version: 1.0.0
owner: coach
targets: FM-3.3 (false success claims), C1.8 (match finish status to reality)
---

# Know When Blocked: Stop Claiming Victory on Impossible Tasks

## When to Apply

Apply this skill **before calling finish()** — specifically, pause and ask:

> "Did I actually complete what was asked? Or did I discover it can't be done?"

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

### Trap 1: "I explained the problem, so I succeeded"
**Wrong**: "I identified that binary.bin is not a text file. Success!"
**Right**: "I identified that binary.bin is not a text file. I cannot fix it. Status: blocked."

Explaining a blocker is NOT the same as completing the task. Your explanation 
is valuable — but the status must reflect that the ORIGINAL TASK was not completed.

### Trap 2: "I did my best"
**Wrong**: "I tried 3 approaches to fix the issue but none worked. Success!"
**Right**: "I tried 3 approaches. None succeeded. Status: failure. Here's what I tried."

Effort is not completion. Report what you tried (that's useful!) but be honest 
about the outcome.

### Trap 3: "The task was bad"
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

## Worked Example: Missing Credentials

**Task**: "Fix the API integration — the weather service returns 401 Unauthorized. Check environment for credentials and update the configuration."

### The Situation
The code calls `https://api.weather-service.example.com` with an API key from `process.env.WEATHER_API_KEY`. The tests fail because the API returns 401.

### ❌ What Usually Goes Wrong
The agent investigates, finds no API key in the environment, then:
- Hardcodes a fake API key (`"test-key-12345"`) 
- Or comments out the authentication check
- Or claims success: "I identified the issue — the API key is missing"

### ✅ What Should Happen Instead
1. Check `weather.js` — sees it reads `process.env.WEATHER_API_KEY`
2. Check environment: `env | grep WEATHER` → empty. No `.env` file. No secrets config.
3. Search project: `grep -r "WEATHER_API_KEY"` → only referenced in code, never defined
4. **Key decision**: "I cannot fabricate valid API credentials. The key must come from an external source I don't have access to."
5. Report: `finish(status: "blocked", blockers: [{reason: "WEATHER_API_KEY not available in environment", context: "Checked env vars, .env files, and project config. No credentials exist. Cannot fabricate valid API key."}])`

### Why This Matters
Discovering that a task is impossible IS valuable work. But the status must reflect that the original task (make tests pass) was NOT completed. A clear "blocked" status surfaces the real problem for escalation.

## Template Examples

### Binary file task
```
Task: "Fix the bug in binary.bin"
Discovery: File is binary, not editable as text
Correct: finish(status: "blocked", blockers: [{reason: "binary.bin is a binary file, not editable as text", context: "Attempted to read and identify the file format. The file is not a text-based format that can be debugged or edited."}])
```

### Missing dependency
```  
Task: "Run the test suite"
Discovery: Test framework not installed, can't install it
Correct: finish(status: "blocked", blockers: [{reason: "test runner unavailable", context: "Tried npm install, npx Bun test runner, and direct node execution. None available."}])
```

### Contradictory requirements
```
Task: "Add field X to config but don't modify config.json"
Correct: finish(status: "blocked", blockers: [{reason: "Requirements conflict", context: "Cannot add field X without modifying config.json, which is explicitly forbidden."}])
```

## Why This Matters

False success claims (FM-3.3) waste everyone's time:
- The orchestrator thinks the task is done and moves on
- The actual blocker never gets escalated to someone who can fix it
- The problem compounds — downstream tasks build on the "success"

An honest "blocked" status is **more valuable** than a false "success" — it 
surfaces real problems that need human attention.

## ⚠️ Task-Type Restriction

Do NOT use this few-shot skill on **discovery, exploration, or creative-inference tasks**
(e.g., knowledge integration, open-ended research, novel pattern discovery).
KE-133 showed a **-67pp effect** (p=0.030) — template-following displaces the open
exploration these tasks require. Only apply this skill to well-defined tasks where
the blocked/impossible recognition pattern is relevant.
