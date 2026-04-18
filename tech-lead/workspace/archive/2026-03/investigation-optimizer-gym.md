# Investigation: Optimizer Agent Not Registered in Gym Runtime

**Date**: 2026-03-18  
**Task**: [req:0538f412] from May, originating from Coach's exp-072 discovery  
**Status**: Root cause identified, fix confirmed already applied

## Summary

The optimizer agent was silently skipped during `loadAgents()` because its `agent.json` contained an invalid tool preset `"coordination"`, which is not in the `VALID_TOOL_PRESETS` set in `src/app/agent-loader.ts`. This caused ALL gym runs targeting optimizer to fail — the agent never started, and success criteria scored against a pristine (unmodified) environment.

## Root Cause

1. Commit `c974fd0` (2026-03-15) added `"coordination"` tool to optimizer's agent.json
2. `"coordination"` is NOT in `VALID_TOOL_PRESETS` (line 424, agent-loader.ts)
3. `validateAgentConfig()` returned a validation error → `loadAgents()` skipped optimizer
4. The error was **silent**: logged to the event bus (`[loader] Skipped agents with config errors: optimizer.tools: Unknown tool preset "coordination"`) but NOT to stderr. The gym-run.sh captures stderr but the skip message goes to stdout via the event bus
5. `manager.hasAgent("optimizer")` returns false → may.ts exits with `Agent "optimizer" is not registered` on stderr

## Timeline

| Date | Commit | optimizer tools | Gym result |
|------|--------|----------------|------------|
| Mar 15 | c974fd0 | coordination, coding, agents, workflow | ❌ NOT REGISTERED |
| Mar 17 12:45 UTC | 3694184 | coding, agents, workflow | ✅ Would register |
| Mar 17 17:01 UTC | d120ac7 | coding, agents, finish | ✅ Would register |
| Mar 18 14:28 UTC | 479970e | coding, agents, checkpoint, finish | ✅ Current config |

## Impact

- **exp-066 results are INVALID**: optimizer never ran. The 4/6 scores were from pristine environment scoring
- **exp-072 optimizer runs**: Coach says these also showed "not registered". If exp-072 was run against the production agents/ directory (baseline mode, post-Mar-17 fix), then either:
  - (a) The gym was using a stale working tree (pre-fix commit), OR  
  - (b) There's a second issue — but all current validation checks pass

## Current Status

The optimizer's agent.json is currently valid:
- Model: `opus` ✅ (exists in models map)
- Tools: `coding`, `agents`, `checkpoint`, `finish` ✅ (all in VALID_TOOL_PRESETS)
- Required fields: all present ✅

## Recommendations

1. **No code change needed** — the config is already fixed
2. **Rerun gym scenarios with optimizer** to establish valid baseline scores
3. **Improve gym-run.sh error detection**: The "not registered" error goes to stderr (which gym captures), but the diagnostic log explaining WHY goes to stdout (event bus). Recommend adding a check in gym-run.sh that detects "not registered" in stderr and fails explicitly with a helpful message.
4. **Coach should invalidate all prior optimizer gym results** (exp-066 and earlier) — they measured nothing

## Systemic Issue: Silent Agent Skipping

The `loadAgents()` function skips agents with validation errors and emits a warning via the event bus. In the gym runtime, this warning is lost in stdout (mixed with other output). Consider:
- Making `loadAgents()` return the list of skipped agents alongside added/updated
- Having `may.ts` explicitly check if the requested `--agent` was in the skipped list and provide a targeted error message
