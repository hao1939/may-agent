# Finding: Bob Checkpoint Tool Misuse — HIGH Impact

**Found:** 2026-03-17T21:43 UTC
**Status:** ACTIVE — happening right now, started ~1h ago

## Problem

Bob is calling `agents.call("checkpoint", ...)` instead of using the native `checkpoint()` tool.

The `checkpoint` tool is in Bob's `agent.json` tools list and is injected natively.
But Bob treats "checkpoint" as an agent name, not a tool name. He calls:
```
agents.call("checkpoint", { summary: "...", data: {...} })
```
instead of:
```
checkpoint({ summary: "...", data: {...} })
```

## Impact

| Metric | Value |
|--------|-------|
| checkpoint-as-agent requests (EXPIRED) | 14 |
| bob→bob self-checkpoint requests (FAILED) | 20 |
| bob→bob self-checkpoint requests (COMPLETED — still wasteful) | 7 |
| Total wasted compute time (FAILED only) | 47.6 minutes |
| Sessions affected | 29 |
| Time window | 20:43–21:35 UTC (less than 1 hour) |
| Error class | All "infra" — APIConnectionError, ServiceUnavailableError |

The "checkpoint" agent doesn't exist, so those 14 requests all expired.
The 20 bob→bob FAILED requests spin up full Bob sessions just to process checkpoint tasks, which then fail due to API errors (likely from the burst of unnecessary sessions).
The 7 that "completed" still wasted a full session's worth of compute for what should be a simple file append.

## Root Cause

**Behavioral** — Bob doesn't distinguish between:
1. `checkpoint()` — a local tool that appends to `.state/checkpoints/<sessionId>.jsonl`
2. `agents.call("checkpoint", ...)` — treats "checkpoint" as another agent

The checkpoint tool writes to disk locally, no LLM needed. Using `agents.call()` spawns an entire LLM session.

## Fix

Two-pronged:
1. **Behavioral (Coach):** Train Bob that `checkpoint()` is a tool, not an agent. Add to Bob's LESSONS.md or handle via growth cycle.
2. **Infra (Tech-Lead, optional):** Add a guard in `agents.call()`/`agents.send()` that rejects calls where the target matches a tool name in the calling agent's toolset. This would prevent any agent from accidentally calling a tool as an agent.

## Cost Estimate

At $3/M input tokens, each unnecessary Bob session (~142s average) costs roughly:
- ~$0.15-0.30 per session (model + API overhead)
- 27 unnecessary sessions × $0.20 avg = **~$5.40 in the last hour alone**
- If this continues at this rate: **~$130/day**

This must be fixed immediately.
