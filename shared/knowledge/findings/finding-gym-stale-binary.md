# Finding: Gym Oneshot Stale Binary — 8 of 12 Agents Missing

**Date**: 2026-03-18
**Status**: ✅ FIXED (commit 1f10b87)
**Impact**: Blocked ALL gym experiments for coder, optimizer, bob, coach, master, qa, scout, tech-lead
**Source**: Coach request (req:411085fd)

## Problem

The gym scripts (`gym-run.sh`, `gym-run-workflow.sh`) prefer the compiled binary (`bundle/may-agent`) over `bun src/app/may.ts`. The binary was last built on March 17 10:26 and didn't include tool presets added since then (checkpoint, system-status, claude-code, gemini-cli, codex).

When the binary tried to build tools for agents using these presets, the agent registration silently failed. Only 4 of 12 agents loaded successfully:
- ✅ amy-kimi (tools: coding, scrape, finish)
- ✅ amy (tools: coding, finish) 
- ✅ may (tools: coding, agents, cron, system-status, finish)
- ✅ evaluator (tools: coding, finish)

All 8 other agents failed because they use `checkpoint` or other newer presets.

## Root Cause

`gym-run.sh` binary resolution logic:
```bash
elif [[ -x "$PROJECT_ROOT/bundle/may-agent" ]]; then
  MAY_CMD=("$PROJECT_ROOT/bundle/may-agent")  # Always used if binary exists
```

No check for binary freshness. Binary in .gitignore, so it only gets rebuilt manually.

## Fix

1. **Rebuilt binary** — `scripts/bundle.sh` → all 12 agents now register
2. **Added staleness check** — both gym scripts now compare binary mtime against `src/*.ts`:
   - If any `.ts` source file is newer than the binary → falls back to `bun` with a warning
   - Prevents this class of bug from recurring

## Verification

- `gym-run.sh cascading-error --agent coder`: 5/5 checks pass ✅
- `gym-run.sh judgment-security-legit --agent coder`: 4/4 checks pass ✅  
- `gym-run.sh cascading-error --agent optimizer`: 5/5 checks pass ✅
- Binary test: `./bundle/may-agent --oneshot --agent coder --task "test"` → success ✅
