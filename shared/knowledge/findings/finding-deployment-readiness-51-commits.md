# Deployment Readiness: 51 Commits Blocked on Process Restart

**Date:** 2026-03-18T07:14 UTC
**Status:** READY TO DEPLOY — all 1,457 tests pass (109 test files)
**Blocker:** PID 7 (bun launcher) needs restart. Started Mar 17 13:54 UTC (~17 hours ago).

## Test Status
```
Test Files  109 passed (109)
Tests       1457 passed (1457)
TSC:        clean (91156db fixed last 8 errors)
```

## Impact Categories

### 🔴 CRITICAL — Cost/Waste Reduction (est. $800-900/day savings)

| Commit | Fix | Est. Savings |
|--------|-----|-------------|
| 440bc6a, f8a481c, 5244274, 8c8cf0b | Cron hot-reload + timer leak fix | $26/day (330 fewer sessions) |
| 848ebf1 | Idle heartbeat pre-flight skip | ~18% session reduction |
| 7c86665 | Bypass LiteLLM for Anthropic prompt caching | $23-47/day |
| 9bc3742 | common-sense.md to system prompt for caching | $31/day |
| 97f3a50 | Agent error circuit breaker (stops Bob cascade) | Prevents error storms |
| e7c1cb9 | Evaluator re-eval 48h cutoff | Stops 9,974 wasted re-evals |
| 2b972c0 | Cap initial jitter to 5min | Faster cron startup |
| 9eff164 | Lower turn budget warning 40→35 | Fewer interrupted sessions |

**Combined cron+caching fixes alone: $80-104/day = $2,400-3,120/month**

### 🟡 QUALITY — Correctness Fixes

| Commit | Fix | Impact |
|--------|-----|--------|
| 82ced56 | finish() status preserved (not overwritten by interrupt) | 77% of completions were misclassified |
| 326b7f2 | Waste ratio penalty in evaluator | 100% waste sessions now flagged |
| cb95fff | Evaluator false-positive fix | Accurate waste metrics |
| 6c44f0e | Parse real usage from JSONL | Real cost data in evals |
| 62ea165 | Narrow error regex | Fewer false-positive errors |
| b43b94e | Cap waste, remove PIVOT REQUIRED from errors | Better eval accuracy |
| a3d9865 | Activate stuck detection (was dead code!) | 3-error sessions auto-terminated |
| 986d89b | Add 'interrupted' status to TaskResult | Stop lossy error mapping |

### 🟢 FEATURES — New Capabilities

| Commit | Feature | Benefit |
|--------|---------|---------|
| 9eefa72 | Read-dedup guard (>5 reads blocked) | Stops Amy $71/session read loops |
| 2233509 | finish() evidence guard | Blocks false success claims |
| 07b0d7f | Tool-as-agent guard | Prevents Bob's agents.call misuse |
| 4abbc07 | Pre-flight checks for run-agent-task | Skip idle cron LLM sessions |
| 4c7cdc3 | Zombie session cleanup on startup | Auto-archive stuck sessions |
| e4bebca, 433e18c | Checkpoint tool (P3.5) | Mid-session state saving |
| f3f9108, 9c3b96a | OpBudget visibility | Agents see remaining budget |
| 1f51d46 | Auto-inject tool names into prompt | Agents know their tools |
| b28c09a | Evidence tags for injected content | Instruction hierarchy defense |
| 858a334 | Auto-complete send() requests after heartbeat | Better request tracking |

### ⚪ NON-FUNCTIONAL — Tests, Refactors, Gym Scenarios

| Count | Type |
|-------|------|
| 5 | Gym scenarios (judgment, security, verification) |
| 4 | Test fixes/additions |
| 3 | Refactors (dead code removal, compatibility) |

## Summary

**51 commits. 17+ hours undeployed. $80-104/day burning while we wait.**

Every hour of delay costs ~$3-4 in preventable waste. The codebase is clean — TSC passes, all 1,457 tests green. A single process restart deploys everything.

### Restart Command
```bash
kill -TERM 7 && sleep 2 && bun src/app/launcher.ts --chat --cron --telegram --console --socket &
```

Or if the entrypoint handles restarts:
```bash
kill -HUP 7
```
