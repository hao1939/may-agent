# Design clarity and proposal status review — 2026-11-11

**Supports:** [Design authoring and review](../../2b-manual/design-authoring/SKILL.md). Keep current rules discoverable, preserve useful history and choose the next small change from current evidence.

**Review scope:** Current documentation navigation, the main ownership/execution contracts, and a status inventory of 36 proposal entries other than their README: 35 present at the start and one workflow-portability draft added concurrently. Implementation checks targeted the shared contracts and disputed status claims; this is not a complete source audit of every proposal. Read Host source at `c3fdc20d0cdb83c2ac151ba4672a2581e5b7825b`, whose tree matches merged #452 at `6bacfaa3eb7d041257020a858ab4047c88c18bb4`, and Apps source at `30c0867d4a` plus the documented local alignment edits. GitHub readback checked all 153 distinct PR references found in the initial proposal inventory. Merge state establishes source integration, not deployment or closure of every related design question. The checker work is assigned elsewhere and was not changed here.

This review did not execute model experiments, inspect current production state, restart services or withdraw retained work. Its recommendations are not implementation or operational approvals. Existing dirty documentation edits were preserved.

## Findings and corrections

1. **Current organization contradicted its own completed handover.** The learning-loop contract and proposal index still called Alex unimplemented. The current contract now identifies Alex's assessment/engineering/comparison responsibilities, while the migration proposal retains exact historical receipts and residual-state limits.
2. **Execution and resource status drifted.** Agent guidance still allowed cold Host session resume and called workload accounting/coordination unimplemented. It now matches Sessions and merged #443/#449. Skill discovery, native-history fixes and structured-finish validation are marked merged without asserting today's installation state.
3. **Completed implementation plans appeared to be active work.** Six dated policy, PoC, workflow, runtime and App-behavior records were archived with forwarding pages. Their unresolved observations remain evidence; archive status does not mean every old question was solved.
4. **A mixed proposal still proposed the architecture that #449 shipped.** Task communication's original design is archived; its active page now contains only operational routing, quiet communication and connected adoption evidence.
5. **Old source inventories were presented as current defects.** The convergence index now separates the freshness rule rechecked in current source from September investigation leads. Merged #157/#147/#371/#443/#452 and bounded startup recovery are no longer treated as pending implementation.
6. **Meaning must survive shorter instructions.** Current schema structure still retains per-state constraints as well as semantic admission. Size reduction alone proves neither agent comprehension nor lower total cost. Accurate prepared-payload measurement remains with its existing assignee.

## Proposal dispositions

Inventory: **36 entries** — 10 pending evidence, 11 source landed; adoption pending, 7 historical, 7 deferred, 1 assigned elsewhere. “Pending evidence” is a candidate question, not a new Task or approved feature. “Source landed” still leaves its named adoption limits open. The concurrent workflow draft is catalogued here without editing its author's proposal.

| Proposal | Disposition | Remaining value or next evidence |
| --- | --- | --- |
| [Teaching agents](../../proposals/agent-behavior-and-capability-extension.md) | Pending evidence | Use existing instructions/skills/workflows; the remaining question is one discover-author-activate-fresh-use path with useful outcomes, not a new trainer. |
| [Workload implementation](../../proposals/agent-task-workload-implementation.md) | Source landed; adoption pending | Host #443 merged the consolidated stack; retain its candidate history. Complete selected installation/result-disposition acceptance before broader activation. |
| [Workload model](../../proposals/agent-task-workload-model.md) | Source landed; adoption pending | Shared budgets, limits and feedback exist. Remaining work concerns funded scope, caller disposition and observed choices; standalone admission remains separate. |
| [Alex organization and migration](../../proposals/alex-improvement-app.md) | Source landed; adoption pending | The source migration is complete; dated handover records report activation. Residual retained-state withdrawal and end-to-end improvement acceptance are separate work. |
| [September App behavior review](../../proposals/app-behavior-convergence-20260925.md) | Historical | Archived evidence and contrasting failure cases; do not treat its old App/file inventory as a current implementation queue. |
| [App author usability](../../proposals/app-environment-review-20260928.md) | Pending evidence | Choose one concrete author/worker discovery failure and compare the smallest correction. Avoid another capability inventory. |
| [Installation-policy migration](../../proposals/app-policy-and-host-boundary-cleanup.md) | Historical | Host #326 source slice is complete. Dated rollout and remaining retained-state limits are archived; current installation declarations own behavior. |
| [Earlier simplification review](../../proposals/authority-boundary-simplification.md) | Source landed; adoption pending | Many cuts landed, and #449 retired crash replay/configurable upkeep. Recheck only provider delivery or a concrete remaining consumer; no generic cleanup backlog. |
| [Current gaps and historical leads](../../proposals/design-implementation-convergence.md) | Pending evidence | Freshness-by-event-name is rechecked in current source. Other September rows are leads requiring reproduction, not confirmed current defects. |
| [DeepSeek adoption candidates](../../proposals/dsh-superagent-review-and-adoption-20261111.md) | Pending evidence | Approved cuts landed in #449. Attention views, connector retry safety and App initiative are conditional trials; choose a recurring need before adding behavior. |
| [External-component cleanup](../../proposals/external-components-simplification.md) | Source landed; adoption pending | The three first-milestone fixes landed. Broader feedback/reporting changes remain conditional on a demonstrated consumer and provider evidence. |
| [Context preparation experiment](../../proposals/focused-session-continuation.md) | Deferred | Supporting hooks/measurements merged in #192/#193; default adoption remains unproven. Reconsider after current prompt work with a concrete context-use failure. |
| [Host contract refinements](host-contract-improvements-20261016.md) | Source landed; adoption pending | The listed repairs, including #371 and report admission, merged. Remaining private-path, query-cost and agent-adoption questions need specific evidence. |
| [Host/App release compatibility](../../proposals/host-stability-and-app-extensibility-20261005.md) | Pending evidence | Use the smallest real-App compatibility and boundary checks that catch a current gap; several named earlier defects are already repaired. |
| [Standing project-review loop](../../proposals/may-project-review-loop-20260912.md) | Deferred | A bounded pilot exists. A standing review loop needs evidence that its decisions and resulting outcomes justify continuing attention/model cost. |
| [Prompt and schema size](../../proposals/model-surface-and-prompt-hygiene-20261111.md) | Assigned elsewhere | Host #452 is merged and Apps prompt/skill changes are committed. Accurate prepared-payload measurement and remaining prompt work are already assigned; do not duplicate them. |
| [Observation ownership and freshness](../../proposals/observer-feedback-and-resource-conventions.md) | Pending evidence | Publication/observer-accounting foundations exist, including #371. The concrete remaining generic-Host coupling is freshness selected by event spelling; provider convention trials stay conditional. |
| [PoC source retirement](../../proposals/poc-retirement-and-knowledge-20260912.md) | Historical | Host #174 merged; current source has no tracked scripts/poc tree. Preserve the supported-tool/evidence convention without rerunning the old deletion inventory. |
| [Progress under arriving input](../../proposals/progress-under-burst-input.md) | Source landed; adoption pending | Scoped acceptance exists in current source. Useful progress, correction latency and cost under representative bursts remain behavioral questions. |
| [Evidence-based recovery](recovery-from-execution-evidence-20260922.md) | Pending evidence | The shared recovery rule is current. Use retained effect receipts and one contrasting failure when a real owner-recovery gap appears; do not restore workflow replay. |
| [Earlier recovery/oversight record](../../proposals/reliable-recovery-and-independent-oversight-20261002.md) | Historical | Archived implementation and trial evidence. Unified recovery owns the remaining availability/diagnosis question; the old ordering is superseded. |
| [Responsive recovery](responsive-host-recovery-20261002.md) | Source landed; adoption pending | Indexed fixes and bounded isolated startup recovery exist. Measure a current responsiveness failure before reviving this old implementation plan. |
| [Durable work without an App](../../proposals/standalone-agent-tasks.md) | Deferred | Accepted direction; direct durable admission and identity compatibility remain unimplemented. Existing Apps do not demonstrate urgency for this storage/addressing change. |
| [Broader storage extraction](../../proposals/storage-state-service.md) | Deferred | Atomic attachment and shared state operations exist. A new service/API deployment or wider extraction needs a concrete coupling or operating problem. |
| [Alternative result spelling](../../proposals/task-attempt-decision-schema-20261002.md) | Deferred | Keep state/continue and current schema identities. A spelling migration alone has no demonstrated outcome or maintenance benefit. |
| [Broad capability discovery](../../proposals/task-execution-capabilities-20261002.md) | Deferred | Current SDK/tools already expose callable work, requests and Conditions. Start with one demonstrated missing capability rather than a universal facade. |
| [Capability-discovery reference](../../proposals/task-execution-capability-contracts-20261003.md) | Deferred | Supporting reference for the preceding deferred design, not another implementation track. Existing calling/return contracts remain current. |
| [Task-owned Host cuts](../../proposals/task-owned-host-simplification-20261111.md) | Historical | Forwarding page to #449 implementation evidence. Accepted cuts are complete in source; stopped upgrade and deployment remain separate. |
| [Task entry and evidence readability](../../proposals/task-resource-layout-20260929.md) | Pending evidence | Clarify assigned/considered inputs versus pending unclaimed input using current readers and artifacts. One missed-review/correction comparison can bound the change. |
| [Earlier core/runtime roadmap](../../proposals/task-runtime-organization.md) | Historical | Archived dated source review. Architecture and current Task contracts own the system; old candidate steps require revalidation before new work. |
| [Task communication and operational routing](../../proposals/tasks-and-communication-resources.md) | Source landed; adoption pending | Common admission/results/communication landed in #449. Keep only the App operational-route and quiet-follow-through questions active; original design is archived. |
| [Telegram interaction](../../proposals/telegram-conversation-experience.md) | Source landed; adoption pending | Host #157 is merged; later common Conversation and delivery fixes are current. Representative installed interaction remains separate from that old candidate. |
| [Reachable owned recovery](../../proposals/unified-agent-recovery-20261017.md) | Pending evidence | Saved-caller and declared-route trials exist. Remaining contrasts are unavailable owner/module bootstrap, exact return and real diagnosis; repair one route if evidence warrants it. |
| [September workflow rollout](../../proposals/workflow-practices-review.md) | Historical | Archived dated source/behavior observations. Current workflow authoring rules apply; the old per-workflow rollout inventory is not a current backlog. |
| [Workflow evidence and health](../../proposals/workflow-tracing-and-health-metrics.md) | Source landed; adoption pending | Both #143 and #147 merged. Extra artifact/health presentation and provider adoption need actual reader value; avoid adding metrics solely to finish the old plan. |
| [Portable business workflows](../../proposals/workflow-business-host-boundary.md) | Pending evidence | Concurrent draft; business/management boundary agreed, extraction and runner/API still proposed. Begin with one existing workflow and prove independent use plus hosted adoption before broad migration. |

## Recommended next moves

### 1. Remove hidden event-name policy from Condition freshness

At the reviewed source, `src/app/core/tasks/app-task-condition-tracker.ts`,
`isFreshLevelObservation()` selects freshness using `aks.repo-ref.observed` and
suffixes such as `.state`, `.check` and `.pulse`. Equivalent facts can therefore
receive different validity rules because of their names. This is a concrete
remaining coupling in a generic Host; it does not establish a current incident.

The [convergence index](../../proposals/design-implementation-convergence.md)
and [observer proposal](../../proposals/observer-feedback-and-resource-conventions.md)
own the question. Review the smallest explicit observation-validity requirement
using the existing Condition expectations. Preserve historical result facts,
reopened generations and retained waits; do not simply remove the stale-fact
protection. Acceptance should compare equivalent observations under different
names and prove the same stale/current decisions. This is preferable to a new
observation service or a naming convention that silently carries policy.

### 2. Make the current Task entry harder to misread

The [Task entry proposal](../../proposals/task-resource-layout-20260929.md)
records a missed assigned review despite the full evidence being available.
Compare a clearer presentation of assigned/considered input, unclaimed pending
input, accepted output and independent waits. Reuse current scoped reads and
exact evidence links. Keep the change only if the contrast reduces missed work
or repeated explanation without losing scope; no new acknowledgment ledger is
needed. This is separate from the prompt-size work already assigned.

### 3. Prove one recovery and result-return path end to end

Use the [hierarchical recovery proposal](../../proposals/unified-agent-recovery-20261017.md)
and [communication follow-up](../../proposals/tasks-and-communication-resources.md)
as one connected question. With the original owner/Conversation execution still
unavailable, show a declared route reaches usable owned work, then returns repair
evidence to the exact original obligation. Preserve the human ask and caller
Condition until their own outcomes are accepted. Start with source fixtures;
real diagnosis and installed acceptance need their own evidence and authority.
Do not create a second supervisor or another general recovery lifecycle.

### Workflow portability: a separate bounded candidate

The new [business/Host boundary draft](../../proposals/workflow-business-host-boundary.md)
fits the current ownership model: business decisions stay in workflows and Apps;
Host admission, accepted results, funding and fresh-attempt recovery retain their
owners. A standalone experiment does not promise durable Task management.

Its new execution module, observation channel, bindings and runner could also
increase the contract surface. Start with one existing workflow and extract only
what prevents independent authoring/testing. Compare the resulting code and
test setup with today's direct fixtures; retain one invocation path for hosted
callers. Broader API design and migration should follow demonstrated reduction
in coupling and total maintenance cost. This review does not take over that draft
or approve its proposed API.

## Defer until a concrete need changes the tradeoff

Keep standalone durable agent addressing, a replacement attempt-result spelling,
a universal capability facade, a separate storage service, default context
preparation and a standing project-review loop deferred. Each can add a contract,
migration or recurring cost without a demonstrated current consumer. DeepSeek
initiative, attention views and connector retry safety remain conditional App
trials; an observed recurring problem should choose the next one.

## Validation and limits

- The local file/heading audit found **0 current broken links** and the same
  **20 historical broken links** as before this review, all in archived records.
  Those removed source paths limit old provenance; they do not justify restoring
  retired implementations. Moved pages and incoming heading links were checked.
- `git diff --check -- projects/alex.app/docs` passed.
- In `/app`, `bun run check:may-design` passed documentation integrity and typed
  examples, then failed canonical App validation because the existing
  `evaluation.app` and `gym.app` directories have no `app.ts`. They were left intact.
  The model-surface checker passed separately for 9 enabled agents.
- The **full design gate passed** in an isolated checkout at `/tmp/mdr11`, using
  Apps `30c0867d4a`, these docs and the reviewed merged Host tree: documentation
  integrity, typed examples, canonical Apps and model-surface checks for 10 agents.
  The existing `reports` layout warning remains.
- The same isolated tree initially failed the model-surface check at its longer
  path under `/tmp/may-docs-review-20261111/validation`: May's `verification`
  skill was omitted from the bounded catalogue. Moving that worktree to the
  shorter path, without changing its files, made the full gate pass. The checker
  serializes absolute paths, so checkout location changes measured catalogue
  size. This confirmed portability limit remains with the assigned checker work;
  no checker or prompt implementation was changed here.

These are structural and source-status checks, not proof of agent comprehension,
installed behavior or improved operating cost. No change was made to the
model-surface checker or assigned implementation work. Documentation edits remain
local and uncommitted at the end of this review.
