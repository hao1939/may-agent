# Graceful attempt finishing trial — 2026-10-04

**Supports:** [Finishing before the execution deadline](../../2a-design/execution-contributions.md#finish-before-the-execution-deadline).
**Choice basis:** [Simple first](../../1-principles/core-principles.md#simple-first) and [agents judge; infra executes](../../1-principles/core-principles.md#code-executes-and-brings-back-evidence-agents-judge).
**Status:** Source candidate, not deployed. Scripted provider decisions; no live model trial or measured token savings.

## Question and choice

Can existing partial-result admission preserve useful work when a helper consumes
the attempt's allowance? Admission already works if the agent returns a valid
result. A hard timeout can prevent that result from being submitted at all.
The operation-count reminder alone misses long waits with few tool calls.

Reserve time inside the original deadline, stop cooperative work, and ask the
agent to submit its existing result contract. The agent judges progress and
remaining work. Infra does not synthesize success, extend the deadline or add a
new Task state. This trades a small amount of work time for an opportunity to
retain progress; unresponsive providers and non-cooperative I/O can still fail.

## Source and reproduction

Host candidate: `731cdc250fddb6d8b17c8637756297db9196367b`.
Initial trial revision: `2be2cb0516e1e7155d0d320376fbb07849b77bbf`.
Baseline: `a267244d110a5830fbc75c786ee2252cb5692c94`.
Owning regression: `src/lib/graceful-finish.test.ts` in the Host repository.
Run `bun test src/lib/graceful-finish.test.ts` after a frozen dependency install.

The fixture uses the real Pi model/tool loop, managed Task executor, result
validation and admission with temporary storage. Its scripted provider checks:

- A blocked tool stops; new effects are rejected; `finish()` can correct a
  rejected proposal and submit honest partial progress.
- A stalled final model response still reaches the original hard timeout,
  without an invented result.
- A helper is joined and its interrupted execution reference returns to the
  parent. Accepted progress keeps the request unfinished. The next attempt
  receives that evidence and completes without launching the helper again.

Copying the direct and managed Task regressions to an isolated baseline checkout
makes both fail: the direct execution reaches its 2-second hard timeout,
and the managed execution reaches its 3-second hard timeout without accepted
progress. Their short allowances exercise the same proportional reserve.

An initial fixture assumed the helper's timeout and parent's reminder had a
fixed order and allowed exactly two model responses. Repetition exposed that
invalid assumption: a helper can return just before the reminder, and feedback
can postpone a proposed tool call. The fixture now follows returned evidence,
honors provider cancellation and permits bounded corrective turns. Twelve
consecutive managed-Task trials passed without retries hiding a failed trial.
This was a fixture correction, not a reason to impose ordering on the runtime.

No live installation, Task, deployment or native Codex execution was changed.
The owning contract states executor coverage and cancellation limitations.

## Review follow-up: nested helper evidence

[PR #308](https://github.com/hao1939/may-agent/pull/308#discussion_r4174540051)
identified a missing depth boundary. An inherited work-stop reason was wrapped
as ordinary caller cancellation, so a deeper synchronous helper call discarded
its joined result. Preserve that reason at the execution-scope boundary through
every descendant; ordinary cancellation retains its existing behavior.

The regression drives an owner, helper and leaf through the real model/tool
loop. Once the leaf tool has started, it injects an ancestor work stop and
checks the exact interrupted execution reference in both nested call receipts,
retained leaf evidence and complete draining. A separate explicit-Stop case
still reports cancellation. Injecting the signal after entry avoids racing
child startup with a short timer; the existing Task test owns timer coverage.
The work-stop case fails on the original PR revision while the ordinary Stop
case passes. Both pass with the correction; the focused suite passes 63 tests
with 294 assertions. No model judgment is inferred.
