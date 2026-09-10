---
name: native-coding-worker
description: Run a bounded investigation, review, comparison, or patch with Codex CLI or Claude Code through May's awaited run_cli_agent tool. Use when an independent coding worker adds useful capacity or a second opinion.
---

# Native Coding Worker

## Core Rule

Send one sharp packet and keep May or the project owner accountable for the
decision. A CLI worker is capacity, not a project owner or completion oracle.

## Protocol

1. Choose `investigate`, `review`, or `patch` from the requested outcome.
2. State one question or deliverable, relevant files, constraints, expected
   evidence, and a stop condition.
3. Start fresh for an independent opinion. Pass `resumeSessionId` only to
   continue an exact known native thread; implicit shared reuse is retired.
4. For mutation-heavy patch work, prepare an isolated worktree outside `/app` and set
   `worktreePolicy: "require"`. Do not let a worker improvise branch cleanup.
5. Use `expectedOutput` when a deterministic JSON handoff is useful.
6. Await the tool's terminal result, then inspect its named result and evidence
   paths. Do not poll a worker record or return a CLI-terminal Condition.
   The returned `taskId` is only an evidence correlation key, not a Task or
   execution resource. Work that must outlive this call belongs to the
   responsible App's ordinary Task.
7. Verify patches in the owning checkout before claiming completion.

Prefer TypeScript/JavaScript and Bun for new May-agent helpers. Use another
language only when the required existing tool has no maintained JS/TS path.

## Failure Handling

Use the recorded category to choose the next move:

- `permission`: correct authority or sandbox assumptions;
- `tool`: repair the command/tool packet;
- `no_output` or `output_schema`: sharpen the expected artifact;
- `timeout`: reduce scope or resume the native session;
- `process`: inspect events and runtime health before retrying;
- `cancelled`: respect the caller's cancellation rather than restarting it.

Do not treat a zero process exit alone as success, and do not retry blindly.

## Anti-Patterns

- Sending a vague project-sized prompt without a stop condition.
- Delegating ownership or human judgment to the CLI worker.
- Using a patch worker in the main dirty checkout when isolation is practical.
- Claiming success without reviewing result, diff, and verification evidence.
- Creating a separate worker queue or completion lifecycle beside the caller's
  Task.
