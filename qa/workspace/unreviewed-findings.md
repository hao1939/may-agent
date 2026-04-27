# Unreviewed findings (QA heartbeat)

Date: 2026-04-27

## Environment gaps impacting mandatory QA checks

- `./node_modules/.bin/tsc --noEmit` does **not** compile a project; it prints TypeScript CLI help and exits 1. This typically indicates **no `tsconfig.json` in repo root** (or command is being run in a directory without a TS project).
  - Evidence: QA run printed `tsc: The TypeScript Compiler - Version 6.0.3` help text and exited code 1.

- `./node_modules/.bin/vitest --run` fails because **Vitest is not installed**.
  - Evidence: `/bin/bash: line 1: ./node_modules/.bin/vitest: No such file or directory` (exit 127)
  - `package.json` contains only `typescript` dependency; no `vitest`.

## Recent changes observed (not fully QA-verified)

- Commit `a8a482a` modifies `.state/requests.db` (“initialize requests.db schema”). This is a binary DB file; functional verification requires exercising whichever code reads/writes it.

- Commit `a8e4d72` adds `.state/findings/2026-04-27-agentsearchbench-execution-signals.md` and `.state/knowledge/triage-2026-04-27.md`. Content read and appears consistent with a research triage note.
