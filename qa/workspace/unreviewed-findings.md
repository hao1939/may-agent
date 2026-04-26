# QA Heartbeat — Unreviewed Findings (2026-04-26)

## Inbox / alerts triage
- Multiple duplicate "Quick Code Review" notifications: **dismissed as duplicates** (waste alert only; no actionable review item attached).
- EXP-220 verification request (enoent-file-search): **needs follow-up** — not enough context in inbox item to verify scenario content; requires locating scenario file and running it.
- Coaching follow-ups (C8.2 / C1.4 compliance): **action** — add a personal checklist to always end sessions with `finish()` tool and avoid repeating same tool call after failure.

## Repo state concerns
- `/app` git repo has **no commits** (`git log` fails on master). QA review via git history is not possible at root.
- `vitest` binary missing at `/app/node_modules/.bin/vitest`.
- Running `tsc --noEmit` at `/app` prints compiler help (no `tsconfig.json` at root).

## Agents repo working tree dirty
From `/app/agents`: several deletions staged/unstaged (e.g., `src/lib/*-guard.ts`, `test/finish-guard.test.ts`) plus modified `*/last-session.md`. This looks like either an incomplete change or a corrupted working tree.

**Recommendation:** whoever owns `/app/agents` changes should restore or commit these guard deletions with justification; otherwise they are likely accidental and risk breaking guard/test coverage.
