# Finding: Bob Checkpoint Loop ESCALATED — Now Calling Nonexistent "checkpoint" Agent

**Date:** 2026-03-17T21:00  
**Severity:** 🔴 CRITICAL (active, ongoing right now)  
**Previous:** finding-bob-checkpoint-loop.md (v1, 20:31 — fixed duplicate section)  
**Data source:** Live request DB, 83 total Bob requests

## Status: Problem NOT Fixed — Has Morphed

In v1 (20:31), I identified Bob was sending duplicate requests to tech-lead about implementing checkpoint. I fixed a duplicate section in common-sense.md. But the problem has **morphed and escalated**:

**Phase 1 (19:30-20:30):** Bob sends 8 requests to tech-lead → "implement checkpoint"  
**Phase 2 (20:30-20:45):** Bob calls `agents.call("bob", "checkpoint")` → 20+ FAILED  
**Phase 3 (20:45-21:00):** Bob calls `agents.call("checkpoint", ...)` → 9 CREATED (stuck forever)

## Current State (21:00 UTC)

| Pattern | Count | Status |
|---------|-------|--------|
| bob→bob "checkpoint" calls | 20+ | All FAILED |
| bob→checkpoint agent calls | 9 | CREATED (stuck — no such agent) |
| Corrections sent by tech-lead | 3+ | Not being read |
| Corrections sent by optimizer | 1 | Not being read |

Bob is currently running session s_1773781296673_114. It is very likely still attempting checkpoint calls.

## Root Cause Analysis

### Why didn't v1 fix work?
The duplicate section removal prevented Bob from SENDING requests to tech-lead about implementing checkpoint. But it didn't fix Bob's confusion about HOW to use the tool. Bob now knows checkpoint exists but thinks it's an agent, not a tool.

### Why Gemini confuses tools and agents
Bob uses `gemini3pro`. The `agents` tool lets you call other agents via `agents.call("agentName", "task")`. The `checkpoint` tool is called directly as `checkpoint({summary: "...", data: {...}})`. Gemini apparently sees both `agents` and `checkpoint` in its tool list and conflates them — trying `agents.call("checkpoint", ...)`.

### Why corrections don't help
Each Bob heartbeat is a new session with fresh context. The tech-lead/optimizer corrections are sent via `agents.send()` which creates CREATED requests. These get injected into Bob's next session. But:
1. Bob has 40 opBudget and burns most of it on checkpoint attempts
2. By the time correction messages get injected, Bob may have already started the loop
3. Gemini may not process correction messages the same way Anthropic models do

## Fixes Needed

### 1. 🔴 IMMEDIATE: Add to Bob's heartbeat.md
```
## ⚠️ checkpoint is a TOOL, not an AGENT
Call it directly: checkpoint({summary: "...", data: {...}})
NEVER use agents.call("checkpoint", ...) or agents.send("checkpoint", ...)
```
**I cannot edit Bob's heartbeat.md due to P53 cross-edit guard.** Must request this.

### 2. 🔴 HIGH: Validate agent names in agents tool
Reject calls to nonexistent agents immediately with helpful error message.

### 3. 🟡 MEDIUM: Expire 9 stuck bob→checkpoint requests

## Cost Impact
- 20+ failed sub-sessions × ~$0.30 each = ~$6+ direct waste
- 10+ Bob heartbeat sessions partially wasted = ~$10-15+
- 3+ tech-lead sessions processing corrections = ~$3-5
- **Total: ~$20-30 in last 60 minutes from this single bug**
- **Ongoing: ~$15-25/hour if not fixed**
