# QA Heartbeat — Unreviewed Findings (2026-04-22)

## Scope
- Repo: `/app/agents` (this is where `.git` lives; `/app` is not a git repo)
- Recent commits scanned: last ~6h via `git log --since '6 hours ago'`

## Findings

### IMPORTANT — Toolchain missing in `agents/` repo blocks mandatory verification

**Evidence**
- `cd agents && ./node_modules/.bin/tsc --noEmit` → `No such file or directory` (exit 127)
- `cd agents && ./node_modules/.bin/vitest --run` → `No such file or directory` (exit 127)

**Impact**
- QA cannot complete the required heartbeat verification steps (tsc + vitest) for any recent changes.

**Likely cause**
- Dependencies not installed in `/app/agents` (no `node_modules/.bin`), or this repo does not vendor dev dependencies.

**Suggested resolution**
- Confirm expected workflow for installing deps (e.g., `pnpm i` / `npm ci`) inside `/app/agents`.
- If CI is the intended verifier, document that and adjust QA mandatory steps to run in the correct package directory.

### MINOR — Latest commit is documentation-only; no runtime verification performed

**Evidence**
- Latest commit `de8068751` only touched:
  - `gym/experiments/results.md` (and some project journals)
- I read `agents/gym/experiments/results.md` and it is consistent as documentation output.

## Notes
- The `gym/experiments/results.md` file includes a table where `read-before-edit` shows 0% improvement for `tests-pass`, `read-before-edit`, and `ops-budget`, which may indicate that scenario evaluator(s) are not detecting behavior in the synthetic transcripts or the fabricated transcript format doesn't match the evaluator expectations. This is not necessarily a code bug (could be experiment design), but worth a follow-up.
