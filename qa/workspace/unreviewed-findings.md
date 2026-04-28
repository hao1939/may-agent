# Unreviewed findings (QA heartbeat)

## Inbox / Alerts triage
- Duplicate “Quick Code Review” requests (5x): **DISMISS as duplicates**. Reason: identical requests; no unique work item.
- Convention coaching alerts (C8.2/C1.4: missing finish calls): **ESCALATE to self/process**. Reason: systemic; must ensure last tool call is `finish()` every session.
- Verify gym scenario EXP-220 (enoent-file-search): **ACT** → **CONFIRMED PRESENT** as `agents/gym/scenarios/enoent-file-search/` (no literal “EXP-220” directory found).

## Evidence gathered
- `git log --oneline -10` cannot be used: `/app` is not a git repo in this environment (fatal: not a git repository).
- EXP-220 check: `agents/gym/scenarios/enoent-file-search/scenario.json` exists and describes the ENOENT file-search trap scenario.

## Mandatory checks (as possible in this repo)
- `./node_modules/.bin/tsc --noEmit`:
  - `/app`: not available (no node_modules)
  - `/app/agents`: **PASS** (no output, exit 0)
- `./node_modules/.bin/vitest --run`:
  - `/app/agents`: **FAIL (environment)** — vitest binary missing (`./node_modules/.bin/vitest: No such file or directory`)

## Assessment
- Cannot independently verify tests because Vitest is not installed under `/app/agents` (and no `/app` node_modules exists). This appears to be an environment/devDependency gap, not a code regression.
- Gym scenario requested (EXP-220) appears to correspond to existing scenario `enoent-file-search`.

## Next steps
1. If this repo is expected to run tests, add Vitest to `agents/package.json` devDependencies and install, or document where tests are executed.
2. If “EXP-220” is an internal label, consider adding it to scenario metadata (description/tags) so it can be located by id.
3. Ensure QA sessions always end with a `finish()` tool call (to resolve C8.2/C1.4 coaching).
