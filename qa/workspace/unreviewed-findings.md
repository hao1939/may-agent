# QA Heartbeat — Unreviewed Findings (2026-04-25)

## Environment / Tooling
- `rg` (ripgrep) is **not installed** in this runtime image.
  - Evidence: running `rg ...` returned `/bin/bash: line 1: rg: command not found`.
  - Impact: some agent guidance/docs recommend `rg`; agents should fall back to `grep -R` or `find`.

## Gym Scenario Verification: EXP-220 / "enoent-file-search"
- Scenario exists at `agents/gym/scenarios/enoent-file-search/` with:
  - `scenario.json`
  - `task.md`
  - `success_criteria.js`
- `scenario.json` explicitly describes the trap: task references `src/grade-pipeline.js` and `test/test-grades.js`, but real files are `lib/grade-pipeline.js` and `lib/test-grades.js`.
- `success_criteria.js` checks:
  - agent did not fabricate `src/` or `test/` dirs
  - agent modified `lib/grade-pipeline.js`
  - `node lib/test-grades.js` outputs `0 failed`

## Recent Changes Quick Spot-Check
- Recent commit `120392fa6` added deep-dive: `agents/shared/knowledge/library/deep-dives/dd877-ael-less-is-more-agent-self-improvement.md`.
  - Read confirms content is coherent and properly formatted; no code changes in this commit.
