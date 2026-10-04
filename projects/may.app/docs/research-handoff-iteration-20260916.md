# Research handoff iteration — September 16, 2026

Status: implemented, reviewed, merged, and deployed to the existing local instance.
The initial isolated experiments and the later deployed trial are distinguished below.
Preference learning remains at the earlier PoC boundary.

## Contract ownership

The common [App contract](../../alex.app/docs/2a-design/agent-app.md#assignment-authority-and-context)
owns assignment authority, required context references, admission, caller
clarification and Task reuse. The Host implementation removes redundant
Conversation handoff fields and shares the agent guidance with ordinary Tasks.
It adds no classifier, model admission service, document store or work lifecycle.

[May policy](intent-and-daily-learning.md) owns interpretation of a shared link,
Scout selection and review of the returned record. Active guidance belongs to
`agents/may/AGENTS.md`. Scout owns its
[assessment procedure](../../scout-knowledge-lib.app/design/scout-knowledge-library-process.md#requested-source-assessments)
and [archive layout](../../scout-knowledge-lib.app/design/scout-knowledge-library-layout.md#requested-assessment-records).
Its manifest now rejects empty exploration and incomplete goals. A specific
paper originally used `goal`; the deployed procedural refinement below uses
`assess-source` for a bounded source assessment. `goal` remains broader research,
and `explore` means a supported feed scan.

## Real-source experiment

Source: https://arxiv.org/abs/2608.25512 — *A Programming Paradigm for
Spatiotemporal Composability*, arXiv:2608.25512v1, by Yifan Shi, Wei Zhang and
Tianyi Cui. The source was accessible as a 92-page PDF. Both May and Scout used
`gpt-5.6-sol` with their real coding tools and the real arXiv source.

The candidate ran in a separate daemon with its own SQLite database, socket,
Conversation history, agent definitions and copied library. Only May and Scout
were loaded; periodic schedules and observers were disabled. Installation roots
were substituted in the copied App files and instructions. App input schemas,
Task mapping, normal scheduling, model execution and automatic result returns
were retained. No test code injected worker answers or manually delivered results.

| Scenario | Observed outcome | Sessions / elapsed |
| --- | --- | --- |
| Bare link, empty Conversation, no Topic/reply/Scout focus | One complete Scout goal on the first handoff. Read the exact source, saved an assessment, and returned it automatically. May read the saved file before fulfilling its Request. No clarification or unrelated scan. | May → Scout → May; 219.1 s |
| Same bare link, fresh Conversation after daemon restart | Found the existing assessment, rechecked v1 and the PDF, clarified coverage in that record, and returned the same path. No duplicate finding or new curated topic note. | May → Scout → May; 139.5 s |
| Simulated narrow correction | A contribution bullet incorrectly said provider-before-consumer teardown, contradicting the note's detailed explanation. Scout checked Theorem 70 and the unload rule and repaired the same note. May reviewed it. **Reuse failed:** May created another Task without reading the earlier assignment. | May → Scout → May; 101.0 s |
| Simulated follow-up after shared-guidance repair and restart | Asked for one illustrative example beside that correction. May used `tasks get`, then `tasks update` with complete input. The existing correction Task advanced from generation 1 to 2. Scout added the example to the same file; May read it before closure. No new Task or note. | May → Scout → May; 75.4 s |

Elapsed time runs from the first session start to the final session finish,
not from human typing or daemon startup. Sessions can contain several model
steps and tool calls; these counts are not model-call counts. The first two
scenarios received only the bare URL. The latter two were explicit simulated
follow-ups supplied by the experimenter, not spontaneous human corrections.

The record is `knowledge/findings/2026-09-16-spatiotemporal-composability-cordis.md`
in the isolated Scout library. It includes source identity/version, actual
coverage, claims and evidence, assumptions, limitations, related knowledge and
disposition. The final example is explicitly labeled illustrative and not from
the paper. All four Requests closed with explanations. Earlier fulfilled
Requests retained their history when later follow-ups were accepted.

The first run used the initial shared prompt before compaction. The existing
four-kilobyte Task-protocol check caught its size; the compact version passed and
was used in the revisit. The reuse failure then led to a second shared change:
read contextual work before creating related work, and distinguish a converged
result from Task closure. This belongs in the common contract, not in an arXiv
or Scout-specific routing rule.

One restart in the test harness briefly raced the old socket owner. A refinement
publication was recorded during shutdown without a Request link. After readiness,
retrying the same idempotency key admitted exactly one Request under the same
Event identity. No database repair or extra human instruction was used.

## Validation and limits

- Host full `bun run ci` at `542c736d`: 3,103 passed, zero failed, three
  installation-only checks skipped; 188.4 seconds. The regression suite covers invalid handoffs admitting no work, repair after
  reopen, complete input reaching the Task mapper, large required documents
  retained by reference, legacy rejected-result scope recovery, corrections,
  creator authority, and automatic result return.
- May: typecheck and all 31 tests pass, including the running-correction/reopen
  regression with the candidate Host. Full `check` stops at a pre-existing
  formatting issue in untouched `agents/tech-lead/workflows/develop-change.ts`.
- Scout: typecheck, syntax build and all 356 tests pass. Changed manifest and
  test formatting pass. Existing library projection/link checks pass; navigation
  checks meet their declared thresholds (11/10, 8/8 and 14/14).
  Whole-App formatting reports five untouched files: the accepted-output test,
  three verification-allocation scripts, and the XHS credential watcher.
- Common document integrity, checked SDK/control examples and App boundaries pass.

These are bounded behavior observations. They do not establish arbitrary-source
extraction, autonomous preference learning, model consistency, or a semantic
truth guarantee for archived prose. The ordering inconsistency demonstrates why
saving and reading back a record cannot replace source-sensitive review. Archive
requirements remain Scout policy checked by its caller; admission validates
shape and authority, not the truth or completeness of the research.

Mechanical restart/reference behavior is covered by portable tests. This trial
did not model-test an inaccessible required reference, a blocked source, or a
clarification requiring an actual human decision. Existing caller-result paths
carry those reports; no new escalation lifecycle was added.

## Paired source and reproduction

Host branch: `fix/complete-conversation-handoff`, based on main
`45d6bd2e751174d5f6355bbbc62041c163fb2b3e`.
The first implementation is `67cb3660c302c2374e3bb6d1767da75e223a22a3`;
the final reuse refinement is `542c736d0cd4276f4f3cc16e3e6eb1ff9d41b850`.
The App policy/design/schema changes are the companion commit containing this
record, on `fix/may-handoff-20260916`, based on App workspace `df3501f446`.
Raw local evidence retains exact prompts, results, tool traces, Task snapshots,
Request histories, library hashes, inputs, logs and assessment revisions.

For a comparable isolated trial:

1. Check out the paired Host and App revisions. Use Node 24 and Bun 1.3.14;
   install Host dependencies and resolve the App SDK to that Host's SDK.
2. Copy the candidate May and Scout Apps, the global May agent, shared definition
   material and a library snapshot into a temporary `APP_ROOT`. Substitute its
   roots, load only the two participating agents, and disable periodic producers
   in the trial composition. Retain normal Task execution and returns. Commit
   the trial definition snapshot so normal release loading sees the candidate.
3. Start `bun src/app/may.ts --socket` from the candidate Host with isolated
   `APP_ROOT`, `PROJECT_ROOT`, `AGENTS_ROOT`, `PROJECTS_ROOT`, `SHARED_ROOT`,
   `STATE_DIR`, `DAEMON_INSTANCE` and `DAEMON_AGENT`. Supply the authorized model
   endpoint through the usual environment, disable external Telegram delivery,
   and wait for confirmed readiness.
4. Publish a human `conversation.message.created` containing only the exact URL,
   with a unique message identity, no reply and no selected Topic. Require an
   admission receipt with its Request link. Observe Task input, source tools,
   saved record, caller read-back and explained Request closure.
5. Restart the same isolated daemon and repeat in a fresh Conversation. Compare
   library identities and hashes, not only the fluent answer. For continuation,
   add a narrow follow-up in the existing Topic and check the actual Task
   generation and full revised input.
6. Preserve evidence and stop the isolated daemon. Keep model trials separate
   from portable CI; do not use the production installation as a test fixture.

Integrate the Host SDK/schema/guidance and companion App consumers as a reviewed
pair. New Conversation decisions must use the new SDK shape; historical proposed
results remain evidence. Do not merge or activate mismatched halves. Production
activation is a separate Host Operations App task using the documented release
procedure, with in-flight work and rollback considered at that boundary.

## Design review before integration

The sufficient outcome is a useful source assessment that survives the turn,
with corrections carried to its existing owner and less human repetition. The
common [review rule](../../alex.app/docs/1-principles/core-principles.md#review-rule)
and [philosophy](../../alex.app/docs/1-principles/design-philosophy.md#how-to-decide-a-tradeoff)
support removing the ignored outer assignment fields and using existing App
input, Task revision, feedback, and findings records. A separate intent router,
semantic-admission service, clarification lifecycle, or archive service does not
provide demonstrated value for this case.

Review found and repaired three gaps in the candidate:

- Common guidance could imply that every App must accept generic goal fields.
  The contract now makes fixed App semantics explicit: a declared status operation
  can be complete with empty data. The accepted Task specification remains the
  assignment authority; later context does not silently revise it.
- Schema errors for a union could report the first, unrelated input kind. The
  Host now shares one input validator for direct admission and conversational
  handoff. It checks the full schema and uses a matching literal-kind branch only
  to explain a rejection. It does not judge semantic sufficiency.
- Removing Scout's generic fallback also rejected existing addressed owner-review
  requests outside the known maintenance reasons. That ordinary-agent path is
  preserved. Malformed scans are still rejected, and unknown observed facts still
  cannot create work.

Verification focuses on the changed contracts: selected-kind error feedback and
repair after restart, fixed-operation input, whole-schema rejection, preserved
maintenance input, and the existing Task/Request correction cases. The large
reference test proves that input and its retrievable path survive storage reopen;
it does not establish that a model read or correctly interpreted the document.
The earlier real-source trials retain their exact revision and behavioral limits.
No additional model trial or production activation is claimed by this review.

The archive obligation remains May/Scout policy with an explicit no-save override.
Judging relevance, adequate source coverage, and whether an existing Task fits
remains agent work. One source trial and one corrected continuation are useful
initial evidence, not a guarantee of reliable daily learning. Preference projection
and Gym intake remain outside this implementation.

## Deployed local-instance trial after review

The human explicitly requested reuse of the existing local instance and deployment
of the latest fix. Host PR #194 merged as
`dd548cabe2bf88ba427de2d29fdde3e94b7050c5`. The deployed Host is
`3a8893ba11d196706b70812d4a93423f8c892207`, which includes that merge and preserves
the three installation changes for Astra, pinned workflow helpers, and accepted
local workspace outputs. Its tree is identical to the already-tested candidate
`0194cc02`; the deployment build's 63 control/ingress tests passed. The companion
App definition source is `47bccf7a3fbd4660115dcdf7533f1140dc4e96e6`.

The correlated deployment receipt reported success, matching built and loaded
artifact hashes, healthy services, and no duplicate deployment. The control socket
and HTTP readiness passed. May and Scout remained the only enabled Apps; all
disabled markers and unrelated workspace edits were preserved. No work was active
at either restart, and no production database was reset or repaired.

Normal App reload rejected unrelated tracked design-document edits in the shared
checkout and retained the old generation. To activate only committed source, the
operator used `DefinitionSourceReleaseStore.stage()` from the clean companion
worktree, validated the compiled App imports and complete agent generation against
the deployed SDK, then stopped the idle daemon, activated that prepared release,
and restarted with a guarded rollback path. Readiness and the admission worker's
source identity confirmed the new generation. This was an explicit deployment
operation; it did not change reload policy or commit another owner's edits.

The bare URL was admitted into a fresh Conversation on that running instance.
The live library contained no assessment matching this paper before submission.
Schedules, observers, real agent context, and normal execution remained enabled.
No trial-specific instructions or answers were supplied with the URL.

The first run took 203.727 seconds across three sessions, May → Scout → May:

- May inferred a specific paper assessment and archive obligation without asking
  for clarification. Its first handoff used one complete Scout `goal` input,
  carrying the URL, outcome, acceptance, constraints, and reading-coverage policy.
- Scout fetched the exact arXiv source, extracted the 92-page PDF, created one
  assessment, read it back, and added a linked digest highlight. No curated topic
  note changed and no unrelated feed scan was created.
- May read the saved assessment and retrieved the Scout Task before closing its
  Request. Normal result delivery completed without operator intervention.
- **Coverage verification failed.** Scout's note and May's reply claimed all
  92 pages, including proofs, had been reviewed. The trace records extraction,
  head/search output, and only four bounded reads of the extracted text: offsets
  100/320, 2688/680, 3290/570, and 3850/80 (offset/limit). These cover selected
  introductory, implementation, case-study, discussion, and concluding material;
  they do not substantiate continuous review of the intervening formal development.
  May accepted Scout's coverage assertion rather than checking its basis.

The archived file is
`knowledge/findings/2026-09-16-spatiotemporal-composability-context-paradigm.md`.
The substantive discussion correctly distinguishes dependent-before-provider
teardown, reversible context state versus external effects, unchecked inverse and
commutativity obligations, and observational adoption versus controlled evaluation.
Those useful findings do not justify the broader claim of proof review.

The operator preserved the original answer, note, Task state, and trace, then
submitted an explicit review correction in the same Topic. This follow-up is
separate from the unassisted bare-link result. May read the existing Request and
Task, reopened that Request, and used `followUp.task` to continue the same Scout
Task. The correction fits the existing assessment and honest-coverage acceptance;
it did not require a new Task or a specification generation change. Scout changed
the same note to **partial extracted-text review**, stated that the complete paper
and proofs had not been reviewed, and qualified unsupported strength-of-evidence
claims. The local evidence retains the original overclaim as well as the repair.
May read the corrected file before closing the reopened
Request at revision 6. Both runs completed through the normal return path, with
six sessions in total and one Scout Task at generation 1 throughout. The corrected
reply explicitly describes partial coverage; no code or prompt changed between
the bare-link run and this operator-supplied correction.

The container also lacked a PDF reader and Python package installer. Scout
recovered by installing the reader in its user environment, but that cost extra
steps and created an unmanaged runtime dependency. A pinned PDF-reading capability
in the installation would make this recurring task more predictable.

This trial supports autonomous routing, complete handoff, durable archival,
automatic return, and reuse for a correction. It does **not** establish reliable
coverage verification: a saved note and its author's completion assertion are not
independent evidence. The next improvement should give the caller concrete source
sections/pages actually read and compare coverage claims against that record.
This fits the existing assignment, result evidence, and caller review boundaries;
it does not require another semantic-admission or archive service. No such further
implementation or autonomous preference learning is claimed here.


## Source procedure and user-experience iteration

The next iteration used https://arxiv.org/pdf/2508.10874, *SSRL: Self-Search
Reinforcement Learning*, arXiv:2508.10874v1. The source was a readable 39-page
PDF. It tested the narrower design: May echoes its understood outcome, Scout's
code prepares source evidence and saves the result, and one read-only model call
provides the analysis. The Host implementation and execution lifecycle did not
change. Shared guidance belongs to [Workflows](../../alex.app/docs/2a-design/workflows.md#procedural-evidence-and-agent-judgment);
May's wording/default effort belongs to [intent policy](intent-and-daily-learning.md),
and extraction/archive behavior belongs to Scout's
[source-assessment procedure](../../scout-knowledge-lib.app/design/scout-knowledge-library-process.md#requested-source-assessments).

Implementation began at App commit `13bf319f31`; the final executable App source
is `5852fb2712`. The running Host remains `3a8893ba`. Only App definitions were
activated on the same local instance through a staged committed source release;
its App/agent imports, workflow discovery, service readiness and source identity
were checked. Python 3 and the pinned pypdf 6.19.0 dependency were already present
in the container. No agent installed packages or edited archive files.

### Actual interaction and repairs

The first bare link was entered through the unmodified May Console in the
existing primary Conversation. May replied: “I’ll assess the paper’s main ideas,
evidence, and limitations, then save a source-grounded note for later reference.”
It selected `assess-source` with the correct URL and explicit archiving.

This first attempt exposed a real integration failure: the workflow exported a
default function instead of the required named `execute`. It therefore did not
start research. May disclosed the blocker and kept the Request and Task. Commit
`876585b241` fixed the export; the fixture and release check now cover that entry
point and actual workflow discovery. After activation, the same Task recovered
without resubmitting the URL or replacing it with a feed scan. The initial run's
latency includes this repair and must not be presented as normal research latency.
An unrelated scheduled digest also appeared in the primary Console; notification
prioritization remains outside this change.

While Scout was working, an operator supplied this ordinary-language test
correction through Console, without Task IDs, source offsets or file paths:
“For this paper, focus on what it means for May's daily learning, especially what
it doesn't demonstrate. Keep the saved note concise.” May stated the revised
understanding, revised the same Request, and used `tasks get`/`tasks update` to
advance the existing Scout Task from generation 1 to 2. Its final reply addressed
the corrected question; the Request closed at revision 6. The first assessment
remains historical evidence in the same note. No obsolete assessment was delivered
as fulfillment of the corrected ask.

Review found the updated note was still too long and placed after the earlier
entry. The final refinement requests 300–500 words, limits the draft to 6,000
characters, and presents the latest assessment before expandable earlier history.
Attempt cancellation is also propagated to retrieval/extraction and checked before
saving a late result. Its deterministic regression aborts after a model returns
and verifies that no assessment file is written; it is not a claim of atomic
filesystem cancellation or transactions with independent writers.

### Fresh Conversation on the final source

The same bare URL was then admitted into a fresh Conversation on the existing
instance through the socket. This follow-up validates behavior without inherited
May discussion, while the preceding trial supplies actual Console evidence.
Only the URL was supplied, with no selected Topic or custom research instruction.

- May echoed assessment and preservation in 19.107 seconds.
- It selected the typed source procedure; one Scout model call supplied the
  analysis, with observation tools only. The observed Scout calls used `finish`
  and no filesystem-writing or package-installation tools.
- Code reused the same source assessment and put a roughly 465-word latest entry
  first (including title, question and source metadata). Earlier entries survived.
- May read the saved assessment and returned useful findings, limitations, the
  source and the same saved path. The Request closed at revision 3.
- Final response arrived 64.591 seconds after admission. These timings describe
  this run, not a comparative performance benchmark or latency guarantee.

Across the three Scout calls, each actual model prompt contained 60,000 of
124,710 extracted characters from portions of 20 of 39 pages. An independent
trace-to-record check matched every saved retrieval identity, byte hash, supplied
span and excerpt hash to the actual prompt packet. All three checks passed. The
reply explicitly described partial coverage; neither the workflow nor May claimed
proof verification, experiment reproduction or complete-paper review.

The result distinguishes author-reported QA gains and model-dependent sim-to-real
transfer from evidence of May learning reliably each day. One source assessment
was added, and no pre-existing library note changed. Its path is
`knowledge/findings/2026-09-16-source-assessment-59968e7b4159.md`.

### Verification and remaining limits

Scout's frozen-source suite: 369 passed, zero failed. This includes actual PDF
extraction from a synthetic fixture, a local HTTP post, source failure, no-save,
record reuse, concurrent-edit detection, partial analysis, save failure and late
cancellation. Scout typecheck, syntax bundle and formatting of changed code pass.
May's 30 ordinary tests passed; the separately enabled Host-backed correction and
storage-reopen test also passed. Common design integrity, checked SDK/control
examples and canonical App-boundary checks passed. Earlier test attempts exposed
an SDK fixture mismatch, missing local PDF dependency configuration and an edit
made during a suite run; these were corrected before the frozen-source pass.

This is promising evidence for the bounded assessment experience, not a guarantee
of correct interpretation or research truth. Text extraction does not cover PDF
figures, OCR, paywalls or JavaScript-rendered bodies. The excerpts omit middle
sections of long papers; questions requiring those sections remain unfinished.
May still needs to judge whether the supplied evidence fits the actual question.
Artifact navigation, notification prioritization and durable preference learning
remain separate work. User authorization was refined to local merge only; no
remote PR or push is required for this iteration.


## Repository-page iteration and partial-result preservation

The next user-supplied test source was https://github.com/cordiverse/cordis.
The existing local instance, enabled Apps, schedules and real library were reused.
These inputs entered through ordinary conversation socket admission; this was not
another full Console UI test. No Cordis PR was changed. The user confirmed that
the URL was a May/Scout input and had previously accepted local merging.

### Failure observed before refinement

A bare URL in a fresh Conversation caused May to promise a concrete architecture,
core-abstractions and maturity assessment. The single-page reader could only
supply the short README and repository landing page. Scout honestly returned a
structured partial draft with the missing implementation/documentation evidence,
but the workflow discarded it because the agent finish status was `partial`.
The caller received a generic incomplete-attempt message without that draft,
its precise gap or an archive path, and left the existing Task to retry.
Seven Scout calls returned partial drafts without saving an assessment.

An experimenter-supplied ordinary-language correction narrowed the outcome to
what the page establishes, its useful takeaway and unknowns. May revised the
same Request and updated the same Scout Task to generation 2. One corrected
assessment completed and was saved; the Request closed at revision 5. This
shows the correction path working, but it required intervention and is not
counted as an autonomous baseline success.

The old HTML extractor also removed the targets behind the page's “arXiv” and
primer link labels. Independently checking plain-text input exposed another
mechanical loss: HTML parsing could remove TypeScript generics and literal tags.

### Small changes at the existing owners

- May keeps a bare link's first-look scope consistent across its acknowledgement,
  Request and worker acceptance. Explicit deeper requirements remain binding;
  multi-source research or implementation inspection uses the existing `goal`.
- Scout preserves a valid structured partial draft, its reported evidence gap and
  source coverage, while returning incomplete. A partial finish cannot converge
  even when its draft's completion flag disagrees. Missing drafts remain failures.
- HTML extraction retains HTTP(S) link targets relative to the retrieved page URL,
  without following them. Plain text/Markdown preserve literal code. The existing
  source/time/size bounds, one assessment call and verified save are retained.
- The common partial-output principle belongs in `may-agent.app`'s workflow design.
  May owns scope and caller follow-up policy; Scout owns extraction and records.
  No Host code, admission service, source crawler or new lifecycle was added.

The actual first failed model output was replayed through the candidate workflow
with its recorded source packet. It produced a saved partial note containing the
original draft and precise evidence gap, and returned `incomplete`. This replay
made no new model call and used a temporary library, separate from the live trial.

### Fresh conversation after activation

Executable App source: `e371b6a7e5da42154e2499c417023aae21637b64`.
The committed definitions were staged and validated through the existing release
store, activated while the daemon was idle, then checked for readiness. The Host
binary remained `3a8893ba11d196706b70812d4a93423f8c892207`; unrelated edits and
disabled Apps were preserved.

Only the bare Cordis URL was supplied in Conversation `may:cordis-fresh-20260916`.
It had no inherited discussion or selected Topic; the earlier source note existed
and was available for reuse. No corrective scope was supplied in this run.

- May replied after **18.454 seconds**: “I’ll assess what Cordis is, its main ideas,
  likely usefulness, and important limitations, then save a note for later.”
- The accepted Request and `assess-source` assignment stayed at landing-page depth.
- One Scout call used only `finish`; retrieval and archive writes remained code-owned.
- The final response arrived after **60.094 seconds**, through May → Scout → May.
  May read the saved assessment and fulfilled the Request at revision 3.
- The latest assessment reused
  `knowledge/findings/2026-09-16-source-assessment-67188e0c48a0.md`, with earlier
  evidence retained below it. Across both live runs, one note was added and no
  pre-existing knowledge note changed.
- All **11,104 extracted characters** were supplied, including the paper and
  primer URLs. Prompt-to-record comparison matched the exact coverage metadata
  and excerpt hash. Link presence does not imply linked-content access.

The response explained the project's stated composability focus, unstable-API
warning and unfinished documentation, and disclosed that the paper, primer and
implementation were not reviewed. This is a useful first look with limited depth;
it is not evidence that May understands the programming model or can assess
production readiness from this page. Model consistency and deeper adaptive
research remain separate from the proven extraction/save mechanics.

Validation on frozen executable source: **374 Scout tests passed**, zero failures,
including 17 source-assessment checks. Typecheck, syntax build, changed-code
formatting, common design integrity, SDK/control examples and App-boundary checks
passed. Local evidence is retained at
`/home/hao/workspace-archive/may-cordis-20260916/`, including inputs, results,
traces, coverage comparisons, partial-output replay, activation and check logs.
