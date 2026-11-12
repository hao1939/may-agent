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

`task-transcript.ts` supplies `/api/task/transcript?appId=...&taskId=...`.
It resolves the current Task through `task.get` and checks the exact App, Task
and generation against the executor's existing `codex-goal-bindings.json`.
Native thread IDs and working directories come only from that Host state.
The short-lived Codex client initializes, reads, and stops; it never starts or
resumes a thread, steers a turn, or changes a goal. A final Task/binding check
discards results if execution changed during the read.

The default page contains the latest 30 visible items in chronological order;
`limit` accepts 1–100. `nextCursor` retrieves older history and is authenticated,
scoped to the current Task generation and native thread, and valid for this
HTTP process's lifetime. Each response scans at most 16 native item pages and
bounds message and command output. Reasoning, system/developer context, the
private Task packet, and raw tool arguments/results are omitted. `thread/read`
retrieves metadata without turns; `thread/items/list` omits `turnId` to use the
native bounded pagination across the thread, including active turns. Native read
requests time out after five seconds, with an eight-second client lifetime.
The pinned [Codex thread item protocol](https://github.com/openai/codex/blob/rust-v0.162.1/codex-rs/app-server-protocol/schema/typescript/v2/ThreadItemsListParams.ts)
defines the optional turn filter and native cursor.
Managed May sessions currently return a precise unavailable result rather than
substituting another Task or session's transcript.

`task-transcript.test.ts` exercises this reader through the production JSONL
client and a local protocol peer, including active reads, cross-turn paging,
identity fencing, hidden content, bounded results and shutdown on failures.

`task-input.ts` supplies `POST /api/task/input`. JSON input names the exact
`appId`, `taskId`, `expectedGeneration`, `message` and stable `idempotencyKey`;
optional `inputKind` selects an input declared by the App (default `message`).
The handler checks current Task identity, generation and terminal state before
sending feedback through existing `app.input.admit` with `targetTaskId` and
server-owned human attribution. This is a pre-send generation check, not an
atomic requirement revision or native thread control. The App owns how feedback
is considered; accepted requirement changes use its existing typed revision path.

A 202 response includes `accepted`, `appId`, `taskId`, `generation`, and available
publication receipts. It confirms durable admission, not agent acknowledgment
or completion. Lost acknowledgments return 503 with `delivery: "unknown"`;
retry the identical payload with the same key. Exact persisted publications are
confirmed before checking current Task state, so a replay still succeeds after
the original input changed or closed the Task. New input cannot reopen a closed
Task. Cross-origin browser input and oversized bodies are rejected.

[`http-task-session.test.ts`](../../../test/integration/http-task-session.test.ts)
checks both routes through a real HTTP process and disposable control socket.
App-owned pages can combine these endpoints with Task reads and exact Task
WebSocket subscriptions without depending on the Host's platform UI.

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
(`/api/sessions/:id/eval`) and agent evaluation trends remain available. Historical
artifacts and evaluation records are retained; HTTP does not regenerate their old
finding/notification summaries. Task review and follow-through belong to Apps.

The project Lineage tab and `/api/projects/lineage` aggregate are also retired.
The project Sessions tab and `/api/projects/sessions` remain, with their existing
tagged/mention provenance and historical workflow-file fallback. Exact session
detail retains recorded parent/child links. The removed view combined additional
workflow references, historical file reads and child associations with inline
checkpoint summaries; those project-wide summaries have no replacement view.
Stored sessions, workflow artifacts, checkpoints and historical rows are retained.

[`http-human-tasks.test.ts`](../../../test/integration/http-human-tasks.test.ts)
exercises these routes through a real HTTP process and control socket, including
pagination, exact identifiers, accepted-evidence options, missing Tasks, failed
Conversation reads and an unavailable daemon. Browser coverage checks the served
Task board and Conversation interactions, plus installed-catalog refresh and
empty/unavailable results independently of project metadata. Keep those boundary
tests when moving handlers; a direct helper test alone would not verify route wiring.
