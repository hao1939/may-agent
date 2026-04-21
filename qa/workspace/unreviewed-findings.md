# Unreviewed findings (QA heartbeat)

## Context
- Repo root `/app` is **not** a git repository; only `/app/agents` is.
- No `node_modules` present in `/app`, so required QA commands `./node_modules/.bin/tsc --noEmit` and `./node_modules/.bin/vitest --run` cannot be executed.

## Recent commits (agents repo)
From `cd agents && git log --oneline -10`:
- 4d3f923ec bob: update last-session from context-learning extraction
- 4a7a4cfd2 bob: workspace state updates from prior session
- 5c8397057 context-learning: add lessons for scout from failed sessions
- 061534bda scout: Apr 21 triage — DD#551-556 ...
- 9f844138b scout: deep-dive on agent learning mechanisms ...
- 74ec5fbb2 bob: mark CR#348 synthesis done, KE-325 written
- 5b8347b4e INDEX: add KE-325
- 5dd33e6fa EXP-190: blocked on gym infra — agent not invoked (GYM_AGENT_BIN unset)
- 8455409d2 KE-325: Disagreement Architecture five-layer stack (CR#348)
- a90ad937c optimizer: cost outlier scan ...

## Working tree status
`git status` shows modified files (likely auto-generated heartbeat context files):
- amy-kimi/workspace/heartbeat-context.md
- bob/last-session.md
- bob/workspace/heartbeat-context.md
- coach/workspace/heartbeat-context.md
- evaluator/workspace/heartbeat-context.md
- optimizer/workspace/heartbeat-context.md
- qa/workspace/heartbeat-context.md
- scout/last-session.md
- scout/workspace/heartbeat-context.md
- tech-lead/workspace/heartbeat-context.md

## Quick quality sweep (sample file)
Read `agents/bob/last-session.md`: looks like an auto-generated session summary; no obvious formatting or content issues.

## Issues / Risks
1) **Environment gap:** missing project root with `package.json`/`node_modules` prevents mandated TypeScript + Vitest verification.
2) **Noise changes:** multiple `workspace/heartbeat-context.md` and `last-session.md` files are modified; these can create churn if committed unintentionally.
