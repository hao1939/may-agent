# EXP-540: Structural Path Normalization for Tech-Lead

**Date**: 2026-05-25
**Author**: coach
**Status**: DEPLOYED (Option B — structural injection in master-worker.ts:451)
**Type**: Structural intervention (follows EXP-510/520/530 proven pattern)

## Problem

Tech-lead has 39.1% pass rate on C7.1 (correct file paths) — the worst non-QA violation. 
The agent uses absolute paths like `/Users/hao/c/...` or `/home/...` instead of relative paths from the project root.

This causes:
- Failed file reads/writes (paths don't resolve)
- Wasted tool calls
- Cascading errors when the agent can't find files it references

## Hypothesis

**H-540**: If we inject a PATH RULE structural block into the tech-lead's prompt (or the shared heartbeat/worker prompt for all agents), path violation rate will drop from 60.9% to ≤20%.

## Evidence This Pattern Works

- EXP-510: Structural injection → write rate 37% → 76% (+39pp)
- EXP-520: Structural gate → 100% recovery on 7/7 triggers
- EXP-530: Structural verification gate → preliminary positive signal
- KE-480: Text coaching dead for behavioral enforcement; structural required

## Design

### Option A: Agent-specific (tech-lead context.md)
Add to top of tech-lead's context:
```
## ⚠️ PATH RULE (STRUCTURAL — NEVER SKIP)
ALL file paths must be RELATIVE to the project root. 
- ✅ CORRECT: agents/tech-lead/workspace/file.md, .state/todo.md
- ❌ WRONG: /Users/hao/c/file.md, /home/user/file.md, ~/file.md
If you see an absolute path in a task, convert it to relative before using it.
```

### Option B: Structural injection (master-worker.ts or heartbeat-data.ts)
Add to COMPLETION REQUIREMENTS block:
```
5. ALL file paths must be relative to the project root (never /Users/, /home/, or ~/)
```

### Recommendation: Option A first
- C7.1 is worst for tech-lead specifically (39.1%) vs others (optimizer 86.2%)
- Start with agent-specific text, but expect it may fail (KE-480)
- If text fails, escalate to Option B (structural injection)

## Measurement

**Baseline**: 39.1% pass rate (9/23) on C7.1 for tech-lead (7-day window)
**Treatment**: Deploy Option A
**Metric**: C7.1 pass rate in convention-checks summary after 20+ sessions
**Success**: ≥80% pass rate (from 39.1%)
**Timeline**: Measure ~2026-06-01

## Decision Rules
- ≥80% pass → POSITIVE, keep
- 50-80% → PARTIAL, consider Option B structural injection
- <50% → NEGATIVE, deploy Option B immediately

## Risk
- Low: additive text only, no code changes for Option A
- If Option A fails (expected per KE-480), Option B is ready to deploy
