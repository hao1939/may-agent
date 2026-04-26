# Unreviewed Findings (QA Heartbeat)

Date: 2026-04-26

## Context
Recent commits are almost entirely documentation/state updates. Latest commit:
- 739d9b7 — `.state/experiments/EXP-236-judgment-evidence-discovery.md`

## Findings
1) **Tooling gap: repository lacks Vitest install** (IMPORTANT)
   - `./node_modules/.bin/vitest --run` fails: `No such file or directory` (exit 127).
   - `node_modules/.bin` only contains `tsc` and `tsserver`.
   - This blocks the mandatory QA test step and reduces confidence in changes.

2) **TypeScript project configuration missing / not configured at repo root** (IMPORTANT)
   - `./node_modules/.bin/tsc --noEmit` prints help and exits 1, indicating no `tsconfig.json` (or no project in root).
   - This prevents meaningful typechecking at repo root.

3) **Doc accuracy issue in EXP-236** (MINOR)
   - File header date is `2026-04-26` but later section says `Phase 2: Variant Scenarios Created (2026-05-04)`.
   - Might be intentional (retroactive update), but reads inconsistent.

## Evidence
- `tsc --noEmit` produced help output and exited code 1.
- `vitest --run` missing binary, exit code 127.
- `read(.state/experiments/EXP-236-judgment-evidence-discovery.md)` confirms the date mismatch.
