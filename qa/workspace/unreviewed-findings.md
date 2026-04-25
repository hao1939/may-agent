# QA Heartbeat — Unreviewed Findings (2026-04-25)

## Inbox triage
- Multiple duplicate notifications about "Quick Code Review" waste: likely upstream dispatch duplication. No actionable code artifact attached in this heartbeat, so **dismissed as duplicate noise**.
- Alert to verify new gym scenario EXP-220: investigated — scenario exists as `agents/gym/scenarios/enoent-file-search/`.

## EXP-220 verification
- No directory named `EXP-220*` exists under `agents/gym/scenarios/`.
- A scenario named **`enoent-file-search`** is present and appears to match the described EXP-220 intent.
- Evidence: `agents/gym/scenarios/enoent-file-search/scenario.json` contains description referencing ENOENT + file search trap.

## Test/tooling environment issues
- `./node_modules/.bin/tsc --noEmit` fails: `No such file or directory` (node_modules not present in this environment).
- `./node_modules/.bin/vitest --run` fails: `No such file or directory`.

## Recent change sweep (agents repo)
- Latest commit in `agents/` is `2742f338e`, modifies only `agents/bob/last-session.md` (auto-generated session metadata).
