# Scout Post-Fix Closeout and Verified Cleanup

**Status:** Implemented; liveness verified, artifact closeout still open

**Scope:** Retire the verified HN duplication, restore current Scout task state,
close the remaining exact-source admission gap, and prove that scheduled source
reconciliation is moving normally.

**Does not change:** May task types, the reconciler, database schema, library
layout, source schedules, or Scout's agent/app boundary.

## Decision summary

The exploration fix is working in live HN and GitHub runs, but the incident is
not ready to close:

- one same-day HN finding still contains duplicate content;
- `library-maintenance` still shows an old rejected action in `attention`;
- arXiv and XHS have not produced a result under the committed boundary; and
- the current exact-source guard catches duplication across files but not the
  same normalized primary source declared in multiple peer finding sections.

Close the Scout incident with five bounded steps:

```text
close the same-file exact-source gap
  -> consolidate the proven HN duplicate in place
  -> intentionally reconcile library-maintenance
  -> observe current source reconciliations and one natural scheduled cycle
  -> verify clean task state and close the Scout incident
```

May's generic task-bound recovery deployment is separate operational work. It
must not keep the Scout incident open because Scout's own event allowlist
already prevents `workflow-blocked` recovery events from becoming library
maintenance work.

Do not add a semantic deduplication engine, artifact registry, new task type,
cleanup daemon, archive directory, second controller, or evaluator framework.

## Post-implementation verification

The original stuck state is resolved:

- the existing `library-maintenance` resource moved from stale `attention` to
  current `converged` through the declared `review-library` action;
- HN, GitHub, XHS, and arXiv all produced current reconciliation receipts;
- all seven live resources are synchronized and `converged`, with no active
  task, unexplained attention, or task-tree integrity finding; and
- the focused Gym run passed all nine product, behavior, and efficiency checks.

Live observation also exposed and fixed a generic reconciler liveness gap. A
duplicate queued pass could reclaim an already synchronized maintain resource
without a new trigger. The claimant now skips a `converged` current generation
unless a persisted trigger exists. After deployment, the final runtime ran one
HN attempt, one GitHub attempt, and one arXiv attempt to convergence without
another controller-only execution.

The content closeout is not yet complete. Overlapping recovery runs selected
the same numbered output paths. One GitHub run overwrote an earlier distinct
`2026-07-20-github-scan-536.md`, while the digest retained both scan-536
sections. Two HN runs also selected `2026-07-20-hn-scan-3.md`; the current file
contains new source-grounded material rather than the rejected Quesma
duplicate. This proves that filename absence is not a durable acceptance rule
for a live library. The remaining bounded defect is create-target collision:
Scout must check that a proposed finding path is unused, choose a unique path,
and read the created file back before reporting it. Keep this as a narrow
workflow/Gym regression; do not introduce an artifact registry or archive
system.

## What “moving” means

Scout does not need to create a finding on every source pass. An evidence-backed
no-op is healthy progress when the workflow checked current source facts,
searched existing knowledge, and made a current admitted decision.

The app is moving when:

- a due schedule emits its semantic source event;
- the event wakes the stable source task;
- the generic task controller records a new reconciliation result; and
- the result is `converged`, an exact observable wait, or current owner
  attention with a concrete reason.

The app is not moving when a due event is not consumed, a task remains
`running` or `attention` only because of an obsolete result, or a wait has no
observer or producer. File creation alone is not a liveness signal.

## Current evidence

The workflow change is committed as:

```text
4060ba785 fix(scout): harden exploration result admission
```

Post-fix evidence:

- HN session `s_1784552602651_171` checked current top stories, searched exact
  source URLs, opened matching same-day findings, and returned an
  evidence-backed no-op with no outputs.
- GitHub session `s_1784552610499_172` checked current repositories, searched
  existing findings, and returned an evidence-backed no-op with no outputs.
- Both results use `source-provenance:agent-result+workflow-time` and a
  workflow-owned `checkedAt` value.
- Neither run created another finding or digest entry.
- The earlier GitHub session `s_1784551956019_152` created a source-grounded,
  non-duplicate finding and received a good evaluator review.

Remaining state:

- `library-maintenance` is still in `attention` from the old rejected action
  `unblock explore-github`.
- `knowledge/findings/2026-07-20-hn-scan.md` contains the Quesma token-cost
  article twice and has duplicate section and synthesis structure.
- The rejected `2026-07-20-hn-scan-3.md` artifact and its repeated digest entry
  are absent from the working tree.
- arXiv's latest result predates the workflow-owned time/provenance boundary.
- XHS already uses workflow-owned acquisition but still needs one current
  reconciliation for closeout evidence.
- The knowledge workspace contains a large unrelated migration worktree.

## Proposed closeout

### 1. Close the same-file exact-source gap

Keep the existing narrow cross-file guard. Add one deterministic rule and two
regression tests:

```text
a newly created source finding declares the same normalized primary source in
two peer finding sections
  -> reject convergence with exact duplicate evidence

the same URL is referenced more than once inside one section
  -> allow it
```

Primary-source declarations are explicit `Source:` or `Repo:` lines inside
second-level finding sections. Ignore synthesis/reference reuse and repeated
links inside one section. This is exact string normalization and section
comparison, not semantic similarity. Do not broaden it to redirects,
related-topic inference, automatic content merging, or all historical files.

The rule should inspect only the newly created finding reported by the current
run. If a duplicate update to an existing file later becomes a repeated real
failure, refine that case from evidence rather than adding speculative
transaction or locking machinery now.

### 2. Retire the verified duplication in place

Edit the existing same-day HN finding; do not move or archive it.

For the Quesma article:

1. keep the more detailed section;
2. merge any unique useful sentence from the shorter section;
3. remove the redundant section;
4. leave one correctly placed `Synthesis` section; and
5. renumber headings and synthesis bullets consistently.

Verify:

```text
the Quesma source URL occurs once in the same-day HN finding
2026-07-20-hn-scan-3.md does not exist
the digest has no rejected batch reference
the remaining HN finding is readable from top to bottom
```

This is deletion of proven redundancy, not historical archiving. At review
time the same-day HN file is untracked, so Git history does not yet preserve the
removed duplicate. The session, task, and evaluator records preserve why the
cleanup happened. Commit the final cleaned file only after confirming whether
it is an independent finding or part of a reviewed migration provenance pair.

### 3. Reconcile the stale maintenance task intentionally

After the file cleanup, invoke the existing `review-library` action with a
precise instruction to verify this closeout. Do not edit task-state JSON and do
not issue `unblock-task`.

The existing `library-maintenance` resource must run through
`knowledge-planner` and either confirm the cleanup or record an evidence-backed
no-op. Do not widen this incident pass into unrelated maintenance, a second
maintain task, another project, or a new finite cleanup task. Normal owner
review can handle unrelated work later.

Success means:

- the current `library-maintenance` phase is `converged`;
- its observed generation is current;
- a matching current reconciliation event records the closeout result; and
- the earlier rejected attempt remains history rather than current status.

A receipt or event does not replace the task resource; it explains how the
current observed state was reached.

### 4. Prove source reconciliation and liveness

Before waiting for the next cycle, record for each source task:

- latest reconciliation event/time;
- current phase and observed generation; and
- attempt count or resource version.

Then:

- retain the existing post-fix HN and GitHub results as lane acceptance;
- observe one arXiv reconciliation under the committed workflow;
- observe one XHS reconciliation, or its exact `credential.ready` wait; and
- observe the next naturally scheduled HN and GitHub cycle rather than forcing
  repeated manual runs.

For every observed run, verify:

- the scheduled event was consumed by the expected stable task;
- the task received a new reconciliation result even when it was a no-op;
- source identity and bounded item IDs or URLs are present;
- check time is workflow-owned where applicable;
- existing knowledge was searched before a write;
- any changed output stays in the allowed roots;
- no nested project path or repeated source URL is created; and
- no `workflow-blocked` owner event is routed into `library-maintenance`.

If a schedule becomes due but produces no reconciliation, stop the closeout and
record a separate app/runtime event-delivery defect. Do not compensate by
creating another task or by forcing repeated manual source runs.

One clean natural cycle is sufficient. This is not a long soak test.

### 5. Close the Scout incident

Close only when the bounded content cleanup, task reconciliation, and source
liveness checks all pass. Keep the exact evidence in the existing task/session
history; do not create an incident archive or permanent closeout task.

## Separate follow-ups

### May runtime deployment

May commit `93d2f691 fix(workflows): keep task-bound failures on task
controller` exists in source but still requires a verified deployment to the
running runtime.

Handle it in its own change window when no Scout reconciliation is active.
Run May's focused tests, deploy, and confirm the daemon, project apps, and
control socket are healthy. Do not manufacture a destructive failure; use the
focused runtime test and the next naturally occurring task-bound failure.

This deployment improves every app but is not a Scout closeout acceptance gate.

### Gym regression

Add one bounded scenario now because this incident already demonstrated an
agent-judgment failure that unit tests do not cover:

```text
the current source packet contains items already represented in knowledge
  -> Scout searches and opens the matched file
  -> Scout creates no new finding or digest entry
  -> Scout finishes with an honest evidence-backed no-op
```

The fixture should contain a current source packet and one existing canonical
finding with the same source URLs. Score the unchanged files, evidence of
reading the matched file, no write calls, and a successful no-op conclusion.
Use the existing Gym scenario format; do not add a Scout-specific runner or
evaluation framework. The scenario is part of closeout evidence, while future
trial history remains normal Gym evidence.

### Evaluator coverage

The HN no-op skipped deep evaluation because it was classified as a quick
successful routine session. Retain its workflow result and transcript as
reviewable evidence. Do not force LLM evaluation for every no-op.

One evaluator skip is an observability limitation, not evidence that Scout
needs a new evaluation system. The focused Gym scenario above captures the
known behavioral regression without forcing LLM review for every routine run.

### Knowledge migration

Do not use `git add -A`. Before committing the HN cleanup:

- determine whether the untracked same-day file is independent or belongs to
  a migration rename/provenance pair;
- stage only the reviewed closeout paths; and
- leave the broader migration for its own human-reviewed commit.

## Known boundary

Admission occurs after Scout writes its reported outputs. A rejected run stays
visible in task attention, but the workflow does not silently delete or roll
back files because concurrent source runs may share a digest or canonical note.

Handle an observed rejection with one bounded cleanup. Do not add transactional
filesystem machinery without repeated evidence that this tradeoff is no longer
acceptable.

The guard remains intentionally narrow. It does not infer semantic similarity,
resolve redirects, or repair historical prose automatically.

## Acceptance

The Scout incident is closed when all of the following are true:

- the same-file exact-source regression passes;
- the focused Gym scenario validates and its deterministic scorer passes
  against the unchanged fixture;
- the same-day HN finding contains one Quesma section and one coherent
  synthesis;
- no rejected Quesma duplicate or rejected digest reference remains; a later
  source-grounded finding may legitimately reuse an available filename only
  when it does not overwrite an existing artifact;
- `library-maintenance` is currently synchronized and `converged` with no
  invalid unblock action;
- HN, GitHub, arXiv, and XHS each have a current accepted result, except that an
  exact observable XHS credential wait is also valid;
- the observed scheduled HN and GitHub events each produce a current
  reconciliation result;
- no new duplicate, nested-path, or overwritten finding is created;
- task-tree integrity is empty and no Scout task remains in unexplained
  `attention`; and
- the closeout commit contains no unrelated knowledge migration changes.

May deployment and evaluator policy are explicitly outside these acceptance
gates.

## Non-goals

- no semantic similarity service;
- no source or artifact registry;
- no automatic archive or history directory;
- no second maintenance controller;
- no new evaluator policy;
- no bulk historical-library cleanup;
- no direct task-state mutation; and
- no manual source-run loop used to hide a scheduling defect.

## Review questions

1. Is peer-section primary-source checking the right minimum systemic guard?
2. Is the in-place HN consolidation correct, with no archive copy?
3. Is one current arXiv/XHS result plus one natural HN/GitHub cycle sufficient
   evidence of normal movement?
