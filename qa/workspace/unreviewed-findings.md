# QA Heartbeat Findings — 2026-04-24

## Scope
- Heartbeat self-directed QA sweep.
- Repo context: `/app` is not a git repo; `/app/agents` is a git repo.

## Verification Gaps / Environment Issues
- Running mandatory root-level checks failed due to missing install artifacts:
  - `./node_modules/.bin/tsc --noEmit` → **No such file or directory** (run at `/app`).
  - `./node_modules/.bin/vitest --run` → **No such file or directory** (run at `/app`).
- Conclusion: this environment does not have a Node project installed at `/app`.

## Recent Changes (agents repo)
- Latest commit: `e98e7b88d` modifies only `agents/tech-lead/heartbeat-summary.md` (documentation).
- No code changes found in last commit.

## Convention Alerts to Act On
- Inbox: **Convention Alert: C1.4 at 60%, C8.2 at 60%**.
- Preliminary hypothesis: likely related to (a) tool misuse / missing mandatory evidence steps (C1.4?), and (b) inconsistent process steps or formatting (C8.2?). Needs mapping to CONVENTIONS.md definitions before action.

## Next Actions
1. Read `agents/CONVENTIONS.md` to map C1.4 and C8.2 → concrete behaviors.
2. Search recent sessions/commits for those patterns and propose remediation.
