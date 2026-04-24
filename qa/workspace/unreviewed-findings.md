# QA Heartbeat — Unreviewed Findings (2026-04-24)

## Inbox waste alerts (duplicate review requests)
- **Action:** Dismiss as duplicate/waste. The inbox contains 5 identical “Quick Code Review” notifications with no payload identifying a specific PR/commit/file to review.
- **Escalate to:** Dispatcher/optimizer — investigate why “Quick Code Review” is duplicated 5x.

## Repo / verification notes (evidence)
- `/app` is **not** a git repo; only `/app/agents` is (`git log` at `/app` fails with `fatal: not a git repository`).
- Mandatory verification commands were run against `/app/agents`:
  - `./node_modules/.bin/tsc --noEmit` → **PASS** (no output, exit 0).
  - `./node_modules/.bin/vitest --run` → **FAIL**: `No such file or directory` because `vitest` is not installed (`agents/package.json` has no vitest devDependency).

## Uncommitted changes detected
- There are uncommitted diffs in `agents/evaluator/last-session.md` and `agents/scout/last-session.md` (auto-generated last-session files). This is not a functional code change but does indicate a process issue (dirty tree).
