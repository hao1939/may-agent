# Unreviewed Findings (QA Heartbeat)

Date: 2026-04-24

## Inbox triage (waste / duplicates)
- Received 5 identical "Quick Code Review" requests.
  - Action: **Dismiss duplicates** as waste/duplicate dispatch.
  - Recommendation: upstream should dedupe notifications by (request_type, payload_hash, time_window) and/or mark as idempotent.

## Repository status / verification constraints
- `/app` is **not** a git repository; the actual repo is `/app/agents` (has `.git`).
- QA mandatory check note: `./node_modules/.bin/vitest --run` **cannot be executed** in `/app/agents` because **vitest is not installed** (not present in `node_modules/.bin`, and not listed in `package.json`). This is an environment/config gap, not a code regression.

## Recent changes (last 10 commits) — sampled
- `ccdd7d886` and `23a0b9fd2` are doc/log updates only (`*/last-session.md`, `runs.jsonl`). No product code to review.
- Most recent commits that mention code fixes (`357549878`, `0b2c6f2cd`) also only touched `tech-lead/last-session.md` in this repo; the actual code changes likely occurred in another repo or in generated scenario outputs.

## Required checks (run by QA, independent)
- `tsc --noEmit` (from `/app/agents`): **PASS** (no output).
- `vitest --run` (from `/app/agents`): **FAIL (environment)** — `./node_modules/.bin/vitest: No such file or directory`.

## Quality note
- Tech-lead session log claims "All 9 tests pass"; QA could not verify due to missing vitest.
