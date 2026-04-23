# Unreviewed findings (QA heartbeat)

## Scope (this heartbeat)
- Reviewed recent commits in `/app/agents` (last 10).
- Read one recently changed file (`agents/scout/skills/verify-quantitative-claims.md`).
- Attempted mandatory verification commands (`tsc`, `vitest`) per QA SOUL; both are missing in this repo’s `node_modules/.bin`, so independent verification is not possible.

## Evidence
### Recent commits (agents repo)
- `git log --oneline -10` output (see tool evidence in this session) includes:
  - `7b2ca014f` — `scout: new skill verify-quantitative-claims targeting FM-3.3 (unbacked counts in finish summaries)`
  - `c6243eb6c` — `qa: heartbeat findings on missing tsc/vitest`

### File read (changed content)
- `agents/scout/skills/verify-quantitative-claims.md` (read this session)
  - Adds a rule: any numeric claim in `finish(success)` must be backed by a tool output (e.g., `grep -c`, `wc -l`, `jq length`) and cited in `verification_evidence`.
  - No executable code; content looks internally consistent.

## Mandatory checks
### `./node_modules/.bin/tsc --noEmit`
- FAIL (cannot run): `/bin/bash: line 1: ./node_modules/.bin/tsc: No such file or directory`

### `./node_modules/.bin/vitest --run`
- FAIL (cannot run): `/bin/bash: line 1: ./node_modules/.bin/vitest: No such file or directory`

## Findings
### IMPORTANT: QA verification commands are unavailable in this repo
- The QA SOUL mandates running `tsc` and `vitest`. In `/app/agents`, `./node_modules/.bin/tsc` and `./node_modules/.bin/vitest` do not exist, so mandated verification cannot be performed.

## Recommended remediation
- Add `typescript` and `vitest` (plus configs as needed) to `agents/package.json` (devDependencies), OR update QA SOUL/knowledge to reflect the correct verification commands for this repo.
