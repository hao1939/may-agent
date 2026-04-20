# Unreviewed Findings — 2026-04-20 (QA heartbeat)

## Context
- `/app` is **not** a git repository; the actual git repo is `/app/agents`.

## Recent changes (agents repo)
Working tree modifications are heartbeat context/last-session docs:
- `amy-kimi/workspace/heartbeat-context.md`
- `bob/workspace/heartbeat-context.md`
- `coach/workspace/heartbeat-context.md`
- `evaluator/last-session.md`
- `evaluator/workspace/heartbeat-context.md`
- `optimizer/workspace/heartbeat-context.md`
- `qa/workspace/heartbeat-context.md`
- `scout/workspace/heartbeat-context.md`
- `tech-lead/workspace/heartbeat-context.md`

These appear auto-generated; no product logic changes identified in this heartbeat.

## QA process blockers (CRITICAL)
Mandatory QA commands failed:
- `./node_modules/.bin/tsc --noEmit` → missing (`/app/node_modules` contains only `.vite`, no `.bin`).
- `./node_modules/.bin/vitest --run` → missing.
Also, no `package.json` / `tsconfig.json` found near repo root, so a Node/TS project structure is incomplete in this environment.

## Quality sweep (spot check)
Read `src/dashboard/server.ts`:
- Type safety: `any` used in `json(res, data: any)`, `readBody(): Promise<any>`, and `catch (err: any)`.
- Error handling: `readBody()` unconditionally `JSON.parse`s; malformed JSON yields 500 instead of a 400.
- Module-system ambiguity: `import.meta.dirname || __dirname` mixes ESM and CJS patterns; needs a clear build/runtime target.

## Heartbeat addendum — 2026-04-20 (new verification)

### File read (mandatory step #1)
Read `src/pipeline.js`:
- **CRITICAL:** Comment/spec says normalize before penalties (“Normalization must precede penalty application…”) but code applies penalties before normalization (`applyPenalties()` then `normalize()`). Either the comment is wrong or the implementation is wrong; outcome may differ.
- **IMPORTANT:** `validateRecords()` compares `score`/`max_score` using relational ops; if scores are strings from CSV, coercion may be surprising. Recommend explicit number parsing/validation.
