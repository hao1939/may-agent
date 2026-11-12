# Project Lineage retirement — November 12, 2026

**Status:** Implemented in [Host PR 458](https://github.com/hao1939/may-agent/pull/458),
pending merge and installation. The user approved this feature reduction.

**Owns:** Source evidence for the reduced [Web UI](../../2a-design/webui.md) and
[HTTP boundary](../../2a-design/http-boundary.md). Recorded
[session ancestry](../../2a-design/sessions.md#session-lineage) remains supported.

## Decision and scope

Baseline Host `a84c6918ed40` (#457); candidate
`9d8e0068abcec4e1c3eeabc07be80538256304af`. The project detail page had two history
tabs with separate readers: Sessions and Lineage. The only checked-in caller of
`/api/projects/lineage` was the Lineage tab in `pages/projects.js`; this is a
source audit, not a census of live usage. The checked-in companion Apps source
has no active caller; its only earlier reference is archived UI design evidence.

Lineage combined five associations: explicit session project tags, workflow
references to a project, historical file reads, task-text mentions and children
of already associated sessions. Some associations were inferred, not evidence
of project ownership or Task acceptance. A separate timeline renderer fetched
checkpoint summaries for up to 30 sessions and offered inline expansion.

The approved cut removes that tab, renderer, inline summary expansion, API route
and handler. `/api/projects/lineage` returns 404. There is no compatibility route
or replacement timeline. This removes 296 production lines; documentation and
regression updates are counted separately.

The deliberate loss is that combined historical investigation view and its
inline checkpoint summaries. The retained project Sessions tab uses its existing
explicit-tag/mention behavior and historical workflow-file fallback. Its matching
rules are not equivalent to the retired aggregate, and it does not display all
sessions previously shown by Lineage. Exact session detail, transcripts, saved
notes, recorded parent/child links, Task and workflow trace reads remain.

No session identities, database schema/rows, workflow artifacts, checkpoints,
Task relationships, execution or recovery behavior are changed. Historical
`file_reads` rows remain stored; their dedicated project timeline reader is gone.
Checkpoint/digest production and other readers are outside this cut.

## Verification and release boundary

The existing HTTP integration scenario checks the retired route alongside
retained project Sessions, exact session detail, recorded child links and saved
review evidence. The existing browser scenario checks that project detail has
no Lineage tab and that Sessions opens an exact session. All 33 affected HTTP,
asset and browser cases pass against the candidate. Full
`MAY_TEST_SHARDS=4 bun run ci` passed: 4,141 tests, zero failures and three
installation-only skips; browser coverage executed. The Host diff including
guide and existing regression updates is 40 additions and 302 deletions.
Paired Apps `check:may-design` passed in isolation with zero errors and the
existing root-layout warning for `reports`. Hosted checks are linked from the PR.

No deployment, service restart, live-state conversion or provider/model call is
part of this change. Install the paired server and staged UI assets together;
a source merge alone cannot establish what a running installation serves.
