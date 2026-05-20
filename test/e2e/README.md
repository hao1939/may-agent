# test/e2e/

End-to-end tests for the may-agent daemon.

## Two flavors

### In-process e2e (existing)

Construct a daemon inside the test process; talk to it directly through bus
subscriptions and helper interfaces. No subprocess, no socket. Fast (~50ms
per test). These don't need any extra env var.

Examples: `control-routing-e2e.test.ts`, `telegram-reply-e2e.test.ts`.

### Live-stack e2e

Spawn a real `bun src/app/may.ts --cron --socket` subprocess pointed at a
sandboxed state dir, then drive it through its Unix socket and observe via
the sandbox's SQLite DB and filesystem. Asserts behavior of the **full
running daemon** — process boundary, socket frames, event persistence,
handler hot-reload, workflow file discovery, etc.

Each live-stack test is its own sandbox at `/tmp/may-e2e-<runId>/` with its
own `.state/`, `agents/`, `projects/`, `shared/`. Nothing is read from or
written to `/app/agents`, `/app/projects`, `/app/shared`, or the host's real
`.state/`.

Live-stack tests run by default because they are the main behavior contract.
LLM-driven variants are gated behind `E2E_LIVE_LLM=1`.

```bash
# Full e2e suite, including live-stack daemon tests
bun test test/e2e/

# Single case
bun test test/e2e/e2-project-comment-roundtrip.test.ts

# Keep sandbox dirs for debugging (default: rm on close)
E2E_KEEP=1 bun test test/e2e/e1-handler-loop-liveness.test.ts
ls /tmp/may-e2e-*/
```

## Cases

| Case | Validates | Status |
|---|---|---|
| `e1-handler-loop-liveness` | Cron → handler-loader → event-persistence pipeline; `user-guide.md § Cron`, `handler-authoring.md § Lifecycle Events` | ✅ |
| `e2-project-comment-roundtrip` | `project.comment.created` socket flow → discussion.md append + status flip + `project.nudge` event; comment intake portion of `user-guide.md § Events in Practice` | ✅ |
| `e3a-task-driven-project-loop` | Task-driven project loop (lite); dispatch → dependency unblock → owner judgment routing. SDK project-task helpers | ✅ |
| `e3b-workflow-discovery` | Agent-scoped workflow file resolution + dispatch + `workflow_runs` persistence; `workflow-authoring.md § Workflow Location` | ✅ |
| `e4-metric-lifecycle` | `sdk.metrics.define`/`record`/`evaluate` → breach event → `metric_alerts` row → recovery; `metric-alerts.md`, `metrics.md § Pipeline` | ✅ |
| `e5-agent-reload` | `reload` socket command → new agent on disk picked up, updated agent reported; `user-guide.md § Reload`, `agent-convention.md` | ✅ |
| `e6-agent-call-chain` | `ctx.sdk.runAgent(target, task)` from a handler → child session with `kind=call`+`source=callAgent`, completion event observed; `sdk-quickstart.md § sdk.runAgent` | ✅ |
| `e7-escalation-roundtrip` | `escalation.created` → `escalation.resolved` → resume_attempted/resume_failed; `needs_human` short-circuit; `sdk-quickstart.md § External Escalate`, `escalation.md` | ✅ |
| `e8-project-comment-ui` | Served platform UI: index loads, top-level assets resolve, row click navigates to canonical id, comment form POSTs to `/api/projects/comment`, discussion.md appended, status flips. Replaces the manual `scripts/e2e-platform-comment.mjs`. Skipped on hosts without Chrome (set `E2E_NO_UI=1` to opt out). | ✅ |
| `e9-session-auto-resume` | Cold (interrupted) session pre-seeded on disk → `steer` socket frame → unified `manager.resumeSession` primitive → fresh `session.start` event with the same sessionId. Regression test for the v2 single-resume-path refactor (`resumeInterrupted` no-op removed; `executeResume` is the single funnel). | ✅ |
| `control-routing-e2e` | In-process socket frame routing; canonical `message.created` persistence/rejection plus legacy `fork` command translation | ✅ |
| `telegram-reply-e2e` | In-process Telegram reply routing, proactive human messages, project comment nudges, session steering, slash-command normalization | ✅ |

E8 currently covers project-comment UI; broader telegram UI flows and
full-LLM variants of E3a/E6 are still future work — see roadmap in
`projects/platform/proposals/2026-05-19-e2e-harness-findings.md`.

## Library

`lib/sandbox.ts` — `buildSandbox(spec) → { socketPath, stateDir, projectsRoot, dbPath, daemonReady, close }`. Copies fixtures from `fixtures/` into a tmp dir, spawns the daemon, returns control handles.

`lib/live-daemon.ts` — `openSandboxDb`, `queryEvents`, `queryWorkflowRuns`, `querySessions`, `pollUntil`, `socketEmit`, `socketStatus`, and env-flag constants (`E2E_LIVE_LLM`, `E2E_EXTENDED`).

## Fixtures

`fixtures/agents/` — minimal agent definitions. `agent.json` with `tools: ["cron"]` and a 3-line `AGENTS.md`. No real heartbeat, no real handlers unless the test specifies them.

`fixtures/handlers/` — one-purpose handler files per test. State across fires must persist in DB (handlers are hot-reloaded every fire; module-level state is reset).

`fixtures/workflows/` — fixture workflows used by E3a and E3b. Pure functions, no LLM calls.

`fixtures/projects/` — fixture project trees for tests that need them (E2, E3a).

## Findings during harness work

Building this harness surfaced implementation/documentation gaps that are not
test-specific. They are recorded in
`projects/platform/proposals/2026-05-19-e2e-harness-findings.md`.
