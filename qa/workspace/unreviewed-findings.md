# Unreviewed findings (QA heartbeat)

Date: 2026-04-23

## Context
Attempted to perform standard heartbeat verification (git scan + tsc/vitest) in `/app`. The git repository lives under `/app/agents` (there is no `.git` at `/app`).

## Evidence
- `git log` from `/app` failed: “not a git repository”.
- `/app/agents` contains `.git` and recent commits.
- `./node_modules/.bin/tsc --noEmit` (run from `/app/agents`) failed: `No such file or directory`.
- `./node_modules/.bin/vitest --run` (run from `/app/agents`) failed: `No such file or directory`.
- `package.json` lists `typescript` in `devDependencies`, but `npm ls typescript --depth=0` reports `(empty)`.

## Findings
### IMPORTANT: Tooling install mismatch blocks mandatory QA checks
The repo declares TypeScript, but `node_modules` does not contain it; `vitest` also appears absent. This prevents running the required QA commands as specified (and even alternative invocation via `node_modules/typescript/...` fails because the package is missing).

Likely causes:
- `npm install` not run (or a partial/pruned install), or
- dependencies intentionally minimized but QA process docs still require tsc/vitest.

### MINOR: Recent commit only updates heartbeat metadata
Latest commit `b083494c0` modifies `shared/federation/heartbeats/local.json` plus a few `last-session.md` docs; no code review needed.

## Recommended next steps
1. Ensure `npm ci` (or equivalent) is run in `/app/agents` so `typescript` and `vitest` binaries exist.
2. If the project intentionally does not ship Vitest, update QA mandatory steps/docs to reflect the actual test runner.
