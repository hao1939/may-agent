# Unreviewed Findings (QA Heartbeat)

## Context
Heartbeat triage. No active alerts. Inbox contains repeated duplicate "Quick Code Review" notifications and a request to verify gym scenario EXP-220.

## Findings
### 1) Environment: repo root is not a git repo (IMPORTANT)
- Running `git log` in `/app` fails with: `fatal: not a git repository`.
- `agents/` is its own git repository; git operations must be run from `/app/agents`.

### 2) Tooling: tsc/vitest not available in /app (IMPORTANT)
- `cd /app && ./node_modules/.bin/tsc --noEmit` -> `No such file or directory`
- `cd /app && ./node_modules/.bin/vitest --run` -> `No such file or directory`
This means the mandatory QA verification steps cannot currently be executed from `/app`. If the intended project root for TS/test commands is different (e.g., `/app/agents`), the runbook should be clarified.

### 3) Recent change reviewed: skill-workflow-audit project file (MINOR)
Commit `5454f7b6f` touched `agents/shared/projects/skill-workflow-audit/project.md`.
- The line `- **skill.delivery-rate: 0` appears truncated/incomplete in the file. This looks like a formatting or accidental edit that should be corrected.

## Next actions
- Verify where `node_modules` lives (if anywhere) and where `tsc`/`vitest` should be executed.
- Verify EXP-220 scenario exists and is correctly set up (agent.notification P2).
- Deduplicate the 5 identical "Quick Code Review" requests (agent.notification P1) and escalate if dispatch system is spamming.
