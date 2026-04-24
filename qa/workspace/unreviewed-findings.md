# QA Heartbeat — Unreviewed Findings (2026-04-24)

## Context
- Repo root `/app` is not a git repository.
- Actual git repo is `/app/agents`.

## Recent changes (agents repo)
- `15f389de8` (amy): updated `amy/last-session.md` and appended results to `shared/knowledge/experiments/EXP-178/runs-real.jsonl`.

## Findings
1. **Test runner mismatch (environment gap)**
   - QA SOP expects `./node_modules/.bin/vitest --run`, but `/app/agents` has no vitest dependency/binary.
   - Evidence: `ls node_modules/.bin` shows `tsc` but no `vitest`; `package.json` has only `typescript` + `puppeteer-core`.

2. **Experiment log indicates prior SQL injection miss in one run**
   - `agents/shared/knowledge/experiments/EXP-178/runs-real.jsonl` includes an entry where `sql-injection-addressed` is `false` for arm `G1`, but later arm `G2` passed all checks.
   - This is informational; not a code regression by itself.
