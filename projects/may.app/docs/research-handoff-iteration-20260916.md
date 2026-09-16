# Research handoff iteration — September 16, 2026

Status: implemented and exercised in isolation. No production activation.
Preference learning remains at the earlier PoC boundary.

## Contract ownership

The common [App contract](../../may-agent.app/docs/2a-design/agent-app.md#assignment-authority-and-context)
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
paper uses `goal`; `explore` means a supported feed scan.

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
common [review rule](../../may-agent.app/docs/1-principles/core-principles.md#review-rule)
and [philosophy](../../may-agent.app/docs/1-principles/design-philosophy.md#how-to-decide-a-tradeoff)
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
