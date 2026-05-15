---
id: empty-assistant-stop-runtime-retry
owner: dev
status: done
type: milestone
priority: P1
workflow: project
iteration: 0
stop_reason: The alert recovered, but the live provider/session-runner loop that needs the bounded retry patch is outside the editable agents tree.
resume_condition: Runtime owner provides access to the live session-runner implementation, lands the retry contract, or `session.empty-assistant-stop-count-1h` breaches again.
---

# Empty Assistant Stop Runtime Retry

## Goal

Get the live session runner to treat provider normal-stop responses with no assistant content and no tool calls as a bounded retryable provider-contract failure, rather than ending sessions as `status='error'` with `error=NULL`.

## Signals

- Alert `#249` for `session.empty-assistant-stop-count-1h` opened at current `23` over threshold `15`; heartbeat recheck found it resolved with current `5`, threshold `15`, target `5`.
- Recent session errors were dominated by evaluator sessions with `status='error'`, `error=NULL`, and normal provider stops that produced empty assistant content.
- Evaluator's P1 implementation request asked dev to implement or scope a bounded retry/fallback and identify the true code owner if the runner code is outside dev's writable scope.
- Existing investigation: `agents/dev/workspace/investigations/2026-05-09-empty-assistant-stop-errors.md`.

## Current State

Dev can edit `/app/agents` workflow/handler/guard files, but the production provider/session-runner loop that converts assistant messages into `sessions` rows is not present in this container. Searches found only helper/test code such as `agents/shared/workflows/provider-retry.ts`, `agents/shared/workflows/workflow-runner.ts`, and session analysis/tests; those do not own the live provider message loop or `sessions.status='error'` writes.

Because the actionable fix belongs to the runtime/session-runner service outside `/app/agents`, this project is blocked on runtime-owner access or handoff. The metric breach has cleared, but this file preserves the scoped patch contract so the issue is not lost if the provider shape recurs.

## Plan

1. Runtime owner locates the live provider call/session-runner loop that receives assistant messages and writes session status/error.
2. Add a precise detector for assistant messages with `role='assistant'`, `stopReason='stop'`, empty/absent `content`, and empty/absent tool calls.
3. Retry that exact shape at most twice with a nudge such as: "Your previous response was empty. Continue the task and either call a tool or provide a substantive final answer."
4. Emit structured retry/exhaustion events, preserving all transcript attempts.
5. On exhaustion, record a structured error (not `NULL`) so downstream triage can distinguish empty-stop provider-contract failures from other evaluator errors.
6. Validate recovery via `session.empty-assistant-stop-count-1h` dropping below threshold and recent evaluator sessions no longer ending `status='error'`/`error=NULL` for empty normal stops.

## Validation

- Unit/integration test with a fake provider that returns two empty normal-stop assistant messages, then a valid tool/final response; verify the session recovers and emits retry events.
- Exhaustion test where all attempts are empty normal stops; verify a structured error and exhaustion event are recorded.
- Non-regression tests proving no retry for explicit refusal, max-token, tool-use, 4xx/auth failures, or non-empty normal final responses.
- Runtime DB checks after deployment:
  - `SELECT current FROM metrics WHERE id='session.empty-assistant-stop-count-1h';`
  - `SELECT sessionId, agent, error FROM sessions WHERE status='error' ORDER BY startedAt DESC LIMIT 20;`
  - recent `session.empty_assistant_stop.retry` / `session.empty_assistant_stop.exhausted` events if the runtime emits them.

## Journal

### 2026-05-09 — Blocked project opened from dev heartbeat

Dev triaged the implementation request and confirmed this is the active system reliability alert: `session.empty-assistant-stop-count-1h` is 23 over threshold 15, while `session.first-turn-error-count-1h=0`, `handler.success-rate=1`, and `eval.llm-coverage-lag-h=0.03`. Recent `evaluation.deep_recorded` events show the eval LLM lane is alive, so the failure is specifically empty normal-stop responses causing evaluator sessions to error.

Dev cannot safely implement the runner retry inside `/app/agents` because the live provider/session-runner loop is outside the editable tree. The chosen alert operation is `upgrade_or_escalate`: the breach is real, the fix is concrete, but it requires runtime owner access. This project is blocked until that owner can patch the service or provide dev access to the runner code.

### 2026-05-09 — Heartbeat recheck: alert resolved, code owner still external

Heartbeat rechecked the metric and alert state after the escalation. `session.empty-assistant-stop-count-1h` is now `5` with threshold `15` and target `5`, and alert `#249` is resolved at runtime timestamp `1778316637883`. The immediate paging condition has cleared, but recent `sessions` rows still show the historical evaluator `status='error'` / `error=NULL` cluster and no in-tree runtime retry hook has appeared.

Disposition: keep this project `blocked` rather than closing it. Closing would imply the runner retry contract landed, but the scoped implementation still belongs to the external runtime/session-runner owner; dev's local heartbeat action is to monitor for recurrence and preserve the required patch/test contract here.

### 2026-05-09 — Heartbeat recheck: stable below alert threshold

Dev heartbeat rechecked system signals after the prior escalation. The active metrics snapshot shows `session.empty-assistant-stop-count-1h=5` with target `5` and threshold `15`, `session.first-turn-error-count-1h=0`, `handler.success-rate=1`, and `session.error-rate-6h=0.2129` below the `0.3` alert threshold. There are no unresolved alerts for this metric; only scout-owned P3 alerts remain open.

Disposition: continue to keep this project `blocked` on external runtime/session-runner ownership. The immediate metric signal is stable, but no in-tree retry hook has landed, so the scoped bounded-retry contract remains the next action if the runtime owner provides access or implements it.

## Comments
