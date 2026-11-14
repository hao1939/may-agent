<ai_context>
summary: "Heartbeat2 deliberately lets recurring agent work continue silently during quiet hours, unanswered-message mutes, and message-cap exhaustion, while separate turn, role, and priced-spend gates stop work. This makes attention, execution, and cost three distinct budget domains rather than one generic autonomy switch."
triggers: ["autonomous agent budgets", "quiet hours", "message caps", "unattended work", "agent spend limits", "heartbeat2", "silent agent work"]
last_updated: "2026-11-14"
source_basis: "Static inspection of electricsheephq/heartbeat2 at pinned commit 90635990c5b0d9db3e793e8ed465e2a3d5b6069b, including README, v0.3 agency specification, security disclosure, dispatch gates, policy code, and selected tests; software and tests were not run."
</ai_context>

# Autonomous-agent attention controls do not bound work

**Date:** 2026-11-14  
**Repo:** https://github.com/electricsheephq/heartbeat2  
**Reviewed revision:** https://github.com/electricsheephq/heartbeat2/commit/90635990c5b0d9db3e793e8ed465e2a3d5b6069b  
**Coverage:** Static inspection of README, `specs/v0.3-AGENCY.md`, `SECURITY.md`, `heartbeat2/poller.py`, `heartbeat2/policy.py`, and selected tests in `tests/test_v03_u1.py`, `tests/test_v03_u3.py`, and `tests/test_v03_fix1.py`  
**Disposition:** New knowledge

## Question

When an agent can initiate work between human messages, which limits control the owner's attention, which stop execution, and which bound spend?

## What the source implements

Heartbeat2 adds scheduled turns, watchers, standing roles, and optional “own time” to Hermes Agent conversations. The source makes a deliberate distinction between suppressing a message and suppressing a model turn:

- For agent-authored recurring work, roles, and own-time turns, quiet hours, the unanswered-message threshold, and the daily message cap set the occurrence to `force_silent`. The turn still enters the conversation with its normal tools, can do work, and records a summary, but its response is not delivered then.
- The daily model-turn cap, optional daily priced-spend limit, and per-role daily turn budget instead stop the agent-authored turn. The source says the spend check happens before a turn and cannot cap the cost of a turn already running; calls without known pricing do not count toward the dollar limit.
- Owner-class reminders are treated differently from agent-authored work. The source preserves selected owner-requested reminders beyond agent spend gates, while owner one-shots wait through quiet hours rather than silently doing their work.
- Silent `progress` with a summary counts as useful work and does not advance the idle governor. `no_change` and `blocked` are treated as idle, allowing repeated unproductive wakes to slow and eventually pause.
- Creation and mutation have further controls: gateway injection requires a separate configuration grant; direct messages are the default; agent-created items can be allowed, refused, or held for owner approval; active-item and child-creation limits constrain schedule growth.

Selected producer-authored tests encode these intended distinctions. They assert that recurring turns are claimed with `force_silent` under quiet hours, unanswered-message limits, and message-cap exhaustion; that `notify=true` still cannot deliver such a held message; and that model-turn, role, and priced-cost caps skip further agent work instead.

## Scout interpretation

An “autonomy budget” is too coarse to describe an unattended agent. At least three ledgers are needed:

1. **Attention budget:** whether and when the system may interrupt or message the person.
2. **Execution budget:** whether another model turn or role step may start.
3. **Spend budget:** whether priced usage remains under an operator-defined threshold.

These budgets answer different safety questions. Quiet hours can protect sleep while still authorizing tools to run. A message cap can prevent notification floods while silent turns continue consuming tokens and changing files or external systems. Conversely, a spend cap can stop new priced turns without proving that the last admitted turn stayed below the limit. A user interface that displays only “muted,” “quiet,” or “under the message limit” therefore does not establish that the agent is idle.

For systems that permit unattended tools, the receipts should identify: why the turn was admitted, whether delivery was suppressed, which execution and cost gates were checked, whether pricing was known, what effects occurred, and which later message carried any held result. Attention controls should not be presented as execution controls unless they actually prevent the turn and its tools.

This finding complements [Always-on agents are durable event cycles, not continuous sessions](./2026-11-14-always-on-agents-are-durable-event-cycles.md). That note describes the durable inbox/timer/memory/permission/outbox structure; Heartbeat2 contributes a concrete, source-level example of separate attention, turn, role, and spend semantics inside such a cycle.

## Relevance to May

May already distinguishes agent execution from communication and tracks work across durable Task attempts. Heartbeat2 suggests a useful review question for every unattended path: does a communication hold merely suppress delivery, or does it also stop tool-capable work? Operator-facing status should expose those semantics separately, especially when a turn can continue under quiet hours or a message cap.

## Evidence limits

This is producer-authored source and documentation, not independent operational evidence. Scout did not install Heartbeat2 or Hermes, run the unit or end-to-end tests, execute a wake, inspect a live SQLite database, exercise provider billing, or validate any gateway delivery. The README's benchmark compares the implementation with a repository-authored naive heartbeat emulator; Scout did not run or use those benchmark totals as evidence here.

Static inspection establishes intended code paths and tests, not that every integration preserves them. The normal conversation toolset remains available to wake turns, so the safety of silent work depends on Hermes permissions and the configured tools. The priced-spend limit explicitly excludes unpriced calls and cannot stop a turn already underway; it is an admission threshold, not a hard billing ceiling.
