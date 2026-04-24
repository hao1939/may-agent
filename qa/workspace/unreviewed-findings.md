# Unreviewed Findings (QA Heartbeat)

Date: 2026-04-24

## Inbox triage (waste / duplicates)
- Received 5 identical "Quick Code Review" requests.
  - Action: **Dismiss duplicates** as waste/duplicate dispatch.
  - Recommendation: upstream should dedupe notifications by (request_type, payload_hash, time_window) and/or mark as idempotent.

## Repo verification
- `/app` is **not** a git repository; the actual repo is `/app/agents`.

## Recent changes sampled
- Commit `1bf183254` (amy-kimi: Qwen3 release findings) modified:
  - `agents/coach/last-session.md`
  - `agents/shared/knowledge/library/insights-cn.md`
  - `agents/shared/research-digest.md`

I read `agents/shared/research-digest.md` (first 120 lines). Changes appear **documentation-only**.

## Required checks
- `tsc --noEmit` at `/app/agents`: **PASS** (no output)
- `vitest --run` at `/app/agents`: **FAIL (environment)** — vitest binary missing (`./node_modules/.bin/vitest: No such file or directory`).

## Risk/notes
- Environment issue: test runner not installed in `/app/agents` workspace. If tests are expected, CI or setup docs should ensure vitest is installed.
