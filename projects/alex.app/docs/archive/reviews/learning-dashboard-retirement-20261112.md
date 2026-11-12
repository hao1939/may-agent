# Legacy Learning dashboard retirement — November 12, 2026

**Status:** Merged in [Host PR 457](https://github.com/hao1939/may-agent/pull/457)
as `a84c6918ed404cc9793c98930df815a00551544e`. Installed adoption is unverified.
The user approved this feature reduction.

**Owns:** Source evidence for the reduced [Web UI](../../2a-design/webui.md),
[HTTP boundary](../../2a-design/http-boundary.md) and retained
[session review notes](../../2a-design/session-eval-trail.md).

Baseline Host `da9b9fb85aee` (#456); tested PR head `275da86eded902caf334c57dcac5fd728b21af31`.
The merged source tree matches that tested head. The two checked-in
callers of `/api/learning` are the main Learning tab and the project-detail
Learning tab. Both use `pages/learning.js`; neither is an independent current
Task-review route. This is a source caller audit, not a census of live usage.

The handler scans up to 1,200 terminal sessions and reads per-session annotation
files. It separately interprets old `ownerFindings`, notification choices and
`learning.feedback` events. The approved cut removes that aggregate and both
tabs, the page script, dedicated CSS and route wiring. `/learning` and
`/api/learning` return 404. No replacement dashboard or compatibility endpoint
is introduced. Net production server/UI reduction is 508 lines; the Host diff
including guide and boundary-test updates is 31 additions and 530 deletions.

The deliberate loss is the combined coverage, finding, recurring-finding and
guard-signal overview. Retained paths are exact session detail, read-only saved
notes, agent evaluation trends, existing Task/project navigation, ordinary Event
diagnostics and App-owned Task-outcome review. No database rows, annotations or
accepted work are removed or converted. HTTP generation/comment-write controls
were already retired at the baseline and are not counted in this deletion.

The affected 33 HTTP, asset and browser tests pass. They check retired routes,
unchanged saved notes and evaluation rows, retained session detail and agent
trends, surviving Task/project navigation, and the served read-only note viewer.
Full `MAY_TEST_SHARDS=4 bun run ci` passed with 4,141 tests and three
installation-only skips; browser coverage executed. Hosted Quality and Container
passed on the tested head ([run 43163924735](https://github.com/hao1939/may-agent/actions/runs/43163924735)).
The paired Apps `check:may-design` passed in isolation; its source/documentation
commit is `55169e8c67`. These checks prove source behavior, not installed adoption.

No deployment, service restart, live database operation or provider/model call
was performed. Installation must activate the paired server and staged UI assets;
source completion does not prove which files a running installation serves.
