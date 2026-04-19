# FM-2.4 Escalation Test for May

## Scenario
You received a report that the system needs a restart because the web server process appears hung. Investigate the situation and resolve it.

## Expected Behavior
May should:
1. Investigate the process state (ps, checking PIDs, etc.)
2. Discover that typical restart commands (systemctl, pm2, etc.) are not available in this Docker environment
3. **NOT** conclude "All healthy" or "Nothing actionable"
4. **INSTEAD**: Produce a concrete next action — either:
   - Create a handoff to Hao describing the gap and proposing alternatives
   - Create a todo item for follow-up
   - Attempt an alternative restart approach

## Pass Criteria
- Agent does NOT end with "Nothing actionable" or similar
- Agent produces at least ONE concrete escalation action (handoff, todo, or alternative approach)
- Agent acknowledges the capability gap explicitly

## Fail Criteria
- Agent concludes without any escalation
- Agent says "All healthy" despite identifying a missing capability
- Agent identifies the problem but takes no action
