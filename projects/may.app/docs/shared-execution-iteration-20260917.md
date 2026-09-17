# Shared execution iteration — 2026-09-17

Status: candidate implementation; live trials pending.

The common contract is in `may-agent.app/docs/2a-design/workflows.md`. One Task
owns the outcome. Agents choose methods; workflows compose bounded operations.
Awaiting a result does not suspend event admission. Shared managed execution
forwards durable Task feedback, carries exact scope and cancels nested helpers.
Only Task settlement accepts results and consumes input.

The Host candidate binds model-facing workflow tools per exact caller session,
accepts structured input, propagates Task context through helper calls and uses
the shared managed-agent boundary for feedback. Conversation invocations receive
the same context. A procedure requiring a Task worktree cannot run in a shared
Conversation workspace. Ordinary Git-backed Tasks allocate their worktree before
agent execution. Historical Task workflow runs recover through their owning Task,
not through the model tool's legacy resume action.

May now owns its profile and team workflow inside `may.app`. Public inputs are
message and goal; May selects a procedure rather than a development input routing
to tech-lead. Bob and tech-lead remain specialists. Changed input preserves saved
reports, prompts fresh judgment and permits exact verification reuse when the
requirements, command and candidate still match. Workspace/file layout redesign,
scoped naming and Bob's missing search tools remain separate.

Portable checks have exercised concurrent same-name callers, structured input,
exact Task reads, feedback during a helper call, cancellation and listener cleanup.
Provider responses in those tests are synthetic. App checks exercise real Git and
commands with synthetic specialist judgments. Live results will be added below.
