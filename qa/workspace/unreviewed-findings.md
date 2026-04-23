# Unreviewed findings (QA heartbeat)

## 2026-04-23

### Environment / verification blockers
- **Repo root `/app` is not a git repository** (git commands fail with `fatal: not a git repository`). Evidence: `git log --oneline --since='6 hours ago'` failed in `/app`.
- The actual git repo is `/app/agents`.

### Recent change inspected
- Latest relevant infra change: commit `518ef9734` (may: fix common-sense-verify and research-intake cron handlerConfig missing agent/task) touched `agents/may/cron.json`.
- I read `agents/may/cron.json` and confirmed `handlerConfig` blocks for `common-sense-verify` and `research-intake` include **both** `agent` and `task`, plus `workflow: "verify-wrap"` and a `timeoutMs`.

### Typecheck / test execution status
- Could not run mandatory checks **in this environment**:
  - `./node_modules/.bin/tsc --noEmit` missing under `/app/agents` (`No such file or directory`).
  - `./node_modules/.bin/vitest --run` missing under `/app/agents` (`No such file or directory`).
- There is no `package.json` or `tsconfig.json` at `/app/agents` root; dependencies appear to exist only inside individual `agents/gym/scenarios/*` folders.

### Notable observation
- `agents/coach/last-session.md` was the only file changed in the most recent commit (`af4ec1dfd`) and appears to be an auto-generated log entry (not code).
