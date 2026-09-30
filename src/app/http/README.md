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

`read-model/` contains HTTP diagnostic reads for the event graph and loop trace.
Other report implementations live in `../adapters/reporting/`.

[`http-human-tasks.test.ts`](../../../test/integration/http-human-tasks.test.ts)
exercises these routes through a real HTTP process and control socket, including
pagination, exact identifiers, accepted-evidence options, missing Tasks, failed
Conversation reads and an unavailable daemon. Browser coverage checks the served
Task board and Conversation interactions, plus installed-catalog refresh and
empty/unavailable results independently of project metadata. Keep those boundary
tests when moving handlers; a direct helper test alone would not verify route wiring.
