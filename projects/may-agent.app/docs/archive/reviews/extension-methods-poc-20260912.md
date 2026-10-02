# Agent extension methods: choosing, activating and evaluating changes

> Historical record. Status, revisions and deployment observations below belong
> to the recorded review or trial, not the current installation. Follow the
> linked owning contracts for current behavior. Open limitations remain evidence;
> archiving this record does not establish that they were resolved.


**Supports:** [Teaching agents: from a correction to dependable behavior](../../proposals/agent-behavior-and-capability-extension.md). Compares when guidance, skills, workflows and tools deliver useful improvements.

**Choice basis:** [Applicable philosophy and convention](../../1-principles/evolution.md#promotion-tests); [compare competing choices](../../1-principles/core-principles.md#resolve-conflicting-designs).

**Status:** Bounded investigation completed, September 12, 2026. Isolated fixtures only;
no production guidance, permissions, App state or deployment changes.
**Parent:** [Behavior-extension proposal](../../proposals/agent-behavior-and-capability-extension.md).

## Questions and scope

For each method, establish the useful case, activation path, lifetime, retention
requirement, limitations, and evidence that an agent can choose and use it.
Separate source availability, execution delivery, actual use and useful results.

Methods: current input/steering; persistent conversation context; identity and
shared guidance; skills; referenced knowledge; tools; workflows; model selection
and bounded delegation; observation/feedback; isolated candidate improvement.

Extra boundaries worth testing are withdrawal and rollback, restart without
activation, source versus mutable operational data, crowded discovery, capability
filtering, untrusted feedback, and evaluation failures versus agent failures.
Do not assume a file is consumed or a copied candidate is activated.

## Bottom line

The existing mechanisms are enough for the next step. Their **delivery and
activation paths**, not a missing extension framework, are the main weakness.

- Instructions, skills and referenced facts can change later behavior without
  changing the model's weights. They solve different problems.
- A saved ability is not necessarily visible or usable. The crowded-catalog
  trial missed an installed skill; an exact reference restored useful use.
- Another agent can author a small, scoped candidate that the target uses.
  This trial proves bounded teaching, not general autonomous self-improvement.
- Source persistence and behavioral persistence are different. The active
  revision survives reopening, but old sessions, retrieval and retained history
  still matter. Restart is neither publication nor automatic forgetting.
- The installed Evaluation/Gym path has existing pieces worth reusing, but
  feedback delivery and verified activation still need integration work.

## Which method fits which case?

| Method | Good use | Main limitation or cost |
| --- | --- | --- |
| Current input / steering | Correct the current request, priority or next decision | Delivery depends on the entry path. Cannot undo an already committed action or guarantee instant interruption. |
| Conversation / Task context | Preserve accepted scope, decisions and exact work references | Stored history may be omitted, summarized or stale. It is not a universal standing instruction. |
| Identity / shared guidance | A short stable role or principle needed in nearly every relevant execution | Paid in repeated prompt context; broad instructions can conflict or over-apply. Keep domain details local. |
| Skill | A reusable method for a recognizable kind of work | Discovery and selection are fallible; prose does not enforce a sequence or grant tools. |
| Referenced knowledge | Facts, policies and detailed explanations | Must be discoverable, readable and current. A file merely existing is insufficient. |
| Tool | A bounded operation, authoritative lookup or validated action | Requires actual availability, permission and correct implementation. Calling it is not proof its result satisfies the task. |
| Workflow | Required ordering, evidence collection, validation and bounded branching | Enforces its own steps only after invocation. Optional selection and final judgment remain fallible. |
| Model selection | A different reasoning/cost/context tradeoff | Does not fix missing facts or permissions. Provider/fallback differences can invalidate a comparison. |
| Bounded delegation | Independent judgment or specialized context | Adds context-transfer and coordination cost. The callee does not automatically inherit the caller's methods or authority. |
| Observation / evaluation feedback | Bring a later fact, result or critique to the responsible agent | Needs a declared route or retrieval path. A report is neither a command nor a permanent lesson. |
| Candidate improvement | Distill a reviewed lesson into one of the mechanisms above | Not a separate extension mechanism. Needs isolated edits, comparisons, approval where required, and verified activation. |

Use the smallest combination that meets the need. For example: a skill explains
when to collect PR evidence; a tool or workflow returns that evidence; the agent
judges it. A one-line role correction does not need that whole combination.

## When does it take effect, and how do we keep it?

| Method | Takes effect when | Lifetime and retention |
| --- | --- | --- |
| Input / steering | The existing input/control path delivers it to an execution's next supported decision boundary | Scoped to that work. A transcript may retain it; make a separate authorized guidance change for standing behavior. |
| Conversation / Task context | The runtime supplies relevant state/history, or the agent reads its exact references | Durable state survives restart, but future delivery is selective. Keep the accepted decision with its owner, not only in a scratch note. |
| Identity / shared guidance | Committed source is successfully reloaded and a new execution is prepared | Active source survives restart. Old prepared executions remain pinned; amend/withdraw through the same source path. |
| Skill | Its activated catalog advertises it and the agent reads it, or a supported explicit selector supplies its body | The package is durable; selection is situational. Body/results may remain in history. Retain the source, trigger description and usable read/selection path. |
| Released knowledge | An execution reads the referenced document in its definition snapshot | Versioned with that release. Commit/reload/new preparation changes the available version; an index alone does not force reading. |
| Mutable operational facts | A tool reads the current owned data | A later read can see new data without source reload. Keep provenance/freshness with the fact; do not silently treat mutable facts as approved policy. |
| Agent-local tool / workflow | New source is validated/activated, loaded, then called by a new execution | Old loaded code remains pinned. Keep reviewed source and required dependencies. Changing Host code or dependencies needs their separate build/deployment path. |
| Model configuration | A newly prepared execution receives the activated configuration and valid provider route | Retained in configuration, not learned weights. Updating a native CLI's global package is not updating May's linked model libraries. |
| Delegation | The caller supplies the scoped request and available references to a bounded callee | The returned result is evidence. Durable improvement requires a separate reviewed change to the target's own guidance/code. |
| Feedback | It is explicitly supplied, actually read, or admitted through a declared Task route | A saved critique may survive but remain unused. Retain evidence; promote only the reviewed, reusable lesson. |
| Candidate promotion | The exact reviewed artifact is applied, the intended revision is verified active, and a fresh relevant execution uses it | Retain source, comparison evidence and an undo path. Copying files or emitting a change event is not activation proof. |

“New execution” is not every internal model call. An existing persistent session
can keep its old definition after reload. Preserve the Task/Conversation identity
while making the supported execution transition. Do not wake all waiting Tasks
merely because guidance changed.

Likewise, “temporary” means **not made standing policy**, not guaranteed erasure
from history. Correct current context explicitly when withdrawing an instruction;
do not claim a source rollback removes old answers or reverses external effects.

## New experiment and results

There were **23 attempted bounded executions: 22 completed model executions and
one invalid harness execution**. All completed records identify `gpt-5.6-sol`,
with fallback disabled. Each execution had a 90-second deadline; there were no
automatic retries. The initial cap was 24. No extra pilot model calls were made.

Synthetic Orion capacity policy v1 defines production's limit as 37 total
occupied-plus-additional slots. Version 2 adds staging's limit of 12; other
environments remain undefined. Eligibility never grants deployment permission.
The deliberately unfamiliar values test whether supplied knowledge is used,
not whether the model recalls a public policy.

### Delivery and natural use

| Trial | Observed behavior | What this establishes |
| --- | --- | --- |
| Knowledge file, no index/routing | Tried a missing index, read evidence, reported the limit unavailable | Saving a document did not make its content used. It correctly avoided guessing. |
| Same knowledge plus index and role pointer | Read index → policy → evidence; rejected 38 against 37 | An ordinary reference path worked. The two routing changes were bundled, not independently compared. |
| Target skill among 6 entries | Chose/read the relevant skill and correctly rejected 38 | Natural selection worked in the small catalog. |
| Target among 40 entries | Actual 8,000-character catalog omitted it; agent guessed paths and reported missing policy | A real discovery blind spot, not a bad policy or inability to apply it. |
| Same crowded setup, explicit runtime selection | Used the supplied skill and rejected 38 | Explicit preparation can bypass catalog omission. This is not proof Console/Telegram forwards selection. |
| Same crowded setup, exact path in request | Read the skill and rejected 38 | A simple available reference also repairs this fixture; no new search service was needed. |
| Unrelated request with prior explicit-skill history | Returned an ordinary welcome | Scope restraint in one carried-history execution, not guaranteed forgetting or daemon resume. |
| Available capacity lookup tool | Chose it, cited returned policy and rejected 38 | The agent can use a suitably described operation naturally. |
| Same lookup filtered by actual readonly policy | Reported the limit unavailable | Capability removal did not lead to fabricated lookup success in this case. |

The crowded fixture intentionally offers a confined read tool, not a shell or
directory-listing tool. A richer installed toolset might find the omitted skill
another way. Six and forty are experimental conditions, not recommended catalog
limits: path lengths, ordering, scope and descriptions determine the actual fit.
The crowded read-only attempt took about 17.9 seconds, versus 6.5 seconds for the
small catalog; these single observations do not establish a general speed gain.

### Can one agent improve another?

Yes, in the tested narrow sense. A separate improver used May's real read/write
tools to edit one isolated candidate `AGENTS.md`, verified the edit by reading
it back, and left the original role/trust restrictions intact. It could not
edit target source, evaluator records, tool permissions or activation state.
The harness, not the improver, staged and activated the candidate.

| Stage | Result |
| --- | --- |
| Baseline production and staging | Calculated demand but correctly reported policy unavailable. These are honest baselines, not failures. |
| First authored candidate | Added the production rule. Target rejected 30 + 9 against 37, refused to generalize it to staging, and handled unrelated writing normally. |
| Explicit owner feedback | Added newly approved staging scope; this was not a fabricated failure of candidate 1. |
| Second authored candidate | Retained production, added staging, version citation, equality, unknown-scope handling and eligibility/permission separation. |
| New input combinations | Rejected staging 5 + 8 against 12; accepted production 35 + 2 at 37; left development unknown; ordinary writing stayed ordinary. |
| Rollback, fresh execution | Returned to unknown staging policy rather than retaining the removed candidate rule. |
| Reactivation and source-store reopen | A fresh execution accepted staging 5 + 7 exactly at 12 using policy v2. |

This is **agent-authored scoped teaching plus tested adoption**. It is not novel
reasoning-strategy discovery: the authoritative policy was supplied in coaching.
The author was directed to an identity candidate, so this does not demonstrate
autonomous choice between identity, skill, knowledge, tool and workflow changes.
The held-out inputs are nearby combinations, not a broad unseen benchmark.
No model wrote executable extension code in this trial.

### Keep the invalid run and measurement correction visible

The first improver attempt failed before any tool call with `No API key for
provider: github-copilot`. The hand-built definition omitted the credential
binding that normal `buildAgentDefinition()` supplies. The model never authored
a candidate in that execution; changing agent guidance would not fix the cause.

The corrected harness explicitly binds the already configured route. It reused
the completed baselines and ran only the eleven unfinished cases in a new
fixture. The original twelve-attempt evidence is retained and counted; the
continuation's cumulative count is 23, not 12 + 23. This was one explained
setup repair, not a retry loop or a successful behavioral result.

The original carried-history record also included previous tool calls and usage
because the runner returns the whole transcript. The evidence export removes
the exact matched history prefix and records that correction. The welcome turn
made no new tool call. This is a useful evaluation lesson: do not attribute old
work to a new turn. Raw local evidence was not rewritten.

The 22 completed executions total about 150 seconds of reported execution time
and 65,424 reported tokens after that correction. These are not end-to-end wall
time, verified billing cost, or a production capacity estimate.

## Mechanics versus model evidence

New no-model checks exercised the actual release store, definition preparation,
read/write tools, local-tool loader and workflow runner:

- A fresh Bun process restores the activated revision, not a newer unactivated
  checkout commit. This is a source-store restart, not a full daemon restart.
- Activation does not mutate an already prepared prompt. Old loaded tools and
  workflows return v1; loading from the replacement release returns v2.
- A current operational fact changes on the next read without reload, while
  released knowledge remains pinned to its source snapshot.
- Missing workflow invocation fails explicitly, and a real tool policy filters
  the lookup capability.
- The ordinary cross-edit guard blocks another agent's identity, while the
  isolated candidate is allowed. That guard does **not** protect all skill paths;
  it is not a complete authorization or sandbox boundary. The PoC adds explicit
  one-file write confinement and denies evaluation-record reads.

The existing six owning test files passed: **98 tests, 300 assertions, no
failures**. They cover skills, preparation, persistent-session snapshots,
release restoration, local tool loading and cross-edit rules.
Explicit TypeScript checking of the three retained PoC scripts and ESLint pass.
A separate no-model run of #160's final teaching harness also passed actual
temporary-daemon correlated success/failed reload checks with the prior active
definition retained. That is neither a rerun of its model trial nor this new
matrix running through the daemon.

Earlier evidence is reused rather than counted again:

- [Guidance adoption](agent-adoption-poc-20260912.md): loaded identity/skill versus
  unreferenced memory, temporary instruction and amendment.
- [Workflow stability](workflow-stability-poc-20260912.md): ordered collection,
  incomplete sources, revision changes, retries, cancellation and return evidence.
- [Real-daemon teaching](conversation-adoption-poc-20260912.md): ordinary human
  teaching, scope, withdrawal, hostile input, failed activation and fresh chat.
  Optional workflow selection was 2/6, not guaranteed adoption.

## Installed gaps and the smallest next step

Source inspection finds three gaps in the existing path:

1. **Feedback delivery:** Evaluation's `canonicalFeedbackTarget()` prefers
   agent-local `last-eval.md`, but installed shared guidance points at generated
   `agent-feedback/<agent>.md`. Normal prompt preparation injects neither body.
   The HTTP details view labels `last-eval.md` as prompt content, which is not
   evidence the execution received it. Align one owned output/reference path
   and verify an actual read; do not add blanket feedback prompt injection.
   Feedback is mutable execution evidence: its pointer must reach the current
   owned record, not an old copy inside an immutable definition snapshot.
2. **Activation after promotion:** Gym verifies a candidate fingerprint and
   copies the approved overlay, emits `agent.revision.changed`, then reports
   applied. That branch does not itself commit/reload/verify the active source.
   A successful copy must remain “source applied, activation unverified” until
   the existing authorized reload path proves otherwise.
3. **Target scope:** Gym intake and its improvement plan currently accept May,
   not arbitrary agents. The isolated cross-agent result is not permission or
   implementation proof for fleet-wide automatic improvement.

Source references: Evaluation's
[feedback target](../../../../evaluation.app/agents/evaluator/workflows/evaluation-feedback-projection.ts),
Gym's [promotion and candidate loop](../../../../gym.app/agents/gym/workflows/improve-agent.ts)
and [intake scope](../../../../gym.app/agents/gym/workflows/evaluation-intake.ts),
Host [prompt preparation](../../../../may-agent/src/lib/agent-execution.ts) and
[agent-details presentation](../../../../may-agent/src/app/http/server.ts).
Inspection used workspace `db2e8e7c` and Host `49272b5a`; the evidence file retains
hashes of the inspected App/guidance sources.

Keep the accepted exact-artifact production approval rule. Reuse the existing
Gym candidate comparison/revision loop, which already caps sequential candidate
iterations at five, rather than build a new learning controller. Code runs
comparisons and preserves evidence; the agent judges causes and candidate edits.
Invalid provider, harness or evaluator runs are not target-agent failures.

The next useful integration test is one owned Task following:

```text
exact observed issue → decide whether a reusable change is needed
  → isolated candidate → baseline / target / regression / negative controls
  → explicit feedback → bounded revision only when evidence justifies it
  → exact approval → apply source → verify active revision
  → fresh ordinary execution → keep, revise or roll back
```

Stop at attention/approval when authority or valid evidence is missing; do not
broaden tools or edit the grading truth to get a passing candidate. Preserve
the same Task through later input/waits. No new subscription registry, promotion
state machine, supervisor or extension package format is justified by this trial.

## Valuable boundaries still unproved

Prioritize these for the actual first installed method, not a general framework:

- Fresh definition adoption on a **real long-lived Task** without losing its
  identity, accepted waits or outcomes; current matrix uses the direct runner.
- Withdrawal with **old contradictory history**, compaction and a full daemon
  restart. Fresh-run rollback is not evidence of forgetting in an old session.
- **Native worker handoff:** confirm the child receives/reads the exact method,
  uses its own allowed tools and returns evidence. Sharing files is insufficient.
- **Model changes:** compare the same cases and record exact route/fallback,
  rather than attribute endpoint or model changes to guidance improvements.
- **Generalization and staleness:** different inputs, changed or expired facts,
  conflicts, non-applicable tasks and simultaneous source edits. One candidate
  must not overwrite a newer approved change.
- **Authority and privacy:** instruction-shaped external feedback, source edits
  outside the candidate, sensitive lessons, and trusted executable modules.
  Earlier hostile-input tests and this file confinement are narrow evidence,
  not a comprehensive security certification.

## Reproduction and retained evidence

The local audit branch is `poc/extension-method-matrix-20260912`, based on #161
`a31a957d`. Initial model trials ran commit `b6e9a26d`; the explained candidate
continuation ran `81dac33a`. Final type-checking/hygiene revision `886ae455`
removes two unused copied workflow fixtures and fixes experimental types; their
earlier contents remain recoverable in Git. Its no-model preflight passes, but
it was not a repeated model trial. The new scripts are local experimental source, not an
installed capability or an additional published PR.

The [sanitized evidence](../../proposals/evidence/extension-methods-20260912.json) retains all
23 attempted execution records, inputs, answers, candidate edits, tool calls,
reported usage, source/prompt/harness hashes and failure accounting. Full prompts
remain in local temporary evidence; provider configuration and credentials are
not exported. The two evidence roots are `/tmp/may-extension-matrix-mg5LHJ`
and `/tmp/may-extension-matrix-hlAw1Q`; mechanics evidence was saved separately.

For an explicitly authorized new trial in the audit checkout:

```sh
bunx tsc --noEmit -p scripts/poc/tsconfig.extension-methods.json
bun scripts/poc/extension-method-matrix.ts
bun scripts/poc/extension-mechanics.ts
# Uses the configured model route; at most 24 executions, no automatic retries:
bun scripts/poc/extension-method-matrix.ts --live
```

The `--candidate-from` continuation is narrowly restricted to this recorded
credential-setup failure and counts previous attempts. It is experimental audit
support, not a new production retry mechanism. No full deployment or installed
learning-loop success is claimed.
