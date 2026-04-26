# Unreviewed findings (QA heartbeat)

Date: 2026-04-26

## Environment / verification blockers

- `./node_modules/.bin/tsc --noEmit` does not run a project compile because there is **no tsconfig.json** at repo root. The command prints the TypeScript help text and exits with code 1.
  - Evidence: tool run in this session showed `tsc: The TypeScript Compiler - Version 6.0.3` help output, exit code 1.

- `./node_modules/.bin/vitest --run` cannot be executed because **vitest is not installed** in this repo (`./node_modules/.bin/vitest: No such file or directory`).
  - Evidence: tool run in this session exited code 127.

## Recent changes sampled

- Read `.state/experiments/EXP-230-concept-lookup-deployment.md` (commit `0901093`). It claims a new tool `agents/shared/knowledge/ke-lookup.sh` exists, but this heartbeat did **not** verify the script file itself or any integration/wiring.

- Read `.state/hypotheses/h-exp-028-skill-shallow-read.md` (commit `2a89b48`). Noted a likely metadata issue: header says **Created: 2026-10-28** but resolution references 2026-05-25; chronology seems inconsistent.
