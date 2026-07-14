---
name: native-coding-worker
description: Delegate a bounded investigation, review, comparison, or patch to Codex CLI or Claude Code through May's durable run_cli_agent path. Use when an independent coding worker adds capacity or a second opinion.
---

# Native Coding Worker

## Core Rule

Send one sharp packet and keep May or the project owner accountable for the
decision. A CLI worker is capacity, not a project owner or completion oracle.

## Protocol

1. Choose `investigate`, `review`, or `patch` from the requested outcome.
2. State one question or deliverable, relevant files, constraints, expected
   evidence, and a stop condition.
3. Prefer `reuseSession: true` for May's normal Codex/Claude continuity. Use a
   fresh native session only when the human asks or context isolation matters.
4. For mutation-heavy patch work, prepare an isolated worktree and set
   `worktreePolicy: "require"`. Do not let a worker improvise branch cleanup.
5. Use `expectedOutput` when a deterministic JSON handoff is useful.
6. Treat acceptance as asynchronous. Follow `cli.task.completed` or
   `cli.task.failed`, then inspect the result and evidence paths.
7. Verify patches in the owning checkout before claiming completion.

Prefer TypeScript/JavaScript and Bun for new May-agent helpers. Use another
language only when the required existing tool has no maintained JS/TS path.

## Failure Handling

Use the recorded category to choose the next move:

- `permission`: correct authority or sandbox assumptions;
- `tool`: repair the command/tool packet;
- `no_output` or `output_schema`: sharpen the expected artifact;
- `timeout`: reduce scope or resume the native session;
- `process` or `orphaned`: inspect events and runtime health before retrying.

Do not treat a zero process exit alone as success, and do not retry blindly.

## Anti-Patterns

- Sending a vague project-sized prompt without a stop condition.
- Delegating ownership or human judgment to the CLI worker.
- Using a patch worker in the main dirty checkout when isolation is practical.
- Claiming success without reviewing result, diff, and verification evidence.
- Creating a parallel request lifecycle outside `cli.task.*` and its trace.
