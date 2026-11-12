# HTTP source map

`server.ts` starts the HTTP server, wires route handlers and owns the existing
socket connection and static-file serving. Its final `fetch` function lists
the routes explicitly.

`task-read-routes.ts` handles the related read endpoints:

- `/api/conversation`: bounded Conversation reads.
- `/api/apps`: loaded Apps and Task counts from the existing `apps.list` read.
- `/api/tasks` and `/api/task`: the human-facing Task projection.
- `/api/apps/:appId/tasks` and its Task detail route: the App/SDK projection.

These handlers validate HTTP parameters, forward the exact identity and options
to the daemon, and translate its reply into the existing HTTP response. The
daemon owns the shared projections and state. The two Task views keep their
respective response shapes and error handling.

The handler factory takes only the existing daemon-read and JSON-response
functions. Server startup and route selection stay in `server.ts`; the read
module opens no database or socket and performs no Task transitions.

The Projects page presents loaded Apps independently of saved project context.
`/api/projects` remains a metadata read; its saved status does not establish
App loading or Task execution. Missing project metadata cannot hide a loaded
App, and saved metadata cannot substitute for an unavailable daemon read.

`project-metadata.ts` reads project identity and posture for the project list,
detail, session lookup and agent counts. JSON posture reuses the saved project
read model; source identity stays stable. Historical Markdown remains readable,
and the project list/counts share discovery. Session reads retain the former
parser's exact tags alongside the current identity; ingress keeps its previous
single target. No stored IDs are rewritten. Malformed JSON is omitted from the
saved-project list and fails detail explicitly; missing metadata still permits
an exact saved session-tag lookup. These reads do not establish Task ownership.
Collection discovery captures timestamps inside each guarded metadata read, so
a disappearing file cannot fail the whole list. Controls use the shared source
identity parser without loading display posture; JSON syntax errors retain the
previous path/frontmatter fallback. File access errors still fail explicitly,
and the daemon owns validation and admission of the single addressed target.

`read-model/` contains HTTP diagnostic reads for the event graph and loop trace.
Other report implementations live in `../adapters/reporting/`.

The legacy Learning dashboard and `/api/learning` aggregate are retired, including
the project-detail Learning tab. Session detail, saved review-note reads
(`/api/sessions/:id/eval`) remain available. Historical
artifacts and evaluation records are retained; HTTP does not regenerate their old
finding/notification summaries. Task review and follow-through belong to Apps.

The project Lineage tab and `/api/projects/lineage` aggregate are also retired.
The project Sessions tab and `/api/projects/sessions` remain, with their existing
tagged/mention provenance and historical workflow-file fallback. Exact session
detail retains recorded parent/child links. The removed view combined additional
workflow references, historical file reads and child associations with inline
checkpoint summaries; those project-wide summaries have no replacement view.
Stored sessions, workflow artifacts, checkpoints and historical rows are retained.

Overview has one presentation: workflow outcomes, current Tasks and Liveness.
The folded legacy health summary/charts, agent grid/drawer, activity timeline,
live feed and session statistics are retired. The old drawer's evaluation
summary, seven-day delegation totals and workspace file list have no replacement
view. Their backend reads remain supported.
Session links open `/sessions/:id`, using one inspector and follow-up composer;
the session's agent link opens `/agents/:name`. The shared WebSocket transport,
event subscriptions and current-page refresh remain. Retained history and metric
charts are unchanged.
Only explicit session navigation changes the route; background session reads
cannot open a session. The router owns session-page mode and cancels queued
refreshes on navigation. A queued refresh captures its original session ID and
checks the active route before reading. Workflow summary cards retain their
shared health-card styles, including mobile layout.
The routed session ID also determines follow-up publication and subscription.
Agent-chat reads and new-chat callbacks belong to the active agent's Chat
subtab; route/subtab changes, Reset and newer selections invalidate them.
Transcript reads cannot replace newer messages. Subscription changes happen
at selection time and are restored on connection, without waiting for history.
Entering another agent's chat clears the previous binding while its default
thread loads; input during that read addresses the selected agent.
One route-based subscription owner serves every realtime consumer: Overview
receives global lifecycle events, session inspection/direct bound chat receives
its exact session, and unbound direct-agent chat subscribes to no sessions.
Only generic Sessions chat uses the configured interface-agent `chat` alias.
May's Conversation retains global diagnostics and its configured Conversation
updates. Agent Overview/About tabs release their chat connection.

The selected direct thread and routed inspector share one session-read owner.
Returning to Chat restores an existing binding independently of default metadata;
reconnect refreshes the visible transcript and inspector outcome. Lifecycle
notifications request a fresh status snapshot rather than constructing session
inventory from incomplete event payloads. Background inspector reads retain
the current content and composer until a replacement is ready.

Fresh direct-chat HTTP input may supply `requestId` with `content`. It is the
creation command's existing request and publication identity. The existing
`/api/agents/:name/default-session?requestId=...` read then selects only that
agent's chat for that request; an absent match never falls back to its latest
session. Legacy reads without the parameter keep their default selection.
Lookup failures cannot admit a new chat. Retrying a created request republishes
its original start, with the same publication identity, instead of steering a
different thread. The browser uses its active view's read/timer for discovery,
bounded to 30 seconds with 500 ms gaps. Leaving the view cancels discovery;
returning to Chat can check the retained request again. Reset selects a new
request. A draft typed while creation is pending waits for the exact session.
No additional lifecycle, database schema, event type or notification scope is
introduced. Server and browser assets should be released together.

Direct chat renders only saved transcript turns, refreshed at turn/session end
and after reconnect. An update during a history read causes a follow-up read;
obsolete views cannot render the response. WebSocket text/tool payloads and
local input echoes no longer write conversation history. Send feedback remains
separate from saved messages. The exclusive live renderer and its Raw/Markdown
toggle are retired; stored text, tool details and raw transcript evidence remain
inspectable. May's canonical Conversation read/render path is unchanged.

[`http-human-tasks.test.ts`](../../../test/integration/http-human-tasks.test.ts)
exercises these routes through a real HTTP process and control socket, including
pagination, exact identifiers, accepted-evidence options, missing Tasks, failed
Conversation reads and an unavailable daemon. Browser coverage checks the served
Task board and Conversation interactions, plus installed-catalog refresh and
empty/unavailable results independently of project metadata. Keep those boundary
tests when moving handlers; a direct helper test alone would not verify route wiring.
