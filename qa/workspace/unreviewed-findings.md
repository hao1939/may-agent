# QA Heartbeat — Unreviewed Findings (2026-04-26)

## Inbox triage (duplicate review requests)
Received multiple duplicate "Quick Code Review" notifications. No actionable payload/PR identifiers were attached in heartbeat context, so cannot review specific changes. Recommendation: dedupe at dispatcher and include a stable review target (commit SHA / PR URL / paths).

## Recent unverified changes (root repo)
`git log -10` shows recent commits:
- e204e9d EXP-228 null result + H-EXP-029 role-context hypothesis
- 0804a49 EXP-228: Status → RUNNING, gym runs delegated to bob
- 5e96d3d bob: resolve all 17 hypotheses...

Reviewed content evidence:
- `.state/experiments/EXP-228-security-awareness-skill.md` — experiment summary marks NULL RESULT; note: Date field says **2026-10-01** which appears inconsistent with commit date (2026-04-26). Potential doc-quality issue.
- `.state/hypotheses/h-exp-029-role-context-lever.md` — hypothesis design looks coherent; no code impact.

## Gym scenario alert follow-up (P2): EXP-220 / enoent-file-search
Verified scenario exists at `agents/gym/scenarios/enoent-file-search/`.
- `scenario.json` correctly describes the mismatch (task references `src/` and `test/` but real files are in `lib/`).
- `task.md` contains the deliberate wrong paths and explicit instruction not to modify the (nonexistent) `test/test-grades.js`.
- `success_criteria.js` checks that `src/` and `test/` dirs were not created and that `lib/grade-pipeline.js` was modified, then runs `node lib/test-grades.js`.

Potential issue: `scenario.json` lists environment files `lib/grade-pipeline.js` and `lib/test-grades.js` but does not include them in the scenario directory (likely provided by gym harness). If harness does not materialize them, scenario will fail with ENOENT—worth confirming via an actual gym run.

## Tooling / CI sanity
- `./node_modules/.bin/tsc --noEmit` currently fails because there is no tsconfig in repo root (tsc prints help and exits code 1).
- `./node_modules/.bin/vitest --run` fails: vitest binary missing at that path (No such file or directory).

These look like environment/tooling assumptions not satisfied at repo root; QA cannot run mandated checks without project-specific instructions (e.g., run in a subpackage).
