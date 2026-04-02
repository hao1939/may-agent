# Finding: 42 Undeployed Commits — Restart Impact Analysis

**Date**: 2026-03-18T04:50 UTC
**Status**: BLOCKED on process restart (Hao action)
**Severity**: CRITICAL — System is running 14h-stale code

## Current State

- **Process PID 7**: Started 2026-03-17 ~14:47 UTC (identity.json timestamp)
- **Current time**: 2026-03-18 ~04:50 UTC
- **Stale duration**: ~14 hours
- **Undeployed commits**: 42 (15 fixes, 11 features, 16 other)
- **Test status**: 1,428/1,428 passing (106 test files, 0 failures)

## High-Impact Undeployed Fixes

### Cost-Saving (estimated $30-60/day blocked)
| Commit | Fix | Est. Daily Savings |
|--------|-----|-------------------|
| `7c86665` | Bypass LiteLLM for Anthropic → enable prompt caching | $23-47/day |
| `848ebf1` | Idle heartbeat pre-flight skip | $6/day |
| `97f3a50` | Agent error circuit breaker (stops Bob waste) | $3-5/day |
| `9eefa72` | Read-dedup guard (blocks Amy read loops) | $2-3/day |

### Reliability Fixes
| Commit | Fix |
|--------|-----|
| `440bc6a` + `f8a481c` + `5244274` + `8c8cf0b` | Cron config hot-reload (4 commits fixing reload chain) |
| `4c7cdc3` | Zombie session cleanup on startup |
| `07b0d7f` | Tool-as-agent guard |
| `2233509` | finish() evidence validation guard |
| `e7c1cb9` | Evaluator re-evaluation infinite loop fix |
| `a3d9865` | Stuck detection activation (was dead code!) |

### Evaluator Improvements
| Commit | Fix |
|--------|-----|
| `1671974` | Re-evaluate zero-usage evals |
| `adc98bd` | Wire heuristic evaluations into startup |
| `6c44f0e` | Parse real usage from JSONL transcripts |
| `b43b94e` | Fix false-positive error detection |

### New Capabilities
| Commit | Feature |
|--------|---------|
| `e4bebca` + `433e18c` + `ae37f2a` | Checkpoint tool (P3.5) — 10 tests |
| `986d89b` | 'interrupted' status in TaskResult |
| `9eff164` | Turn budget warning at 35 (was 40) |

## Cost of NOT Restarting

Per hour of delay:
- ~$1.25-2.50/hr in prompt caching waste alone
- ~$0.25/hr in idle session waste
- ~$0.15/hr in Bob circuit breaker waste
- **Total: ~$1.65-2.90/hr ≈ $40-70/day**

Over the 14h since process start: **~$23-41 wasted** on problems with committed fixes.

## Action Required

**Single action**: Restart the process (PID 7).

```bash
# From Docker host:
docker exec may-agent /usr/local/bin/restart-may.sh
# OR from within container:
kill 7
```

All 42 commits are tested (1,428/1,428 pass) and ready for deployment.
