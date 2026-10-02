# Agent prompt assembly: source review and simplification proposal

**Supports:** [Agent Cooperation](../2a-design/agents.md). Reviews whether usable instructions and facts reach the actual worker without duplication.

**Choice basis:** [Applicable philosophy and convention](../1-principles/core-principles.md#context-is-discovered-not-dumped); [compare competing choices](../1-principles/core-principles.md#resolve-conflicting-designs).

**Status:** Cleanup implemented on candidate source; verification recorded below.
Not deployed. The source review and initial probes below describe the baseline.

## Decision

Keep the existing preparation pipeline. Give each piece of model context one
owner and a clear lifetime. Remove repeated and obsolete instructions before
extracting any remaining substantial Host prose into bundled Markdown.

The final model input is a system instruction, tool definitions, and a sequence
of messages. It is not just `appTaskAgentProtocol`, `AGENTS.md`, or the initial
request. Reviewing only one string misses transformations and later input.

This follows [Host/App ownership](../2a-design/system-boundary.md),
[context passing](../2a-design/agents.md#context-passing), and
[mechanism selection](../1-principles/code-vs-data.md). No prompt registry,
template language, automatic keyword routing, or additional work lifecycle is
needed. Method selection remains agent/App judgment.

## Source and evidence

Reviewed Host `e55f932a7fd26009fd12d7b9d60fa64b306d1973` and installation source
`6b7cdac90456624d8f8194b125988e45ed79d732`. These are checkout revisions, not a
claim about the running binary or active immutable definition release.

A synthetic probe used the production `prepareAgentExecution` and
`createAgentRun`, replacing only `streamFn` with a recording fake provider.
It made seven fake provider calls and zero real model calls. Two iterations
examined the current assembly and a composition using the existing
`executionContext` option. No live Task or installation state was changed.

| Probe | Observed at the provider boundary |
| --- | --- |
| Normal managed preparation | Shared and role instructions in system; Task protocol in messages; result schema in tools; current Task brief appended |
| App context preparer returning a smaller request | It received the original request. The Task protocol disappeared; schema and current Task brief remained |
| Force transcript compaction | The tail of the Task protocol and the initial request disappeared from the message view; schema and current Task brief remained |
| Repeated Task reads | The brief refreshed and did not accumulate in the durable transcript |
| Explicit `systemPrompt` | Convention files and generated environment were bypassed; generic finish instructions were still appended |
| Short Host orientation passed through existing `executionContext` | It survived both App preparation and compaction; tools and current Task context still arrived |

The compaction result does not mean the root Task lost its canonical assignment:
the fresh brief still supplied its outcome and input. It demonstrates that
instructions and invocation-specific details carried only in the initial
message are not guaranteed to remain visible. The composition probe establishes
placement, not improved model judgment or a completed Host integration.

Reproduction: prepare a synthetic agent with distinct markers in
`shared/common-sense.md`, `AGENTS.md`, and `context.md`; supply the actual Task
result schema and a scoped fake Task reader. Capture `systemPrompt`, `messages`,
and tool parameters in `streamFn`. Repeat with `contextPreparation` returning
one short sentence, then with enough old messages to trigger compaction. Repeat
with the orientation in `executionContext`. Assert marker visibility and exact
Task identity at this boundary, rather than comparing a copied renderer.

Existing checks ran at the reviewed Host revision:

```sh
bun test src/lib/agent-execution.test.ts \
  src/lib/task-decision-context.test.ts src/lib/task-workspace-context.test.ts \
  src/lib/completion-contract.test.ts src/lib/compaction.test.ts \
  src/lib/workflow-finish-recovery.test.ts \
  src/app/loader/agent-registry-loader.test.ts \
  src/app/adapters/executors/codex/codex-goal-packet.test.ts
```

Result: **136 passed, 0 failed**. These are assembly, lifecycle, and contract
checks. They do not measure model quality, certify provider wire serialization,
or establish live rollout.

## How the current prompt reaches the model

```text
immutable agent definition + caller's invocation
  -> entry adapter supplies request and result contract
  -> manager supplies Task discovery and helper scope, when applicable
  -> prepareAgentExecution
       system: convention files or explicit override + runtime instructions
       tools: available capabilities with schema-backed finish
       request: App preparation or default request, then explicit skill
  -> model/tool loop, on each model request
       history, tool results, steering and recovery messages
       -> compact history when needed
       -> append fresh Task decision brief when Task-bound
       -> convert messages to provider-compatible representation
       -> streamFn(systemPrompt, messages, tools)
  -> provider adapter serializes the actual API request
```

The initial full Task request and shorter `contextPrompt` are alternatives for
context preparation, not evidence that both are always sent to the model.
The full supplied assignment is retained for evidence and explicit App
preparation. The default may use the shorter rendering; discovery-file failure
restores the full request. Preserve this fallback while simplifying prose.

| Stage | Source entrypoint | What it contributes |
| --- | --- | --- |
| Definition | [agent-definition.ts](../../../may-agent/src/app/loader/agent-definition.ts) | Released role/shared paths, model, tools, skill snapshot, optional synchronous App preparer |
| Task entry | [managed-agent.ts](../../../may-agent/src/app/adapters/executors/managed-agent.ts) | Task protocol, full assignment/catalog/events, shorter default context, Task result schema |
| Conversation entry | [turn-agent.ts](../../../may-agent/src/app/conversations/turn-agent.ts) | Conversation contract and behavioral prose, bounded input/Requests/linked Tasks, Conversation result schema |
| Session entry | [manager.ts](../../../may-agent/src/lib/manager.ts), `runDefinition` | Task workspace links; helper contribution/lineage; bound tools, deadline and owner |
| System and tools | [agent-execution.ts](../../../may-agent/src/lib/agent-execution.ts), `resolveSystemPrompt`, `resolveTools` | Shared guidance, role, skill catalog, runtime environment; execution/completion text; actual tool schemas |
| Request rendering | `prepareExecution` in the same file | Explicit App `contextPreparation` takes the original request; otherwise use `contextPrompt` or original request. Selected skill wraps the result |
| Current state | [task-decision-context.ts](../../../may-agent/src/lib/task-decision-context.ts) | Current understanding, results, waits, events, coverage/freshness and exact detail references before each model request |
| History | [compaction.ts](../../../may-agent/src/lib/compaction.ts) | Deterministic summary of older messages plus recent messages; not an authoritative resource snapshot |
| Later messages | `manager.ts`, [workflow-finish-recovery.ts](../../../may-agent/src/lib/workflow-finish-recovery.ts) | Scoped Task-event notifications, caller steering, completion-budget and recovery prompts |
| Provider boundary | [agent-runner.ts](../../../may-agent/src/lib/agent-runner.ts) and Pi's agent loop | Transform messages, convert them, then submit system/messages/tools to the configured stream |

`TASK.md`, `context.json`, and `catalog.json` are generated by
[task-workspace-context.ts](../../../may-agent/src/lib/task-workspace-context.ts).
They provide attempt-start discovery and exact evidence references. The current
decision brief is refreshed separately. A linked file is available to read;
linking does not mean all its bytes were loaded into the model.

## Similar issues found

### 1. Contract guidance shares the lifetime of disposable request text

`appTaskAgentProtocol` is 5,079 UTF-8 bytes for the probe's App ID. It mixes
result semantics, tool documentation, generic behavior and identity. It is
sent as request text, so the App preparer and compactor can remove it.
Conversation guidance is assembled into request text in the same way.
The reviewed May, Scout, Evaluation and Gym `agent.json` files do not currently
configure `contextPreparation`; that branch is a demonstrated extension risk,
not an observed live failure. Compaction depends on the selected execution's
configuration and accumulated context.

The [result schema](../../../may-agent/packages/sdk/src/task-contract.ts)
already explains some fields, including `continue`, but many descriptions are
absent. Deleting the entire prompt would remove knowledge. Move field meaning
to the actual schema/tool owner, keep a short runtime orientation outside
request rewriting, and remove duplicates only once that information is present.

### 2. Checked-in shared guidance contradicts the implemented tools

[Shared guidance](../../../../shared/common-sense.md) says `context_updates`
persists to `context.md` forever. The [finish tool](../../../may-agent/src/lib/tools/lifecycle.ts)
explicitly retains suggestions without writing or activating that file, and
the normal loader does not load `context.md`. The manual already describes the
implemented behavior. This requires correcting authored guidance, not another
memory mechanism.

The same shared file claims guards automatically enforce verification, scope,
and completeness. They implement particular checks; they do not establish
semantic success. It also carries a fixed escalation chain and roster. Review
those against actual caller ownership and installed capabilities rather than
teaching a universal route through named agents.

Shared guidance is 12,412 bytes and May's role file is 30,805 bytes at the reviewed
revision, before runtime protocol, skills, schemas or Task data. These are source
bytes, not token counts or a quality threshold. The useful cleanup is duplicated
or situational material, not an arbitrary percentage reduction.

May's [returning-work instructions](../../../may.app/agents/may/AGENTS.md#returning-delegated-work)
repeat Task protocol explanations about `waiting`, `report`, `continue`, failure
recovery and preserving independent waits. Retain May's judgment about when to
seek help; maintain the common field semantics with their schema/tool owner.

Representative App workflows show both useful ownership and further cleanup
opportunities. Evaluation already loads its shared criteria from an owned
Markdown file, while [task-outcome-review.ts](../../../evaluation.app/agents/evaluator/workflows/task-outcome-review.ts)
also appends a long static assessment method. Scout's role file contains named
workflow-specific procedures, while [scout-assess-source.ts](../../../scout-knowledge-lib.app/agents/scout/workflows/scout-assess-source.ts)
supplies the corresponding bounded assignment. Consolidate recurring methods
within those Apps. Keep current source packets, working paths and contribution
instructions in the call. Their domain-specific criteria do not belong in a
global Host prompt; short caller instructions are legitimate code-generated
input. This is a representative review, not a certification of every workflow.

### 3. Completion wording does not match the caller's scope

The generic preparation layer and finish wrapper call every structured
execution a “workflow step.” Ordinary Task workers, Conversation decisions, and
helper contributions use that layer too. Recovery text also has copied finish
reminders in the managed and direct runners.

Describe the bounded invocation and supplied result contract. Keep one shared
completion explanation; let tools document payload meaning. A helper's accepted
contribution is not whole-Task completion. A native worker's local completion
is not acceptance by the App. These distinctions must survive prose cleanup.

### 4. Role, current facts and historical context are not consistently separated

The current Task brief is a useful foundation: it refreshes after compaction,
marks missing coverage, retains scoped known facts on read failure, and links
details. Keep it.

Compaction preserves only the first 500 characters as the original-task preview.
A helper's detailed assignment or a selected skill can live outside that
preview. The manager supplies an exact session metadata reference for helper
scope, but the brief is about the shared Task, not the helper's full contribution.
Preserve the invocation reference and selected-skill reference across compaction;
use existing session/definition evidence rather than assigning the whole Task
again or introducing another assignment record.

The compatibility persistent-chat path embeds a truncated human message and
state-derived strings inside `chatContext` in the system prompt. Those are input
and observations, not standing instructions. Its “Current time” comes from a
manager-lifetime timestamp. A cached stable prefix must not claim fresh time.
Keep current data in the message/context view and identify snapshot time honestly.

### 5. Some apparent prompt infrastructure is outside the active path

[prompt-builder.ts](../../../../shared/lib/prompt-builder.ts) and
[context-filter.ts](../../../../shared/lib/context-filter.ts) implement older
keyword selection of `context.md` sections and loose skill files. Searches of
the reviewed Host and current App source found no production caller of
`buildPrompt`; it remains exported and tested. It is not the Host assembler.
Check external consumers, then retire unused exports/tests instead of wiring
this older mechanism into the current path.

[memory-prompt.test.ts](../../../may-agent/src/lib/memory-prompt.test.ts)
has tests named for memory loading which only assert that a run produced a
result. They do not establish what reached the model. Replace useful coverage
with provider-boundary assertions already supported by the execution fixtures;
remove tests that merely preserve obsolete terminology.

### 6. Prompt evidence is incomplete

Session metadata retains the supplied assignment, output contract and lineage;
JSONL retains ordinary messages; usage records include preparation sizes; Task
detail files retain data snapshots. These are useful but are not an exact log
of every post-transform model input. The refreshed brief deliberately does not
appear as another transcript message. Normal convention-loaded system text is
not equivalent to the explicit `systemPrompt` definition field either.

For an audit, inspect the existing prepared object and capture the exact
system/messages/tool schemas at `streamFn` for a selected invocation, as in the
probe. A later diagnostic should link existing definition/session/Task evidence
and label loaded, omitted and unavailable sources. Defer continuous full-prompt
logging: it would duplicate large and potentially private context. A digest or
byte count alone cannot prove which meaning the agent saw.

## Paths that legitimately differ

| Execution | Context contract |
| --- | --- |
| Managed Task worker | Current Task brief plus its Task result contract |
| Bounded workflow/helper call | Caller contribution plus inherited Task context when supplied; caller-selected result schema |
| Conversation decision | Bounded Conversation input/Requests/linked Tasks plus its decision schema, running through ordinary bounded execution |
| Compatibility persistent chat | Retained conversation, refreshed chat context, no `finish` tool; App request preparation is bypassed |
| Generic native CLI worker | [cli-agent.ts](../../../may-agent/src/lib/cli-agent.ts) supplies caller prompt, file references and optional worktree. Native CLI rules/history also apply; it does not run the managed decision-brief transform |
| Codex Task goal executor | [codex-goal-packet.ts](../../../may-agent/src/app/adapters/executors/codex/codex-goal-packet.ts) supplies a canonical packet with role, assignment, observations and schema plus adapter-specific instructions |

Share the guarantees and source ownership; do not force identical prompts or
completion tools onto different executor capabilities. Native-tool environment
and instruction discovery need executor-specific evidence. A saved `prompt.md`
proves the supplied packet, not the native CLI's entire effective context.

## Proposed organization

| Material | Owner and placement | Lifetime |
| --- | --- | --- |
| Persistence, authority, schema validation, preserving independent obligations | Existing runtime code and tests | Every relevant operation |
| Tool behavior and result-field semantics | Tool/schema definition, with concise descriptions | Available with the capability |
| Runtime orientation and invocation scope | Small Host-authored instruction in existing preparation; bundled prose if substantial | Survives request rewriting and compaction |
| Shared working principles and agent responsibility | `common-sense.md` and agent `AGENTS.md` | Selected immutable definition |
| Situational methods | Existing scoped skills or linked knowledge | When selected or read |
| Caller assignment, output expectation, selected skill references | Existing invocation/session evidence and bounded request view | This contribution, still discoverable after compaction |
| Current Task/Conversation state, new input, waits and evidence | Existing owned readers and bounded projections | Refresh at the supported model boundary |
| Tool results, prior messages, recoveries | Existing transcript and linked execution evidence | History; compactable |

This is a division of responsibility, not a new set of mandatory prompt files
or an override hierarchy. A tool result, quoted document, or latest event does
not become an instruction merely by appearing later. New input, accepted state,
failures, waits and useful work coexist; authority and evidence determine which
claim applies. Code enforces mechanical controls; agents judge uncertain meaning.

Use the existing `PreparedAgentExecution` fields rather than introducing a
parallel “prompt resource.” `contextPreparation` remains an optional App-owned
projection of the supplied request. It cannot rewrite Host instructions or
actual tool schemas; code can enforce that placement, while the App remains
responsible for preserving the request's meaning. Keep explicit `systemPrompt`
for intentionally custom definitions, with its bypass behavior visible.

Select runtime guidance from the supplied execution/result contract and actual
capabilities. Agent names, topic keywords and the mere presence of a parent Task
are insufficient: a helper can share Task context while owing a different
result. Keep the helper's contribution visible without inheriting the Task
owner's entire assignment or completion rules.

If substantial Host prose remains after deduplication, bundle Markdown with the
Host release. Avoid runtime file lookup against the installation checkout.
Verify the compiled artifact includes it. Small dynamic labels and factual
renderers can stay in TypeScript. Moving every string into files adds little.

## Implementation order and acceptance

1. **Correct known contradictions.** Repair shared memory/guard claims and
   generic completion terminology. Verify instruction activation separately from
   committing the source. Keep App-specific behavior in its owning App.
2. **Separate instructions from request projection.** Put the short Host
   orientation in existing preparation, improve schema/tool descriptions, and
   delete duplicated Task/Conversation/App prose. Preserve fallback input,
   exact scope, independent obligations and rejection feedback.
3. **Preserve discovery through compaction.** Retain the helper's invocation and
   selected-skill references using existing evidence. Reuse the current Task
   brief. Validate missing references and fresh-state failures explicitly.
4. **Remove misleading leftovers and improve inspection.** Retire demonstrably
   unused prompt helpers and vacuous tests. Start with fixture/provider-boundary
   inspection; add a production readout only when its consumer and cost are clear.
5. **Compare behavior before rollout.** Use the existing Gym comparison route
   with identical inputs, model and tools. Include recovery, independent waits
   plus useful work, a correction after compaction, helper scope, missing detail,
   Conversation closure, and a selected skill. Record completion correctness,
   lost obligations, repeated effects, needed human intervention and cost.

Assembly checks should verify the actual model-boundary inputs, including
App preparation, explicit-system override, compaction and recovery. Contract
tests still enforce mechanics. A shorter prompt or passing substring test is
not evidence of improved behavior. Existing successful cases must remain in the
comparison so the cleanup does not optimize only the latest failure.

The gain is fewer conflicting instructions, stable contract visibility and a
clearer reading path. Costs are modest preparation wiring, more precise tool
documentation, authored-guidance cleanup and behavioral validation. Detailed
methods must remain discoverable when removed from default context; repeated
reads and increased retries would count against the change.

Scout's [control-relevant context note](../../../../shared/knowledge/library/deep-dives/DD-650-contextual-control-without-memory-growth.md)
and [history-pollution note](../../../../shared/knowledge/library/deep-dives/DD-740-context-pollution-self-conditioning.md)
suggest useful comparison questions. Treat their reported research results as
leads, not validated performance predictions for May. They do not justify a new
context classifier or automatic deletion of history.


## Implementation and verification

The candidate keeps the existing preparation mechanism. It deletes
`appTaskAgentProtocol` and duplicated Conversation instructions, bundles a short
Host orientation in `src/lib/execution-instructions.md`, and puts result/tool
semantics beside their SDK schemas and capabilities. May's communication and
interpretation policy is in `may.app`; the common boundary is documented in
[agents.md](../2a-design/agents.md#model-context-assembly) and the
[authoring manual](../2b-manual/agent-convention.md#how-to-extend).

Managed bounded invocations link their existing session assignment in system
context. Explicit skills retain their canonical reference. App preparation can
still project the request, while compaction leaves these instructions, tool
schemas and the current Task brief available. Compatibility chat observations
move from system instructions into a refreshed data message. Chat does not pin
an earlier turn's scope or skill as standing authority. Native CLI adapters retain their own context paths; these managed refresh
guarantees do not apply to them.

The companion App change corrects the `context_updates` and guard claims and
replaces an obsolete escalation roster with owner/capability discovery. Shared
assignment guidance retains the convention for large context and required links. It also
removes the unused `shared/lib/prompt-builder.ts`, its private context filter and
its tests/export; tracked source search found no production consumers. These
were not the Host's assembler. Host tests that merely asserted a session result
exists were replaced with actual provider-boundary and compiled-asset checks.

The first implementation put too much repeated prose on shared schema fields.
Inspection showed the Task schema grew from 8,587 to 16,088 UTF-8 bytes. The
revised version states common semantics once and keeps field notes short:
12,118 bytes. After ignoring descriptions, Task and Conversation JSON schemas
are identical to the baseline. No accepted shape or admission rule changed.

A fixture containing the prepared system text, one finish tool/schema and the
Task adapter's default request measured 14,454 bytes before and 13,843 after.
It excludes real App roles, other tools and current Task data, so it is a narrow
assembly comparison, not production token/cost evidence. Conversation schema
size rises from 2,503 to 4,600 bytes while its duplicated request instructions
are removed. Generic helpers gain the short Host orientation; their exact
scope and own output schema remain independent of any shared Task context.

Provider fixtures exercise real preparation and the model/tool loop with a
recording fake provider. They prove fresh Task state after forced compaction,
retained Host and selected-skill references with an App preparer, an App-owned
helper schema and rejection of the wrong result, and refreshed chat observations
outside system text and durable history. A compiled preparation fixture runs
without installation prompt files and proves the Markdown is in the artifact.
The initial full suite found six obsolete text/layout assertions. These were
removed or updated at the owning contract tests; the on-demand-file and explicit
override guarantees were retained in the actual preparation tests. A legacy
hierarchy test also read the real installation's shared instructions; its
replacement uses only temporary fixtures.

Verified Host candidate: `adc64089212124d0aa30a2a0e2a0b7f7ac323c1e`
on `refactor/agent-prompt-assembly`, based on `e55f932a7fd26009fd12d7b9d60fa64b306d1973`.
Companion Apps source is the commit containing this implementation record.

| Check | Result |
| --- | --- |
| Host `bun run ci` | Passed: 3,237 tests, 15,718 assertions, zero failures |
| Installed-fleet checks in portable CI | Three intentionally skipped; require explicit installation scope |
| Browser and compiled-asset checks | Executed and passed in the Host suite |
| Apps `bun run check:may-design` | Passed: design integrity, compiled SDK examples, canonical App check |
| Apps `bun test shared/lib/__tests__` | 60 passed |
| May `bun test ./projects/may.app/agents/may/workflows/develop-change.test.ts` | 32 passed |

The retained regression entrypoints are Host `src/lib/agent-execution.test.ts`,
`task-decision-context.test.ts`, `system-prompt-cache.test.ts`, the Conversation
contract tests, and `test/integration/{task-workflow-context,task-decision-context,execution-instructions-build}.test.ts`.
Run them from the Host checkout or run its complete `bun run ci`.
There is no live model comparison or deployment claim. Guidance should land
before Host activation; it remains compatible with the old Host. This is a
source/definition rollout, with no Task migration or new storage mechanism.
