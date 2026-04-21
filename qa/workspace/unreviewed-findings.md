# Unreviewed Findings (QA heartbeat)

## Context
- Repo root (`/app`) is **not** a git repository; `agents/` is.
- Latest commit reviewed: `ecd98823d` — `migrate legacy projects to directory format, remove legacy .md scanning from handler`
- Changed file: `may/handlers/project.ts`

## Verification gaps (environment)
- Could not run mandatory checks:
  - `./node_modules/.bin/tsc --noEmit` failed: `.bin/tsc` missing (node_modules appears incomplete: only `.vite/` present).
  - `./node_modules/.bin/vitest --run` not runnable for same reason.
  - No `package.json` found under `agents/` (searched up to depth 3), so npm scripts/tooling cannot be verified.

## Code review notes (partial)
- Read `may/handlers/project.ts` lines 1–200.
- Observed substantial logic: project scanning, state persistence, inflight control, workflow run file writing.
- Potential risk areas to verify once tooling is available:
  - `appendComment()` uses regex replacement on `## Comments` section; ensure it preserves existing content and doesn’t duplicate/strip when `## Comments` exists with trailing sections.
  - `extractSection()` uses exact marker `## ${heading}\n` (requires newline); may fail if headings use `\r\n` or trailing spaces.
  - Best-effort `try/catch {}` blocks suppress errors (intended) — ensure failures don’t lead to silent data loss.

## Next steps
1. Ensure dependency install / workspace has `package.json` and `node_modules/.bin` populated, then re-run:
   - `./node_modules/.bin/tsc --noEmit`
   - `./node_modules/.bin/vitest --run`
2. Continue file read of `may/handlers/project.ts` (offset 201+) to assess the actual migration change and any edge cases.
