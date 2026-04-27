# Regression Guard: Agent System Literacy

## Metrics to Watch

| Metric | Description | Source |
|--------|-------------|--------|
| `system.project-creation-rate` | Are agents creating projects correctly? | `/app/agents/shared/projects/` directory |
| `system.escalation-quality` | Do escalations include context, not just "help"? | Recent escalation messages in request DB |
| `gym.literacy-pass-rate` | Can agents pass basic literacy checks? | Gym drill results if available |

## Breach Thresholds

| Metric | Breach Condition | Rationale |
|--------|-----------------|-----------|
| `system.escalation-quality` | < 50% of escalations have actionable context | Agents reverting to low-quality asks |
| `system.project-creation-rate` | 0 new projects in 7+ days despite active work | Agents ignoring project workflow |
| `gym.literacy-pass-rate` | 0% (no agents reading shared docs) | Complete disengagement from system |

## Reactivation Trigger

When bob's heartbeat runs, it should:

1. **Check escalation quality**: Review last 5 escalations. If >half lack context (no file paths, no error details, no attempted solutions), flag breach.
2. **Check project activity**: If no projects created/updated in 7 days despite active sessions, flag breach.
3. **Check skill usage**: If agents are repeatedly asking questions answered in existing docs, flag breach.

**If any threshold is breached**: Reopen project `agent-system-literacy` with a new milestone targeting the specific regression.

## Resolution

Once the regression is addressed (metrics return above threshold for 3+ heartbeat cycles), close the project again.
