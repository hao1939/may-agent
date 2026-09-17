# Reduce context cost through App knowledge and agent methods

**Design status:** Experimental proposal with an isolated PoC, refined September 15, 2026.
**Implementation status:** The supporting opt-in preparer merged in Host PR #192 as
`83a27430794abf49a5ebb3f14a58af387bb8cccb`. Portable checks and bounded model
comparisons are recorded below. Passive usage reporting is a follow-up candidate.
No App activation, deployment, transcript continuation or default change.

## Recommendation

Reduce the cost of completing the same useful work by improving **App-owned
context preparation** and **agent methods for using evidence**. Use existing
execution capabilities first. This is primarily an App/domain optimization;
a generic preparation hook is supporting system code, not the savings policy.

Start with a representative Master Validation assessment. Compare current and
concise fresh briefs, with and without improved agent guidance, while preserving
the model, required checks and execution frequency. Extend to PR preparation
when that experiment demonstrates useful behavior. Keep exact transcript
continuation separate until retaining history earns its cost and complexity.

The durable Task owns what should be achieved. Each attempt rereads current
state and reconciles it. Context preparation changes what information is put
in front of the model, within the normal bounded execution. Its output is
neither a requirement edit nor an accepted result.

```text
accepted input -> App prepares current facts and brief
               -> ordinary bounded agent call
               -> agent judges and reads evidence as needed
               -> result -> ordinary reconciliation/recovery
```

Events, synchronous tool replies, acknowledgment, scheduling, cancellation,
waiting and recovery keep their current contracts. A context implementation
does not get a second path for any of them.

## Three responsibilities for extension

Classify a change by what it is responsible for, not by its programming
language or directory. An App workflow implemented in TypeScript can express
domain knowledge; that does not make it system-foundation code.

| Part | Responsibility here | Example and normal home |
| --- | --- | --- |
| **1. Code — system foundation** | Generic execution, extension loading, current scope, result boundaries and usage reporting | Existing Host executor, SDK and tool-loading contracts; the optional preparation hook and passive usage instrumentation |
| **2. Agent — reasoning and methods** | Decide what to investigate, select useful reads, test a hypothesis and recognize insufficient evidence | Owned instructions or a discoverable skill teaching selective reads, concise findings and verification |
| **3. App — domain knowledge** | Define evidence meaning, the assignment, relevance rules, workflow procedure and acceptance | Master/PR workflow, domain brief builder, evidence reader and domain-specific preparer implementation |

For example, the rule that a validation receipt applies to an exact source
revision belongs to the App. The method of checking a cited failure before
declaring it resolved belongs to the agent. Invoking a configured preparer and
recording usage belongs to system code.

These responsibilities compose through the existing Host/App boundary. The
agent judges within its App assignment; it does not become a third execution
owner. A skill may carry App knowledge, and a tool may implement a domain read.
The medium does not move that knowledge into the system foundation.

## Extension philosophy before adoption

Apply the accepted [mechanism guide](../1-principles/code-vs-data.md) first.
When existing tools, wakes and current context are sufficient, improve owned
instructions, skills or knowledge as needed. When the input is poor, fix the
App's context assembly at its existing boundary. Add a system capability only
for a demonstrated gap that the current extension mechanisms cannot adequately
cover, with benefit sufficient to justify implementation and maintenance.

Guidance cannot undo the initial cost of an oversized brief already supplied
before the agent runs. That supports examining the App's brief builder; it does
not establish that a new shared hook is necessary. Conversely, a shorter brief
cannot teach an agent how to investigate unfamiliar evidence. Evaluate both
responsibilities rather than assuming one replaces the other.

The existing `contextPreparation` hook is available for comparison. Its merged
status, configurability and placement do not prove that an App should adopt it
or that its policy saves cost. Compare its fit with an ordinary App helper or
workflow using the same policy. Keep one authoritative implementation of that
policy; do not maintain competing selection rules in the workflow, hook and
shared system prompt.

If a promising solution conflicts with an existing extension rule, identify the
exact rule, explain the conflict and compare compliant alternatives. Propose and
review any necessary rule change **before implementing the conflicting design**.
Do not silently create an exception or rewrite the philosophy to justify a
preferred optimization. This clarification changes the proposal's review
criteria; it does not amend the accepted extension rules or activate a candidate.

## Ownership of the proposed change

| Responsibility | Owner |
| --- | --- |
| Desired outcome, requirements and domain acceptance | App and assigning owner |
| Persistence of accepted state, execution fences and recovery | Existing system Task/runtime |
| Evidence meaning, brief layout, initial inclusion and domain references | App-owned context implementation |
| Further investigation, relevance judgment and sufficiency of evidence | Responsible agent under its App assignment |
| Which extension is installed | Existing configuration/composition |
| Tools, workspace, limits and validated completion mechanics | Existing executor |
| Prior attempts and results | System-retained evidence, interpreted by the App/agent; not current authority |

A preparer cannot reliably infer which arbitrary paragraphs are requirements
or whether a log is dispensable. Domain-specific selection belongs in the
App-owned implementation. The default preserves the full brief.

All implementations must preserve the current requirements and access to
decision-relevant evidence. Code enforces the input/output and execution
boundaries. Semantic equivalence still needs fixtures, review and outcome
evaluation, just like existing workflow context assembly.

## First App and agent experiment

Master Validation's recorded median starting input was about 289K tokens.
Its existing `compactMasterJudgmentContext` already saves detailed evidence
through `writeEvidence`, but still maps large owner and run collections into
the initial brief. Begin with that App implementation, not a generic selector
for arbitrary model input. PR preparation is a later domain consumer.

1. **App:** retain the same complete evidence snapshot and its revision. Build
   a current brief containing the assignment, constraints, previous accepted
   conclusions, changed evidence, blockers and coverage information. Record
   unknown or omitted detail explicitly; absence from a brief is not success.
2. **App:** keep full details reachable by exact reference using existing reads.
   Reuse or improve a domain reader only where the available reads cannot
   retrieve useful bounded records. Paging must expose remaining records and
   distinguish unavailable evidence from an empty result. Resolve references
   in the target agent's actual execution, not just in the preparer's workspace.
3. **Agent:** teach selective investigation, checking evidence revisions,
   revisiting reopened findings and retaining concise supported conclusions.
   The agent can request further detail when it needs it. The App still defines
   which checks and acceptance evidence are required.
4. **System code:** use the ordinary bounded call, tool loading, result handling
   and available usage observations. Any missing generic measurement or execution
   capability is a separately justified system change with its own contract.

An initial brief around 20K tokens is an experimental sizing target, not a hard
cutoff or permission to drop requirements. Count all subsequent reads and model
turns. If this assessment requires inspecting the whole inventory, the candidate
must do so and record its actual cost.

Use the same App-owned preparation function whether called directly by the
existing workflow or selected through the optional hook. Deterministic domain
rules stay in that function; situational judgment stays with the agent. Existing
source/revision checks and exact-result acceptance remain in their owning paths.
Workflow implementation remains part of App/domain knowledge throughout.

The extension test for a later PR implementation is whether it can join through
ordinary App modules and agent guidance without changing core lifecycle rules.
Extract small shared mechanics only when actual consumers justify them. No
universal evidence service, new session API or automatic summary agent is
required to run the first comparison.

## Supporting system capability: optional context preparation

This section records the system capability and its tested boundary separately
from the App optimization. It does not require the first App experiment to use
the hook or make the hook responsible for domain selection. Host PR #192 added
one experimental, optional setting in `agent.json`:

```json
{
  "contextPreparation": "./context/concise.ts"
}
```

Omitting it keeps the full current brief. The value selects a module using the
existing runtime importer and definition-generation boundary. The entrypoint
must be relative to and remain inside the agent's definition directory, including
after resolving symlinks. Absolute paths and paths escaping that directory are
rejected. This keeps module selection inside the captured agent source; there is
no separate registry or dependency scanner. Imports remain ordinary trusted App
code, with the same installation and review expectations as tools and workflows.
This check is not a sandbox for a module's transitive imports.

A module default-exports this SDK type:

```ts
import type { AgentContextPreparer } from "@may-agent/sdk";

const prepare: AgentContextPreparer = ({ task }) => {
  // Recognize this App's brief, retain its current requirements, and
  // choose evidence appropriate to the current work.
  // Unsupported formats can simply return task.
  return task;
};

export default prepare;
```

The initial type is `(input: Readonly<{ task: string }>) => string`. It is
synchronous, pure and inexpensive. It receives supplied context, not a Task
control handle, session manager, model client or database. No model calls,
I/O, durable writes or background work belong in preparation. The SDK type and
configuration are explicitly experimental until a representative App workload
demonstrates enough value to retain the interface. The selected module's
domain-specific implementation belongs to part 3, App knowledge; loading and
invoking it through this contract belongs to part 1, system code.

This deliberately tests the smallest useful seam. It is not a complete API for
loading old transcripts. If an evaluated implementation needs read-only history
access later, first check existing evidence reads and the extension guidance.
Review a demonstrated missing contract separately before extending the adapter;
do not give it ownership of work or introduce a coordination service.

The shared executor:

1. Keeps the original task as execution input/evidence.
2. Calls the configured preparer for bounded execution, or uses the task unchanged.
3. Rejects malformed/empty returned context and surfaces preparer failures.
   Promise/thenable returns remain invalid; their rejection is consumed so it
   cannot escape the caller's normal error handling.
4. Applies explicit skill instructions and the current system/tool/schema rules
   separately, then uses the existing runner.

Persistent human chat keeps its current turn preparation; this PoC selects
bounded agent briefs. Existing full/default executions need no migration.

## Reliability of the supporting capability

Preparation has no completion cache and no cross-attempt mutable state.
Repeating it with the same input is inexpensive. Execution evidence retains
the original task and the actual model messages; configuration follows the
existing immutable definition generation and explicit reload rules.

| Situation | Handling |
| --- | --- |
| New requirements, reopened finding or changed revision | Prepare from the complete current brief; the worker reconciles it |
| Unsupported brief format | A preparer may return the original complete brief |
| Optional evidence cannot be replaced with a usable reference | Keep it inline |
| Required evidence or authority is unavailable | Explicit failure; never invent missing evidence or broaden access |
| Invalid module/export | Reject the definition generation through the existing loader |
| Preparer throws or returns malformed context | Normal execution failure, with accepted work retained by its owner |
| Provider failure, cancellation, retry | Existing execution/Task path |
| Independent or concurrent calls | Separate current invocations and results, no shared session writer |
| Disable the experiment | Remove the option for future definition generations |

A thrown error is not silently converted into a successful full-brief run.
Choosing full context for an unsupported input is an explicit policy decision
inside a preparer. No generic retry, fallback queue, event route or watchdog is added.

Purity is an authoring contract, not a sandbox: trusted module code can violate
it. The synchronous callback runs before the runner's execution scope, so its
CPU time is not independently bounded or preempted. Keep modules small and review
their work. Rejecting an async result does not cancel work already started by
misbehaving trusted code. Expensive asynchronous context collection remains in
existing App tools/workflows; this candidate adds no preparation worker or timer.

## What happens to focused continuation?

Focused work may benefit from earlier hypotheses, attempted fixes and accepted
conclusions. Those can already be included as ordinary evidence in the current
brief. A future context implementation may retain selected working history.

Exact transcript continuation is deferred. The previous draft proposed
`ctx.agents.continue(...)`, explicit incremental-update versions and a writer
protocol. The App context experiment does not require them; they remain outside
the initial scope.

Source inspection on post-#191 execution code found reasons to keep that
optimization separate:

- A supplied `sessionId` in `workflow-tool.ts` may return an already completed
  result instead of executing a new message.
- `manager.ts` can restore messages, but resume also retains older execution
  metadata and uses session-keyed completed results.
- An offline reproduction of `extractFinishParams` returned a previous
  successful finish after a new user request and an unfinished assistant reply.
  Scanning all inherited messages is not a current-invocation completion boundary.
- Pi 0.85.1 forwards session identity as a provider cache key on supported
  routes. Copying history into a new execution can change cache affinity.
  Actual gateway/provider behavior and cache lifetime are unverified.

This PoC creates fresh ordinary executions and does not restore history, so it
does not introduce that old-result path. It does not claim to repair the
existing explicit-session reuse behavior. Before retaining transcripts, require
current-invocation result/usage boundaries, compatible scope checks and
immutable earlier receipts. Keep provider cache identity inside the execution
adapter. A session reference never authorizes work or grants permissions.

No new Focus resource, registration framework, continuation ledger or automatic
summary agent is justified by the current evidence.

## Why review this now?

The September 12 investigation found repeated fresh sessions for ongoing work.
The measurement window is September 12, 2026, 00:00–24:00 Asia/Shanghai, using
the report frozen at September 14, 13:41:47 in the same time zone:

| Work | Recorded pattern | What it suggests |
| --- | --- | --- |
| PR preparation | 1,491 sessions for 202 PRs; one PR had 27 sessions and used 98.2M tokens | Review comments and validation feedback may benefit from continuing the same repair conversation |
| Source repair | 220 sessions for 189 Tasks | Continuity is less obviously missing; much of the work already stays in longer coding sessions |
| Master Validation | 1,120 sessions for one standing Task | Repeated large assessments need attention, but an endless transcript could make them worse |
| Test-health discovery | 629 sessions for one standing Task, investigating many different specs | The standing Task is too broad to define a single focused conversation |

Across the day's 3,782 sessions, first responses read 399.76M input tokens,
with 1.07% reported as cache reads. Later responses had an 83.84% cache-read
rate. First responses accounted for 38.1% of input that was not a cache read.
These are token-weighted rates, not percentages of requests with a cache hit.
“First” means the first retained positive-usage response in the whole session;
a session crossing midnight is not counted as starting again.

Repeated sessions can still do useful, different work. These measurements do
not prove that every restart was wasteful, that continuation causes the observed
cache difference, or that all first-response input can be saved. Recorded tokens
also do not identify GitHub AI-credit charges or their allocation between billing
choices.

### Offline follow-up: message size versus retained context

All 1,491 PR prompts were rechecked against the frozen report's hashes. There
were 1,289 follow-ups within the same recorded App, Task, agent and PR scope.
An update encoding preserving all changed fields, individual review threads,
deletions and list order reconstructed every subsequent evidence snapshot exactly.
It made follow-up messages **57.6% smaller in serialized characters**, including
the unchanged surrounding task instructions and update framing.

However, carrying the initial brief and every later update through the same
observed model-call counts produced **3.03× prompt character exposure** relative
to fresh full briefs. That replay assumes no compaction or rotation and excludes
system, tool and assistant history. It is a growth-risk demonstration, not a
prediction of total tokens, cache behavior or charges. The concise fresh-brief
alternative was not measured on that retained workload; the later synthetic
comparisons below do not establish its production benefit.

The median gap between executions was 17.3 minutes; 485 of the 1,289 gaps exceeded
30 minutes. Provider cache survival across those gaps remains unverified. The
earlier 10–20% token-saving suggestion is only a trial target, not a forecast.

Any later retained-history comparison must include existing compaction or fresh
handovers, with their cost and quality effects, and allow concise fresh context
to win. The first App/agent comparison below uses fresh executions.
Do not infer a token-saving percentage from the smaller update messages.
Sizes, reconstruction checks, scripts and a graph are retained in the local
usage investigation's `session-continuation/` follow-up directory.


## Isolated implementation and experiments

The candidate adds the SDK preparer type, configuration loading and a call in
the existing `prepareAgentExecution` function. That function is already shared
by managed workflow agents and direct bounded agents. No production Task,
event-routing, workflow-call or storage code changes.

The sample concise policy is synthetic App code in a test fixture. It preserves
all current packet fields and replaces a duplicated log body with its existing
reference. Unsupported inputs or missing references retain the full brief.
It is an experiment, not a generic log-summarization policy to deploy to Apps.

Portable coverage exercises actual config loading, unchanged workflow calls,
the manager and real runner with a deterministic model stream. Four successive
briefs cover an initial finding, resolution, reopening and a changed requirement.
Each invocation uses a fresh manager; original inputs and distinct result
identities are checked. Other owning tests cover current tools/schema, definition
opt-out, invalid modules/results, explicit failure and existing cancellation.
This establishes execution wiring and context fidelity, not model judgment.

The first fixture run failed because the synthetic success omitted required
verification facts; another fixture assertion used `sessionId` instead of the
public result's `id`. Both fixtures were corrected to use the existing
contracts. No production finish or result contract was weakened.

### Model comparison

Two bounded, synthetic comparisons use the same model, current requirements,
read/finish tools, output schema and evidence within each comparison. Cases
include changed scope and a reopened finding. The log contains an additional
required failure in one case, so an implementation cannot pass merely by
ignoring omitted evidence. A missing-reference case must retain the complete
input.

The first policy replaces any duplicated log with its reference. The second
keeps required evidence inline and shortens only evidence explicitly marked as
background by the App's brief. That relevance field is added to both variants
of the second comparison; it is not inferred by core.

Both comparisons used `gpt-5.5`, fresh execution IDs, read-only fixture access,
a schema-validated result and a 75-second bound per invocation. Each run allowed
at most 16 provider responses with at most 1,200 output tokens per response.
The two runs actually completed 16 invocations and 19 provider responses;
all 16 answers matched the expected revision and findings.

| Run / policy | Correct | Uncached input | Cache reads | Total input exposure | Output | Tool calls | Elapsed |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| First / full | 4/4 | 9,233 | 2,560 | 11,793 | 791 | 4 | 17.59 s |
| First / references | 4/4 | 12,466 | 0 | 12,466 | 769 | 6 | 18.86 s |
| Second / full | 4/4 | 1,569 | 10,240 | 11,809 | 535 | 4 | 15.93 s |
| Second / selective | 4/4 | 4,466 | 5,120 | 9,586 | 813 | 5 | 17.94 s |

Cache writes were zero. Total input exposure is uncached input plus cache reads
and writes, summed across every response, including evidence retrieval.

The first policy reduced the initial briefs from 44,222 to 11,760 characters,
but increased total input exposure by **5.7%**. An optional log was retrieved in
one call and a required log in another. This is a concrete example of smaller
messages costing more work.

The second policy reduced initial briefs from 44,288 to 22,662 characters.
It preserved required logs inline and reduced total input exposure by **18.8%**.
However, it still made one extra tool call, took longer and used more uncached
input than the full-brief baseline, which received many cache hits. It does
**not** establish cheaper execution. Model behavior also varied: one background
reference was still inspected. No further special rule was added to core.

**Conclusion:** the replacement boundary works, and evidence selection changes
the outcome of the optimization. Keep the full default. The reference-only
policy is not supported for adoption by this trial. The selective policy is a
candidate for a representative App workload; cost and quality need evaluation
under realistic cache behavior.

Small synthetic samples cannot establish production cost savings or long-term
recovery behavior. The fixture does not make code changes or run a validation
pipeline. Both variants read the same temporary fixture files using fresh
execution IDs, without inherited messages or model edits. Provider-side cache
sharing across sequential requests cannot be isolated. Report observed cache
reads rather than claiming cold-cache isolation. Source CI was running during
the trials; elapsed times are observations, not a controlled speed benchmark.
### Revisions, checks and reproduction

The September 15 review kept the configured seam and tightened two demonstrated
failure boundaries. The earlier candidate accepted an external absolute module;
editing that file and invalidating the importer changed behavior while reusing
the same captured release. It also rejected a Promise as malformed but left its
rejection unhandled. Process consequences depend on the surrounding error handlers;
this was an escape from ordinary failure handling, not proof of every daemon crash.

The refined candidate rejects escaping entrypoints and consumes invalid async
rejections before reporting the ordinary preparation error. Five regression cases
failed against the earlier implementation and passed after the fixes: absolute
path, parent traversal, file symlink, directory symlink, and an isolated process
checking async functions, Promise-returning functions and thenables. A captured
release also retains its preparer after editing source and clearing the import cache.

The tests no longer require a frozen argument object or a particular list of its
keys. They check the useful contract: current input, original receipt, current
execution controls, explicit skills and ordinary execution. The feature branch
contains portable implementation and regressions only. The paid comparison harness
and result files remain in the historical experiment commit below.

- Host baseline: `bf001b48` (main after #191 and #176).
- Initial implementation: `586c977d11e2c5f67a2be7ddf7c469f38fc85136`.
- Refined feature: `4784f43da9251c58379d98e3e54d44e46f9f890a`,
  [Host PR #192](https://github.com/hao1939/may-agent/pull/192), branch
  `feat/experimental-context-preparation`.
- Refined owning gate: **52 passed, 0 failed**, 226 assertions.
- Refined full gate: **3,063 passed, 3 installation-only skips, 0 failed**,
  13,645 assertions across 304 files, 147.95 seconds. Host/SDK type checks,
  App-boundary validation, lint and real browser tests passed. Both GitHub
  Quality and Container checks passed at the refined revision, including the
  isolated image build/smoke check. No new paid model trial or live deployment.
- [Hosted validation](https://github.com/hao1939/may-agent/actions/runs/34884234748).
- Branch-local harness, second policy and sanitized results:
  `dde4367638d6ff478310ca32a5d002f6cf882521`.
  The latter retains experiments for review; it is not a production command
  to include in an eventual feature PR.
- Historical experiment branch: `experiment/context-preparation-20260914`.
- Initial full gate: **3,058 passed, 3 installation-only skips, 0 failed**,
  13,636 assertions across 304 files, 154.35 seconds, including browser checks.
  Host/SDK type checks, App-boundary validation and lint also passed.

Verification history is retained, rather than hidden by retries. The first
full run found the new SDK type missing from the export snapshot; that contract
was updated. The next run exhausted disk space: three failures directly reported
ENOSPC (SQLite, temporary-directory creation and daemon startup). A browser test
also timed out in that run; its exact cause was not established. The final
unchanged implementation passed with temporary files on available memory-backed
storage, including all four previously failing tests. No timeout was increased
and no test was skipped to make that run pass.

From the implementation revision, after the normal frozen dependency install:

```sh
bun test src/lib/agent-execution.test.ts src/app/loader/agent-registry-loader.test.ts test/integration/context-preparation.test.ts packages/sdk/src/index.test.ts
bun run ci
```

Use a temporary directory with enough capacity for full CI. The final run set
`TMPDIR` to an isolated executable memory-backed directory; this is a test
environment choice, not a Host runtime setting.

To reproduce the separately authorized model trial, check out the experiment
revision and supply a compatible gateway through `MODEL_BASE_URL` and
`LITELLM_API_KEY` in the environment:

```sh
MAY_CONTEXT_TRIAL_LIVE=1 bun context-trial.ts
MAY_CONTEXT_TRIAL_LIVE=1 MAY_CONTEXT_TRIAL_SELECTIVE=1 MAY_CONTEXT_TRIAL_OUTPUT=/tmp/context-selective-results.json bun context-trial.ts
```

The first command uses the reference-only policy; the second uses selective
inline evidence. `context-trial-results.json` retains the observed counters.
Runs may produce different model decisions, tool use and cache hits. Credentials
and raw model transcripts are not committed.


## Evaluation: separate the App and agent effects

Use matched Master assessment cases with the same evidence snapshot, model and
reasoning settings, tool availability, output schema, execution frequency and
acceptance criteria. The current methods and current App brief are the baseline.
Compare four variants to avoid attributing all benefit to the new hook:

| Variant | App brief | Agent method | What the comparison reveals |
| --- | --- | --- | --- |
| Baseline | Current | Current | Cost and correctness of existing behavior |
| Agent change | Current | Guidance for selective reads and concise findings | Effect of part 2 alone |
| App change | Concise current brief with complete evidence access | Current | Effect of part 3 alone |
| Combined | Concise current brief with complete evidence access | Same improved guidance | Whether the two changes work well together |

The proposed guidance is the sole instruction difference in its comparisons;
the App brief is the sole evidence-layout difference in its comparisons. The
hook is not an extra token-saving policy. Check input/output fidelity offline
when comparing direct workflow preparation with invocation through the hook.
Keep the selected execution path fixed during each model comparison.

Include changed source, reopened findings, new failures outside the initial
detail page, missing references and unchanged blockers. Use expected domain
findings and required verification evidence, not execution success alone. After
tuning on development cases, check separate held-out cases to avoid teaching a
brief builder only the answers already seen. An ordinary follow-up should show
that guidance was available, delivered, used and useful without repeated coaching.

Measure complete work sequences:

| Measure | Scope |
| --- | --- |
| Quality | Correct findings, missed/reopened findings, preserved constraints and valid current-revision evidence |
| Model usage | Ordinary input, cache reads, cache writes and output from every response, including usage-bearing failures and corrections |
| Additional work | Evidence retrieval, repeated reads, tool calls, summaries, compaction and handovers |
| Time and failure | End-to-end latency, retries, preparation errors and ordinary recovery |
| Implementation cost | Added modules, configuration, maintenance and any new execution paths |

Link invocations and children to the same assessed work and count each response
once; do not add cumulative parent/child subtotals twice. Missing usage remains
unknown. Output already containing reasoning must not have reasoning added
again. Keep configured and actual model/provider identities in the comparison.

Report warm/cold and delayed-follow-up observations where available. Alternate
variant order and repeat bounded matched cases to expose order effects; do not
claim provider-cache isolation without evidence. Keep raw token categories
alongside any price estimate and state its rates. These counters are not a
GitHub credit bill. A smaller brief, fewer input tokens and lower charges are
different claims, as the existing synthetic comparisons demonstrate.

## Adoption and extension-rule review

Choose equivalent accepted work with a measured benefit that justifies the
change's total cost. Prefer the simplest successful variant, including agent
guidance alone or the current baseline. A lower token total with more missed
findings is not a successful optimization. A higher cache-hit rate with higher
overall cost is not success either.

Review the App policy and agent method separately from a supporting system
change. A merged capability is not an App adoption decision. If an attractive
candidate conflicts with an extension rule, cite that exact rule, compare
compliant alternatives, and review a proposed rule amendment before implementing
the conflicting design. Keep the current rules while that question is open.

Retain the full default until an App-specific representative workload passes.
Activation follows the existing source, review and configuration path. Removing
a candidate should restore future baseline execution without migrating Tasks
or sessions. This refinement authorizes no new model calls or live activation;
the recorded historical trials remain separate evidence.

## Passive comparison measurements (September 15 follow-up)

The first reporting slice measures ordinary bounded agent invocations. It does
not add an evaluation agent, work lifecycle, timer or acceptance rule. Preparer
authors keep the same function contract and do not register metrics.

- The loader captures the agent-relative entrypoint and its content hash using
  the existing revision-aware importer. The hash covers the entry file only;
  dependencies and other prompt/configuration changes still need experimental
  controls. Unidentified programmatic adapters remain explicitly unidentified.
- Each actual managed invocation gets a separate observation, linked to the
  existing session, workflow run and Task/attempt. Resuming a session cannot
  overwrite previous invocation totals. Imported messages do not add spend.
- A pure accumulator observes new completed model replies, including corrective
  calls and usage-bearing errors, plus tool invocations. It records the actual
  provider/model, uncached input, cache reads/writes, output and SDK price
  estimates. All-zero/missing usage is unknown, not free. Provider-hidden work
  cannot be measured from these callbacks.
- A small SQLite adapter replaces the cumulative snapshot after each reply and
  at the validated result boundary. Repeated snapshot writes cannot increase
  totals. Preparation errors are recorded before session creation. A crash leaves
  unfinished evidence; reporting failures warn without rejecting accepted work.
- The existing Metrics page reads indexed summaries, never transcript history.
  Rows separate preparer revision, App/agent, configured and actual models, and
  execution outcome. Comparable means use finished invocations with usage on
  every observed reply; priced sample counts expose narrower price coverage.
  Partial subtotals, preparation bytes/time and exact session/workflow evidence
  remain available as details. The time cohort is invocation start, not finish.
  Existing bounded maintenance retires measurements after 30 days without updates.
  The read view checks whether session/workflow evidence still exists before
  linking it; those records can expire earlier.
- Direct execution uses the same accumulator and returns/writes its own usage
  artifact. Its artifacts are not imported into hosted totals. Persistent chat,
  external CLI usage and historical uninstrumented executions remain outside
  this comparison. No transcript backfill guesses the old preparer.

The unit is one invocation's own model usage, not an all-inclusive Task bill.
Children have separate observations; parents do not add their totals again.
The App or human still selects matched workloads and judges accepted results.
Do not choose a preparer from shorter briefs, lower cached input, execution
success alone, or model-catalog cost estimates. The former trial's lower total
input but higher uncached input and slower elapsed time illustrates why.

Candidate: [Host PR #193](https://github.com/hao1939/may-agent/pull/193),
`d2f39dc9c22b1dd0c6f6db4ef98cd342d0c8ace8`, branch
`feat/context-preparation-metrics`, based on merged #192.
The final retention/reporting/browser gate passed 17 tests and 249 assertions.
The full committed-source gate passed **3,070 tests, 3 installation-only skips,
0 failures**, 13,727 assertions across 306 files in 206.20 seconds. Host/SDK
types, App-boundary validation, lint and real browser checks passed.
[GitHub Quality and Container](https://github.com/hao1939/may-agent/actions/runs/34887823702)
both passed on the same revision, including the isolated image build/smoke check.

An isolated 10,000-observation database occupied about 8 MB. On the committed
source while the local suite ran, 100 changing cumulative writes measured
p50/p95 5.1/9.1 ms; 20 comparison reads measured 156/200 ms. These are local
overhead observations, not production capacity or model-savings claims. The
rendered view fit both a 1440-pixel desktop and a 390-pixel mobile viewport.
No installed container, App work, credentials or live data were changed.

## Review decisions

1. Is each change correctly assigned to system code, agent methods or App/domain
   knowledge, regardless of whether it is written as code, a workflow or guidance?
2. Can the existing App context builder and agent tools express the change, and
   what demonstrated gap would justify any additional system capability?
3. Do the App brief and agent method preserve current requirements, complete
   evidence access and independent verification on changed or unfamiliar cases?
4. Do the four variants identify which responsibility supplies the benefit,
   including retrieval, cache behavior, quality and maintenance costs?
5. Does a proposed solution conflict with an extension rule? If so, which exact
   rule amendment must be reviewed before the conflicting implementation?
6. Is there a demonstrated remaining benefit that justifies adding compatible,
   bounded history later?

## Evidence and related work

The local September 12 usage investigation and its `framework-cache` follow-up
retain reconciled counters, prompt-prefix comparisons, source provenance and
offline Pi/gateway probes under
`2026-09-13/investigations/2026-09-12-mlvm-may/`.
The retained offline message-size findings above are unchanged. Raw transcripts
and installation-specific artifacts stay outside published source.

Related design:
[mechanism selection](../1-principles/code-vs-data.md),
[agent and capability extension guidance](agent-behavior-and-capability-extension.md),
[Host/App boundary](../2a-design/system-boundary.md),
[redo versus resume](../1-principles/core-principles.md#prefer-redo-when-it-is-simpler-and-affordable),
[Sessions](../2a-design/sessions.md),
[one Task lifecycle](conversation-input-unification.md),
[execution consolidation](execution-entrypoint-consolidation.md), and
[recurring project review](may-project-review-loop-20260912.md).
