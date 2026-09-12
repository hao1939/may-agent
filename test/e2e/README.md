# Daemon end-to-end tests

These tests run by default in `bun run ci`; they do not require model credentials.
They prove Host mechanics, not the quality of model-generated work.

## Running

```bash
bun run test:e2e
bun test test/e2e/e2-project-comment-roundtrip.test.ts

# Preserve only this test's sandbox for debugging.
E2E_KEEP=1 bun test test/e2e/e1-handler-loop-liveness.test.ts
```

`control-routing-e2e` and `telegram-reply-e2e` exercise in-process components
with mocked external services. The numbered scenarios start a real daemon
subprocess, use its Unix socket/HTTP interface, and inspect its stored results.

Each daemon gets a temporary directory with its own `.state`, agents, projects,
and shared files. Tests do not operate the developer's `/app` installation.
Scheduled fixtures use an explicit startup offset to avoid random initial
waiting. E1 retains real recurring timers; E4 advances metric phases through
the existing operator event ingress once its handler subscription is ready.
It tests the metric lifecycle without waiting for repeated scheduler intervals.

## Coverage and limits

| Case | What it actually checks |
| --- | --- |
| `e1-handler-loop-liveness` | At least two real cron/handler cycles with start, completion, and domain events. |
| `e2-project-comment-roundtrip` | Declared App comment subscription → Task → accepted workflow result, without modifying retained Markdown or inventing an owner/nudge. |
| `e3b-workflow-discovery` | Configured workflow discovery, execution, and terminal `workflow_runs` persistence. |
| `e4-metric-lifecycle` | Operator event triggers real handler phases: definition, healthy baseline without an alert, breach with an open alert, then recovery resolving that same alert. |
| `e5-agent-reload` | A newly written agent definition becomes visible after explicit reload. |
| `e6-host-maintenance` | Host file handlers cannot launch agents, workflows, or escalations; no worker session starts. |
| `e7-escalation-roundtrip` | One escalation moves from `needs_human` to terminal resolution; the FIFO listener produces exactly one resume attempt and failure for a synthetic session. Not successful model execution. |
| `e8-project-comment-ui` | Real browser reads legacy history, preserves rejected comments and retries after an App gains a work route, submits to a declared App route with an idempotent receipt, and executes shipped chat rendering: Markdown/raw streaming, knowledge links and escaped fallback. |
| `project-comment-recovery` | Real daemon/socket timeouts confirm the exact generic-input or comment publication; observation-only Apps and unrelated same-key receipts cannot report work acceptance. |
| `e9-session-auto-resume` | Explicit steering resumes a stored interrupted session under the same identity. Not autonomous retry/backoff or successful model execution. |
| `control-routing-e2e` | Event admission/rejection, persistence, and retained control compatibility. |
| `telegram-reply-e2e` | Telegram routing and control behavior with a mocked Telegram service. |

E8 uses this repository's pinned browser driver. Install Chrome/Chromium or set
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

Current system contracts live in `may-agent.app/docs`. Historical harness
findings are in that tree's
`archive/implementation/2026-05-19-e2e-harness-findings.md`; they are not the
current coverage checklist.
