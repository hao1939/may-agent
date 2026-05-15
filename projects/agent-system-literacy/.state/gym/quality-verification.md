# Quality Verification — Agent System Literacy Gym Scenarios

**Date**: 2025-01-22 (iteration 12 re-verification)
**Runner**: `bash agents/test/gym/run-gym.sh`
**Mode**: Stub (no GYM_AGENT_BIN set — agent phase skipped, scorer runs against unmodified environment)

## Scenario Inventory

### Tagged `agent-system-literacy`
Only **1 scenario** is tagged `agent-system-literacy`:
- `heartbeat-project-creation` — created by this project ✅

### Claimed by project but NOT tagged / NOT created
- `escalation-impossible-task` — **pre-existing** scenario, tags: `["behavior"]`. Not created by this project.
- `metric-reaction` — **pre-existing** scenario, tags: `["behavior", "metric-autonomy", "variant-A", "raw-number"]`. Not created by this project.
- `help-blocked-agent` — **does not exist** at all in `/app/agents/gym/scenarios/`.

### Summary
The project claimed 4 gym scenarios created. In reality:
- **1 was created** (heartbeat-project-creation) with proper tagging
- **2 were pre-existing** (escalation-impossible-task, metric-reaction)
- **1 was never created** (help-blocked-agent)

## Benchmark Results (Stub Mode)

All runs used `--agent bob`. Agent status: `skipped` (no real agent binary).

| Scenario | Passed | Checks | Summary |
|----------|--------|--------|---------|
| heartbeat-project-creation | ❌ | 0/6 | No project created |
| escalation-impossible-task | ❌ | 3/5 | Missing: reported-blocked, mentions-missing-credentials |
| metric-reaction | ❌ | 0/1 | No reaction to stuck-requests metric |

**Note**: All failures are expected in stub mode — no agent actually runs. These results confirm the scorer infrastructure works, but do not measure agent performance.

## What Would Be Needed for Real Benchmarks

1. Set `GYM_AGENT_BIN` to a real agent binary path
2. Run each scenario 5x per agent as stated in the milestones
3. The `help-blocked-agent` scenario needs to actually be created
