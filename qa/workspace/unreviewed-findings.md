# QA Heartbeat — Unreviewed Findings (2026-04-23)

## Scope
Heartbeat review of recent changes in the `agents/` repo (last ~6h) and a quick runtime/tooling sanity check.

## Findings

### 1) CRITICAL — Repo/tooling mismatch blocks mandatory QA checks (tsc/vitest)
- Running `./node_modules/.bin/tsc --noEmit` from `/app` fails because `node_modules/.bin/` does not exist.
  - Evidence: `./node_modules/.bin/tsc --noEmit` → `/bin/bash: ... No such file or directory`
- Same for vitest.
  - Evidence: `./node_modules/.bin/vitest --run` → `/bin/bash: ... No such file or directory`
- In `/app/agents`, there is a git repo, but it also has no `node_modules/.bin` and no `package.json` / `tsconfig.json` at repo root.
  - Evidence: `cd agents && find . -maxdepth 2 -name package.json -print` → no output; `find ... tsconfig.json` → no output.

Impact: the QA role’s non-negotiable verification step (tsc+vitest) cannot be executed in this environment as currently laid out.

### 2) IMPORTANT — `may-agent-bin` invocation confusion (ELF executed via node)
- `node may-agent-bin --help` throws `SyntaxError: Invalid or unexpected token` because `may-agent-bin` is an ELF binary.
- Executing directly works but returns another error: `Agent "may" is not registered. Available:`

This indicates a likely operator footgun: docs/scripts should not suggest running the binary via `node`.

### 3) Review target — new cron subscription for `project` handler
Recent commit `6bb63fb80` modifies `agents/may/cron.json` to add `"escalation.created"` to the `project` job’s `on` list.
- Evidence: `git -C agents show --name-only --oneline 6bb63fb80` and `read(agents/may/cron.json)`.

Quick code read: `agents/may/handlers/project.ts` appears to already accept an optional `event?: TriggerEvent` and uses `event?.source` to emit metrics. No immediate logic bug found in the scanned file, but it has broad try/catch that silently skips DB errors; consider logging errors at least at debug level.

## Recommended follow-ups
1. Decide/standardize how QA should run `tsc`/`vitest` in this repo (maybe via `bun x vitest`, or provide `scripts/test` wrapper), or ensure `node_modules/.bin` exists by adding a package manager install step.
2. If `may-agent-bin` is the intended runner, add a short README snippet: “Run `./may-agent-bin ...` (do not prefix with node)”.
3. If `project` handler is intended to react to `escalation.created`, ensure the event type actually emitted in system matches that string (not verified this heartbeat).
