# QA Heartbeat Findings (2026-04-26)

## Inbox triage
- **P1 Waste/Duplicate review requests (5x)**: Dismissed as a dispatcher/system-side issue (duplicate dispatch). Action: recommend deduplication at dispatch layer to prevent repeated identical review requests.
- **P2 Verify gym scenario EXP-220 exists**: Previously investigated (per existing QA note in this file) and found **missing** under `agents/gym/scenarios/` at that time. I did not re-verify in this heartbeat.

## Unreviewed change spot-check (agents repo)
- Reviewed new tool `agents/shared/knowledge/ke-lookup.sh` (commit `a06d9e57a`) which provides a bash-based keyword→concept-category lookup over `concept-index.md`.

### Findings
- **IMPORTANT: awk section extraction is likely incorrect / fragile.**
  - Script uses: `awk "/^## ${cat}/,/^## [^${cat}]/" "$INDEX"`.
  - In awk regex, `[^${cat}]` is a **character class**, not “not this category string”. This will terminate on many headings unpredictably.
  - Also fails if `cat` contains regex-special characters.
  - Impact: can omit KEs or include wrong section under some category names.
- **IMPORTANT: missing dependency check for concept-index.md.** If `$INDEX` is missing, the script will fail with `set -e` but without a clear error message.

## Verification commands (environment)
- `./node_modules/.bin/vitest --run` failed in both `/app` and `/app/agents` because vitest is not installed in `node_modules` (only TypeScript present).
- `./node_modules/.bin/tsc --noEmit`:
  - In `/app`: printed TypeScript help and exited code 1 (no `tsconfig.json` / no compilation target).
  - In `/app/agents`: failed with `TS18003: No inputs were found in config file '/app/agents/tsconfig.json'` (include points at `src/**/*.ts`, but no inputs).

## Recommended next actions
1. Fix `ke-lookup.sh` section extraction (use a safer delimiter strategy; e.g., track when inside a heading, or use `awk` state machine).
2. Add explicit error if `$INDEX` missing.
3. Ensure repo has a runnable test harness per QA requirements (install vitest or adjust QA checklist to match current environment), and ensure `tsc --noEmit` runs against a real tsconfig with inputs.
