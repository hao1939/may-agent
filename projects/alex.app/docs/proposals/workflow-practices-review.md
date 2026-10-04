# Workflow practices review

**Supports:** [Workflow Discovery And Execution](../2a-design/workflows.md). Reviews adoption of practical workflow conventions and distinguishes source changes from useful behavior.

**Choice basis:** [Applicable philosophy and convention](../1-principles/code-vs-data.md#composition-preserves-execution-rules); [compare competing choices](../1-principles/core-principles.md#resolve-conflicting-designs).

**Status:** In progress. This is a review and rollout checklist, not a claim
that all installed workflows follow the new practice.

## Outcome

Apply the useful lessons from the multi-worker experiment: isolated edits,
focused changes, verification of the actual candidate, clear PR ownership,
independent progress during external waits, and truthful integration status.
Keep read-only workflows and runtime observations lightweight. Prefer shared
agent guidance and existing Git/Host capabilities to another framework.

The operating contract is in
[workflow authoring](../2b-manual/workflow-authoring.md#repository-changes-and-integration).
Shared prompt guidance lives in `shared/common-sense.md` at the installation
root. Source inspected: installation baseline `26562145a4`, Host `v0.2.0`.
The separate `.disabled` change is Host PR #116; it does not repair workflows.

## Findings from the first pass

1. **Shared instructions contradict the current model.** They prescribe a
   retired `project` workflow, fire-and-forget forks, committing from `/app`,
   and continuing even after finite acceptance is met. Corrected in this
   branch. This affects all agent calls that load the shared prompt.
2. **Scout's source workflow writes and admits canonical paths.**
   `scout-explore.ts` builds prompts from `workspace.projectRoot` and
   `workspace.appRoot`, admits files only there, and checks for duplicates and
   overwritten primary sources after the agent has written. Simply telling
   the agent to use a different worktree would either reject its outputs or
   leave verification looking at the wrong files. Fix these as one boundary.
3. **Scout maintenance has the same shared-write contract.**
   `knowledge-planner.ts` grants editing canonical notes, reports and the daily
   digest. Its agent instructions also require those absolute paths. No branch,
   commit, review or integration evidence is required for a maintenance claim.
4. **The daily digest is shared runtime output, not source code.**
   `scout-daily-digest.ts` reads, emits, renames and resets `today.md`; source
   workers append there too. Review loss during concurrent append and retry
   between emission and reset. Do not solve this by putting one shared daily
   accumulator in independent Git worktrees. The current Telegram adapter
   renders shared Conversation messages; it does not consume the workflow's
   old `message.created` event addressed to `human`. "Sent" is therefore
   unsupported, and resetting after that publication can hide undelivered
   findings. Fix the routing and preservation boundary together; changing
   only the wording is insufficient. No live digest was triggered to test
   this known broken path.
5. **Library health should remain an observer.** `library-health.ts` reads the
   canonical library and records packets/metrics; it must not acquire an edit
   worktree just to inspect the library. Revisit the accepted-output metric
   when source work begins returning candidate files and commits: candidate
   creation is not integration into the canonical library. The old JSON-based
   output metric has now been retired (see local validation below); do not
   replace it unless current Task reads leave a useful measurement unmet.
6. **Verification must check the editor's checkout and terminal result.**
   `verified-coder.ts` runs its command at `workspace.root`, but does not put
   that explicit path in the coder prompt. It checks only `status === error`
   before proceeding, so blocked/interrupted calls can reach verification.
   A passing command alone cannot prove the requested change happened.
   This branch now supplies the explicit checkout on every attempt and stops
   before verification for every non-done agent result. Temporary-directory
   tests cover both boundaries; worktree allocation and integration remain open.

The Host already has task-generation worktree preparation, retained branch
identity and integration-aware cleanup (`src/app/adapters/workspaces/git.ts`).
It does not automatically merge a change. Current App declarations use local
workspaces; enabling Git mode needs real end-to-end proof, not just a flag.
In particular, the Scout domain directory belongs to the containing workspace
repository, while the Host project has its own Git repository. Preserve the
correct relative project path when allocating a checkout of either repository.

The remaining Scout isolation change needs one coherent result contract:

- Select task workspaces only for editing workflows; health and digest work
  can keep the existing shared-workspace mode. No second worktree manager is
  needed.
- Use the candidate's nested domain path for editing and validation. Treat
  canonical uncommitted research as separate current evidence, not silently
  committed candidate input.
- Inspect and verify the exact candidate diff before authorized integration.
  Refuse overlapping human edits rather than stashing, resetting or overwriting
  them. Keep the candidate and return the exact unresolved boundary.
- After integration, retain canonical file references plus the verified commit
  and repository-relative path. Temporary worktree paths alone are not durable
  result links: normal Host cleanup removes them.
- Append the shared digest's claim of integration only after integration is
  verified. Preserve candidate evidence separately while review remains open.

Disposable integration probes verified the separate-path and overlapping-edit
cases. This is not permission to merge live research automatically; the
workflow change and a narrowly authorized live integration are still open.

## One-by-one inventory

There are 24 top-level workflow entry modules under current App agent folders.
May uses direct conversational/Task handling and has no workflow module.
Archived workflows, test fixtures and `coach/workflows/gym-helpers.ts` are not
additional entrypoints. Helpers still belong to their callers' reviews.

Paths below are relative to `projects/<App>.app/agents/<agent>/workflows/`.
"Reviewed" means the boundary was inspected, not that its fixes are complete.

| App / agent | File | State / next check |
| --- | --- | --- |
| Scout / scout | `scout-explore.ts` | Reviewed; isolated writes, exact output admission, candidate vs integrated result |
| Scout / scout | `knowledge-planner.ts` | Reviewed; same write/verification boundary, preserve no-op path |
| Scout / scout | `scout-daily-digest.ts` | Reviewed; runtime output ownership, concurrent append and replay |
| Scout / scout | `library-health.ts` | Reviewed; retain observation-only behavior, truthful output metric |
| Host Operations / tech-lead | `verified-coder.ts` | Checkout prompt and terminal gate fixed; allocation/integration proof still open |
| Host Operations / tech-lead | `platform-owner-review.ts` | Queued; ownership, task steering, repair and deployment authority |
| Host Operations / tech-lead | `session-recovery.ts` | Queued; exact identity, safe redo, no duplicate effects |
| Host Operations / optimizer | `investigate-and-fix.ts` | Queued; candidate isolation, verification and integration |
| Host Operations / coach | `growth.ts` | Queued; bounded call and completion meaning |
| Host Operations / coach | `growth-cycle.ts` | Queued; lab/candidate isolation and promotion |
| Host Operations / coach | `training-sprint.ts` | Queued; trial evidence, focused patch and review |
| Gym / gym | `codex-learning-intake.ts` | Queued; evidence intake vs production mutation |
| Gym / gym | `learning-evidence-intake.ts` | Queued; authoritative evidence and replay |
| Gym / gym | `evaluation-intake.ts` | Queued; input ownership and duplicate admission |
| Gym / gym | `incident-intake.ts` | Queued; preserve source identity and existing work |
| Gym / gym | `review-and-propose.ts` | Queued; proposals vs applied changes |
| Gym / gym | `regression-run.ts` | Queued; immutable candidates, verification and side effects |
| Gym / gym | `improve-agent.ts` | Queued; overlays, benchmark truth, promotion and cleanup |
| Evaluation / evaluator | `evaluator-heartbeat.ts` | Queued; observation vs task creation |
| Evaluation / evaluator | `evaluator-deep-eval.ts` | Queued; bounded read-only review |
| Evaluation / evaluator | `evaluator-aftermath.ts` | Queued; findings and owner follow-through |
| Evaluation / evaluator | `project-health-evaluator.ts` | Queued; generated reports vs canonical source edits |
| Evaluation / evaluator | `evaluation-feedback-projection.ts` | Queued; generated feedback ownership and replay |
| Evaluation / evaluator | `executor-trial.ts` | Queued; isolated trial scope and evidence |

## Small rollout steps

1. Correct shared guidance and the authoring contract; do not claim this alone
   changes deterministic workflow behavior.
2. Make one Scout source cycle use an isolated candidate end to end, including
   path mapping, verification, branch evidence and integration. Use temporary
   Git fixtures first, then one authorized local live cycle. Keep no-op research
   cheap. Align the Scout agent's path instructions at the same time.
3. Apply that proven path to Scout maintenance. Separately check digest/runtime
   output behavior; do not introduce a second state service for it.
4. Review and refine every queued module in the table, in small commits. For
   each, decide: retain unchanged, improve guidance, fix a deterministic gap,
   or retire with evidence. Disabled Apps stay disabled during this work.

For each repaired workflow, record tests and a representative execution,
whether canonical files stayed untouched during the attempt, the exact
candidate revision verified, and what finally reached the target branch.
Preserve dirty/unmerged work on failure. Do not use a blanket auto-merge policy,
one global PR slot, extra goal per PR, or broad branch cleanup.

## Initial guidance-only verification

- 80 tests passed across the May/Scout App contracts, Scout's four workflows,
  and `verified-coder`, using the current Host SDK. The new verification tests
  use temporary directories and stub agent results, not live model calls.
- Design-document integrity and `git diff --check` passed.
- No App was enabled, no live Task ran, and no deployment was performed for
  this workflow review. Scout worktree integration remains unproved.

## Local May + Scout validation — September 10

The human subsequently authorized building and starting the local container,
with only May and Scout enabled. Dashboard work and disabled Apps remain out
of scope. Source fixes, successful admission, and observed execution are
recorded separately:

- **Task evidence:** Scout guidance no longer treats retired Task JSON files
  as live authority. The two existing projection-repair Tasks settled with
  explicit obsolete-acceptance explanations rather than recreating the old
  publisher. This is disposition of obsolete work, not regenerated output.
- **XHS wait:** the source workflow's old Condition omitted the required owner
  and review interval. The corrected result passes actual SDK admission and
  was accepted by the same live Task. After restart it remains waiting for
  the operator to open/sign in to Xiaohongshu in the container browser; the
  probe reports no XHS tab. No XHS research success is claimed.
- **May supervision:** Host PR #119 fixes exact peer-App reads from an isolated
  Task worker using the accepted App registry, without loading peer agents or
  controllers. The live May worker successfully read Scout's HN, XHS and
  maintenance Tasks and reconciled without duplicate work. Foreign list calls
  are rejected instead of silently returning local Tasks. Disabled Apps stay
  unavailable. The combined local image uses source `3b5ee146`; this is a
  candidate deployment including PR #116, not a new release.
- **Research:** GitHub, HN and arXiv produced source-grounded findings. Reddit
  recorded a grounded no-op, and maintenance added missing navigation links.
  These were observed results, but edits still used the shared checkout; they
  are not proof of isolated or reviewed integration.
- **Metric retirement:** the normal library-health workflow now retires the
  JSON-based output metric, preserving samples but removing its source command
  and threshold. A live run confirmed those fields and recorded 26 library
  facts without a redundant owner wake. The historical-analysis script now
  requires an explicit snapshot path. No App SQL or replacement collector was
  added. The 70 Scout tests, including the new regression, passed.
- **Host checks:** PR #119 Quality and Container checks passed; the combined
  deployment passed 2,633 tests with three installation-only skips. Only the
  two enabled Apps appeared in live control reads, which remained responsive
  during the bounded checks. This is not long-duration reliability proof.

Digest routing and preservation were subsequently repaired in `58972f68e7`.
The workflow preserves an immutable content snapshot, emits a retry-stable
message addressed to May, and clears only an unchanged accumulator. The normal
`digest-now` action uses the same Task as the schedule. Seventy-eight focused
tests passed; a temporary real-Host integration test with fake endpoints proved
replay produces one request/Conversation message. Local event 6318173 then
refined the existing digest Task (generation 2), and event 6318177 reached May.
The actual model produced a source-linked digest in about 22 seconds. A
Telegram mirror receipt was recorded; human receipt is not proven. Replaying
the operator action returned its original request, with no second handoff.

May's old recovery reviews repeatedly posted unchanged unavailable-App notices.
`3fc1493cd0` makes the existing quiet result explicit in App guidance and its
example: keep evidence on the Task, omit `result.conversation` for no material
change, and still answer human questions and report new blockers/dispositions.
This is agent guidance, not a new Host suppression rule; scheduled live
review 6318195 supplied the first live confirmation. It updated the same May
supervision Task to generation 5, read both exact linked Tasks, and converged
at 6318202 with no `result.conversation`. The latest Conversation message
remained the digest and no new Telegram mirror was recorded. Further cycles
are needed before treating that behavior as reliable over time.

A read-only recorder samples both Apps once a minute for 24 hours starting
September 10 at 08:29 UTC. It records results and failures, not autonomous
repairs. Scheduled recurrence, restart behavior and sustained resource use
remain observations to collect, not properties certified by a short run.

The old May routing-decision attention Task was subsequently reconciled through
exact comment 6318209, with no new infrastructure or manual state rewrite.
May found and this operator verified a retained Evaluation receipt showing the
same finding had already reached the declared `may-agent` / `tech-lead` owner.
Event 6318215 closed only that routing obligation; the underlying workflow
defect is not proved fixed. Both disabled Apps stayed disabled. May then had
zero attention Tasks.

Further failure-injection tests found that Scout exploration and maintenance
could accept structured partial output from a `blocked` agent call. Both tests
failed before the fix. Commit `a6a1fc2242` changes each gate to require `done`
before result admission or maintenance-event publication. Valid domain waits
returned by successful calls remain supported. Eighty-one focused tests and
the installation design checks passed. This failure was reproduced in tests,
not induced against live source access.

Still open: isolated Scout edits and integration; long-running digest recovery;
optional tool-loading warnings.
Preserve these as gaps rather than calling all workflows
healthy. Operator event identities and retained evidence are in the local
bootstrap record under `.state`, not in source snapshots of live Task state.

## Live conversation follow-through — September 10, 09:15–09:28 UTC

An operator-relayed conversation asked May to run and report one next bounded
HN cycle through Scout's existing `explore-hn` Task, without replacing its
standing research. Two real failures preceded success:

- The Host treated `done` as terminal without considering `mode: maintain`.
  May selected the correct Task three times, but no Scout cycle was admitted.
  Host commit `367df88d` fixes the conversational check, input attachment and
  state admission. Three regressions failed before the fix; tests cover the
  same Task generation, no duplicate cycle on replay, and rejection of truly
  completed one-off work. No second scheduler or Task type was introduced.
- The next retry failed because May included the focused Task in the accepted
  ask's links before the Host had linked it into the Conversation. Commit
  `f7231d69` clarifies the existing model contract: omit handoff `taskRefs` and
  name `followUp.requestId`; the Host links the actual admitted Task. This is
  guidance, not relaxed validation or an automatic repair loop.

Local candidate `7edd6d4c` combines those changes with the earlier `.disabled`
and peer-App-read fixes. The semantic-fix candidate passed 2,636 tests with
three installation-only skips; the final guidance delta passed 84 focused
tests and all type, SDK, boundary and lint checks. It is not an official release.

The uncoached retry at event 6318293 accepted an open Request, linked the exact
Scout Task, and started a real source cycle at generation 1. May's initial
review left healthy running work alone. Scout updated the existing evaluation
note and digest, checked primary sources and repaired its own relative-link
mistake. The operator independently checked the cited article and digest link;
the article's experiments were not independently reproduced.

Scout reconciled at 6318317. Its change event carried the open ask into May's
review; May returned the actual finding at 6318326 and closed the same Request
at revision 2 as fulfilled. A Telegram mirror receipt followed. The same HN
Task remained maintained, May created no proxy, and both protected file hashes
were unchanged. This manual next-cycle trial is not natural schedule recurrence
or proof of worktree isolation: Scout still edited the shared checkout.

The recorder saw one brief socket absence during the deliberate 09:21 container
recreation, not an unexplained daemon failure. Readiness passed after both
candidate deployments. Continue watching real scheduled reviews and source runs;
a background recorder alone does not constitute active review or iteration.

## Follow-up checks and shared-tool packaging — 09:30–09:42 UTC

The natural 09:30 May recovery review completed quietly, without repeating the
HN result or reopening its closed ask. A separate status-only question about
XHS produced a direct explanation and the exact browser/sign-in action, closed
its discussion Request, and created or woke no Task.

May's repeated `ssh-exec` loader warning was a real definition-packaging gap:
the agent imported `shared/tools/ssh-exec`, but snapshots omitted that directory.
Host commit `e9670ee2` includes optional shared tools in Git and filesystem
snapshots, checks their authored changes, and uses a new snapshot identity so
an older incomplete snapshot is not reused. Three tests failed before the fix;
loader tests prove the same helper version stays pinned with its agent. No
dynamic dependency resolver, whole-shared-directory copy, or plugin loader was
added.

The combined candidate `9b4cb3bd` passed 2,639 tests, three installation-only
skips, and all CI static checks. After local deployment, reload 6318356 completed
at 6318357 and the actual daemon logged successful loading of `ssh_exec`.
The operator tested loading only, not an SSH connection or command. May and
Scout were the only active Apps throughout.

Review also found that Scout's new note described 26 testing addenda rather
than 26 prompt conditions including the no-additional-instructions default.
Exact feedback 6318358 woke the existing `library-maintenance` Task. Scout
verified the primary source, corrected only the affected note passage, read it
back and reconciled at 6318369 under generation 1. This was handled by the
existing agent/workflow, with no new Task or infrastructure. Its research
and maintenance writes still use the shared checkout; isolation remains open.

## XHS access recovery and detail-reading guidance — 09:50–09:57 UTC

After the human requested opening Xiaohongshu in the local container browser,
the existing credential observer reported readable content at event 6318390.
It automatically woke the same `explore-xhs` Task at generation 1. The first
cycle updated two existing findings and the digest, converging at 6318400.
No manual retry, new Task, or changed schedule was needed for access recovery.

That cycle exposed a reasoning/context gap: it called detail bodies unavailable
without trying the existing browser detail reader. Exact feedback 6318405 gave
the same Task its executable usage. The next cycle successfully read the
TraceRoot post, distinguished product claims from independently tested facts,
corrected the notes and digest, and converged at 6318416. LoopX was correctly
left as not detail-inspected, rather than classified as inaccessible.

The permanent change is source-prompt guidance: show the existing command and
timeout, distinguish unread from failed reads, and keep access tokens out of
durable results. No new tool, retry loop, or mandatory deep-dive stage was
introduced. The prompt regression failed before the change; 37 focused
workflow, source, browser-helper, and observer tests then passed. Live feedback
demonstrates the guidance helps; it is not proof that every later cycle will
choose the best research topic. The 09:55 ready observation did not create a
second concurrent XHS execution.

## Natural source recurrence and queued display — 10:00 UTC

Unchanged schedules emitted HN and GitHub source events 6318428 and 6318429.
HN started at 6318434, converged at 6318447 with a new source-grounded update,
and GitHub started at 6318453 as soon as Scout's one execution lane was free.
May reviewed independently and returned the HN finding at 6318461 without
reopening the earlier closed Request. It inaccurately called this scheduled
cycle a retry; result attribution remains a guidance-quality observation.

While GitHub was queued, `/tasks` incorrectly said up to date: the stored row
had `phase=converged`, `changed=1`, and `ready=1`. Host candidate `ce474d27`
projects this as pending consistently in exact reads, lists, and status
filters. It does not alter Task state, admission, timing, or concurrency.
The regression failed before the change and covers quiet maintained Tasks,
changed-but-not-ready work, ready work, and terminal receipt precedence.
Source checks passed along with 63 Task/control and 25 transport/Console tests;
combined CI and deployment verification remain separate checks.

Combined local candidate `58a6b61c` subsequently passed 2,640 tests, three
installation-only skips, and all static checks, and was deployed at 10:07 UTC
after both source runs ended. Readiness and control checks passed; reopening
XHS restored readable content without another login. The queued case is covered
by its reproduced regression, not yet a second natural post-deployment queue.
The brief missing-tab startup observation produced a maintenance no-op, not
duplicate research or another human request. This remains a local candidate,
not a published release or proof of long-duration reliability.

## Continued observation and result attribution — 10:15 UTC

The natural recovery wake 6318497 completed at 6318505 with a quiet review of
the two previously unavailable linked Tasks. It emitted no Conversation
message, reopened no Request and did not enable another App. The original HN
ask remained fulfilled at revision 2.

Inspection of the 10:00 HN report confirmed a narrower communication defect:
May called scheduled research a retry, even though the original ask had already
closed. The current Task evidence established a new finding, not a new human
request. May guidance now distinguishes historical Conversation context from
the cause of current work. When the cause is unknown, report the finding
without guessing; useful ongoing research can still deserve an update.
No new event, lifecycle rule or suppression mechanism was added. The missing
guidance regression failed before the change; 67 May/Scout contract and
workflow tests passed afterward. Future model behavior still needs live proof.

## Manual source trial — 10:17–10:20 UTC

Two explicit `explore-now` actions (6318511, 6318512) tested HN and XHS without
changing schedules. HN ran first; XHS was correctly pending in human list and
status-filtered reads, with 2–4 ms sampled control latency. Both retained their
generation-1 Task identities. HN converged with a grounded no-op at 6318524;
XHS started less than a second later and converged at 6318548. The XHS agent
used the documented detail reader without extra feedback, read a HarnessEvolve
post, and updated the existing self-evolution note and digest. It attributed
the post's paper claims rather than claiming independent verification. The
operator checked the resulting note and digest link, not the paper's results.

The same live queue exposed an agent-read gap: `app.task.get` still returned
`done` for pending XHS work. A focused Host candidate uses the existing
`changed`/`ready` fields for exact and filtered read projections; stored phase,
accepted results, identity and scheduling remain unchanged. Its lifecycle
regression failed before the fix; 221 affected read, store, tool and reconciler
tests passed. Full CI and live deployment verification are separate checks.

May's reporting guidance did not yet pass the model-backed check: despite
receiving the new instructions, it again called the HN result a retry at
6318537. The closed Request remained unchanged, but the wording was wrong.
Guidance now includes a concise finding-first example. This is not yet a
proved behavioral fix; do not add a Host lifecycle rule to enforce phrasing.

The agent-read fix is Host commit `b97f063e`, based on freshly fetched
`origin/main`. Its full CI passed 2,626 tests with three installation-only
skips. Combined local candidate `6305fcfa` passed 2,641 tests with the same
three skips and all static checks. After deployment at 10:26 UTC, XHS remained
readable without another login. The brief startup missing-tab observation
produced a maintenance no-op, not a new research Task or human request.

Explicit Reddit and arXiv actions 6318571 and 6318576 supplied live queue
proof: Reddit ran while arXiv was pending. Agent exact reads, agent filtered
lists and human filtered lists all reported arXiv pending at generation 1,
with 1 ms sampled control reads. This proves the deployed read boundary for
that queued cycle, not natural recurrence or its eventual research outcome.
The candidate is local only; no public branch was pushed or PR merged.

## Partial research is not a no-op — 10:30 UTC

Reddit accepted a grounded HTTP-403 no-op at 6318582, then arXiv started at
6318585. arXiv retrieved real source evidence but hit the default 24-operation
finish request before integration. It explicitly returned `finish(partial)`;
the SDK execution was `done` with that partial finish retained in `evidence`.
Scout only checked execution status and therefore incorrectly accepted the
cycle as a no-op at 6318593. No source failure or absence of useful material
justified that conclusion.

The App now rejects that explicit partial finish as incomplete and preserves
its evidence on the same Task. One source call uses the existing 48-operation
allowance and ordinary time limit, with guidance to select one candidate early
and reserve effort for integration and read-back. This keeps the Host's shared
default unchanged and adds no workflow retry loop. The partial-admission
regression failed before the fix; 84 May/Scout tests passed afterward. Live
completion with the refined call remains to be tested.

The same failure was then reproduced in `knowledge-planner`: a `done`
execution carrying explicit partial finish evidence could publish a maintenance
fact. Its matching acceptance check now rejects that result before publication
or action admission. Eighty-five May/Scout tests pass, including both partial
regressions. The maintenance failure was tested with a fixture, not induced
against the live library.

The independent natural 10:30 May recovery review converged quietly at
6318604. It repeated no Conversation message and did not enable disabled Apps.

Reload 6318609/6318610 installed the source fix. Exact feedback 6318612 then
continued `explore-arxiv` with the retained source paths and a one-candidate
instruction. It completed at 6318624, generation 1, after 34 tool calls and
without another bounded-finish prompt. Scout updated the existing
memory-governance finding and digest, read both back and checked the exact
diff. The operator confirmed the edited passage, source reference and diff
check; the paper's experimental results were not independently reproduced.
This is a coached continuation, not uncoached natural recurrence. Maintenance
fix reload 6318627/6318628 completed after research ended.

The protected file hashes remained unchanged. The retry exposed another small
Host error-quality defect: the edit tool catches every access failure and
reports file not found, hiding the actual read-only boundary. Scout discovered
the boundary through shell diagnostics and chose a writable existing note;
no mount protection was relaxed. A separate candidate removes that misleading
catch and preserves native errors. Tests cover missing files, read-only,
permission and I/O failures with no downstream writes. A disposable container
probe of a read-only fixture returned `EROFS` correctly. Deployment remains
separate from that probe.

## Error reporting deployment and quiet recurrence — 10:41–10:46 UTC

Host fix `033bd116` passed 2,628 tests with three installation-only skips.
Combined local candidate `50234d9b` passed 2,644 tests, the same three skips,
and all static checks. It was deployed at 10:41 UTC while both Apps were idle;
the installed binary reports that revision and readiness passes. Only May and
Scout remained enabled. XHS was reopened, became readable without another
login, and the protected file hashes remained unchanged. This is a local
candidate deployment, not a published release.

The natural May review 6318651 started at 10:45 and converged at 6318659. It
read both exact disabled-App links and emitted no repeated Conversation
message or replacement Task. This checks quiet recovery, not the still-open
scheduled-research attribution wording. The fulfilled HN ask was not retried.

A read-only library check passed all 136 selected landing-page links. The
existing health observer still reports 26 unchanged facts (future dates,
oversized notes and unsourced backlog), with no new wake signal. Zero new
wakes does not mean those quality issues were fixed. Neither this inspection
nor the deployment rewrote the existing research edits. The manual now also
explains the observed distinction between execution done and partial progress.

## Isolation fixture and continued checks — 10:59–11:12 UTC

A disposable Git fixture exercised the real Host worktree adapter and Scout's
output-admission function with a nested domain directory. The worktree began
at committed content and left the canonical human edit intact. Canonical output
roots rejected the candidate note; candidate-scoped roots accepted it. The Host
refused acceptance of an unintegrated committed candidate and retained its
branch. This demonstrates both the existing protection and the missing App
path/integration boundary. It does not justify enabling Git mode on the live
dirty library or committing human research as a baseline.

The natural 11:00 May review converged quietly at 6318686, with no repeated
message or replacement Task. Credential checks through 11:10 remained ready.
Scout's full existing suite passed 343 tests across 33 files in about 190
seconds, without failures. Scout typecheck, focused formatting, 108 affected
May/Scout tests and the design checks also passed. Formatting cleanup touched
only the recent partial-result checks and regressions, with no behavior change.
The next all-source recurrence remains a separate live check; these tests do
not prove it or solve the shared-checkout writes.

## Natural source recurrence — 12:00–12:12 UTC

The five scheduled source events (6318788–6318792) ran without manual feedback
or retries. All retained generation 1 and completed their bounded calls:

- arXiv (6318814, 30 tool calls) added IdeaAMBIG to the existing evaluation
  companion note and digest.
- HN (6318829, 38 calls) added Procedural Graphs to the existing self-evolution
  note and digest.
- XHS (6318848, 10 calls) read the HarnessEvolve post and correctly made no
  change because the finding was already covered. Browser access remained ready.
- Reddit (6318860, 12 calls) read the public Atom feed, then recorded an HTTP
  429 boundary on a follow-up request; it made no library change.
- GitHub (6318877, 25 calls) created a pinned-revision Containarium finding and
  digest highlight. It explicitly distinguishes static code observations from
  a reproduced runtime escape or security test.

May reported the HN finding once (6318842), without calling it a retry. The
original HN Request remains closed/fulfilled at revision 2. Subsequent bounded
recovery reviews were quiet. This is natural recurrence evidence for the
expanded source allowance, completed-result acceptance and revised attribution
guidance; it is not a long-term reliability guarantee.

The operator read the new output and checked the IdeaAMBIG figures against the
retained paper HTML. The cited experiments were not independently reproduced.
An arXiv whole-file date assertion failed on three dates already present in
the committed baseline; Scout then passed a narrower check of its new section.
That does not resolve the existing dates. Library health recorded 26 unchanged
facts at 6318885, not a clean-library result.

## Small guidance iteration — 13:41 UTC

Repeated source calls tried missing `python`, `bs4`, `pdftotext`, or `file`
before recovering with available tools. Scout's existing context now explains
the standard container's `python3`/Node/Bun paths, checking optional tools,
and keeping missing optional feedback separate from source availability. It
also distinguishes a narrowly passing check from unresolved pre-existing
problems. No dependency, Host rule, retry mechanism or new Task was added.

Guidance commit `9940cbf3d6` was reviewed and fast-forwarded locally without
staging research. Formatting and 44 affected App/source-workflow tests passed;
an initial test command without explicit relative paths matched no tests and
was corrected, not counted as a pass. Reload 6319047/6319048 succeeded without
restarting the container. Model behavior with this guidance still needs the
next natural cycle; successful reload alone does not establish that behavior.

Through 13:41 UTC the recorder held 309 one-minute samples. Control-read p95
was 17 ms and the maximum 32 ms. Its two missing-socket samples corresponded
to earlier intentional deployments; there were no automatic container restarts.
Only May and Scout were loaded. The two protected human-edit hashes remained
unchanged. Scout still writes the shared checkout: safe isolated editing and
integration remain the main open workflow boundary.

## Output-admission fixture fix — 13:47 UTC

A disposable worktree probe exposed an unrelated eager path check: an existing
knowledge output was rejected when the optional scratch directory did not yet
exist. Commit `cc7764b115` resolves existing allowed roots independently while
retaining exact-file and realpath containment checks. The regression failed
before the fix; 45 App/source tests, the installed-project typecheck and
formatting with the installed Prettier 3.8.3 passed. The isolated checkout lacks
TypeScript's type dependencies, so its failed typecheck was not counted. Reload
6319065/6319066 succeeded without a container restart or source Task wake.

The integration fixture then proved that a verified commit can be integrated
without changing an unrelated dirty note, while an overlapping dirty note
refuses integration and the candidate remains readable. Normal successful
cleanup removed the candidate path; canonical and commit-qualified references
remained readable. Only disposable repositories were modified.

Scout's complete suite subsequently passed 344 tests across 33 files, zero
failures, in 157 seconds. This verifies the source revision and fixtures; the
next automatic source cycle remains the model-backed check.

## Natural recurrence exposed draft-only acceptance — 14:00–14:10 UTC

Scheduled HN/GitHub events 6319084/6319085 retained generation 1. HN ran while
GitHub read as pending; May's independent review was quiet. GitHub completed
at 6319129 with a canonical, pinned-revision Agent Control Standard finding.

HN hit the protected security note and correctly received `EROFS`, but then
overgeneralized the restriction to the library. It left a source-grounded
GitSpawn draft and a digest link. The workflow accepted this at 6319106, and
May's message 6319120 incorrectly described library integration. A completed
source observation and preserved draft did not satisfy that claim.

Commit `704d5871d9` rejects nonempty results containing no actual knowledge
output, retaining draft paths and current source evidence. Guidance narrows
read-only errors to the exact path, forbids bypassing protection, and permits
an appropriate writable finding instead. The regression failed before the
fix. The old positive XHS fixture wrote only a digest; it now writes a real
knowledge note as well. All 75 App/workflow tests, 345 full Scout tests,
typecheck, installed-tool formatting and design checks passed. This is a
narrow admission guarantee, not proof of content quality or Git integration.

Reload 6319132/6319133 succeeded without restarting. Explicit operator feedback
6319135 continued the same HN Task from its draft rather than requesting a new
search. It completed at 6319144 after 18 calls without tool errors, created a
canonical finding, retained the draft with a canonical link, and changed the
existing digest link without repeating its highlight. The result explicitly
distinguishes filesystem integration from Git/PR integration. May quietly
coalesced the update at 6319151; the prior finding was already reported.
This correction was coached, not automatic recovery proof. Uncoached source
calls still tried an unavailable module or executable once; affordable
recovery does not justify another runtime mechanism.

The operator verified the canonical file, source references, both local links,
single digest heading and unchanged protected-file hashes. Only Scout's exact
four-byte `.write-test` artifact was removed after its creation was confirmed
in the HN session; no research content was deleted or committed. Safe isolated
editing and reviewed Git integration remain open.
