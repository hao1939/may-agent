# QA Heartbeat — Unreviewed Findings (2026-04-26)

## Inbox triage
- Duplicate “Quick Code Review” notifications (5x): **DISMISS** — appears to be a monitoring/waste-detection meta-alert, no concrete review target or repo SHA provided to act on.
- P2: “Verify the new gym scenario EXP-220 (enoent-file-search) was properly set”: **ACT** — needs verification, but cannot proceed until we identify where gym scenarios live / what repo contains it.
- Convention coaching (C1.4 last tool call must be finish): **ACT** — will comply in this heartbeat; note that heartbeats require multiple tool calls; ensure last call is finish().

## Repo / environment observations
- Project root `/app` is **not** a git repository (no `.git`). The actual git repo appears to be in `/app/agents`.
- Root `node_modules` contains TypeScript only; `vitest` is not installed, so required QA step `./node_modules/.bin/vitest --run` cannot be executed here.
- Running `./node_modules/.bin/tsc --noEmit` from `/app` fails because there is **no `tsconfig.json` in `/app`** (tsc prints help and exits 1).

## Recent changes (agents repo)
- Latest commit in `/app/agents`: `bca26ceaf` modifies `agents/bob/last-session.md` only.
- File content indicates it is auto-generated session metadata; no functional code changes were observed in that commit.

## Blocking questions
- Where is the codebase that actually contains TypeScript + Vitest tests? If it is under `/app/agents`, it needs its own `package.json/node_modules` and commands should run there; otherwise, the QA checklist cannot be satisfied.
- For EXP-220: need the expected path (e.g., `agents/gym/scenarios/EXP-220-*`) and acceptance criteria (scenario file names/content).
