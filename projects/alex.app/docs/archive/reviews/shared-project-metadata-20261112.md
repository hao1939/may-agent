# Shared project metadata reads — November 12, 2026

**Status:** Implemented in [Host PR 460](https://github.com/hao1939/may-agent/pull/460),
pending merge and installation. The user selected this source simplification.

**Owns:** Source evidence for the [HTTP read boundary](../../2a-design/http-boundary.md#read-boundary)
and [project UI](../../2a-design/webui.md#project-surface).

Baseline Host `8fa6b18caa` (#459); candidate `c99e7f5f250e049798176ab959628e94330396ba`.
The original audit was against merged #458 (`2a762206dd52`); its disagreements
also reproduce on this baseline. Temporary local HTTP fixtures found:

- JSON source posture `active` plus runtime projection `blocked` produced
  different list/detail status.
- An owner at a Markdown frontmatter boundary could make Sessions miss a
  retained session tagged with the identity shown in detail.
- Agent project counts scanned only Markdown and omitted JSON-only projects.

## Consolidation and preserved behavior

`project-metadata.ts` is the HTTP metadata reader. List and agent counts also
share discovery. JSON posture reuses `loadProjectReadModel`, accepting an
already-parsed source to avoid a second base-file read. HTTP identity stays tied
to source metadata. Posture projection does not replace source ID or owner.

Historical Markdown, its source text and existing file precedence remain.
Explicit per-agent paths read their own context before a shared basename
fallback. Historical folder identity remains distinct from an optional Markdown
ID label. Recorded current and exact former-parser session tags both remain
readable in detail counts/previews and the Sessions list. The legacy matcher is
retained only to derive compatibility identity; it no longer reads current
posture or chooses display owner. Ingress keeps its previous single target.
No alias grants Task ownership or rewrites stored evidence.

Malformed JSON is omitted from saved-project collections and fails detail
explicitly. A missing project still returns 404 in detail while an exact retained
session-tag lookup remains available. Loaded App discovery stays independent of
saved project metadata. Database rows/schema, source files, Task execution,
recovery and App admission are unchanged. No cache or service is added.

The net production reduction is 47 lines, including compatibility and the review
corrections below. The complete Host diff adds 461 lines and deletes 284 across
six files; the net increase is existing-guide updates plus nine HTTP regressions
and a subprocess-only filesystem fault fixture.

## Review corrections: preserve failure boundaries

The reviewed candidate `37780d1a8852e06ffd82218b42efd7caf1e650cc` exposed two
regressions. Both review comments reproduce against real HTTP adapters with a
temporary control socket, compared with baseline source:

- Malformed saved JSON changed comment admission from 202 to 500 and explicitly
  targeted Event publication from 201 to 500. Neither reached the daemon. The
  strict display reader had been reused by controls, adding an unintended
  dependency on display metadata parsing.
- Removing one metadata file between its content read and timestamp lookup
  changed listing from a partial 200 to a whole-request 500. Timestamp lookup had
  moved outside the per-record error boundary.

Both readers now share source parsing and the exact former identity rule. The
identity-only control reader tolerates JSON syntax errors through the previous
path/frontmatter fallback, does not load display posture, and lets file-access
errors propagate. Existing path/access checks and daemon admission remain. It
never expands historical session aliases into command targets. Display reads
remain strict. Discovery captures timestamps before admitting each record, so
rendering does not revisit the metadata file and one failure cannot discard the
other projects. This needs no parser mode, new service, cache or storage change.

Three added regressions fail on the reviewed candidate and pass after correction:
both command endpoints assert exact control-socket receipts and targets, and a
subprocess-only fault removes one exact file immediately before its timestamp
read. The other project remains listed and counted. Read/admission cases retain
source files and saved tags; the fault case deliberately removes its own selected
temporary metadata file.

## Verification

The six real HTTP cases cover JSON posture refresh/source identity, Markdown
owner positions, old tags, per-agent/shared basename collisions, and missing or
damaged metadata. Five fail against baseline source; the middle-owner Markdown
case protects behavior that already worked. Source files and saved tags remain
unchanged in those fixtures. The 53 affected HTTP/browser/path/comment-recovery
cases pass on the final candidate, including the served browser test. The Markdown
cases also preserve a saved display label distinct from the folder/session
identity; that assertion caught and corrected a consolidation regression.

Frozen installation and type/SDK/boundary/lint checks pass on the corrected
candidate. Hosted [run 43178493983](https://github.com/hao1939/may-agent/actions/runs/43178493983)
passes Quality and Container: 4,153 tests passed, zero failed, and three
installation-dependent configuration checks skipped across 360 files. Browser
coverage executed. Companion `check:may-design` passes with zero errors and the
existing unclassified `reports` layout warning.

The first local full run on this candidate had 4,152 passes, one failure and the
same three skips: the unchanged `restoredHandler` real Task-worker fixture
exceeded its five-second worker deadline. That scenario passes directly on both
baseline and candidate; its test, scenario and process-executor code are unchanged
by the review correction. The exact cause of the one local timeout is unproven.
A manual complete local rerun on the same frozen candidate passes: 4,153 passed,
zero failed and three skipped across 360 files. The first failure remains part
of this verification record. No timeout or retry policy was changed to obtain a
pass.

Hosted run [43173907349](https://github.com/hao1939/may-agent/actions/runs/43173907349)
passed Quality and Container on the earlier reviewed candidate `37780d1a8852`.
The first Quality attempt failed the unchanged workflow test
`cancels the active step and rejects late workflow effects`: it assumes setup
finishes within the same 10 ms budget as execution, so it expects one cancellation
even when setup consumes the budget and no worker starts. A temporary copy of
that test against baseline reproduces `expected 1, received 0` by adding the
adjacent test's 25 ms `workflow.started` setup delay. The unchanged cancellation
and common-deadline tests pass directly on the candidate. A manually requested
Quality rerun passes on the same candidate; this does not repair that
pre-existing test timing assumption. No unrelated workflow source/test change is
included in this reader consolidation.

No deployment, service restart, live-state conversion or external provider/model
call is part of this source change. Source verification does not establish
installed behavior.
