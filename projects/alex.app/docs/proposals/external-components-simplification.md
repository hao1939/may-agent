# External components: simple, solid, and clearly organized

**Supports:** [Host And App Boundary](../2a-design/system-boundary.md). Repairs specific responsiveness and clarity gaps without expanding every external component.

**Choice basis:** [Applicable philosophy and convention](../1-principles/core-principles.md#one-authority-for-each-resource); [compare competing choices](../1-principles/core-principles.md#resolve-conflicting-designs).

**Design status:** First milestone accepted for implementation; follow-ups remain
conditional.
**Implementation status:** The Scout fix and owning documentation are integrated
into the App workspace's `main`. Host #132 and #133 merged as `23968acd` and
`39a23f22`; the three source fixes are complete. See
[candidate evidence](#candidate-evidence). No deployment or live provider trial
was performed as part of this milestone.

**November 12 feature reduction:** The user selected retirement of the legacy
Learning dashboard in [Host PR 457](https://github.com/hao1939/may-agent/pull/457),
merged as `a84c6918ed40`. Both main/project Learning tabs and `/api/learning` are removed;
exact session history and saved-note reads remain. HTTP review-generation and
comment writes were already retired before this change. The historical table
below must not be used to reopen that completed removal. The
[retirement record](../archive/reviews/learning-dashboard-retirement-20261112.md)
owns scope and checks. Source removal is complete; installed adoption is unverified.

**November 12 project-history reduction:** The user also selected retirement
of the project Lineage tab and `/api/projects/lineage` aggregate in
[Host PR 458](https://github.com/hao1939/may-agent/pull/458), merged as
`2a762206dd52`. Installed adoption is unverified. The
[retirement record](../archive/reviews/project-lineage-retirement-20261112.md)
records the merged removal, the deliberately lost combined timeline
and inline summaries, retained Sessions/exact evidence reads, and verification.
This removes a view; it does not change session ancestry or Task execution.

## Goal and stopping point

Keep ordinary conversation and authorized work responsive and understandable
at an acceptable total cost. Improve external components only where the change
serves that outcome. Follow the [value/cost rules](../1-principles/design-philosophy.md#how-to-decide-a-tradeoff)
and [core principles](../1-principles/core-principles.md): start with a simpler
contract, then use the smallest implementation that is robust enough.

The first milestone is three focused corrections: misleading guard wording,
a blocking credential probe, and unbounded Telegram requests. Stop after their
checks pass. The remaining findings are choices for later work, not promised
phases of a seven-part refactor. A known architectural gap can remain documented
when fixing it costs more than its current consequences.

The [system simplification review](authority-boundary-simplification.md#design-choices-before-code-moves)
now compares feature/path reductions before broader organization work. This page
retains ownership of the external decisions below, especially evaluation UI scope.
The later [observer feedback proposal](observer-feedback-and-resource-conventions.md)
owns the separately reproduced checkpoint-before-publication gap and a first
convention-based provider integration. It does not reopen general observer
cancellation or precise restart recovery from this milestone.

## Retire Host path and read heuristics

**Design status:** Accepted on November 13, 2026.
**Implementation status:** [Host PR 470](https://github.com/hao1939/may-agent/pull/470)
merged as `c5b9b9a70f47` on November 13, 2026. Source removal is complete;
installed adoption remains unverified. Its tree matches tested head `ac3b2770edda`.
This supersedes the earlier guard wording-only choice below.

The user prioritizes internal complexity over line count. Remove three default
Host detectors without building replacements:

- `path-hallucination`: assumes home-directory prefixes cannot exist and carries
  exceptions for search commands and inline scripts. The generic Host cannot
  make that installation assumption; even a shell string argument can match.
- `read-dedup`: tracks counts by path and thresholds, ignoring which page was
  read and whether the file changed. Following the read tool's own pagination
  instructions can trigger its warning.
- `session-read`: classifies transcript access using file names and shell
  patterns, ignoring bounded `read()` ranges and some output limiters.

These rules were responses to historical cost/path incidents. At reviewed Host
baseline `b7db445b62b9`, all three return `block: false`. The Pi runner proceeds
without injecting the reason, while the Host records `guard.triggered` with a
warning label. They provide diagnostics, not enforced loop prevention or path
protection. Removing them gives up those automatic signals; it does not prove
that agent quality or model-token cost improves.

The gain is fewer assumptions, mutable counters, threshold decisions and shell
exceptions in shared execution preparation. Keep ordinary filesystem errors,
read/Bash output limits, cancellation, declared file-write permissions,
required-result validation and App Task acceptance. Truncation limits each
response; a sequence of wasteful calls can still consume the execution budget.
Keep the existing finish and commit diagnostics in this slice (later retired in
#471 and #512). Saved tool evidence and historical guard events remain readable.
No migration, runtime toggle or replacement detector is needed.

Verification should exercise supported pagination and refreshed transcript reads
through shared execution preparation, confirm retained diagnostics still report,
and run the Host's required portable checks. Use synthetic files and shell
arguments, without provider calls or installation state. Documentation can land
first with candidate status; the Host PR changes no App SDK or event schema.

Premerge verification: full local `MAY_TEST_SHARDS=4 bun run ci` passed at
`e5a3dbcbbb52`: 4,040 passed, zero failures, three installation-only skips across
350 files. The later test-only revision registers and executes the Bash
capability in the new regression; its 61 preparation tests and `check:ci` passed.
The initial 184 focused tests across eight files also covered retained finish
diagnostics, file permissions, lifecycle and Bash limits. App
`check:may-design` passed with zero errors and one existing root-layout warning.
[GitHub Quality and Container](https://github.com/hao1939/may-agent/actions/runs/43266856883)
both passed on final head `ac3b2770edda`; automated review approved with no open
issues. These checks do not establish installed behavior.

Unused legacy dashboard HTTP API retirement (`/api/stats`, `/api/agents/activity`,
`/api/agents/timeline`, `/api/agents/health`, `/api/agents/:name/detail`) was
subsequently completed in [Host PR 474](https://github.com/hao1939/may-agent/pull/474)
(`cd29dc70d9`). The remaining unused `extractHallucinatedRelPath` helper and
legacy `memory-sanitizer.ts` file-write regex filter were retired in
[Host PR 479](https://github.com/hao1939/may-agent/pull/479) (`9149a60268`).
Telegram boundary decoupling and `SurfaceSession` unification landed in
[Host PR 468](https://github.com/hao1939/may-agent/pull/468) (`07148372f9`).

## Retire default tool completion diagnostics

**Design status:** Accepted on November 13, 2026.
**Implementation status:** [Host PR 471](https://github.com/hao1939/may-agent/pull/471)
merged as `e5f373cc459d` on November 13, 2026. Source removal is complete;
installed adoption remains unverified. Its tree matches tested head `c92f7eea5a87`.
This extends the completed path/read reduction without reopening its merged scope.

Simplify the completion boundary by retiring the two remaining default Host
detectors: `finish-evidence` and `commit`. Remove their composition, context
conversion, naming wrappers, and internal `onGuard` callback/event plumbing.
Keep the Pi completion hooks that fence later calls after an accepted finish.
There is no replacement detector, configuration option or new review service.

At reviewed baseline `c5b9b9a70f47`, both detectors return `block: false` and
only record a signal. They neither reject completion nor inject guidance into
the model. The finish detector treats tool names and shell patterns as write
activity, including failed write calls, while missing some scripted writes.
The commit detector runs Git status at completion and carries repository-layout
fallbacks, path aliases, generated-file exceptions, and inferred write ownership.
These are diagnostic heuristics, not concrete acceptance or permission checks.

The gain is removing a whole default diagnostic path and its assumptions from
shared execution preparation. The deliberate loss is automatic tool events for
suspected missing write activity and uncommitted source. Do not claim improved
model quality, lower token cost or measured completion latency from deletion.

Required result/schema validation, caller admission, missing-deliverable
rejection, the accepted-finish fence, file-write permissions, execution budgets
and cancellation remain. Apps own their acceptance criteria, including verified
or committed source when required. The former `WorkflowGuard` callback directory
(`guards/*.ts`) was subsequently retired in Host PR #512 (`68aae4963b`) in favor
of declarative `inputSchema` / `outputSchema` validation on the shared invocation
kernel and explicit TypeScript verification helpers.
Historical tool events and the shared `guard.triggered` schema remain readable.

The scoped current App and Host source search found no App consumers of the
retired callback or detector IDs. One App repository workflow independently
checks dirty source; it does not depend on the Host detector. No App runtime or
SDK event-schema migration is needed. Docs may land first with candidate status.

Verification uses existing completion and mixed-batch/queued-input fixtures,
invalid-schema and caller-admission correction, missing-file rejection, concrete
file permissions, workflow guard events and historical HTTP evidence reads.
The updated completion regression reports an existing deliverable in a temporary
dirty Git repository without writing or committing it. Full Host CI and the App
design checks own validation; use synthetic files/processes without provider
calls, installation state or a deployment.

Premerge verification: full local `MAY_TEST_SHARDS=4 bun run ci` passed at
`c92f7eea5a87`: 3,956 passed, zero failures, three installation-only skips across
346 files. The focused run also passed 130 tests across eight files. App
`check:may-design` passed with zero errors and one existing root-layout warning.
[GitHub Quality and Container](https://github.com/hao1939/may-agent/actions/runs/43269824030)
both passed on that final head. These checks do not establish installed behavior.

## Retire automatic lesson file writes

**Design status:** Accepted on November 13, 2026.
**Implementation status:** [Host PR #473](https://github.com/hao1939/may-agent/pull/473)
merged on November 13, 2026, as `8733fde81dae06e8708897f36d3b69aade204141`.
The premerge reviewed head was `80433bc370c50a0e44b8bf7def62826906cb4352`,
including Host main `0c7b0adb07`. Installed adoption remains unverified.

Keep completion focused on validating and returning its report. Retire the
finish tool's automatic append to `.state/memory-stream.jsonl`, along with its
memory-directory selection, swallowed write errors, and the now-unused `agentName`,
`persistDir` and `requestId` construction options. `FinishToolOptions` needs only
`projectRoot` for deliverable validation; current Host constructors adopt it.
The `lessons` report field and its accepted shape remain.

At reviewed Host baseline `07148372f9`, finish copied reported lessons into a
separate local file as well as returning them in its report. The reviewed Host
and scoped App source search found no reader for that stream. Saved completion
arguments/results already retain lessons, including after hosted execution and
session recovery. The append could fail silently and did not activate guidance.

The gain is one less storage path and a completion tool with no memory-writing
responsibility. The deliberate loss is the automatically collected standalone
lesson stream; outside scripts reading it stop receiving new entries. Existing
files are preserved, and no migration, cleanup job, replacement collector or
runtime toggle is introduced. No model-quality, performance or token-saving
claim follows from this source reduction.

Lesson reporting and returned/saved execution evidence remain. Apps still own
review and adoption through their current learning workflow and authorized
guidance edits. Result validation, deliverable checks, accepted-finish fencing,
execution limits and Task acceptance remain. Prompt/schema work stays separate;
only the lesson description changes to match the retired write behavior.

The constructor option removal changes the Host library source contract;
custom source callers must drop those retired options. The App recovery test
and historical May development trial import that factory directly; their
constructors are updated alongside the documentation. No App production caller
or lesson-stream reader was found in the scoped source search. No public SDK or
event schema change is required. Companion docs and constructors landed in Apps
main `b0aacaf1680f1feca0e6d9959d553cceb21fecc8` before the Host source merge.
The source-coupled recovery test and trial constructors were verified with the
premerge reviewed head; use the merged Host source or a descendant containing
it for their typed factory contract. They introduce no production App dependency.

Verification updates the existing lesson-report cases to cover absent/empty
state directories and an unchanged historical stream, and extracts lessons from
a managed helper's saved transcript. A separate `result.json` is not created
for every helper; use the existing completion extractor over saved messages.
Existing validation, invocation fencing, direct execution and recovery tests
remain. Use synthetic files without inspecting or
modifying installation state; the Host PR owns full CI and review evidence.

At the premerge reviewed head, Host type/SDK/boundary/lint checks and 194 focused
Host tests pass.
The paired App recovery suite passes all 12 cases, and `check:may-design` passes
with the existing unclassified `reports` root-layout warning. The initial full
local four-shard CI at `aaf85d817a` completed with 4,014 passes, five failures and
three installation-only skips. Failures were Task-admission/worker deadlines
and SQLite contention, including concurrent database initialization. The four
non-admission cases pass in a targeted comparison with unchanged Host main;
the admission suite also passes separately. All five failed cases, plus the
error/recovery admission case, pass in a six-case run at the premerge reviewed head.
This diagnosis does not turn the initial full run into a pass. Premerge
[GitHub Quality and Container results](https://github.com/hao1939/may-agent/actions/runs/43376773442)
both pass at the referenced head. No installation or model-backed verification
was run.

## Retire per-agent latest checkpoint writes

**Design status:** Accepted on November 13, 2026.
**Implementation status:** [Host PR #478](https://github.com/hao1939/may-agent/pull/478)
merged on November 13, 2026, as `4195036ad3242003b1ff1e83f0c20edfade4b4c9`.
The premerge reviewed head was `694b4f490e07aa1f4dab52dfe335c84a1d2907f5`,
including Host main `0711ede840`. Installed adoption remains unverified.

At reviewed Host baseline `cd29dc70d9`, `checkpoint()` appended to the exact
session's checkpoint log, then overwrote
`.state/checkpoints/latest/<agentName>.json`. Both writes shared one error path.
If the second write failed, the tool reported failure despite a saved checkpoint.
The reviewed Host recovery readers use the session log and retained transcript
receipts. No current Host or scoped App source reader of the per-agent copy was
found. Historical design records describing that pointer remain evidence of
the earlier implementation. A synthetic baseline probe with a file blocking
the `latest` directory returns a checkpoint error while the session log already
contains one saved entry.

Remove the per-agent copy, its directory selection and creation, and its second
write from the tool. Keep `.state/checkpoints/<sessionId>.jsonl`, durable step
numbering, checkpoint attribution, report shape, session-bound recovery and
the existing transcript fallback. `readLatestCheckpoint` remains a per-session
reader; it does not read the retired per-agent file. `agentName` remains in the
tool options and entry because it records attribution.

The gain is one authoritative checkpoint log and one less write/failure path.
The deliberate loss is the automatically refreshed shortcut for locating an
agent's most recently saved checkpoint across sessions. External readers of
that shortcut receive no new entries. Existing files remain untouched. Users
can inspect an exact session's checkpoint log through existing reads; no new
index, locator, collector, compatibility toggle or migration is introduced.
No public SDK, event, model-facing parameter or checkpoint entry shape changes.
The selected change does not retire checkpointing or Task recovery.

Verification updates the existing checkpoint tests to cover an absent pointer
directory, a blocked historical path and an unchanged historical pointer.
Two sessions of one agent retain separate progress and attribution, and the
actual recovery evidence reader reads each saved entry. Existing tests cover
step continuation after process restart, failed log persistence and dynamic
identity. Session/Task recovery tests retain their current evidence, identity
and file/transcript precedence checks. Use temporary fixtures and record the
Host PR's exact head and CI evidence here; no installed-state cleanup is part
of this change.

At initial head `32c0e58be5`, 128 focused checkpoint/preparation/session-recovery
tests and three Task checkpoint recovery cases pass. `check:may-design` passes
with zero errors and the existing unclassified `reports` root-layout warning.
[Initial-head GitHub Quality and Container](https://github.com/hao1939/may-agent/actions/runs/43384510386)
both pass. Full local `MAY_TEST_SHARDS=4 bun run ci` also passes: 4,013 passes,
zero failures and three installation-only skips. The branch then integrated
the separate #477 source migration-tool retirement from main; the checkpoint
change remains the same. At combined head `694b4f490e`, the same 128 focused
tests and three Task recovery cases pass, and `check:may-design` passes with
the same existing warning.
[Combined-head GitHub Quality and Container](https://github.com/hao1939/may-agent/actions/runs/43385328475)
both pass. Full local `MAY_TEST_SHARDS=4 bun run ci` passes at the combined head:
3,851 passes, zero failures and three installation-only skips. No installed-state
or external model verification was run.

## Retire unused memoryLimit configuration

**Design status:** Adopted in merged Host source.
**Implementation status:** [Host PR 480](https://github.com/hao1939/may-agent/pull/480)
merged on November 13, 2026, as `28fc86fbedb93be1e7861614c4d96c53c4b3ed65`.
Its reviewed and tested head was `29bea281bb7a`, including baseline `9149a60268c2`.
The merge also includes the four documentation-only changes from #481; runtime
source and tests match the tested head. Source removal is complete.
Companion App config/manual changes are committed on workspace `main` at
`4af8ffde65e5`; installed adoption is unverified.

At reviewed Host baseline `4195036ad3`, `memoryLimit` exists in `AgentConfig`,
`SubagentDefinition` and the registry's serializable agent view. The loader
copies it into the definition and registry projection, but no current Host
execution or prompt reader uses it. The current manual already documents that
it has no effect. Several current App agent configs still supply the value,
which makes an ineffective option look supported.

Remove the field from those Host types and copy operations. Remove it from
current App config files and the supported-field manual table. Keep the
existing permissive JSON loader: older JSON carrying `memoryLimit` stays
loadable, but the constructed execution definition and new registry view omit
it. No alias, migration, replacement limit, special loader branch or runtime
toggle is introduced. Historical files and benchmark fixtures remain evidence.

The gain is fewer supported settings and less metadata plumbing for a value
with no runtime consumer. The deliberate loss is the unused typed option and
its appearance in newly projected registry metadata. Custom library-source
callers should drop it. No memory limit or working prompt behavior is lost:
compaction, skill discovery, supplied context and tool-output bounds retain
their current contracts. No public SDK or event-schema change is required.
This source reduction does not claim lower token use or better model quality.

The existing legacy-configuration loader regression now includes `memoryLimit`
and verifies that it loads through the real registry loader without propagating
the field while preserving compaction and the execution root. Existing registry
field tests retain their supported controls; stale fixture options are removed.
App config verification checks that only the unused field was removed and uses
the current source validator with synthetic model entries, without inspecting
credentials or running agents. Companion changes may land before Host source
because the removed option was already optional and ineffective at the reviewed
baseline. The Host PR owns full CI and current-head hosted checks; installed
adoption remains separate.

Premerge verification: at initial head `1a835b7b970d`, the focused loader,
registry and startup run passed 34 tests with zero failures and three
installation-only skips. The four App config edits change only `memoryLimit`;
the production validator accepts them with synthetic model entries. App
`check:may-design` passed with zero errors and one existing root-layout warning.
The first full local CI run passed static checks and 3,850 tests but failed one
unchanged nested-worker test: SQLite contention preceded an expected-event
timeout. The exact test passed in a subsequent isolated diagnostic run. This
failure remains part of the evidence. At combined head `29bea281bb7a`, full
local `MAY_TEST_SHARDS=4 bun run ci` passed static checks and 3,843 tests with
zero failures and three installation-only skips across 345 files, including
the previously failing nested-worker case.
[GitHub Quality and Container](https://github.com/hao1939/may-agent/actions/runs/43388791142)
both passed on that exact head. The integrated App docs check passed with zero
errors and the existing root-layout warning. No installation or external
provider trial ran.

## Remove the unused agent configuration projection: merged

**Design status:** Accepted and merged in [Host PR 484](https://github.com/hao1939/may-agent/pull/484) (`2aa4d508a4`), followed by [Host PR 488](https://github.com/hao1939/may-agent/pull/488) (`f884d387f3`).
**Implementation status:** Source implementation is merged on `main`; installed adoption remains separate.

Agent registration previously updated two in-memory owners: `SubagentManager`
kept the actual execution definition in its `agents` map, while `RegistryStore`
separately copied selected fields into an agent metadata map whose only read
path, `getRegistry()`, scanned session metadata directories and returned an
aggregate of both unrelated resources.

[Host PR 484](https://github.com/hao1939/may-agent/pull/484) (`2aa4d508a4`)
removes `PersistedAgentConfig`, `Registry`, `toPersistedConfig`, `saveAgent`,
`removeAgent` and `getRegistry()` from `RegistryStore` and `SubagentManager`,
keeps `SubagentManager.agents` as the single in-memory authority, suppresses
`[agents] Loaded ...` stdout log noise in `"manual"` worker subprocesses, removes
the unused `resumedFromRunId` workflow field, and stream-skips oversized
`item/*` notifications (`> 4 MiB`) in `CodexGoalAppServerClient` using structural
top-level JSON-RPC envelope validation (`OversizedNotificationScanner`) while
preserving the fail-closed 4 MiB limit for RPC responses, server requests and
turn/goal notifications.

[Host PR 488](https://github.com/hao1939/may-agent/pull/488) (`f884d387f3`,
following [Host PR 486](https://github.com/hao1939/may-agent/pull/486)
`cc4c2d78b2`) binds the `checkpoint` tool preset directly to the active agent
session context (`currentAgentSessionId(config.name) ?? getAgentSessionId(config.name)`),
removes the retired `ResumeDiagnostic` / resume-failover synthesis from
`execution-result.ts` and `loop-trace.ts` (preserving `message.delivery_failed`),
and prunes 14 retired zero-reference event union variants from `SystemEvent`.

## Project metadata reader: merged

The user selected this consolidation. [Host PR 460](https://github.com/hao1939/may-agent/pull/460)
shares project metadata parsing/discovery across the list, detail, session lookup
and agent counts, replacing the independently reproduced disagreements. Source
implementation merged as `bdaba7d0ee26`. Installed adoption is unverified.
Review corrections separate identity-only control lookup from strict display
reads and keep disappearing-file failures local to the affected listing record.

The [implementation record](../archive/reviews/shared-project-metadata-20261112.md)
retains the original findings, exact revisions, historical-tag compatibility and
checks. The [HTTP boundary](../2a-design/http-boundary.md#read-boundary) and
[project UI](../2a-design/webui.md#project-surface) own the contract. This needs no
new service, cache, migration or replacement dashboard.

## What changed after reviewing the plan

The user next selected retirement of the folded Overview "Legacy panels".
[Host PR 462](https://github.com/hao1939/may-agent/pull/462), merged as
`b7db445b62b9` on November 13, 2026, removes the old health summary/charts,
agent grid/drawer,
activity timeline, live feed and session statistics. Current Overview and
dedicated pages remain; session links use the current routed inspector. The
old aggregate evaluation summary, seven-day delegation totals and workspace
file list are deliberate losses, without replacement panels. The unused legacy
dashboard backend endpoints (`/api/stats`, `/api/agents/activity`,
`/api/agents/timeline`, `/api/agents/health` and `/api/agents/:name/detail`)
were then retired in [Host PR 474](https://github.com/hao1939/may-agent/pull/474)
(`cd29dc70d9`), and the inferred `/api/events/:id/graph` read model and SVG
renderer were retired in [Host PR 476](https://github.com/hao1939/may-agent/pull/476)
(`339ed72430`). Retained evidence and the shared WebSocket transport remain. See the
[retirement record](../archive/reviews/legacy-dashboard-retirement-20261112.md)
for source status and checks; installed adoption is unverified.
Direct-agent chat uses saved transcripts with separate submission and reader
ownership. This reduction is complete: 488 fewer runtime lines, using the
existing event journal for exact retry routing.

The previous draft treated all findings as required work. It proposed observer
cancellation/reload machinery before inspecting the real consumer, bundled
metric freshness with ownership migration, and preserved advanced evaluation
features without establishing their value. Its directory tree also risked
becoming a file-move checklist.

The narrower decisions are:

| Area | Smallest worthwhile choice | Capability or guarantee we can give up |
| --- | --- | --- |
| Guard | Default Host tool heuristics retired in #470 and #471 | Automatic tool signals for guessed paths, repeat/transcript reads, missing write activity and uncommitted source |
| Observer | Fix the actual blocking provider call first | No new general cancellation API, seamless hot replacement, or precise observation recovery |
| Telegram | Bound each request and cancel owned I/O on close | Delayed/missed display and occasional duplicates; no guaranteed delivery |
| Evaluation UI | Prefer viewing retained evidence; keep only operations the App actually supports | Automatic line-trail generation and inline feedback may be disabled instead of rebuilt |
| Metrics | Expose sample time to an existing consumer when needed | No automatic freshness classifier or mandatory catalog migration |
| Collection | Keep one collector; isolate a demonstrated failure at its existing boundary | Startup selection is sufficient; live removal is unnecessary |
| Layout | Document owners and move code when changing that responsibility | No repository-wide directory migration |

Preserve the consequences that matter: accepted asks and Task identity, honest
results, required action checks, and safe handling of committed external effects.
Duplicate presentation can be affordable; duplicate consequential actions may
not be. Removing a feature must preserve its retained data and expose its
unavailability. Revise the owning contract with a behavior change rather than
silently weakening it or treating every existing guarantee as permanent.

## Evidence and its limits

The original Host review examined `0d8c7658` and candidate `0b420287`.
The cited external code was unchanged at subsequently fetched `main` `765ce79c`.
The earlier **79 focused tests across 11 files** passed; synthetic probes showed
that a never-settling observer skips later scans, reload can start another call,
late facts are discarded after close, and metric reads omit sample time.
These facts do not establish incident frequency or prove that a general observer
framework would repay its cost. Source/PR baselines must be refreshed before
implementation; this is not a deployment audit.

The philosophy review followed actual source consumers:

- The App-declaration search found `scout-knowledge-lib.app`'s credential observer.
  Its `watchers/xhs-credential.ts` calls `inspectXhsCredential`, whose implementation
  in `agents/scout/tools/lib/xhs-credential.ts` uses `spawnSync` with a 30-second
  timeout. It runs through the Host observer callback. An asynchronous function
  around that call still blocks the Host; an AbortSignal alone cannot fix it.
- `transport/telegram-client.ts` awaits fetch without an explicit client deadline.
  The surrounding refresh queue retries on later wakes, not an automatic delivery
  backoff loop. The earlier plan overstated that existing capability.
- `src/lib/tools/read-dedup-guard.ts` counts reads but asserts unchanged content.
- Host Operations' `platform-owner-review.ts` uses `ctx.read.metric` in its review
  packet, providing a concrete potential consumer for sample time.
- The [evaluation trail contract](../2a-design/session-eval-trail.md) already records
  that the current Task does not produce the requested HTTP line trail. Preserving
  the UI feature would require more than moving code.

These are source findings, not a census of live usage. Do not call providers,
inspect live credentials, or build a usage-measurement system to complete this
planning exercise.

## First milestone

### 1. Correct misleading guard guidance

This historical first-milestone correction is complete. The later
[selected retirement](#retire-host-path-and-read-heuristics) supersedes keeping
the detector; it does not reopen the original milestone.

Remove the claim that file content has not changed. Keep the observed read count
and advisory meaning in `src/lib/tools/read-dedup-guard.ts`. Do not add hashing,
watchers, or blocking behavior.

**Value/cost:** A tiny edit removes incorrect guidance from a shared execution
path. **Proof:** Run the existing guard tests and review the wording; no new
wording-only test suite is needed.

### 2. Make the existing credential probe nonblocking

Replace the synchronous subprocess with an ordinary bounded asynchronous call.
Keep the current 30-second provider budget and output interpretation initially;
await the result in the observer and its other caller, `scout-explore.ts`, and
update their typed dependencies together. Use synthetic subprocess fixtures.

Keep failure visible and preserve current credential/Condition semantics. A
missed observation can wait for the next ordinary scan. Check that the async
conversion does not make the probe's local cache or a late result override newer
evidence. Use a small local guard or defer a busy replacement if necessary;
do not expand this into a general observer lifecycle or reload redesign.
If safe replacement needs substantial coordination, support replacement after
settlement or restart and document that limitation.

**Value/cost:** This removes a concrete path that can occupy the Host event loop
for up to the provider timeout. It is narrower than adding an SDK signal and
tracking every observer generation. **Proof:** A pending fixture process leaves
an unrelated event-loop callback responsive; success, timeout, and late-result
cases preserve the existing result semantics. Run the affected observer and
workflow tests. Do not run the real credential probe to test the change.

The generic observer deadline/cancellation gap remains documented. Revisit it
when another asynchronous observer needs the same facility or an actual failure
justifies it. Never simulate cancellation by releasing a slot while unbounded
old work continues; a visible stop or delayed replacement is an acceptable limit.

### 3. Bound Telegram I/O without expanding delivery guarantees

Add client-owned cancellation and finite request deadlines in the existing
`telegram-client.ts`; connect them to the bot's existing close path. Start with
one ordinary-request default and a long-poll deadline above the existing
30-second server wait. Choose conservative constants from the current request
paths; the previous draft's exact values were not measured requirements.
Prevent further chunk sends and polling after close. Keep current controls,
provider message IDs, and confirmed-render tracking.

Restrict plain-text resend to confirmed formatting rejection; alternatively
send plain text where formatting adds little value. A timeout does not prove
that a message was not delivered. Keep the current wake-driven refresh behavior:
a later wake may retry an unconfirmed message and produce a duplicate. Without
a later wake, display may remain missing; the durable answer is still readable
through the existing Conversation surfaces. Do not add periodic retry, durable
delivery state, or a second queue to strengthen that promise.

**Value/cost:** Explicit bounds and cleanup improve a normal human channel with
little new state. **Proof:** Local network fixtures cover a stalled request,
long polling, close during I/O, and the distinction between formatting rejection
and uncertain timeout. Existing chunk, refresh, ordering, and Stop tests remain
the contract owners. Accepted input/actions retain their deduplication guarantees.
Update [Telegram notifications](../2a-design/telegram-notifications.md) with the
accepted display limitation; no layout extraction is required for this fix.

## Candidate evidence

Implementation started from Host `765ce79c` and App workspace `8cb0e2dc05`.
The shared checkouts remain on `main`; implementation uses isolated branches.

| Change | Source / review | Evidence |
| --- | --- | --- |
| Truthful guard guidance | [Host #132](https://github.com/hao1939/may-agent/pull/132), candidate `013b7226`, merged `23968acd` | Existing 8 guard tests and full local CI passed: 2,664 pass, 3 deployment-only skips |
| Nonblocking credential probe | App workspace `main`, source commit `2e1b713e09` | All 350 App tests passed, including parser-failure containment; syntax, types, changed-file formatting, projection, links and navigation thresholds passed; see the aggregate-check limitation below |
| Telegram request bounds and close | [Host #133](https://github.com/hao1939/may-agent/pull/133), candidate `280d06ad`, merged `39a23f22` | Focused network, input, refresh, multipart, Stop and integration checks passed; full local CI passed: 2,670 pass, 3 deployment-only skips |

Scout retains its 30-second budget and existing ready/unavailable interpretation.
A temporary marker in its existing cache fences stale results across separately
loaded modules; there is no observer registry or recovery loop. Its full
`bun run check` stops on pre-existing formatting in
`scripts/accepted-source-outputs.test.ts`; the remaining checks were run
individually. That unchanged file is outside this fix.

The first hosted Quality run for #132 timed out in the unchanged browser Stop
fixture while waiting for a diagnostic event. The fixture does not wait for
its WebSocket subscription before publishing. The test passed in local
isolation; the first failure is recorded in the PR and the failed job was
rerun once successfully. Quality and Container passed on both Host candidates.
The first failure remains recorded; the browser fixture still has a potential
subscription race. Check the PRs for later revisions and review results.

Tests use synthetic child processes and local network fixtures. No real XHS or
Telegram call, credential inspection, live App-state operation, restart or deployment
was used as validation. The App fix and Host fixes can land independently.
Workspace integration preserved later `main` documentation changes; the 38
affected Scout tests and `check:may-design` passed again before landing.
GitHub merge state was rechecked September 11, 2026. Both Host fixes are on remote
`main`; the canonical local checkout remains at `743aa5de`. Source integration
does not establish which runtime is deployed.

## Conditional follow-ups

These are alternatives to consider when the first milestone is complete. Each
needs an actual consumer or recurring failure; neither folder symmetry nor an
old backlog entry is enough.

| Finding | Default decision | Evidence that would justify more work |
| --- | --- | --- |
| HTTP owns evaluation instructions and feedback writes | Prefer a read-only trail view and disable unsupported write/generation controls together with their routes. Keep existing artifacts and supported App review operations | Regular use of inline/line-level review that cannot be served adequately by existing conversation/App tools |
| Metric reads omit sample time | If needed by the existing owner-review packet, add last-successful-sample time from retained snapshots; show unknown when unavailable | A consumer needs age to make a better decision; definition-update time must not stand in for sample time |
| Collector attachment is mixed with daemon setup | Keep the implementation; add a small composition/cleanup seam only when omission or failure containment requires it | A fixture demonstrates collector failure blocking unrelated startup/work, or a supported deployment needs collection omitted |
| Central domain metric definitions | Keep the gap visible. Retire unused/noisy metrics; migrate a measurement when its domain owner is changing it | Conflicting writers, repeated calibration problems, or a useful App change makes ownership separation worth the paired migration |
| Scattered executor files | Update the navigation map; group touched backend files in the next real backend change | Repeated edits cross unrelated responsibilities or cause import/wiring mistakes |

The evaluation recommendation is a proposed feature reduction, not an approved
removal or a claim that nobody uses it. Before changing it, inspect known callers
and explain the retained user path. Update the Host/UI and
[HTTP](../2a-design/http-boundary.md)/[evaluation](../2a-design/session-eval-trail.md)
contracts together. Retain historical reads and explicitly reject unavailable
operations; never report an unsaved comment as saved. If retaining the feature
is worthwhile, use the existing Evaluation App route and its state authority.
Do not prebuild a feedback journal, migration bridge, or new retry protocol.
This supersedes the mandatory paired migration in the earlier draft; the
[authority follow-up](authority-boundary-simplification.md#remaining-work) keeps
the underlying ownership gap visible.

Metric sample time, collector cleanup, and catalog ownership are separate
choices. Do not bundle them. Keep one snapshot cadence and the existing metric
service. A raw timestamp plus a clear unknown value may be enough; automated
freshness states and dedicated health storage need their own use. If a metric
migration proceeds, preserve useful history and meaning and remove the old
writer in the same cutover, following the
[ownership rule](design-implementation-convergence.md#remaining-metric-ownership-migration).

## Code organization without a move project

Use the [architecture](../2a-design/architecture.md) and this ownership map.
Existing names need not match the ideal immediately.

| Responsibility | Home for changes |
| --- | --- |
| Accepted work, state consistency, events | Existing core/state/runtime modules |
| Conversation policy and context | `src/app/core/state/conversations.ts` and `conversation-task-turns.ts` |
| Concrete executor, producer, reporting, discovery, workspace, maintenance implementations | Their existing `src/app/adapters/` families; flat implementations can stay until a useful extraction |
| Input/output transport | Existing `src/app/transport/` and `http/` files (`server.ts`, `session-routes.ts`, `agent-routes.ts`, `project-routes.ts`, `metric-knowledge-routes.ts`, `event-routes.ts`) |
| Concrete selection and lifecycle wiring | `src/app/composition/` and existing composition roots |
| Public contracts and human clients | Existing SDK, control, terminal, and Web UI packages |
| Domain probes, prompts, workflows, and acceptance | The owning `projects/<id>.app/` |

Move implementations and tests together only when doing so clarifies the change.
Keep ordinary calls for local reads/atomic operations and events for independent
consumers. No generic plugin interface, new service layer, empty folders, or
compatibility wrappers are needed. Discovery, schedules, workspaces, Console,
skills, and maintenance already have useful boundaries; keep them unless a
specific failure warrants change. Required recovery is not optional housekeeping.

## Review and verification

For each chosen change, state the useful outcome, smallest alternative, accepted
limitation, and focused proof. If it grows into new persistent state, multiple
coordination paths, or a cross-component migration, revisit the feature first.
This is a stopping rule for scope, not a new approval process for routine edits.

Use small independent PRs for cohesive fixes. Keep shared checkouts on `main`
and isolate source edits. Follow the relevant repository checks: affected
fixtures first, full Host `bun run ci` and current Quality/Container checks for
a Host PR, affected App tests for App changes, and `bun run check:may-design`
when contracts change. Pair Host/App revisions only when the actual change
crosses that boundary. Reuse existing regressions; do not add an exhaustive
optional-component matrix or model-backed trial for these mechanical fixes.

The milestone is complete when its three corrections have sufficient proof.
Do not continue through the conditional table automatically. Reliability can
come from dropping a feature, delaying an observation, using another existing
surface, or restarting a faulty optional capability. Additional automation must
repay its implementation, maintenance, compute, and human-attention cost over
its likely useful lifetime.
