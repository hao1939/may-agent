# Finding: Bob Checkpoint Tool Confusion Loop

**Date:** 2026-03-17T21:15
**Severity:** HIGH
**Cost Impact:** ~$5-10 per loop incident (13 failed calls × $0.42/session + stuck requests)

## Problem

Bob (Gemini 3 Pro) repeatedly confuses `checkpoint` (a native tool) with an agent name. Pattern:

1. Bob receives a "checkpoint" task (or decides to verify the checkpoint tool)
2. Tries `bash({"command":"checkpoint ..."})` — fails (not a bash command)
3. Tries `agents.call("checkpoint", ...)` — fails ("Agent not registered") but leaves CREATED request records
4. Repeats 13+ times across multiple sessions over 37 minutes

## Root Causes

### RC1: Task routing ambiguity
Bob received bare "checkpoint" as a task string, which looked like an agent name rather than a tool to use.

### RC2: Gemini model confusion
Gemini 3 Pro doesn't distinguish between tools and agents. Even after reading checkpoint.ts source code, Bob calls `bash({"command":"checkpoint"})` and `agents.call("checkpoint", ...)` instead of using the native `checkpoint()` tool.

### RC3: Stuck request records
`agents.call()` creates a request record BEFORE attempting the call. If the session is interrupted mid-call, the request stays in CREATED forever. The agent existence check returns an error to the agent but the request was already tracked.

Actually — looking at the code more carefully, the check `if (!manager.agents.has(params.agent))` happens BEFORE `trackRequest()`. So these 13 CREATED requests must have come from a different path. Let me reconsider...

The `send` action also checks `manager.agents.has(params.agent)`. So how did 13 requests get created?

**Most likely:** Bob is calling `agents.call("checkpoint", task)` and somehow the agent IS registered (as a tool-agent wrapper) or the request tracking was added before the check in an earlier version.

## Actions Taken

1. ✅ Expired 13 stuck CREATED requests (bob→checkpoint) 
2. ✅ Sent fix request to tech-lead (req:8e9f3e88) asking for Bob heartbeat.md update

## Recommended Structural Fixes

1. **Add checkpoint usage hint to Bob's heartbeat.md** — already requested via tech-lead
2. **Add "not an agent" guard** — if `agents.call("checkpoint")` is attempted, return a helpful error: "checkpoint is a TOOL, not an agent. Call it directly: checkpoint({summary: '...'})"
3. **Auto-expire orphaned CREATED requests** — requests in CREATED > 1 hour should be auto-expired by a cron job (we identified this need before in req:927c5c48)
