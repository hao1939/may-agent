# Agent judgment and code paths — October 16, 2026

**Status:** Source review and recommended refinements; no runtime change or activation.

**Supports:** [Purpose and value](../../1-principles/purpose.md): useful outcomes
with less supervision and acceptable total cost.

**Choice basis:** [Code should help agents work](../../1-principles/code-vs-data.md#code-should-help-agents-work),
[agents judge](../../1-principles/core-principles.md#code-executes-and-brings-back-evidence-agents-judge)
and [Host/App ownership](../../2a-design/system-boundary.md#ownership-and-intervention).

## Review conclusion

The foundation supports the intended model: agents interpret and adapt; code
makes understood work efficient and provides reliable execution. The gaps are
uneven feedback, requirements embedded in the generic completion tool, and
procedures that end before the agent can handle an unfamiliar result.

A schema match enables a known code path. It does not prove that the result is
correct. A mismatch is evidence that this path cannot safely consume the data;
it does not prove the work is impossible or that the content has no value.
The responsible agent can interpret it, repair a proposal, choose another
authorized method, or return a blocker to its owner. Recovering useful work and
improving the code for future work are separate decisions.

This is a system-wide cooperation rule, not an instruction for the Host to call
a model whenever validation fails. Apps own interpretation and procedure. Host
owns identity, authority, durable work, execution bounds, effect safety and
feedback. Arbitrary content does not become an executable control by reaching
an agent. Agent competence is a working default, not a guarantee of success.

## Scope and evidence

- Apps main snapshot: `9d94b5a42a`.
- Alex's separate candidate: `cc24d7290a`, including its preceding evidence-hash
  and completion-guidance changes. These changes were not present in the main
  snapshot; this review makes no activation claim.
- Host source: `21abd7b9b2160d7eb9a1726fc2e79e693dc35380`.
- Inspected admission, agent invocation, completion, workflow consumption,
  diagnostics, evaluator guidance and existing periodic audit.
- Two local synthetic probes below use real schemas/readers, without model
  calls, live Tasks, deployment or changes to retained reports.

This is a focused boundary review, not proof of coverage across every App or
an attribution of current production cost to every finding.

## Findings and smallest useful corrections

### 1. A second validator can reject work after its author has finished

**Owner: Alex App first; optional shared completion feedback belongs to Host.**

`task-outcome-review.ts` supplies `resultSchema` to the model, then calls
`parsedJudgment` after execution. Metric review uses the same pair. The schema
allows whitespace-only strings through `minLength: 1`; the reader trims them
and rejects empty summary/responsibility/delivery or a blank follow-up request.
This remains in Alex's candidate, not just the older main snapshot.

Synthetic probe against candidate `cc24d7290a`:

| Proposal | Schema accepts | Reader accepts |
| --- | --- | --- |
| Ordinary complete judgment | yes | yes |
| Same judgment with summary `" "` | yes | no |
| Same judgment with followUp request message `" "` | yes | no |

The agent receives no field-specific correction from that later reader. Task
review returns a blocker; metric review returns incomplete. Another execution
can consume review allowance even though the immediate problem was formatting.
The examples establish a boundary mismatch, not its observed production rate.

Use one App-owned definition for shape checks and consumption. Distinguish
historical report compatibility from admission of new proposals. Return
correctable domain checks to the agent before its contribution becomes terminal.
The Host already has an internal pure `validateOutput` callback for direct Task
agents; public `ctx.agents.call` exposes a schema but no equivalent callback.
If structural alignment is insufficient, exposing that existing feedback
capability is a small generic extension. Do not add a new repair service.

Sources: `projects/alex.app/agents/evaluator/workflows/task-outcome-review.ts`
(`resultSchema`, `parsedJudgment`, post-call validation), `metric-review.ts`,
Host `src/lib/tools/workflow-finish.ts`, `packages/sdk/src/workflow.ts`.

### 2. Generic completion guidance assumes a particular way of doing work

**Owner: Host contract, with corresponding App guidance.**

The generic `finish` tool requires nonempty `verification_facts` for every
success and describes them as this session's tool outputs. A reviewer can
legitimately judge supplied evidence without running another tool. Alex's
guidance explicitly permits citing supplied evidence, while the shared tool
still asks for tool calls. The Host checks that the array is nonempty, not that
it proves the assignment. Outer and domain-specific evidence fields also need
separate authoring despite their similar names.

Clarify that execution facts and domain evidence are different responsibilities.
Host records what ran and what was accepted. The App/caller defines sufficient
evidence for the contribution. Immediately remove the suggestion that success
necessarily requires fresh tool output. Review whether the outer evidence field
adds information when the caller already provides an evidence-bearing contract;
derive redundant summaries or keep optional detail where that is sufficient.
Do not remove identity, publication checks or an explicit follow-up decision.

Source: Host `src/lib/tools/lifecycle.ts` (`finishSchema` and success validation),
Alex evaluator `AGENTS.md` and candidate completion-correction guidance.

### 3. A narrow result schema can obstruct an honest inability report

**Owner: shared invocation contract; Apps define successful domain results.**

`createWorkflowFinishTool` makes `result` mandatory for every finish status when
a caller supplies a schema. A synthetic probe supplying a summary, blocker and
next step but no normal result was rejected for all of `blocked`, `failure` and
`partial`. The recovery prompt likewise asks for the required payload when
blocked. This is currently deliberate contract behavior, not proof of a new
production incident.

An App can already include an honest unavailable/partial outcome in its own
schema. Prefer that when it is meaningful domain data. The broader contract
should also let a helper say it could not produce the expected contribution
without manufacturing one. Separate completion of the invocation from
availability of a validated domain result. Preserve partial output as evidence;
only validated output may enter code that requires the domain type.

Review this as a coordinated contract change, including consumers which currently
equate `execution.status === "done"` with an available result. Do not silently
make `result` optional while leaving those consumers unchanged.

Sources: Host `src/lib/tools/workflow-finish.ts`,
`src/lib/workflow-finish-recovery.ts`, `src/lib/agent-execution.ts`,
`src/lib/workflow-tool.ts`.

### 4. Exceptions are retained, but cheap feedback and audit are inconsistent

**Owner: Host/library for mechanical facts; Alex for audit and decisions.**

The pinned Pi validator includes the entire attempted argument object in its
error. Shape validation occurs before the ordinary before/after-tool hooks.
Semantic finish rejection instead returns text beginning `finish() error:`.
These paths remain correctable, but they provide different machine-readable
signals and can inflate repeated model context.

Return concise field/check failures with a reference to retained original
evidence. Represent rejection consistently at its owning boundary; do not ask
the evaluator to infer it from arbitrary error prose. Reuse execution records
and reporting projections for rejected proposals, correction effort and final
outcomes. Successful recovery must remain success while its cost stays visible.
Do not add a new Event-driven model call for each rejection.

The ordinary process reader is bounded and excludes evaluator sessions from
self-scoring. The existing six-hour operational audit already covers recurring
failure, recovery and usage and assigns Alex independent coverage when the
evaluator itself is implicated. Extend that existing audit's evidence where
needed; absence of a failure metric is not proof of cheap recovery. Audit can
choose no change for an isolated transient, legacy case or disproportionate fix,
or choose guidance, App code, shared capability or upstream repair for a pattern.

Sources: pinned `pi-ai/dist/utils/validation.js` and
`pi-agent-core/dist/agent-loop.js`, Host `workflow-finish.ts`, Alex
`task-process-evidence.ts` and the
[existing operational audit](../../evaluation/systemic-pattern-review-20260927.md#six-hour-cross-task-operational-audit).

### 5. Input interpretation needs an explicit owner, not relaxed admission

**Owner: App ingress/procedure; Host retains its admission boundary.**

Host validates an addressed App input before inbox admission. A rejected shape
does not create an accepted destination obligation. The original Event may still
exist; that is not Task acceptance. Alex already accepts ordinary `message` and
`goal` inputs with context, so interpretation does not inherently need a new
public protocol.

Use a valid ordinary input carrying the unfamiliar content as data when an App
needs interpretation. Let its existing procedure choose a deterministic reader
when suitable or ask the responsible agent when it is not. If a typed operation
was rejected, return the specific failure to the existing caller to correct or
choose that ordinary route. Preserve exact identity, original content and useful
work. A missing target, denied permission or corrupted publication cannot be
silently converted into permission to execute it.

This is a convention and focused App adoption gap, not evidence that every
schema rejection needs a Host fallback or another Task. A broken App procedure
uses its existing independent operational feedback route.

Sources: Host `src/app/core/inbox/app-inbox-host.ts`, Alex `app.ts`,
[recovery ownership](../../2a-design/system-boundary.md#recovery-uses-evidence-before-repetition).

## Design refinement and implementation order

Put the system-wide rule in philosophy/core principles, summarize ownership in
System Boundary, and keep exact completion feedback at Execution Contributions.
Teach its use through the existing Task execution skill and workflow manual.
Audit dispositions belong in the existing evaluation guidance. Maintain one
source for each rule; no new skill copy or recovery lifecycle is needed.

1. Align Alex's new-output schema and consumer, and demonstrate a correctable
   rejection reaching the current reviewer. Preserve report publication reuse.
2. Clarify generic finish guidance and identify which completion requirements
   protect execution versus duplicate App judgments. Refine the inability-report
   contract and affected consumers together if needed.
3. Make generic rejection feedback concise and consistently observable at the
   supported validator boundary; expose existing App-owned preflight if required.
4. Prove one unfamiliar-input case can reach an existing agent, produce useful
   work and retain audit evidence. Use the existing periodic audit to decide
   which repeat patterns justify permanent automation.

Decisive trials include a legacy report interpreted without rewriting history,
a schema-valid but reader-invalid proposal corrected in the same invocation,
an honest unavailable result, and a committed publication followed by retry
without duplicate publication. Denied authority must remain denied. Measure
final useful outcomes, recurring correction cost and owner intervention; first
format validity is an efficiency measure, not the purpose of the system.

## Good behavior to preserve

Same-invocation finish correction, bounded execution and accepted partial work
already support this direction. Workflows can call agents directly, without a
Host-selected recovery mode. Saved reports recover publication without another
judgment. Metrics collect quietly; meaningful transitions and the declared audit
bring evidence to an agent. Heuristic finish guards can report concerns without
automatically blocking work. These mechanisms should be reused rather than
replaced with a universal exception controller.
