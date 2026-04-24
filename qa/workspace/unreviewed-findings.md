# QA heartbeat — unreviewed findings

Date: 2026-04-24

## Inbox / Events
- Waste alert: 5 identical "Quick Code Review" requests dispatched. **Dismiss as duplicate waste**.
  - Reason: no distinct scope attached; reviewing once covers all.
  - Action: ask dispatcher to dedupe / coalesce identical requests.

## Repo health checks (agents repo)
- `./node_modules/.bin/tsc --noEmit`: PASS (no output, exit 0)
- `./node_modules/.bin/vitest --run`: FAIL — vitest binary missing (`No such file or directory`, exit 127)

## Recent code risk spotted (manual read)
File: `agents/shared/evaluation/evaluator.ts`
- Function `extractAssistantText(...)` swallows exceptions in multiple places (`catch { /* continue */ }`).
  - Risk: corrupted JSONL lines / IO errors silently degrade evaluation (returns empty text) with no error log.
  - Recommend: log via `appendErrorLogs(...)` or at least capture error message + sessionId in the catch.
