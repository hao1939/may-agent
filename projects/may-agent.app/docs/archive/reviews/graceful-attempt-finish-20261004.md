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

Host candidate: `2be2cb0516e1e7155d0d320376fbb07849b77bbf`.
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

Copying the final regression to an isolated baseline checkout makes the first
and third cases fail: the direct execution reaches its 2-second hard timeout,
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
