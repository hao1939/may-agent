# Agent workflow frameworks: reuse and May's boundary — November 12, 2026

**Supports:** [Workflow as an executable skill](../../proposals/workflow-business-host-boundary.md).
Tests whether the proposed extraction should use an existing framework and identifies
what May must still own.

**Choice basis:** [Simple first](../../1-principles/core-principles.md#simple-first)
and [composition preserves execution rules](../../1-principles/code-vs-data.md#composition-preserves-execution-rules).
Compare complete integration costs and accepted execution semantics, rather than
choosing a framework by syntax or popularity.

**Status:** Source investigation and design recommendation. Public GitHub source,
documentation and selected regression tests were read at the revisions below.
No external package was installed, model called, framework test executed or
performance benchmark run. These are branch snapshots, not release or deployment
certifications. The active proposal owns the intended design.

## Finding and recommendation

Reusable workflow functions, injected context, lifecycle hooks, typed results,
standalone execution and hosted observation already exist in other projects.
Our proposal's mechanism is conventional. Those features alone do not justify a
new general-purpose agent workflow framework.

The useful May-specific layer is the binding between an invocation and its
existing accountable Task: identity, creator authority, shared funding/capacity,
exact captured definitions, descendant cleanup, evidence and result settlement.
A third-party execution library can sit within that boundary. The reviewed
framework contracts do not supply May's particular Task semantics automatically;
this is an integration requirement, not evidence that they cannot implement them.

Recommend extracting a **small execution wrapper and Host adapter** from current
code, retaining ordinary async functions and the existing agent backend. Keep
LangGraph's functional API as the first credible adoption alternative. Select
it if a bounded comparison shows less total code or a useful orchestration
capability we would otherwise need to build. Custom code is justified only while
that smaller scope remains cheaper to understand, verify and maintain.

## Framework comparison

| Project | What is already available | What we can learn or reuse | Fit for May |
| --- | --- | --- | --- |
| LangChain / LangGraph JS | LangChain supplies integrations/components; LangGraph supplies stateful orchestration. Graph and functional APIs share a runtime; checkpointing, streams, interrupts and retry policies are supported. | Plain-function entry points, explicit operation boundaries, custom streaming and swappable persistence. | Strongest general execution-library candidate. Checkpointing is optional, so May's fresh-attempt recovery does not disqualify it. Existing Task bindings and operation admission still need an adapter. |
| Mastra | TypeScript steps with schemas, branch/parallel composition, local run/start/stream, Studio, hooks, storage and runner integrations. | Clear step schemas, execution-engine separation and useful author feedback. | Credible existing framework; a broader agent/application surface than the current extraction. Evaluate the embedding path and completion semantics before replacing May code. |
| LlamaIndex Workflows TS | Typed events, handlers, per-run context, streams and tracing middleware. | Closest to the proposed event/runner idea; shows how small the observable core can be. | README and package metadata explicitly mark it deprecated and direct users to Python. Useful design reference; weak new TypeScript dependency choice. |
| LlamaAgents / Python Workflows | Async event-driven steps, resource injection, test runner and a separate workflow server/debugging UI. | The business workflow/core/server separation already supports the local-to-managed journey; collect output and trace together in tests. | Strong architectural reference. Adopting the Python runtime adds a language/process boundary to this TypeScript/Bun project. |
| OpenAI Agents SDK JS | Agent/Runner separation, context, tools/handoffs, typed hooks, cancellation, sessions, tracing and deterministic test models. | Dependency injection, runner-owned lifecycle and scripted model I/O while retaining the real tool pipeline. | Primarily an agent-loop/backend alternative or capability binding. May already uses Pi for agent execution; adding another loop is not necessary to extract a business workflow. It supports non-OpenAI model providers. |
| Restate TypeScript | Durable async handlers, journaled operations, workflow state, signals and attempt-scoped interceptors. | Explicit effect acknowledgment, attempt versus logical workflow identity, and documented retry/commit windows. | Valuable when durable execution is the requirement. Its server/journal would add another recovery authority unless deliberately integrated with or substituted for the current model. |
| Temporal TypeScript | Durable workflows and activities, worker/service execution, cancellation scopes and interceptors. | Separation of deterministic orchestration from external activities and mature execution controls. | Appropriate for durable process orchestration. It adds worker/service infrastructure; current worker support is Node-specific, while May uses Bun. This is a broader runtime decision. |

Evidence: [LangGraph overview](https://github.com/langchain-ai/langgraphjs/blob/737e53b1d8f613e8844764b0f2f7c012e548a15c/libs/langgraph-core/README.md); [Mastra workflows](https://github.com/mastra-ai/mastra/blob/b0ef22e7bfeb309c456d5c54528d579c4ac9e863/docs/src/content/en/docs/workflows/overview.mdx); [TypeScript workflow README](https://github.com/run-llama/workflows-ts/blob/0a1090f41a7e47137bdf7ac0e305eddcec6c9f1d/README.md); [separate workflow server](https://github.com/run-llama/llama-agents/blob/ff3ea6549dad12ccca42c285b110ce3b4e864f04/docs/src/content/docs/llamaagents/workflows/deployment.md); [Agents SDK overview](https://github.com/openai/openai-agents-js/blob/7589b9c40120b89a7d2d28a5a60b4defe1ed7bf5/README.md); [Restate SDK overview](https://github.com/restatedev/sdk-typescript/blob/492920de40602f7cdf6a0d56c363151309ebcb24/README.md); [Temporal SDK requirements](https://github.com/temporalio/sdk-typescript/blob/386515009d51a3f72b4dc89d94ecf0fb43345497/README.md).

## Findings that change the proposal

### 1. LangGraph can run ordinary control flow without a persistent thread

Its functional API wraps an async `entrypoint` and smaller `task` operations.
The entrypoint's checkpointer is optional. Its tests explicitly run both with
and without checkpointing. Therefore, “we want ordinary TypeScript” and “we do
not want a second durable workflow lifecycle” are insufficient reasons to reject
LangGraph. It is also usable without adopting the higher-level LangChain agent
abstractions, although its package still depends on LangChain core contracts.

With checkpointing and interrupts enabled, replay has additional constraints:
side effects and nondeterminism need appropriate task/receipt boundaries. A
LangGraph `task` is an execution step, not May's accountable Task. Keep these
identities distinct in any adapter.

Sources: [functional API implementation](https://github.com/langchain-ai/langgraphjs/blob/737e53b1d8f613e8844764b0f2f7c012e548a15c/libs/langgraph-core/src/func/index.ts); [functional API guide](https://github.com/langchain-ai/langgraphjs/blob/737e53b1d8f613e8844764b0f2f7c012e548a15c/docs/docs/concepts/functional_api.md); [checkpointed/non-checkpointed and cancellation tests](https://github.com/langchain-ai/langgraphjs/blob/737e53b1d8f613e8844764b0f2f7c012e548a15c/libs/langgraph-core/src/tests/func.test.ts).

### 2. A lifecycle callback is not automatically a durable commit boundary

Mastra's execution engine awaits `onStart` and propagates its failure before
steps run. Its `onFinish` and `onError` callbacks catch and log callback failures.
That is a useful observer contract, but putting May's required final persistence
only in `onFinish` would not satisfy our proposed acknowledgment rule.

The OpenAI JS hook contract uses an event emitter with listeners returning
`void`; `emit` returns a boolean. It does not by itself promise to await durable
application writes. Its official migration guidance also separates observational
hooks from execution-shaping guardrails/approvals/filters.

Use framework hooks for observation according to their actual contract. Keep
required admission and completion writes in an explicitly awaited Host boundary.
This supports the proposal's distinction between optional `ctx.emit` observations
and required capability effects.

Sources: [execution-engine hooks](https://github.com/mastra-ai/mastra/blob/b0ef22e7bfeb309c456d5c54528d579c4ac9e863/packages/core/src/workflows/execution-engine.ts); [typed lifecycle hooks](https://github.com/openai/openai-agents-js/blob/7589b9c40120b89a7d2d28a5a60b4defe1ed7bf5/packages/agents-core/src/lifecycle.ts);
[official OpenAI lifecycle guidance](https://developers.openai.com/cookbook/examples/agents_sdk/migrate-from-claude-agent-sdk/readme#what-you-migrate).

### 3. Cancellation needs an owned-operation contract

The LangGraph functional cancellation test explicitly notes that an abort can
stop graph progress without halting already active work. This is a normal
cooperative-cancellation limit. The OpenAI SDK's sibling-cancellation helper
signals siblings, waits with `Promise.allSettled` and preserves the originating
failure. Neither observation establishes that arbitrary external effects have
stopped or that a May capacity reservation is safe to release.

Mastra has useful regression examples for a missed cancellation broadcast plus
a failing persisted-state read, and for late siblings overwriting a failed run.
Those tests show why a healthy happy-path graph is insufficient integration
proof. They are source examples, not failures reproduced in this investigation.

Keep May's existing cleanup confirmation and capacity ownership. Borrow the
first-failure and late-sibling cases for the surviving contract suite, avoiding
an independent full business matrix for every execution backend.

Sources: [checkpointed/non-checkpointed and cancellation tests](https://github.com/langchain-ai/langgraphjs/blob/737e53b1d8f613e8844764b0f2f7c012e548a15c/libs/langgraph-core/src/tests/func.test.ts); [sibling cancellation implementation](https://github.com/openai/openai-agents-js/blob/7589b9c40120b89a7d2d28a5a60b4defe1ed7bf5/packages/agents-core/src/runner/siblingCancellation.ts); [lost cancellation/read-failure regression](https://github.com/mastra-ai/mastra/blob/b0ef22e7bfeb309c456d5c54528d579c4ac9e863/packages/core/src/workflows/evented/cancel-check-read-failure.test.ts); [late sibling/first-failure regressions](https://github.com/mastra-ai/mastra/blob/b0ef22e7bfeb309c456d5c54528d579c4ac9e863/packages/core/src/workflows/evented/foreach-failure.test.ts).

### 4. Event-driven business flow and observation have different jobs

LlamaIndex TS events dispatch business handlers and produce later events. Its
trace middleware separately wraps those handlers. Python Workflows also separates
resource injection and the workflow server from the procedure, and its test
runner drains events and returns the final result together.

For May's current async-function authoring, optional metric/progress events
should stay observations. Required agent calls and business publications remain
awaited operations. Turning every function call into an event-routing protocol
would introduce complexity without a demonstrated business need.

Sources: [event context](https://github.com/run-llama/workflows-ts/blob/0a1090f41a7e47137bdf7ac0e305eddcec6c9f1d/packages/core/src/core/context.ts); [trace middleware](https://github.com/run-llama/workflows-ts/blob/0a1090f41a7e47137bdf7ac0e305eddcec6c9f1d/packages/core/src/middleware/trace-events.ts); [resource injection](https://github.com/run-llama/llama-agents/blob/ff3ea6549dad12ccca42c285b110ce3b4e864f04/docs/src/content/docs/llamaagents/workflows/resources.md); [WorkflowTestRunner](https://github.com/run-llama/llama-agents/blob/ff3ea6549dad12ccca42c285b110ce3b4e864f04/docs/src/content/docs/llamaagents/workflows/testing.md).

### 5. Durable engines improve recovery, but cannot remove effect ambiguity

Restate documents a window where an external action succeeds and failure occurs
before its result becomes durable. That action can run again. Journaled workflows
therefore still need suitable external idempotency keys or receipts. This is a
useful correction to interpreting “durable workflow” as arbitrary exactly-once
external effects.

May currently retains obligation state and starts a fresh attempt after confirmed
cleanup. Restate/Temporal are worthwhile alternatives if preserving expensive
in-flight work or long-lived business waits becomes a real requirement. Adopting
them should explicitly decide who owns recovery and durable waiting. Stacking a
second owner behind the current Task recovery path needs additional evidence.
The SDK license alone does not establish a durable platform's operating or
licensing cost.

Sources: [durable context and effect failure semantics](https://github.com/restatedev/sdk-typescript/blob/492920de40602f7cdf6a0d56c363151309ebcb24/packages/libs/restate-sdk/src/context.ts); [durable payment workflow](https://github.com/restatedev/sdk-typescript/blob/492920de40602f7cdf6a0d56c363151309ebcb24/packages/examples/node/src/workflow.ts); [attempt-scoped interceptors](https://github.com/restatedev/sdk-typescript/blob/492920de40602f7cdf6a0d56c363151309ebcb24/packages/libs/restate-sdk/src/hooks.ts); [workflow interceptors](https://github.com/temporalio/sdk-typescript/blob/386515009d51a3f72b4dc89d94ecf0fb43345497/packages/workflow/src/interceptors.ts);
[May crash recovery](../../2a-design/workflows.md#crash-recovery).

### 6. Fast tests can retain the real execution path

The OpenAI SDK's scripted-model example replaces model I/O while executing the
real tool pipeline, asserts that the tool result reaches the next model request,
and checks that all scripted responses were consumed. It separately disables
network tracing. This is more useful than mocking an entire runner into a
successful result, and cheaper than booting the complete Host for each branch.

LlamaAgents' test runner similarly combines terminal output, streamed events and
state assertions. Apply these patterns at our capability boundary, with small
Host integration cases for admission, persistence and recovery. No speedup was
measured in this review.

Sources: [scripted-model tool workflow test](https://github.com/openai/openai-agents-js/blob/7589b9c40120b89a7d2d28a5a60b4defe1ed7bf5/examples/docs/testing/toolWorkflow.ts); [fixture-consumption regression](https://github.com/openai/openai-agents-js/blob/7589b9c40120b89a7d2d28a5a60b4defe1ed7bf5/examples/docs/testing/workflowDrift.ts); [WorkflowTestRunner](https://github.com/run-llama/llama-agents/blob/ff3ea6549dad12ccca42c285b110ce3b4e864f04/docs/src/content/docs/llamaagents/workflows/testing.md).

## What May should own, reuse and omit

| Layer | Recommended owner | Value or tradeoff |
| --- | --- | --- |
| Business steps and criteria | Owning App workflow | Users tune a useful method and keep its evidence/meaning |
| Model/provider/tool execution | Existing Pi backend and selected integrations | Reuse the current implementation; a new workflow wrapper does not justify replacing the model loop |
| Bounded invocation wrapper | Small portable extraction, with LangGraph as comparison candidate | Supplies consistent result, cancellation and nested-operation behavior with less Host setup |
| Host Task binding | May | Existing Task/attempt identity, creator authority, scoped capabilities, shared budgets, captured definitions, cleanup and settlement |
| Optional observation | Framework hooks or standard telemetry behind an adapter | Keep observers replaceable and distinct from required commits |
| Durable scheduling and recovery | Current Task runtime | Maintain one declared owner; reconsider a durable platform only for an identified requirement |

May's current source already imports `@earendil-works/pi-agent-core` and
`@earendil-works/pi-coding-agent` in
[agent execution](../../../../may-agent/src/lib/agent-execution.ts),
[agent runner](../../../../may-agent/src/lib/agent-runner.ts) and
[skills](../../../../may-agent/src/lib/skills.ts).
The [workflow tool](../../../../may-agent/src/lib/workflow-tool.ts) currently
combines invocation with Host services; the
[Task adapter](../../../../may-agent/src/app/adapters/executors/workflow.ts)
composes Task-specific execution. Local source inspected: `e9e88da22f`.
The work is principally separating this existing code and preserving its
contracts, rather than inventing agent orchestration from scratch.

Avoid expanding the extraction into a general graph DSL, plugin registry,
workflow scheduler or replay engine. Support an external engine by composing
it inside a bounded workflow when useful, routing managed operations through
Host capabilities. Add a dedicated engine adapter only after that use exposes a
concrete repeated need. A framework graph that returns is contribution evidence;
The Task owner still assesses and consumes it through existing admission.

## Decision and a bounded comparison

The recommendation is architectural, not a measured framework winner.
Before a broad rewrite or a new package ecosystem, compare:

1. One existing business workflow using ordinary async functions and the
   extracted execution wrapper.
2. The same input, output and deterministic capability fixtures through
   LangGraph's functional API without a checkpointer, inside the same Host boundary.

Use one useful review/repair example with a nested managed operation. Verify
input/result validation, useful partial reports, denial before child execution,
cancellation while a helper drains, optional-observer failure versus required
finish-write failure, exact definition selection, and Task settlement ownership.
Both candidates must consume the expected fixture operations; use bounded cases
that catch actual boundary regressions.

Compare standalone boot dependencies, authoring code, adaptation code, retained
May-specific machinery, test setup/runtime and behavior under those failures.
Name the baseline and include the full maintained surface, rather than judging
only a small example. If LangGraph removes more complexity than it adds while
preserving these contracts, adopt it. If the extraction stays a small wrapper
and LangGraph mainly adds translation, retain the wrapper. Select Mastra instead
for this comparison if its broader authoring/Studio features become an explicit
requirement. That runtime comparison has not been run.

## Source revisions and maintenance notes

Links above use immutable GitHub commit paths. Public source was fetched on
November 12, 2026. Package versions below are the inspected source manifests;
they are not claims about the newest published stable version.

| Repository | Inspected commit | Source/maintenance note |
| --- | --- | --- |
| [langchain-ai/langgraphjs](https://github.com/langchain-ai/langgraphjs) | [`737e53b1d8f6`](https://github.com/langchain-ai/langgraphjs/commit/737e53b1d8f613e8844764b0f2f7c012e548a15c) | MIT; `@langchain/langgraph` source manifest 1.7.3; functional API and optional checkpointer verified. |
| [mastra-ai/mastra](https://github.com/mastra-ai/mastra) | [`b0ef22e7bfeb`](https://github.com/mastra-ai/mastra/commit/b0ef22e7bfeb309c456d5c54528d579c4ac9e863) | `@mastra/core` source manifest 1.83.0-alpha.8, Apache-2.0; repository has separately licensed `ee/` content. Do not equate branch state with a stable release. |
| [run-llama/workflows-ts](https://github.com/run-llama/workflows-ts) | [`0a1090f41a7e`](https://github.com/run-llama/workflows-ts/commit/0a1090f41a7e47137bdf7ac0e305eddcec6c9f1d) | MIT; source manifest 1.3.4 explicitly deprecated, corroborated by README. |
| [run-llama/llama-agents](https://github.com/run-llama/llama-agents) | [`ff3ea6549dad`](https://github.com/run-llama/llama-agents/commit/ff3ea6549dad12ccca42c285b110ce3b4e864f04) | MIT; repository redirects to `run-llama/llama-agents`; core, server, resources and testing docs inspected. |
| [openai/openai-agents-js](https://github.com/openai/openai-agents-js) | [`7589b9c40120`](https://github.com/openai/openai-agents-js/commit/7589b9c40120b89a7d2d28a5a60b4defe1ed7bf5) | MIT; `@openai/agents-core` source manifest 0.21.0; hooks and scripted test examples inspected. |
| [restatedev/sdk-typescript](https://github.com/restatedev/sdk-typescript) | [`492920de4060`](https://github.com/restatedev/sdk-typescript/commit/492920de40602f7cdf6a0d56c363151309ebcb24) | MIT SDK; source manifest 1.18.3; server is a separate dependency and was not license-audited here. |
| [temporalio/sdk-typescript](https://github.com/temporalio/sdk-typescript) | [`386515009d51`](https://github.com/temporalio/sdk-typescript/commit/386515009d51a3f72b4dc89d94ecf0fb43345497) | MIT SDK; worker uses Node-specific native/thread/VM facilities; alternative runtimes are not supported equivalently. |

Mastra licensing evidence: [repository license](https://github.com/mastra-ai/mastra/blob/b0ef22e7bfeb309c456d5c54528d579c4ac9e863/LICENSE.md).
