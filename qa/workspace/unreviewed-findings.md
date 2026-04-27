# Unreviewed findings (QA heartbeat)

## Context
Scanned `git log --oneline -10` at repo root. Most recent commit is `ec77ec3` adding `.state/experiments/EXP-242-evidence-gathering-structural.md`.

## Findings
### 1) Tooling gaps prevent mandatory QA checks (tsc/vitest)
- `./node_modules/.bin/tsc --noEmit` does **not** compile a project; it prints help and exits with code 1 because there is **no `tsconfig.json`** at repo root (or no default project for `tsc` to run against).
- `./node_modules/.bin/vitest --run` fails with `No such file or directory` because **vitest is not installed**.

Evidence:
- `package.json` contains only `typescript` under dependencies (no vitest).
- Running `tsc --noEmit` printed the compiler help text and exited 1.
- Running vitest returned exit code 127.

Impact:
- QA cannot independently verify TypeScript typecheck or test suite at the root repo as currently configured.

Recommendation:
- Add a root `tsconfig.json` (or document the correct `tsc -p <path>` command) and install/configure vitest if tests are expected.

### 2) Review of latest change (documentation/experiment design)
Read `.state/experiments/EXP-242-evidence-gathering-structural.md`. This is design/analysis text only; no code changes.

Notes:
- The doc explicitly acknowledges a potential weakness (⚡ pattern may not transfer to analysis modality) and proposes an appropriate fallback (scenario redesign Option C). No correctness issues found in the document itself.
