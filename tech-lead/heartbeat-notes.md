# Tech-Lead Heartbeat Notes

## Latest Heartbeat (current)

- **Build**: Clean (0 TS errors via `tsc --noEmit`)
- **Dead code check**: No unused .ts files found in recent commits
- **amy-kimi**: Already disabled in agent.json (429 rate limit, account suspended)
- **Inbox triage** (20+ items):
  - Gym runner `agent_type` bug → Already fixed (AGENT_TYPE_MAP in .gym-runner-bundle.mjs:520)
  - Gym runner `--oneshot --task` → Correct; binary expects `--task` not `--task-file`
  - amy-kimi 100% errors (3 notifications) → Already disabled
  - C7.1 path violations → Context.md already has warnings
  - Handler health/cron/requests.db/metrics issues → Infra-layer, not agents/ code
  - EXP-235 ready → No action needed this heartbeat
  - success_criteria.js "Cannot..." → Paths resolve correctly in code; may be runtime env issue

## Previous Heartbeat

- **Build**: Clean (0 TS errors via `npx tsc --noEmit`)
- **Workspace tests**: 15/15 passing
- **Inbox triage**:
  - Gym runner `agent_type` bug → Already fixed (AGENT_TYPE_MAP in .gym-runner-bundle.mjs:519)
  - Bob persistent-task SOUL.md request → Dismissed (guidance already in bob/context.md + bob/skills/persistent-task-workflow.md)
  - Gym runner `--oneshot` blocker → Related to agent_type bug, already resolved
