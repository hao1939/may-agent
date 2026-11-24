# Daemon end-to-end tests

These tests run by default in `bun run ci`; they do not require model credentials.
They prove Host mechanics, not the quality of model-generated work.

## Running

```bash
bun run test:e2e
bun test test/e2e/e2-app-feedback-roundtrip.test.ts

# Preserve only this test's sandbox for debugging.
E2E_KEEP=1 bun test test/e2e/e2-app-feedback-roundtrip.test.ts
```

`control-routing-e2e` and `telegram-reply-e2e` exercise in-process components
with mocked external services. The numbered scenarios start a real daemon
subprocess, use its Unix socket/HTTP interface, and inspect its stored results.

Each daemon gets a temporary directory with its own `.state`, agents, projects,
and shared files. Tests do not operate the developer's `/app` installation.
Scheduled fixtures use an explicit startup offset to avoid random initial
waiting. E4 advances metric phases through
the existing operator event ingress once its handler subscription is ready.
It tests the metric lifecycle without waiting for repeated scheduler intervals.

## Coverage and limits

| Case | What it actually checks |
| --- | --- |
| `e2-app-feedback-roundtrip` | Canonical App input → Task → accepted workflow result, without modifying retained Markdown or inventing an owner/nudge. |
| `e3b-workflow-discovery` | Configured workflow discovery, execution, and terminal `workflow_runs` persistence. |
| `e4-metric-lifecycle` | Operator event triggers real handler phases: definition, healthy baseline without an alert, breach with an open alert, then recovery resolving that same alert. |
| `e5-agent-reload` | A newly written agent definition becomes visible after explicit reload. |
| `e5-source-activation` | Source activation has a correlated result; an invalid candidate preserves the active source. |
| `task-startup-no-schedules` | Real daemon restart recovers accepted work even when recurring schedules are disabled. |
| `task-delegation-recovery` | Typed delegation, scoped caller progress while a worker is pending, then daemon/worker crash after an external commit but before acknowledgment; ordinary recovery reads the receipt without another publication and returns through the original caller. Model decisions use a scripted local provider. |
| `task-native-feedback` | App-mapped input reaches an already-active native turn through a separate Task worker; duplicate ingress causes one effect, accepted results consume exact inputs, and unrelated input remains pending. Uses a scripted native protocol peer, not the installed Codex CLI or a model. |
| `control-routing-e2e` | Event admission/rejection, persistence, and retained control compatibility. |
| `telegram-reply-e2e` | Telegram routing and control behavior with a mocked Telegram service. |

The browser scenarios in `test/integration/http-health-pages.test.ts` and
`test/integration/http-human-tasks.test.ts` use the pinned browser driver.
Install Chrome/Chromium or set
`CHROME_PATH`. Missing prerequisites are an explicit local skip; `E2E_NO_UI=1`
also skips locally. Both conditions fail under `CI=true`, where the browser
scenario must execute.

## Helpers and fixtures

`lib/sandbox.ts` creates the isolated tree, starts the daemon, captures logs,
and tears it down. `lib/live-daemon.ts` provides socket, polling, and database
helpers. Poll for the observation being tested rather than sleeping and
assuming it happened.

Committed fixtures provide minimal agents, mechanical handlers, a no-model
workflow, and project files. Handler progress that spans invocations is stored
in the sandbox database, not hidden in module globals.

The [test guide](../README.md) describes current coverage ownership. Keep Host
fixtures self-contained; App acceptance and historical App trials belong with
the owning App and are supplied separately when needed for an integration.
