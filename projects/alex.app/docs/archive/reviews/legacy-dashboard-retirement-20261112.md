# Legacy Overview dashboard retirement — November 12, 2026

**Status:** Merged in
[Host PR 462](https://github.com/hao1939/may-agent/pull/462) as
`b7db445b62b900172593a0c7a284aeda7da53405` on November 13, 2026 (Asia/Shanghai).
Reviewed candidate `014bdd5540d20af7c38103f27b71613807d3f353` includes runtime
correction `1868eba3f5` and its retention-fixture correction. Main is integrated
through `62de4a82ec` (#467), including #463's retirement of the separate
evaluation database and #466's offline migration separation. Installed adoption
is unverified. Earlier reviewed revisions and their evidence are recorded below.

The redesign follows the user's choice of saved transcript refresh at turn
boundaries for direct-agent chat. The selected-session reader is separate from
the temporary submission binding; accepted publication is separate from
session creation. Current requirements are in Web UI; this record preserves
review findings, deliberate losses and evidence for each revision.

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
Send and subscription use the routed session identity. Agent-chat view callbacks
belong to the selected agent's Chat subtab; subtab changes release its reader.
The originating selection retains an in-flight submission or hidden receipt.
Explicit navigation, target changes and Reset discard that temporary binding.
One route-based subscription owner serves Overview, session inspection
and chat independently of message rendering. Direct chat now renders only
saved turns on initial selection, turn/session end and reconnect. Transcript
views own their reads and queued refreshes; notifications and local input do
not write another conversation history. Entering an agent's chat clears the prior
session binding so a message sent during default-thread resolution addresses
that agent. This is one browser selection counter, not another work lifecycle.

No Task lifecycle, execution, recovery, stored identities, database schema/rows,
workflow artifacts or retention policy changes. No replacement dashboard,
configuration switch, cache or migration is introduced. Backend API retirement
would be a separate consumer/compatibility decision.

The cut removes 603 production lines net across eight browser source files.
HTTP admission and its read helper add 115 lines net for request correlation,
original-target recovery and read failures: **488 fewer runtime lines** across
those ten source files against main `62de4a82ec`. Documentation and real browser
regression coverage account for the larger overall patch.

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

## Chat selection review correction

Review on `e00ec7c47f` found that an agent's delayed default-session response
could overwrite shared chat selection after Chat → Overview → another session.
The inspector still displayed the clicked session, but Send published a valid
steering request to the agent's old default thread. An empty response instead
cleared selection and sent the follow-up to the interface App. A failed read
wrote its error into the newer chat view. The Host cannot infer the user's
intended session from an otherwise valid event addressed to another session.

All three outcomes failed real-browser regressions before correction, including
the actual outgoing event observed through an isolated HTTP/control-socket
fixture. Two further before/after tests reproduced a subtab's stale default
binding and an obsolete transcript replacing the newer conversation. These
failures show a shared browser ownership problem exposed by the routed inspector;
they do not require a replacement dashboard or a Host protocol change.

The correction makes the session route authoritative for publication and
subscription. Agent header reads are scoped to their route. One selection
counter invalidates pending thread, transcript and admission continuations
when their selection changes. The active agent route and Chat subtab must
still match before an agent callback binds or
clears a session or renders an error. Reset cannot be undone by an older read;
the next fresh-chat request retains `forceNew`. A new-chat retry captures its
original agent and selection rather than reading mutable globals later.
Subscriptions update immediately on selection and reconnect; history reads
only render if their selection remains current. WebSocket status auto-selection
is limited to the unselected session-list route, so it cannot choose another
agent's chat destination while a default-thread read is pending.

Nine added regressions cover delayed success/empty/error and the actual
follow-up target, subtab changes, newer default reads, Reset, delayed transcript
rendering and outgoing subscription frames on the real transport (including
reselecting the same thread while its prior transcript read is pending), late
admission of existing direct chat, a captured new-chat retry after navigation,
and input while the selected agent's heading is still loading.

The initial transcript test used the wrong fixture field (`content` instead of
the HTTP projection's `text`); correcting that fixture exposed the intended
before/after transcript assertion. No production transcript format changed.

An intermediate correction used the chat selection counter to guard the agent
heading as well. Sending while the heading loaded invalidated that read and
left the heading absent; a browser regression failed on `ccbfff76b3`. The
heading now checks its route identity, while initialization avoids starting
another thread read after input or Reset has changed chat selection. This
separates route-owned presentation from the composer binding without adding
another persistent authority.

A second intermediate regression failed on `1fb2af90ad`: a newer default-thread
read resolving the same session invalidated the prior transcript but skipped
loading another one, leaving the chat blank. Successful default resolution
now always binds and loads its selected thread; the same-thread shortcut is
removed. Chat selection and its transcript follow one consistent path.

All 34 affected tests passed on `2ad2b2d302`, with real browser execution.
Frozen install and the final full local `MAY_TEST_SHARDS=4 bun run ci` passed:
4,171 tests, zero failures and three installation-only skips across 362 files.
Browser coverage executed. Hosted Quality and Container passed on that same
head with the same test totals in
[CI run 43202453374](https://github.com/hao1939/may-agent/actions/runs/43202453374);
Container built the actual image and executed its isolated smoke test.
Companion Apps `check:may-design` passed with zero errors and the existing
unclassified `reports` root-layout warning. Earlier local runs belong to their
recorded snapshots or the intermediate edit loop; the final gate ran after
all corrections were committed on this clean revision. No automatic test
retries or timeout-policy changes were introduced.

## Subscription and message ownership redesign

Three further review comments on `2ad2b2d302` exposed responsibilities that the
selection guard could not settle:

- [Unbound worker chat](https://github.com/hao1939/may-agent/pull/462#discussion_r4549557637)
  subscribed to `['chat']`, which the control adapter interprets as the configured
  interface agent. A fresh worker chat displayed that other agent's output.
- [History replacement](https://github.com/hao1939/may-agent/pull/462#discussion_r4549557683)
  erased live output and local input received during a transcript read. Its
  assistant accumulator still referenced the removed node, so later output
  remained invisible.
- [Overview](https://github.com/hao1939/may-agent/pull/462#discussion_r4549557720)
  inherited a chat-only subscription guard and remained unsubscribed on a fresh
  connection. Lifecycle notifications did not reach its retained panels.

All three failures were reproduced against that exact head with real browser,
HTTP and control-socket fixtures. An ordered status response served as a
notification barrier; these were delivery/content assertions, not copied
subscription logic or fixed sleeps. Earlier passing gates did not cover these
contracts sufficiently. The PR was returned to draft while its approach was
revised.

The user selected saved transcript refresh at turn boundaries for direct-agent
chat, keeping the main May Conversation behavior. This removes the second
message renderer instead of reconciling two message histories. Direct chat
no longer appends WebSocket text/tool payloads, delegation/closure prose or
optimistic user-message bubbles. Its exclusive Raw/Markdown toggle is removed;
saved text, paired tool details and raw JSONL evidence remain in the retained
transcript renderer. Transport feedback does not claim saved-message completion.

One subscription function derives scope from the visible route and binding:
Overview receives global events, routed/bound sessions receive their exact ID,
unbound worker chat receives no session events, and only generic Sessions chat
uses the interface-agent `chat` alias. May keeps global diagnostic delivery plus
its configured Conversation updates. Route entry, selection and reconnect use
this same owner; Agent Overview/About subtabs release the chat connection.

Transcript views own one in-flight read and one queued refresh. Turn/session-end
notifications mark a pending read dirty, causing a follow-up read that includes
the newly saved turn. Replacing the view invalidates its reads and cancels its
timer. The transcript reader no longer depends on the global selection counter;
that guard remains for default-thread and admission callbacks. Overview and
bound transcript reads reload on reconnect to recover changes missed offline.
No new event cursor, replay store, message merge framework or Host protocol is
introduced.

Removing local echoes also requires preserving drafts when admission fails.
Explicit-target sends use the existing HTTP Event publication helper and
acceptance receipt, independently of the notification socket. Unknown or failed
publication retains the unchanged draft and its publication identity; duplicate
clicks while that draft is pending are ignored. A changed draft or target is a
new input. The existing default-agent HTTP adapter still resolves unbound chat;
failure retains its draft and Reset intent. Default-thread read failures now
update status without replacing saved messages. May's publication helper is
shared without changing its Conversation behavior.

Portable coverage now checks real notification delivery for six scopes on
fresh connections and production-timer reconnects: Overview, unbound worker,
worker with a pending default lookup, routed session, generic Sessions chat and
May Conversation. Another test proves that lifecycle changes refresh all three
Overview reads and that reconnect reveals work changed while disconnected.
The history test writes real session JSONL, submits through the actual control
socket, ends a turn during a held history response, and checks exact saved
messages without duplicate output. It also checks later completed turns and
reconnect. The initial history fixture omitted its session directory; fixing
fixture setup did not require a production change. The test of the removed
standalone live Markdown renderer is retired with its owning implementation;
saved review-note and project-comment coverage remain.
Receipt coverage also exercises a rejected send with the notification socket
closed, an unchanged explicit-target retry, a second click while admission is
held, a different draft typed before the receipt, and rejected fresh-chat Reset
intent. It verifies actual admitted event targets and publication identities.

An explicit-session receipt follows the still-active target rather than the
selection counter used by default-thread resolution. Reloading the same thread
while admission is pending must clear its accepted, unchanged draft. Changing
to another route, resetting the thread or leaving the Chat subtab must prevent
the old callback from changing the newly selected view. A browser regression
reproduced the hidden-composer failure on `39fb27878d`, where a receipt still
cleared input after Chat → About because the session ID remained bound. The
active-surface guard fixes it without another counter or pending-message store.
The same browser coverage checks that generic Sessions restores its saved
transcript after returning from the routed inspector and that a hidden Chat
composer cannot publish input.

Final frozen install and full local `MAY_TEST_SHARDS=4 bun run ci` passed on
`406f138c5c`: 4,150 tests, zero failures and three installation-only skips
across 358 files. Browser coverage executed, including all 44 affected cases.
Hosted Quality and Container passed on that implementation head in
[CI run 43211547875](https://github.com/hao1939/may-agent/actions/runs/43211547875),
with the same test totals and an actual image build/isolated smoke test.
These results certify the earlier implementation. Final frozen install and
full local `MAY_TEST_SHARDS=4 bun run ci` passed on `5cb8c5d1a4`:
4,150 tests, zero failures and three installation-only skips across 358 files.
Browser coverage executed, including the 44 affected cases and the additional
same-thread/inactive-subtab assertions. Hosted Quality and Container passed on
the same head in
[CI run 43214747652](https://github.com/hao1939/may-agent/actions/runs/43214747652),
including the actual image build and isolated smoke test. Companion Apps
`check:may-design` passed with zero errors and the existing root-layout warning.
The clean committed revision was verified without automatic retries or
timeout-policy changes.

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

## Session selection and refresh ownership correction

Five further review findings on `5cb8c5d1a4` were valid. Saved-only rendering
removed conflicting histories, but the implementation still made default
metadata responsible for restoring a visible thread and used a single timed
lookup to guess which session a fresh input had started.
Implementation `89600c3b0e` is integrated with main's #467 cleanup in
`bb76a48e9d`. The earlier local gate was stopped incomplete when main advanced;
it is not final validation evidence.

| Finding | Broken assumption | Correction |
| --- | --- | --- |
| Chat → About → Chat with a failed lookup stopped response refresh | A retained session binding and saved DOM were enough without a reader | Chat entry restores the retained session's reader independently of metadata |
| HTTP 500 cleared saved history | A parsed error JSON without a session ID meant an empty conversation | Check read success before interpreting absence; retain history and binding |
| An offline session completion never updated the inspector | Refreshing the direct-chat reader also refreshed a routed session | Both presentations share the active session reader and reconnect refresh |
| Newly started sessions disappeared from the picker | A start event was a complete status row | Lifecycle events request authoritative status instead of constructing inventory |
| Creation after the first timed lookup never appeared, or Reset found the old thread | An agent's latest session identified the admitted input | Find the exact chat by existing request ID with a bounded active-view lookup |

The backend adapter had the same error/absence confusion: a failed default
read could admit an unintended fresh chat. It now propagates that failure. A
creation request carries its HTTP nonce as the existing command `requestId`
and publication identity. The optional request-scoped default-session read
filters agent, chat kind and request ID, without falling back to another
thread. A retry of a created request retains the original start publication
rather than changing it into steering. Existing callers without the parameter
retain their default-read contract; the new browser and server must be staged
and released together.

The active read owner handles both transcript presentations and exact creation
lookup, with one pending read and one timer. Its discovery has 500 ms gaps and
a 30-second retry window, with a five-second timeout per read.
Route/subtab changes or Reset invalidate that view and cancel
its timer. Returning to Chat restores a retained session or admitted request.
Input typed while finding a new thread is retained until its exact destination
is known. Background inspector refresh keeps the existing content visible,
including saved-note controls. No new event type, database schema, cursor,
message merge, work lifecycle or persistent discovery record is introduced.

All five browser failures were reproduced on the frozen reviewed head with
real HTTP/control sockets. The fixtures use valid saved assistant text blocks
and an ordered notification barrier. The picker fixture includes the runtime
parent-session link and complete authoritative status fields; a partial fixture
initially omitted its task field. Renaming the entire sessions table was also
an invalid storage-failure fixture because schema initialization created an
empty replacement; renaming its required agent column exercises an actual
query failure. Those intermediate fixture runs are diagnostics, not passing
or failing production evidence for the final gate.

Nine new owning cases cover the five findings, exact agent/chat/request
selection, storage-read failure without accidental admission, and stable start
publication on retry. The creation regression includes an older thread, a
newer concurrent thread, a draft typed while starting, and About → Chat before
creation completes. Existing late-admission coverage now holds the real
request-scoped lookup rather than the retired 800 ms retry callback. The timer
regression waits for the initial reader to settle before exercising queued
refresh cancellation. Saved-note coverage caught and now verifies preservation
of inspector controls during background reads.

The complete local gate on `bb76a48e9d` reported 4,105 passes and one failure
(plus three installation-only skips). Its hosted checks passed, but the local
navigation test correctly caught a background read moving the composer out
while leaving the previous transcript visible. This was a production defect,
not a test retry or unexplained flake. A held-read regression reproduced it.
The composer now moves only when replacing its containing content.

That regression also captures an obsolete HTTP snapshot, invalidates the read,
and records actual DOM mutations. It failed before the inspector adopted the
same dirty-read rule as direct chat: invalidated responses must not render an
intermediate snapshot. It now checks only the newest saved outcome appears,
and that a later HTTP 500 retains the current inspector and composer. An absent
JSONL file is a distinct HTTP 404 evidence state: retained metadata/outcome
remain inspectable with an explicit transcript-unavailable message. No second
cache, selection counter or read scheduler was added. The intermediate
`6f9510cc15` edit-loop run does not certify the final revision.

The complete local gate on `2d4bd9f902` reported 4,106 passes, one failure
and three installation-only skips. Hosted Quality and Container passed that
head. The local failure was the existing metric-policy browser test reading
project/vital classes across separate browser calls while reconnect replaced
the panel. It passes in isolation. The final fixture captures one rendered
snapshot and asserts the same warning states, without changing production
refresh behavior or automatically retrying tests.

## Submission ownership and immutable routing correction

Four further comments on `2d4bd9f902` identify a shared design error: page
visibility controlled the lifetime of a submission. A view may leave while
input is still accepted; changing the next draft does not replace that input.
The agent's current default is also not the identity of an earlier publication.

| Finding | Outcome before correction | Correction |
| --- | --- | --- |
| Changed draft during a pending fresh-chat POST | Two publications with different keys and the first receipt lost | Check the existing submission before creating another identity; retain the next draft |
| Accepted fresh POST while About is open | Accepted request forgotten; returning could create another chat | Retain receipt on its originating selection, consume it when Chat returns, restore the reader |
| Lost steering response followed by a changed default | Retrying could steer a different session under the same key | Recover original start/steering publication before default resolution; compare complete canonical input |
| Reset after unknown acceptance with an unchanged draft | The pre-Reset identity could bind the old chat | Reset discards pending publication identity as well as view binding |

One temporary submission retains its original draft, ID, destination and
fresh-thread choice while HTTP admission is in flight or unconfirmed. A hidden
agent subtab releases the reader, while receipt consumption waits for the
matching visible composer. Explicit navigation, target selection and Reset
discard this temporary binding. Returning to an already-bound chat also
restores its reader after a hidden receipt; submission state never owns saved
conversation messages or a separate work lifecycle.

The HTTP adapter reads the existing event journal and verifies the complete
caller input with the existing publication hash. Long-message SQL projections
cannot establish equality. Already accepted input returns its receipt, even
when its original session has ended; interrupted delivery republishes the same
command. Ambiguous keys and conflicting input/targets fail explicitly (409).
Missing original evidence fails as an unavailable read (500). A session alone
cannot justify recreating a missing start publication. No new schema, event
type, persistent request store or runtime retry coordinator is added.

Six new cases first reproduced the four comments on frozen `2d4bd9f902`: one
pending-send case, two hidden-receipt draft variants, Reset after a lost response,
and two exact steering variants including artifact-sized input. Nine new cases
now cover those failures plus a bound-session receipt across About and both
fresh-thread modes before creation. The creation variants also exercise an
interrupted durable delivery. The prior start-retry test now uses real
EventBus/DbWriter publication rather than inferring admission from a seeded
session, and checks missing publication evidence cannot create another chat.

The first complete owning-file run on `1868eba3f5` reported 61 passes and
one failure in the missing-publication fixture. Its deletion was blocked by
the existing referential-retention trigger because this minimal fixture does
not run an App planner to clear `app_admission_pending`. The fixture now
completes that retention fence, verifies deletion actually occurred, and checks
the exact correlated session read before expecting unavailable publication.
The same-revision local full gate was stopped incomplete to integrate that
fixture correction. It is not final validation.

Final verification on `014bdd5540d20af7c38103f27b71613807d3f353`, based on
main `62de4a82ec`:

- Frozen dependency installation and complete local `MAY_TEST_SHARDS=4 bun run ci`
  passed: **4,116 passes, zero failures, three installation-only skips** across
  353 files. Actual browser, daemon/socket, build and script coverage executed.
  The latest nine regressions and the corrected retention case passed within
  that complete run. There were no automatic test retries.
- Hosted **Quality** and **Container** passed on the same head in
  [CI run 43244550099](https://github.com/hao1939/may-agent/actions/runs/43244550099).
  Quality took 4m57s; Container took 2m46s and executed the actual image build
  and isolated runtime-user smoke test. These timings are observations, not
  performance guarantees. All review threads are resolved.
- Companion Apps `bun run check:may-design` passed with zero errors and the
  existing unclassified `reports` root-layout warning. Current Web UI
  requirements and this record carry the same submission/read contract as the
  standalone Host HTTP guide.

The PR still removes 488 runtime lines. The additional correctness code uses
existing publication evidence and view-local state. Source merge and deployment
remain separate; no installed-state conversion, restart or external provider
trial was performed.

## Post-merge closure — November 13, 2026

GitHub records the merge at `2026-11-12T16:49:41Z` (November 13 in
Asia/Shanghai). The complete merged source tree is identical to the reviewed
head `014bdd5540d20af7c38103f27b71613807d3f353`; the final 4,116-pass local run
and hosted Quality/Container evidence above apply to that unchanged tree.
No runtime tests were repeated for this documentation-only closure.

Web UI implementation status and the external-components proposal now mark
this reduction as merged and complete. The saved-turn, submission-identity and
selected-reader contracts remain current. Installed adoption remains unverified;
this closure does not deploy the Host or stage browser assets.
