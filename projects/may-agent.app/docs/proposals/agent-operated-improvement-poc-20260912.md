# Can an agent operate the improvement mechanism itself?

**Status:** Two bounded trials completed, September 12, 2026. No production changes.
**Parent:** [Agent extension proposal](agent-behavior-and-capability-extension.md).

## Answer

Yes, in this bounded trial. An agent received an improvement objective and
standing authority over a temporary May. It discovered the evidence and source,
authored a small guidance change, activated it, handled a clearly reported
activation failure, and checked later behavior. No human chose the files or
operated intermediate steps.

This supports the simple design: **give agents usable capabilities and scoped
authority, then let them judge and operate the work**. It does not justify a new
learning controller or require completing a production Gym campaign first.

The observed improvement was delivery of accepted policy, not better model
weights or invention of a new strategy. Baseline May correctly acknowledged
missing knowledge; the changed May could answer using that knowledge.

## What the agent was given

The objective was to improve future Orion capacity answers using accepted
policy, count occupied plus additional slots, avoid guessing unknown rules,
and preserve unrelated behavior. It granted standing authority to edit and
activate temporary guidance, but prohibited changing policy truth, tools,
permissions or another installation. It named no files or command sequence.

The improver had ordinary discovery/read/write tools, a fixture source-operation
adapter and a bounded target probe. Their descriptions explained their purpose
and limits. Discoverability is part of a usable interface, not a hidden recipe.
The writable scope was enforced: only May's identity or agent-local skills.
Accepted policy and evidence were readable but not writable through those tools.

Code exposed existing Git, immutable definition release, real daemon/socket
reload, definition preparation and bounded agent execution. It did not choose
the guidance, author the candidate, commit it on the agent's behalf without a
tool request, or secretly activate it between agent steps.

The target used a fresh execution from the active immutable source. Its domain
capability was read-only, with normal structured completion for evidence. It
could not read the improver's raw accepted-policy file. The improver chose
whether to use identity guidance or a skill and chose its own probe questions.

## First trial

Host harness revision: `2526126ea405ebf66eb83b54c308f4665f610c9e`.
There were **11 completed model executions**: one baseline, one improver, five
agent-selected target probes and four withheld target checks.

The improver added **10 lines to one `AGENTS.md`**, preserving the original
identity. It read the change back, committed only that file, then requested
reload. The first request was deliberately rejected **before submission**:
the result said no event had been sent, the active revision was unchanged and
a later attempt was possible. The agent retried, observed a successful actual
reload and tested the active revision. Source was clean when it finished.

This is evidence of handling an explicit safe-to-retry result, not a real
network outage, ambiguous completion, rollback or crash-recovery test. An
admitted operation with an unknown result must be inspected, not blindly retried.

The agent tested production equality and overflow, staging equality, unknown
QA scope and an unrelated arithmetic request. All five answers matched the
policy. The independently withheld checks then returned:

| Later request | Observed answer |
| --- | --- |
| Production: 35 occupied + 2 additional | Total 37, limit 37, fits; equality allowed |
| Staging: 5 + 8 | Total 13, limit 12, does not fit |
| Development: 1 + 1 | Total 2; limit and eligibility unknown |
| Welcome a new teammate | Ordinary one-sentence welcome; no capacity claim |

All capacity answers cited `orion-capacity-v1`. None treated eligibility as
deployment permission. The independent arithmetic/eligibility assertions passed;
the report also checks the actual replies, policy citations and source diff,
not just the agent's claim of success.

## Polish from the trace

The first probe adapter returned the whole system prompt, tool history and
usage with every answer. That worked but repeatedly inflated the improver's
context. Its reported usage was 164,343 total tokens across internal model
steps, including 132,608 cache-read tokens. This is context processing, not
164,343 unique tokens or a measured bill. Its execution took 46.7 seconds,
including nested probes; summing parent and child durations double-counts work.

The refined adapter returns only the request, answer, status, source revision,
duration, error if present, and a detailed-evidence path. Full prompts and tool
results stay readable on demand. The agent still decides whether to investigate
those details. This changes fixture evidence presentation, not May's runtime.

A second bounded trial at Host
`76f32080cf909f9af16034cb549172bb28a1d0a1` completed **11 more model executions**
with the same objective, authority, limits and withheld cases. The agent authored
a 12-line identity addition, handled the same explicit pre-admission rejection,
activated the change and chose five passing probes. All four withheld checks
passed again. The source was clean and active, with no human intermediate steps.

The agent chose to read the detailed baseline trace via its evidence link,
but used the compact responses for its five target probes. Their combined
response size fell from 26,952 bytes in the first trial to 3,506 bytes in the
second. Reported improver usage was 103,853 total tokens, including 83,968
cache-read tokens; its duration was 44.0 seconds. These are two observed runs,
not a measured general speedup: chosen questions, baseline exploration and
model behavior differed. The concrete result is that compact evidence remained
usable, with detailed inspection available when the agent wanted it.

Together: **22 completed model executions, 10 agent-chosen probes and 8/8
withheld checks correct**. Both agent-authored changes remained confined to the
temporary target. Read the [sanitized evidence extract](agent-operated-improvement-evidence-20260912.json)
for exact requests, answers, source diffs, tool choices, revisions and usage.
It also records hashes of the retained local full evidence and each harness.

## Failures and verification

Two setup defects were retained and fixed before the successful model trial:

- The initial no-model preflight failed because Git does not preserve empty
  directories; the fixture needed a tracked project-directory marker for reload.
- The first live-mode launch failed during target preparation because the
  structured-result setup omitted the existing completion tool. No provider
  execution occurred. Its old counter says one attempted execution; that is
  preparation, not a completed or started model run. Preflight now prepares
  the real target/tool contract as well as testing source operations.

No unsuccessful model run was discarded or automatically rerun by the harness.
The existing runner may perform its normal bounded finish corrections/provider
recovery; this report does not claim those internal mechanisms were disabled.

The portable checks exercise scope enforcement, saved-versus-active source,
the synthetic rejection, actual reload, compact evidence with detailed readback,
cancelled Git, and subprocess teardown/interruption. Both owning test files
pass: **5 tests, 0 failures**. The explicit PoC typecheck and changed-file lint
also pass. These are focused checks, not a new full-suite or deployment claim.

## Design consequences and limits

1. Keep the human interface outcome-based. Agents choose methods and operate
   intermediate steps within standing authority; escalate scope changes or
   real blockers, not every command.
2. Keep guidance in its ordinary source home. Ten lines were enough here;
   larger situational methods and policy libraries belong behind skills or
   references, not an ever-growing default prompt.
3. Make source/activation status and bounded target trials usable by agents.
   Reuse existing operations and execution interfaces. Do not install these
   fixture adapters as a production improvement service.
4. Return compact evidence with optional detail. A tool response should help
   the caller decide, not copy every nested execution into its context.
5. Keep the improvement process agent-directed. Use a workflow only where a
   stable procedure needs reliable execution; benchmark comparison is optional
   capability, not the definition of improvement.

The baseline spent 25 reads looking for unavailable policy before acknowledging
the gap. That is a discovery limitation in this sparse read-only fixture, not
proof that adding instructions improves reasoning speed. Real interfaces should
make available lookup paths and missing context clear. This PoC does not claim
to have fixed installed catalog overflow or all inefficient discovery.

This is a tiny synthetic domain, with protected known truth and fresh target
executions. It does not establish reliability across models, complex learned
strategies, arbitrary target agents, native CLIs, executable extensions,
long-running Tasks, old-session activation, agent-operated rollback or production
deployment. Earlier [method trials](extension-methods-poc-20260912.md) cover
some underlying mechanisms, but do not substitute for installed-path evidence.

The next useful integration is one authorized target through its normal
source-operation and bounded-execution capabilities. Agree standing authority
for that scope separately; the installed Gym exact-artifact approval policy is
unchanged. The human should supply the objective, not manually operate a loop.

## Reproduce

The local Host branch is `poc/agent-operated-improvement-20260912`, based on the
teaching harness and truthful-completion candidates (#160 and #161). It is
isolated from the live installation. The fixture daemons are stopped after runs;
experiment artifacts remain for audit.
The final tested harness revision is `76f32080`; it is a local PoC branch, not
a merged or deployed production feature.

```sh
bun scripts/poc/agent-operated-improvement.ts
bunx --no-install tsc --noEmit -p scripts/poc/tsconfig.agent-operated.json
bun test scripts/poc/agent-operated-improvement.test.ts scripts/poc/conversation-adoption.test.ts
# Separate explicit model-trial authority and provider configuration required:
bun scripts/poc/agent-operated-improvement.ts --live
```

Default mode makes no model calls. Each live trial allows at most 12 bounded
executions, at most six improver-selected probes, a 300-second improver deadline
and 60 seconds per target. Nested read-only probes have their own deadline;
this harness does not prove immediate cooperative cancellation of those calls.
Every observed model is recorded; the configured route is `gpt-5.6-sol` with
fallback removed. Model-backed runs are not part of portable CI.
