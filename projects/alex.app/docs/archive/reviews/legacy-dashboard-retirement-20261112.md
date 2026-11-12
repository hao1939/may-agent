# Legacy Overview dashboard retirement — November 12, 2026

**Status:** Approved by the user; implemented in
[Host PR 462](https://github.com/hao1939/may-agent/pull/462), pending review/merge.
Tested source `75dc17794def8dff3aee09934e95232df7ebecdd`, based on
`bdaba7d0ee263871ce83d6ef583027936745e1e0` (#460). Installed adoption is unverified.

**Owns:** Source evidence for the reduced [Web UI](../../2a-design/webui.md) and
[HTTP boundary](../../2a-design/http-boundary.md).

## Decision and scope

Overview maintained its current workflow/Task/Liveness presentation alongside
a folded "Legacy panels" dashboard. The legacy branch separately loaded health
summaries and hardcoded health charts, an agent grid/drawer, an activity timeline
and session statistics. The shared chat transport also maintained a live-feed
buffer and rendered feed events, independently of whether the panels were open.
This is a source audit, not a census of installation usage or a measured speedup.

The selected cut deletes those legacy panels, their initialization, renderers,
feed state/calls and exclusive CSS. Preserve the current Liveness timeline,
observations/alerts, workflow health, Task board, Metrics charts and dedicated
Agents, Events, Projects and session pages. The shared event bus, WebSocket
connection, canonical Conversation handling, status updates and current-page
refresh remain. No backend endpoint is removed in this cut.

The deliberate losses include the old combined dashboard and live feed, inline
agent drawer, aggregate evaluation summary, seven-day delegation totals and
workspace file list. The current Agents page is not an equivalent replacement
for all of these. Existing HTTP health/activity/timeline, agent detail and
statistics reads remain supported. Exact session transcripts, saved review
notes, recorded parent/child links and stored evaluation/workflow evidence remain.

Session links previously called the old inline drawer or rendered into the
legacy `detail-panel`, including from current pages. They now use
`/sessions/:id` and `/agents/:name`. One inspector binds follow-up to the routed
session identity. The composer moves out before its containing panel is cleared
or replaced, then returns to the selected session. Late session and saved-note
responses are ignored after a different route is selected.

No Task lifecycle, execution, recovery, stored identities, database schema/rows,
workflow artifacts or retention policy changes. No replacement dashboard,
configuration switch, cache or migration is introduced. Backend API retirement
would be a separate consumer/compatibility decision.

The cut removes 627 production lines net across the six browser source files.
The Host change totals 148 additions and 660 deletions across ten files;
documentation and browser regression coverage account for the difference.

## Verification and release boundary

Frozen install, Host/SDK type checks, canonical App-boundary checks and lint
passed. All 23 affected tests passed, with real browser execution. Full local
`MAY_TEST_SHARDS=4 bun run ci` passed: 4,160 tests, zero failures and three
installation-only skips across 362 files. Browser coverage executed. Companion
Apps `check:may-design` passed with zero errors and the existing unclassified
`reports` root-layout warning.

The new browser navigation regression initially caught a composer-deletion bug
when following session/agent links; the final source preserves the shared
composer before replacing its host. Coverage includes Overview and agent
summary navigation, parent-session identity/follow-up binding, composer survival
after refresh and return to agent chat, browser Back, delayed session/note
success/error after a different selection, saved-note reads and metric chart
window bounds. The diagnostic event assertion now observes the shared event
bus rather than the retired feed renderer; canonical Conversation isolation
remains checked. The initial failing navigation run is retained as diagnostic
evidence; no automatic test retries or timeout policy changes were introduced.

Hosted Quality and Container both passed on the tested source revision above
in [CI run 43185532712](https://github.com/hao1939/may-agent/actions/runs/43185532712).
Container built the actual image and executed its isolated smoke test.

Portable reproduction from a dependency-installed Host checkout:

```sh
bun install --frozen-lockfile
bun test --timeout 30000 test/integration/http-health-pages.test.ts test/integration/http-human-tasks.test.ts test/e2e/e8-project-comment-ui.test.ts
MAY_TEST_SHARDS=4 bun run ci
```

No deployment, service restart, live-state conversion or external provider/model
call is part of this change. Install the paired server and staged UI assets
together; a source merge cannot establish what an installation currently serves.
