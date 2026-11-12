# Legacy Overview dashboard retirement — November 12, 2026

**Status:** Approved by the user; implemented in
[Host PR 462](https://github.com/hao1939/may-agent/pull/462), pending review/merge.
Tested candidate `e00ec7c47fe80d9c6f6dd504aea1abda4ebc0e08` includes review
correction `908ebc4cce` and main through `46fba0f89edc` (#465). The earlier
reviewed head was `75dc17794def8dff3aee09934e95232df7ebecdd`, based on
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
responses are ignored after a different route is selected. Explicit navigation
uses the router; the background loader cannot navigate. The router synchronizes
session-page mode from the route and cancels its pending refresh on navigation.
Each refresh captures its original session ID and rechecks the route before
reading, so a late callback cannot reopen a hidden session.

No Task lifecycle, execution, recovery, stored identities, database schema/rows,
workflow artifacts or retention policy changes. No replacement dashboard,
configuration switch, cache or migration is introduced. Backend API retirement
would be a separate consumer/compatibility decision.

The cut removes 617 production lines net across seven browser source files.
The Host change totals 271 additions and 671 deletions across eleven files;
documentation and browser regression coverage account for the difference.

## Verification and release boundary

The reviewed head `75dc17794d` passed frozen install, Host/SDK type checks,
canonical App-boundary checks and lint.
Its 23 affected tests passed, with real browser execution. Its full local
`MAY_TEST_SHARDS=4 bun run ci` passed: 4,160 tests, zero failures and three
installation-only skips across 362 files. Browser coverage executed. Companion
Apps `check:may-design` passed with zero errors and the existing unclassified
`reports` root-layout warning. Hosted Quality and Container both passed on that
head in [CI run 43185532712](https://github.com/hao1939/may-agent/actions/runs/43185532712),
including the actual image build and isolated smoke test. These results belong
to the earlier head; they do not certify the review corrections below.

## Review corrections

Both review findings were reproduced against `75dc17794d` with real browser
tests, which failed before the corrections:

- A queued session refresh returned from Overview/Metrics to the old session.
  The loader combined navigation and refresh, while hidden session-page mode
  remained active. Explicit navigation and background reading are now separate;
  route exit cancels timers and late callbacks check their original identity.
- Workflow cards still used shared health-card CSS that had been removed as
  legacy-only. Border, padding and value/label hierarchy disappeared. Keep those
  shared rules, including their mobile variants, while removing exclusive styles.

The timer regression checks real timer cancellation, invokes a captured late
callback after selecting Overview, Metrics, agent list or another session, and
proves that an active session still refreshes. The styling regression inspects
actual computed card styles on Overview and Metrics at widths 1280, 600 and 400.
All 25 affected tests passed after correction. The first intermediate full run
was stopped incomplete to integrate the advanced main; it is not gate evidence.
Final frozen install and full local `MAY_TEST_SHARDS=4 bun run ci` passed on
`e00ec7c47f`: 4,162 tests, zero failures and three installation-only skips across
362 files. Browser coverage executed, including both new regressions. Hosted
Quality and Container passed on the same head with the same test totals in
[CI run 43190393957](https://github.com/hao1939/may-agent/actions/runs/43190393957);
Container built the actual image and executed its isolated smoke test.
Companion Apps `check:may-design` passed with zero errors and the existing
unclassified `reports` root-layout warning.

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
Portable reproduction from a dependency-installed Host checkout:

```sh
bun install --frozen-lockfile
bun test --timeout 30000 test/integration/http-health-pages.test.ts test/integration/http-human-tasks.test.ts test/e2e/e8-project-comment-ui.test.ts
MAY_TEST_SHARDS=4 bun run ci
```

No deployment, service restart, live-state conversion or external provider/model
call is part of this change. Install the paired server and staged UI assets
together; a source merge cannot establish what an installation currently serves.
