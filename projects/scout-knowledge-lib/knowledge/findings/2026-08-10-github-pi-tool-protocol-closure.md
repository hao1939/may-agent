<ai_context>
summary: "GitHub finding on pi-from-scratch's compact, executable account of coding-agent loop protocol closure: truncation, abort, unknown-tool, and tool-execution paths must leave model context structurally valid, while production controls remain deliberately omitted."
triggers: ["pi-from-scratch", "coding agent loop", "tool-call protocol", "tool results", "abort handling", "max_tokens", "context compaction"]
last_updated: "2026-08-10"
source_basis: "GitHub repository metadata, README, agent-loop implementation, and tests at commit 9554b9cbf49ba511db60f4befa83edf705f1e532; Scout installed development dependencies, ran all tests, and built the TypeScript project."
</ai_context>

# Pi from Scratch: Agent Loops Need Protocol Closure

Date: 2026-08-10  
Source: GitHub  
Repo: https://github.com/SaladDay/pi-from-scratch

## Signal

**pi-from-scratch** is a new Chinese-language, 600-line TypeScript teaching
implementation that reduces a Pi-style coding agent to an observable stream,
mutable context, four tools, and a loop. Its useful contribution is not a new
agent architecture. It makes a subtle reliability invariant unusually easy to
inspect: **every loop exit and tool-execution path must leave the model's
conversation protocol structurally closed**.

At the inspected revision, a tool call does not merely trigger a function. It
creates an obligation to either record a corresponding result or remove the
call from the accepted assistant message. Truncation and cancellation therefore
need explicit protocol behavior rather than generic exception handling.

## Source-grounded details

- **Repository status:** GitHub search metadata reported the MIT repository was
  created on 2026-08-09 and had 199 stars at observation time. This is an early
  educational implementation signal, not production validation or an adoption
  trend.
- **The loop exposes one auditable data path:** streamed assistant events are
  collected into text and tool calls, the assistant message is appended to
  context, tools execute, and one user-side tool-result message is appended
  before the next model round.
- **Truncation closes rather than executes:** if the model stops on
  `max_tokens` after emitting tool calls, the loop does not run potentially
  incomplete arguments. It emits and records an error result for every call,
  then asks the model to continue in the next round.
- **Abort has two distinct closure paths:** an abort reported while streaming
  records an assistant message with no accepted tool calls and exits. An abort
  during serial tool execution retains completed results and synthesizes
  `error: aborted` results for every skipped call, avoiding dangling tool-use
  entries.
- **Unknown tools remain inside the protocol:** an unregistered tool name
  becomes a tool result (`not found`) rather than an exception that tears down
  the conversation. Ordinary execution exceptions are converted similarly.
- **Compaction is fail-open for evidence retention:** once the message-count
  threshold is reached, old messages are replaced only if a summary call
  returns non-empty output without an error or abort. Failed summarization
  leaves the original context intact.
- **The omissions are explicit and important:** tool arguments are not validated
  against their advertised JSON Schemas; there is no hard step budget or
  production `shouldStopAfterTurn` policy; tools execute serially; compaction is
  triggered by message count rather than tokens or turn-safe cut points. The
  repository presents these as teaching simplifications, so it should be used
  as an executable anatomy lesson, not copied as a production harness.
- **Executable evidence:** Scout installed development dependencies and ran the
  repository at commit `9554b9cbf49ba511db60f4befa83edf705f1e532` on Node 24.
  All 5 Vitest files and 24 tests passed, and `tsc` built successfully. The
  agent-loop suite directly covers plain-text completion, successful tool-result
  reinsertion, and unknown-tool recovery. It does **not** directly test the
  truncation, abort, or compaction branches described above; those observations
  come from inspecting the implementation.

## Why it matters

A minimal agent loop is often summarized as “model → tool → model.” That hides
the actual invariant:

> Once a tool call is committed to conversation history, every subsequent path
> must account for it before the history can be replayed or resumed.

This is **protocol closure**, and it spans more than successful execution:

| Path | Required closure behavior |
| --- | --- |
| Complete tool call | Record the tool's result |
| Unknown tool | Record a typed/visible failure result |
| Tool throws | Convert the failure into a result |
| Output truncated during arguments | Do not actuate; close each call with a truncation result |
| Abort before calls are committed | Persist no accepted calls |
| Abort after some calls execute | Close both completed and skipped calls |
| Context compaction fails | Preserve the replayable original history |

The broader operational lesson is that interruption safety belongs in the
conversation state machine, not only in process supervision. Durable runtimes
can restart a worker, but they cannot safely resume malformed model history
unless the harness defines how partial streams and partial tool batches are
closed.

## Connection to Scout themes

This sharpens the earlier
[Pi minimal-harness finding](./2026-08-05-hn-pi-minimal-harness-extension-stack.md).
That source showed how a small core externalizes sandboxing and extension policy;
this repository shows what the core cannot externalize: conversation-protocol
integrity at each interruption boundary. Minimalism can omit convenience and
policy, but it still needs explicit closure semantics.

For production harness review, the compact implementation suggests a useful
checklist: enumerate every stop reason and every point where a tool batch can be
partially observed, then prove that replayed context contains either a complete
call/result relation or no committed call at all.

## Primary sources

- Repo at inspected revision: https://github.com/SaladDay/pi-from-scratch/commit/9554b9cbf49ba511db60f4befa83edf705f1e532
- Agent loop: https://github.com/SaladDay/pi-from-scratch/blob/9554b9cbf49ba511db60f4befa83edf705f1e532/src/agent.ts
- Agent-loop tests: https://github.com/SaladDay/pi-from-scratch/blob/9554b9cbf49ba511db60f4befa83edf705f1e532/test/agent.test.ts
- README: https://github.com/SaladDay/pi-from-scratch/blob/9554b9cbf49ba511db60f4befa83edf705f1e532/README.md
