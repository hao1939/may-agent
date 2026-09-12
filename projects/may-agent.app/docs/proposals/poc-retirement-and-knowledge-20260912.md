# Review Host scripts, preserve reusable tools and retire completed PoCs

**Status:** Accepted for implementation, September 12, 2026. Isolated source
candidate prepared; not merged or deployed. Removing `scripts/poc/` is a firm
completion requirement, not an optional follow-up.
**Original inventory:** `8026aff97585edd7f728fa4ce360fdde71bc740a` (#164): 48 files,
21 in `poc/` and 27 directly under `scripts/`.
**Refreshed Host baseline:** `38a048da5c105bea91dc7163010d94483a60b747` (#167):
54 tracked script files, **27 in `poc/`** and 27 directly under `scripts/`.
The six additions from #163 are dispositioned below. Scope includes callers,
tests and design/evidence references. Active experimental branches are preserved;
they must not reintroduce the folder into main.

The broader [codebase cleanup review](authority-boundary-simplification.md#september-12-codebase-cleanup-review)
covers runtime, HTTP, compatibility APIs and tests outside this inventory.

## Accepted decision

Remove the permanent `scripts/poc/` collection from Host main. Preserve the
knowledge an experiment produced in the existing design documentation. Keep
executable code on main when it provides a useful regression test, recurring
command or reusable helper with an identified consumer. Active experimental
code stays on an isolated branch or worktree linked from its proposal.

Keep the existing Host build, CI, deployment and diagnostic commands with the
Host. Move domain tooling only with its actual consumers. The root script
inventory below separates placement decisions from correctness fixes; a useful
command can belong here and still need repair. Keep the current mostly flat
layout rather than introducing a directory for every category.

A completed PoC can be successful even when all its experimental code is
deleted. Its durable result is the answered question, supporting evidence,
limitations, and resulting decision. Copying the entire folder to another
archive or test directory would retain its maintenance burden.

This follows [May's goal and value/cost rules](../1-principles/design-philosophy.md),
the [minimal experiment principle](../1-principles/evidence-first.md), and
[mechanism retirement](../1-principles/evolution.md#retirement). The benefit is
less ambiguity about supported commands, less code to update during Host
changes, and easier discovery of what we learned. File count is supporting
evidence; useful knowledge and maintained behavior determine completion.

The accepted cost would be losing current-main execution of completed model
trials. Their original source remains inspectable and reproducible at its
recorded revision with the corresponding dependencies and prerequisites.
That does not promise identical model outputs or indefinite provider availability.

## Where each result belongs

| Result | Home | What to retain |
| --- | --- | --- |
| An unresolved question and active experiment | `docs/proposals/` plus an isolated source branch/worktree | Question, smallest experiment, exact source reference, findings so far, next decision |
| An accepted design conclusion | Its owning `docs/2a-design/` document; principles only for an accepted general rule | The current rule and a concise reason, linked to evidence |
| A completed investigation | `docs/archive/reviews/`; completed migration records may use `docs/archive/implementation/` | Findings, unsuccessful trials, limits, decision and reproduction references |
| A useful regression | Existing Host test suite beside the owning behavior, or `test/integration/` / `test/e2e/` for the actual boundary | Smallest executable check that catches the demonstrated defect |
| A repeatedly needed command | Host `scripts/`, or the owning App/project for domain tooling | A clear purpose, prerequisites, maintained callers and relevant checks |
| A reusable helper from an experiment | The owning script, skill, source module or test suite; see [Reusable scripts and helpers](#reusable-scripts-and-helpers) | The smallest useful implementation, its consumer and relevant checks |
| Raw transcripts, databases and generated reports | Existing external experiment artifacts | Selected sanitized evidence in the document when needed to support its claims |

Use the existing document when it already records the finding. Do not create
one new lesson document per script or paste source code into the design.
When a proposal has both completed evidence and open work, retain its open
decision and move only the completed history, updating links together.

Before deleting a harness, retain a short record:

> Question → observation → conclusion → decision. Include the source revision,
> original script path and invocation, important prerequisites, evidence location
> or selected sanitized results, and the limits of the claim.

The baseline commit above retains every file in this inventory. Other trials
must identify the actual Host/App revisions they used. A disposable worktree
path or an uncommitted file is insufficient preservation: commit useful source
to a retained experimental reference before removing its only copy. Git retains
the harness; evidence that exists only outside Git needs separate preservation
or an explicit statement that it is unavailable.

## Reusable scripts and helpers

Keep useful executable capability as code. Design documentation preserves what
we learned and why the capability exists, and links to its maintained home and
usage. Finishing an investigation does not make its reusable helpers obsolete.
Assess the experiment's conclusion and the helper's future use separately.

Choose a home by responsibility and how the code is used:

| Use | Home |
| --- | --- |
| A Host development, verification or operations command | `may-agent/scripts/`, with its package command or operations-guide entry |
| A domain or project utility | The owning App/project's `scripts/` |
| A helper used as part of a reusable skill | `<scope>/skills/<name>/scripts/`, with invocation and prerequisites in `SKILL.md` |
| A function imported by production code | The responsible source module or existing package |
| A shared test helper or fixture | The owning suite's existing helpers/fixtures |
| An agent-facing operation that needs a tool contract | The owning agent's `tools/`, after checking existing tools and SDK capabilities |
| A procedure that needs dependable ordered execution | The owning agent's `workflows/`, when that sequencing need justifies it |

This follows the existing [skill bundle structure](../1-principles/evolution.md#skills)
and [mechanism selection rules](../1-principles/code-vs-data.md), also applied in
the [extension proposal](agent-behavior-and-capability-extension.md#2-choose-the-smallest-useful-extension).
A reusable script can remain a script. Bundling it with a skill keeps normal
tool permissions and does not introduce a workflow lifecycle.

For each candidate, identify a real consumer or a specific recurring task before
extracting it. Record inputs, outputs, invocation, prerequisites and any side
effects or state roots. Keep relevant correctness checks, remove experiment-only
assumptions, and update callers together. Prefer an existing helper when it
already supplies the behavior. Do not create a general `reusable/` or `common/`
collection for code that merely looks reusable; retain such candidates at the
recorded experimental revision until a use is identified.

For this inventory, the protocol gate already has maintained callers. The
process-resource sampler currently serves only the smoke experiment and its own
tests; it is a candidate for extraction if a recurring diagnostic needs it,
not an established shared utility. The conversation-adoption adapters are
temporary-installation fixtures: preserve the pieces needed by retained reload
tests with those tests. Reusing a fixture does not establish a production
source-editing or preference API.

## Findings to preserve

Much of this knowledge is already documented. The cleanup should connect and
clarify it, including historical source status, rather than repeat the reports.

| Finding | Existing evidence | Current design home |
| --- | --- | --- |
| One Task can handle input, delegate, retain waits, accept exact results and continue after restart; answers and owner closure are separate | [Task review](controller-poc-deeper-review.md), [recovery and cutover evidence](controller-poc-recovery-review.md) | [Task engine](../2a-design/task-resource-engine.md), [Architecture](../2a-design/architecture.md) |
| Code should preserve caller links and coordination state; agents judge evidence and scope. A blocker report does not fulfill the original ask | [Early judgment trial](controller-poc-evidence.md), [input continuation](controller-poc-input-continuation.md), [caller-feedback proposal](caller-feedback-and-waiting.md) | [Events](../2a-design/events.md), [Task engine](../2a-design/task-resource-engine.md); proposed feedback changes stay in their proposal until accepted |
| A scoped correction can affect later work, but saved source, activation, execution delivery and useful adoption are different facts | [Conversation adoption](conversation-adoption-poc-20260912.md), [extension methods](extension-methods-poc-20260912.md) | [Skills](../2a-design/skills.md), [Runtime](../2a-design/runtime.md), [practice learning](../2a-design/practice-learning-loop.md); proposed refinements remain with the [extension proposal](agent-behavior-and-capability-extension.md) |
| A workflow's value can be dependable sequencing even when it finds the same defects as direct work; missing knowledge still needs guidance | [Workflow investigation](workflow-stability-poc-20260912.md), [natural selection comparison](conversation-adoption-poc-20260912.md#what-the-workflow-comparison-taught-us) | [Workflows](../2a-design/workflows.md), [mechanism selection](../1-principles/code-vs-data.md) |
| Improvement can use an ordinary Task; effective tool scope and actual target behavior require verification | [Task improvement](task-improvement-poc-20260912.md), [agent-operated improvement](agent-operated-improvement-poc-20260912.md) | Open [extension proposal](agent-behavior-and-capability-extension.md#improvement-uses-the-ordinary-task-lifecycle); the six added files are included in the refreshed inventory below |

Keep negative and corrected findings visible: malformed harness queries,
overstrict output scoring, missing guidance scope, inaccessible references,
and source/activation mismatches are not automatically agent failures. Passing
fixtures establish the exercised behavior, not a general reliability or cost
claim. Do not rerun paid trials solely to relocate or delete their harnesses.

## Disposition of the 21 PoC files

Paths below are relative to Host `scripts/poc/`. Each row states a proposed
destination and the work needed before removing the old path.

| Files | Proposed disposition |
| --- | --- |
| `check-codex-goal-protocol.ts`, `codex-goal-protocol.ts`, `codex-goal-protocol.snapshot.json`, `codex-goal-protocol.test.ts` (4) | Keep as supported compatibility verification directly under `scripts/`. The package command and container smoke gate already use these files. Update their imports, relative fixture paths, callers and documentation together. |
| `codex-goal-smoke.ts`, `codex-goal-resources.ts`, `codex-goal-resources.test.ts` (3) | Retire the exploratory model/resource trial. Assess the sampler independently: if a named diagnostic needs it, extract the helper and relevant tests to that owner's maintained code before deleting the harness; otherwise retire both at the recorded revision. Preserve useful observations beside the [executor evaluation record](../archive/implementation/codex-goal-executor.md). Existing executor/client/fencing tests remain. Retaining a live smoke command likewise requires a specific recurring purpose. |
| `controller-judgment/backoff.ts` (1) | Delete after comparing its two assertions with `src/app/core/tasks/controller.test.ts` and `app-task-retry.test.ts`, which already exercise early wakes and retry deadlines. Retain its original finding in the controller evidence. |
| `controller-judgment/run.ts`, `controller-judgment/development.json`, `controller-judgment/transfer.json` (3) | Retire the early judgment-only harness and its scenario files. Preserve baseline/transfer findings, the experimental contract and its limitations in the existing controller record. Keep answer/failure admission regressions in their production suites. |
| `controller-judgment/continuing-failure.ts` (1) | Retire the completed direct-agent continuation experiment. Preserve evidence that failure, repair and retry answered the original input after reopen. Keep durable retry and exact-result regressions in the existing Task suites. |
| `controller-judgment/managed-conversation.ts` (1) | Retire the completed live fault trial. Confirm retained runtime/process tests cover the promised input/effect/result guarantees; move any distinct mechanical regression to its owning suite. Record that this experiment used managed in-process execution. |
| `controller-judgment/shared-loop.ts` (1) | Remove from main after preserving its exact source and completed nested, correction, withdrawal and repair evidence. Active caller-feedback/cost questions can continue on their experimental branch. Retain production worker/Conversation tests; deterministic tests do not replace the historical evidence of model judgment. |
| `controller-judgment/README.md` (1) | Incorporate only missing findings, limits and reproduction references into the existing controller documents, then delete. Archive completed history without marking open caller-feedback work complete. |
| `conversation-adoption.ts`, `conversation-adoption-tools.ts`, `conversation-adoption.test.ts` (3) | Retire the live teaching trial after preserving its report. Its test currently invokes the same harness for a real no-model daemon preflight, so deletion requires a coverage change: retain useful successful/rejected reload and correlation checks in `test/e2e/e5-agent-reload.test.ts` or a focused sibling, with fixtures under `test/e2e/`. Compare `src/app/app-source-release.test.ts` first. Delete checks that protect only discarded experimental helpers; preserve cleanup for retained subprocess fixtures. |
| `conversation-adoption.README.md` (1) | Consolidate useful usage/evidence into the existing conversation-adoption record, retain source references, then delete. The fixture source tool is not promoted into a production improvement capability. |
| `task-state-cutover.ts`, `task-runtime-cutover.ts` (2) | Keep temporarily as named upgrade-verification tools under `scripts/migrations/`, while the prior-lifecycle upgrade remains supported. Document the supported old revision, candidate revision and temporary-state prerequisites in the existing operations/test guides. Retire them when that upgrade is deliberately retired; absence of recent use alone does not establish that point. |

This disposition removes the catch-all folder while retaining four compatibility
files and two migration tools as supported commands/support files. Any retained
reload fixture/test code belongs with the behavior it verifies; other helpers
can be extracted under the reuse criteria above. The exact net deletion depends
on coverage and identified reuse; there is no line-count target.

## Six additions to the PoC inventory in refreshed main

These are additional PoC files, not additional root-level commands:

| Files under `scripts/poc/` | Disposition |
| --- | --- |
| `agent-operated-improvement.ts`, `agent-operated-improvement.test.ts`, `agent-operated-improvement.README.md`, `tsconfig.agent-operated.json` (4) | Retire together. Preserve the bounded trials, holdout limits and failures in the existing agent-operated record. The exact scoring/retry-tool tests protect this discarded harness, not a production improvement service. The extracted daemon regression retains real activation coverage. |
| `task-improvement.ts`, `task-improvement.README.md` (2) | Retire together. Preserve same-Task wait/reopen, owner cancellation and successful owner-closure evidence. Existing Task state, runtime, worker and execution-preparation tests remain; the fixture-only activation-window validator is not promoted into core. |

The trial exposed name-based replacement of standard `read`/`write` tools during
preparation. Its fix used explicit fixture tool names, not a new production
permission model. The recorded limitation and production preparation tests
remain; copying the full synthetic improvement App would preserve the PoC under
another name. There is no new installed improvement capability in this cleanup.

## Disposition of the other 27 files (root level)

Paths below are relative to Host `scripts/`. These files comprise 17 executable
commands/helpers, eight tests, one HTML utility and one guide. They are not all
experiments, and a manually invoked utility need not have an automated caller
to be worth maintaining.

| Files | Purpose and evidence of use | Proposed disposition |
| --- | --- | --- |
| `README.md` (1) | Entry point for script purposes, invocation boundaries and compatibility consumers | Keep as the command guide. List purpose, usage, inputs/outputs, prerequisites, effects and owning guide for maintained commands. Correct the benchmark and event-check classifications described below. |
| `build-image.sh`, `build-runtime-binary.ts`, `build-webui.ts`, `build-webui.test.ts` (4) | Package `build`, `bundle` and `ui:sync`; binary/UI artifacts used by image and deployment paths | Keep in Host `scripts/`, including the portable UI test. Document that the current default UI target is sibling `platform/ui` and is replaced recursively. Propose a repository-local build output by default, with explicit staging by callers that need the served UI; update those callers and tests together. |
| `ci-container-needed.sh`, `ci-container-needed.test.ts`, `ci-container-smoke.sh`, `ci-config.test.ts` (4) | `.github/workflows/ci.yml` selects container builds and verifies a disposable candidate image; tests protect the CI contract | Keep together in Host `scripts/`. Update protocol-gate references when it leaves `poc/`. These checks remain part of source/image verification. |
| `check-canonical-app-boundary.ts` (1) | `check:ci` and `verify:apps-artifact` reject retired authoring contracts | Keep as a supported Host compatibility gate. Document optional App-root scanning; a Host-only scan does not cover sibling consumers. |
| `verify-app-artifact-compatibility.ts`, `verify-app-artifact-compatibility.test.ts` (2) | `verify:apps-artifact` loads supplied App definitions against an explicit SDK artifact; portable fixture test | Keep in Host `scripts/`. Preserve explicit App/SDK roots and temporary bundle-cache cleanup. |
| `eslint-config.test.ts`, `publication-privacy.test.ts` (2) | Default test command checks import boundaries and publication configuration | Keep as repository-tooling tests. They do not need executable wrappers or relocation just because they are tests in `scripts/`. |
| `deploy.sh`, `deploy-receipt.ts`, `deploy-receipt.test.ts`, `restarter-ui.test.ts` (4) | `bun run deploy` builds/stages a release and correlates restart receipts; tests cover receipt handling and activation/rollback | Keep as maintained Host release tooling with its tests. Deployment ownership remains the Host Operations App under the [Host/App contract](../2a-design/system-boundary.md). Repair target validation separately as described below. |
| `event-graph-check.ts` (1) | Host and workspace `check:event-graph` inspect trace integrity and optionally backfill it | Keep as a diagnostic, but fix the check-only database-open path. It currently defaults to `/app/.state` and calls schema-initializing `getDb()` even without `--backfill`; it is not a portable source-only check. |
| `sample-runtime-quiet.ts` (1) | `sample:runtime-quiet` and the [operations manual](../2b-manual/app-operations-recovery.md) measure idle CPU/memory with work-activity checks | Keep as an installed-runtime diagnostic. Document socket, state root, Linux `/proc` dependency and exit code 2 for an invalid quiet window. It uses read-only SQLite but requires a running daemon. |
| `benchmark-human-task-interface.ts` (1) | [Task interface evidence](../archive/decisions/task-focused-shared-human-interface.md) records its 20,000-row synthetic performance check | Keep as a repeatable Host benchmark. It uses an in-memory database and no model or live installation; correct the script guide accordingly. Keep machine-sensitive latency thresholds in explicit benchmark use unless a controlled CI runner is chosen. |
| `log-viewer.html` (1) | Manual browser utility for opening JSONL files; currently listed in the script guide | Keep as an offline developer utility if a sanitized representative log confirms the supported format. Document that format and an example. If it only reads retired logs and has no historical-debugging use, preserve that fact and retire it; do not move it into production WebUI merely because it is HTML. Current-format compatibility remains to be verified. |
| `smoke-steering.ts` (1) | Package `smoke:steering` probes a running HTTP service and changes a metric threshold | Replace overlapping checks with portable HTTP integration fixtures; compare current routes and existing tests before removal. Retain a small disposable-installation smoke command only if it catches a distinct deployment problem. Remove the package entry if retired. Its current live-state assumptions do not justify retaining the whole script. |
| `gym-run.sh`, `gym-baseline.sh`, `gym-batch.sh`, `gym-record.ts` (4) | Sibling Gym benchmark calls the baseline wrapper; coach workflows call the batch wrapper; wrappers depend on runner/recorder | Keep temporarily as compatibility entry points. Put general scenario/batch execution in the owning Gym project and App-specific recording/invocation with its owning App. Agree the result/storage contract and update both consumers before removing Host wrappers. Fix result reporting independently of that move. |

The Gym consumers are concrete:
[alignment benchmark](../../../gym/benchmarks/may-alignment/run.sh) and
[coach helper](../../agents/coach/workflows/gym-helpers.ts). The recorder also
derives its database path from its source location and duplicates table setup.
A file move must not silently create a new result database or strand old runs.
Choose the existing authoritative recording path and keep history accessible;
do not create another Host schema as part of directory cleanup.

### Correctness fixes for retained commands

The source review found three defects, reproduced before this proposal. Keep
their fixes independently reviewable from renames and PoC deletion:

| Finding | Required behavior and focused verification |
| --- | --- |
| Deployment target validation accepts an existing closed/cancelled Task because it checks presence only | Validate that the exact Host Operations Task can still accept the deployment result. Exercise real open, closed, cancelled, missing and wrong-App fixtures against the current Task contract; retain receipt/restart tests. |
| Gym baseline can report `{passed:false, checks:[]}` as PASS and exits zero after reported failures | Preserve explicit failure, treat absent/invalid results as errors, and propagate an unsuccessful batch exit status. Use stub runner/recorder fixtures, including failing and empty-check results; no model calls are needed. |
| Event integrity checking can initialize/migrate the selected database without `--backfill` | Open an existing database read-only for inspection and fail clearly on a missing/incompatible database. Keep repair/backfill an explicit write operation. Verify the check path leaves a temporary fixture unchanged and never creates missing state. |

The UI build output change is a separate proposed behavior change, supported by
the observed recursive replacement of its default target. Verify isolated build
output and explicit deployment staging together. Moving files alone addresses
none of these behaviors.

## Implementation sequence

1. **Preserve knowledge and identify current authority.** Complete missing
   evidence/revision references and distinguish accepted contracts, historical
   observations and pending changes. Fix relevant stale status text when moving
   a record. Leave unrelated documentation reorganizations separate.
2. **Extract the maintained pieces.** Identify reusable helpers and their
   consumers; extract them to the homes above before removing their harnesses.
   Move the protocol gate and migration tools; retain the smallest useful daemon
   regression coverage. Update Host
   `package.json`, `scripts/ci-container-smoke.sh`, script/test guides,
   `CONTRIBUTING.md`, executor documentation and App-document links as applicable.
   Recheck path-dependent subprocess and dynamically loaded fixture references.
3. **Delete completed experimental code.** Remove the remaining inventory once
   its evidence, distinct regression coverage and useful reusable helpers have
   an identified home.
   Preserve open experiment branches and ensure they do not reintroduce the
   collection when rebased or merged. Remove obsolete harness-only tests too.
4. **Maintain the remaining commands.** Correct the command guide, address the
   retained-command defects in focused changes, and settle the viewer/smoke
   dispositions. Keep Gym compatibility until its consumers and recording path
   migrate together; its coordinated migration can follow PoC retirement.
5. **Verify the resulting supported surface.** Run the affected tests and
   required Host CI/image checks for the implementation PR. Verify moved migration
   tools with their documented old-source fixture before claiming they still
   work. Check design integrity, examples, local links and whitespace. Confirm
   no active command/import still depends on `scripts/poc/`.

These are checkpoints, not five required PRs. A removed script's historical
path may remain in a clearly versioned reproduction record. An instruction for
current-main use must resolve to a supported command. Source revisions and
historical results remain dated; a move does not create a new live-trial result.

## Review outcome and boundaries

The proposed cleanup is complete when every inventoried file has its reviewed
disposition, `scripts/poc/` is absent from main, supported commands, relevant
regressions and retained helpers still work, and a reader can find each useful
conclusion and its evidence without navigating obsolete executable experiments.
An explicitly retained compatibility wrapper counts as maintained code while
its coordinated migration remains pending.

The disposition review settles which scripts or helpers have recurring use and who owns
them; which teaching/steering checks add distinct coverage; the viewer's supported
format; the supported lifetime of the old-version cutover tools; and the Gym
migration/recording destination. Completed experiments default to retirement
after knowledge capture, with retained tests, commands or helpers for demonstrated
needs. Supported build, CI and operational tooling remains maintained.

This work changes no Task, learning, activation or approval contract. It keeps
the deployment-guard, Gym-scoring and writable event-check fixes independently
reviewable. No production state, raw evidence, deployment or source branches
are deleted. Retired source remains recoverable from Git.

## Implementation record

The candidate removes the full 27-file PoC collection: four protocol files now
live directly in `scripts/`, two supported prior-lifecycle verification tools
live in `scripts/migrations/`, and the remaining 21 files are deleted. No archive
copy is created. `smoke-steering.ts` and its package command are also removed.
The CI contract checks that the retired directory is absent.

The retirement review is [Host #174](https://github.com/hao1939/may-agent/pull/174),
initial head `b83873c6e63ec4df3448cb2b3d408549e2491154`, stacked on #172. It includes
the independently committed UI/viewer change `6c791b95` and the retirement
commit `b83873c6`. Relative to #172 it removes **4,590 net lines**; across both
PRs the Host diff removes **4,327 net lines**. Counts include tests/guides and
are not a claim about runtime performance.

Full local CI at that source passes **2,895 tests**, with three existing
installation-only skips and zero failures (145.28 seconds). The pinned CLI
protocol gate passes all 22 schemas. Both upgrade tools pass against the clean
old source below with a clean candidate checkout. The 20,000-row synthetic
benchmark passes its latency budgets. Canonical design integrity, executable
SDK examples, App checks, reference scans and whitespace checks pass. Hosted
retirement checks and review remain tracked on the PR; nothing is deployed.

The initial safety change is [Host #172](https://github.com/hao1939/may-agent/pull/172),
commit `a7d6f5fa3a48f2e128db802f41f466ae26d5c879`. Full local CI passes:
2,904 tests, three existing installation-only skips, zero failures. GitHub
Quality and Container also pass at that revision. No deployment or model calls.

The retirement candidate adds a small real daemon/socket regression rather than
the teaching harness: commit is not activation; the exact successful reload is
observed; invalid committed source produces a different failed operation and
leaves the active commit/configuration unchanged. Runtime Task/retry/Condition,
owner closure, worker and preparation suites remain intact. Portable HTTP
fixtures retain steering validation; the existing daemon-event test retains
actual threshold application. The offline viewer is verified with messages
written by the current persistence implementation, including string user input.

UI build output defaults to ignored `bundle/platform-ui`, not a sibling served
directory. Tests verify default and explicit staging, stale-output replacement
and an untouched sibling installation. Deployment already supplies an explicit
staging target; its receipt/restarter tests remain. Script documentation now
separates source checks, synthetic benchmarks, installed diagnostics, build and
state-changing operations, including the viewer's format and memory limitations.

Both moved upgrade tools target the clean old-source fixture
`a8f6518855aa5f85a697468665269124dda30479`, not arbitrary historical versions.
The state-only trial passes. The daemon trial initially exposed a stale import
of the retired inbox claim API. It now calls the **old source's** write guard
against converted state, proving that the actual former writer is fenced.
The temporary old-daemon → candidate trial passes: four old processes stopped,
the original reply retained once, unfinished input continued, measurement 17
preserved, old supervisor retired, and fresh input accepted on the same Task.
Four local scripted-provider calls; zero real model calls. These are verification
tools, not supported installed-data migration commands or rollback guarantees.

### Review refinements

The current safety head is `38fe696bbb5849ea5bdc725314bfa26427de33a5`.
It rejects mismatched scenario/agent identities and missing/empty check names
before invoking the Gym recorder, with four additional no-write regressions.
Deployment revalidates its Task after the build and before requesting restart.
That reduces the long build window; it does not hold a lease or replace normal
Host admission fencing. Full local CI: **2,908 passed, three installation-only
skips, zero failures**. GitHub Quality and Container pass. #172 is ready for review.

The reviewed retirement code is `63e8ac222863eb65c54f90f2869655ba341627d7`.
The root README now describes repository-local UI staging, and the three owning
UI design pages distinguish build from deployment. A suggested double-escaping
defect was not present: only result text passed through `truncateStr`, so the
tool-name prefix needs its own escape. An added real-browser assertion verifies
the exact literal tool name as well as absence of injected markup.

The WAL review was resolved by clarifying the chosen guarantee: inspection does
not alter database rows/schema, initialize missing state or run migrations.
SQLite may create reader sidecars. Independently copying a live DB/WAL/SHM set
can race its writer; a coordinated snapshot or a zero-filesystem-write guarantee
is not introduced by this cleanup. The small explicit boundary remains documented.

All current review threads have replies and are resolved; Copilot was requested
again after each push. Both moved upgrade tools also pass at the clean current
retirement head. Relative to current #172, #174 removes **4,585 net lines**;
the combined Host change removes **4,303 net lines**. Full local CI on that code
passes **2,899 tests**, with three existing installation-only skips and zero
failures (160.92 seconds); Quality and Container pass too. The final docs-only
follow-up `4c66e70f` clarifies that `--limit` bounds backfill, not the integrity
scan; it changes no executable/test code. The draft preserves the integration
order below; no merge or deployment was performed.

### Knowledge and integration boundaries

All deleted main-branch source is reachable at the refreshed baseline above.
The evidence documents retain their **actual** trial Host/App revisions and
sanitized observations; the baseline is an archive reference, not a new claim
that all model trials ran on #167. Historical invocations below those records
are explicitly version-bound. Raw transcripts and credentials remain private.
No paid trial was rerun merely for retirement.

Active caller-feedback work remains on `poc/caller-feedback-wait-20260912`
([#169](https://github.com/hao1939/may-agent/pull/169)). Its reviewed harness
checkpoint `2433b88c` is retained. Land that runtime work before retirement, or
rebase it to keep the harness only on its experiment branch while landing its
production changes/tests. Do not resolve delete/modify conflicts by restoring
`scripts/poc/`. The draft Task contract/facts/execution-path changes (#168, #170,
#171) also need to retain this boundary. No active branch/worktree is removed.

Gym's four compatibility wrappers and its existing result database deliberately
stay in place. Coordinated consumer/storage migration remains a follow-up, not
a reason to retain `scripts/poc/`. The baseline-report fix does not certify every
batch-runner behavior: the separate batch wrapper still needs a focused review
of verdict inference and error propagation before using it as an automated gate.

Proposal validation on September 12: all 48 files match the pinned Host tree
exactly once; local links and proposal anchors resolve; whitespace checks pass.
`bun run check:may-design` passes design integrity, executable SDK examples and
canonical App checks. The earlier review's 55 passing focused tests used a
temporary frozen dependency install; they are baseline evidence, not validation
of the proposed deletions.
