# QA Heartbeat — Unreviewed Findings (2026-04-24)

## Context
Attempted standard QA verification steps on the **agents** repo (since it's the only visible git repo under /app). Encountered missing toolchain binaries required by the QA mandatory steps.

## Findings
### 1) CRITICAL — QA mandatory checks cannot run due to missing binaries
- `./node_modules/.bin/tsc --noEmit` fails: `No such file or directory`
- `./node_modules/.bin/vitest --run` fails: `No such file or directory`

Evidence:
- `cd /app/agents && ./node_modules/.bin/tsc --noEmit` → exit 127
- `cd /app/agents && ./node_modules/.bin/vitest --run` → exit 127
- `ls node_modules/.bin` shows no `tsc` or `vitest`
- `package.json` includes `typescript` in devDependencies, but it is not present in `node_modules` (find returned no hits)

Impact: QA cannot independently verify changes per required process; any review verdict must be CONDITIONAL until environment is fixed.

### 2) IMPORTANT — Convention alert needs concrete scope
Received alert: `Convention Alert: C1.4 at 60%, C8.2 at 60%` but the heartbeat message truncates: "Both conventions relate to" (missing details).

Action: Needs clarification from the notifier/manager about what exact behaviors are violating these conventions so QA can act/triage.

## Notes
- `/app` itself is **not** a git repo, so project code changes cannot be reviewed via git history from this location.
