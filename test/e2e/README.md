# test/e2e/

End-to-end tests for the may-agent daemon.

## Two flavors

### In-process e2e (existing)

Construct a daemon inside the test process; talk to it directly through bus
subscriptions and helper interfaces. No subprocess, no socket. Fast (~50ms
per test). These don't need any extra env var.

Examples: `control-routing-e2e.test.ts`, `telegram-reply-e2e.test.ts`.

### Live-stack e2e (new, gated)

Spawn a real `bun src/app/may.ts --cron --socket` subprocess pointed at a
sandboxed state dir, then drive it through its Unix socket and observe via
the sandbox's SQLite DB and filesystem. Asserts behavior of the **full
running daemon** — process boundary, socket frames, event persistence,
handler hot-reload, workflow file discovery, etc.

Each live-stack test is its own sandbox at `/tmp/may-e2e-<runId>/` with its
own `.state/`, `agents/`, `projects/`, `shared/`. Nothing is read from or
written to `/app/agents`, `/app/projects`, `/app/shared`, or the host's real
`.state/`.

Tests are gated behind `E2E_LIVE=1` because they spawn real daemons (~5–10s
each). LLM-driven variants are gated behind `E2E_LIVE_LLM=1`.

```bash
# In-process only (default)
bun test test/e2e/

# Live-stack tests
E2E_LIVE=1 bun test test/e2e/

# Single case
E2E_LIVE=1 bun test test/e2e/e2-project-comment-roundtrip.test.ts

# Keep sandbox dirs for debugging (default: rm on close)
E2E_LIVE=1 E2E_KEEP=1 bun test test/e2e/e1-handler-loop-liveness.test.ts
ls /tmp/may-e2e-*/
```

## Cases

| Case | Validates | Status |
|---|---|---|
| `e1-handler-loop-liveness` | Cron → handler-loader → event-persistence pipeline; `user-guide.md § Cron`, `handler-authoring.md § Lifecycle Events` | ✅ |
| `e2-project-comment-roundtrip` | `project.comment.created` socket flow → discussion.md append + status flip + `project.nudge` event; comment intake portion of `user-guide.md § Events in Practice` | ✅ |
| `e3a-task-driven-project-loop` | Task-driven project loop (lite); dispatch → dependency unblock → owner judgment routing. SDK project-task helpers | ⚠️ skipped — depends on F6 fix |
| `e3b-workflow-discovery` | Agent-scoped workflow file resolution + dispatch + `workflow_runs` persistence; `workflow-authoring.md § Workflow Location` | ✅ |
| `e4-metric-lifecycle` | `sdk.metrics.define`/`record`/`evaluate` → breach event → `metric_alerts` row → recovery; `metric-alerts.md`, `metrics.md § Pipeline` | ✅ |
| `e7-escalation-roundtrip` | `escalation.created` → `escalation.resolved` → resume_attempted/resume_failed; `needs_human` short-circuit; `sdk-quickstart.md § External Escalate`, `escalation.md` | ✅ |

E5 (agent reload), E6 (agent call chain), E8 (telegram) are not yet
implemented — see roadmap in `projects/platform/proposals/2026-05-19-e2e-harness-findings.md`.

## Library

`lib/sandbox.ts` — `buildSandbox(spec) → { socketPath, stateDir, projectsRoot, dbPath, daemonReady, close }`. Copies fixtures from `fixtures/` into a tmp dir, spawns the daemon, returns control handles.

`lib/live-daemon.ts` — `openSandboxDb`, `queryEvents`, `queryWorkflowRuns`, `querySessions`, `pollUntil`, `socketEmit`, `socketStatus`, and env-flag constants (`E2E_LIVE`, `E2E_LIVE_LLM`, `E2E_EXTENDED`).

## Fixtures

`fixtures/agents/` — minimal agent definitions. `agent.json` with `tools: ["cron"]` and a 3-line `AGENTS.md`. No real heartbeat, no real handlers unless the test specifies them.

`fixtures/handlers/` — one-purpose handler files per test. State across fires must persist in DB (handlers are hot-reloaded every fire; module-level state is reset).

`fixtures/workflows/` — fixture workflows used by E3b. Pure functions, no LLM calls.

`fixtures/projects/` — fixture project trees for tests that need them (E2, E3a).

## Findings during harness work

Building this harness surfaced six gaps in implementation/documentation that
are not test-specific. They are recorded in
`projects/platform/proposals/2026-05-19-e2e-harness-findings.md`. F6 is the
reason E3a is currently skipped.
