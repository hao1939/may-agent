# Kubernetes version support page

Standalone HTML, CSS, and JavaScript. No build step, framework, or dependency on
the existing App UI. Serve this directory through the Host's App static-file
route so `/api` and `/ws` are on the same origin. Opening `index.html` directly
from the filesystem does not provide an API connection.

This page requires the Host's Task transcript and Task input endpoints described
below (Host source change `f3e75cfad2`). Deploy the compatible Host before serving the page; an older Host will
show those reads or input as unavailable. Native transcript reads currently
support Tasks bound to the Codex goal executor. Managed May session transcripts
are explicitly unavailable through this reader.

Open the page and enter an App ID and exact Task ID, or use:

```text
/projects/aks-rp-e2e.app/ui/k8s-version-upgrade/?appId=aks-rp-e2e&taskId=EXACT_TASK_ID&version=1.35
```

`version` is optional display context; it does not select or alter a task. The
connect form can discover paginated App tasks through `GET /api/tasks?appId=…`.
It never creates a task. Overview and Details share a persistent session pane.
Drag the separator or focus it and use Left/Right (Shift for larger steps), Home,
or End. On narrow screens the two panes stack.

Optional URL configuration:

- `readOnly=1`: keep task facts, progress and transcript browsing available while
  disabling composer submission and retries. The installation must also disable
  task dispatch or reject input at its server; a URL setting is only a UI control.
- `apiBase`: an optional same-origin reverse-proxy prefix, such as
  `/k8s-upgrade`. For a Host mounted at that prefix, open
  `/k8s-upgrade/projects/aks-rp-e2e.app/ui/k8s-version-upgrade/?apiBase=/k8s-upgrade&appId=aks-rp-e2e&taskId=EXACT_TASK_ID`.
  The prefix applies once to all API reads, task input, the source-document
  link and WebSocket connections. Omit it for a Host served at the origin root.
  A single trailing slash is accepted; external URLs, dot traversal, encoded
  segments and empty path segments are rejected before sending requests.
- `inputKind`: App input kind. Defaults to `owner-review` for `aks-rp-e2e` and
  `message` for other Apps. This is passed to the task input bridge.
- `progressProject` and `progressFile`: an explicit canonical progress document,
  read through `GET /api/projects/artifact?path=…&file=…`. For example,
  `progressProject=projects/aks-e2e-spec-runner` and
  `progressFile=design/execution/kubernetes-version-update/versions/1.38/progress.md`.
  Details renders escaped document text and Markdown tables. It does not derive
  completion percentages or replace the source document with another store.

The page reads `GET /api/task?appId=…&taskId=…` and
`GET /api/task/transcript?appId=…&taskId=…[&cursor=…]`. The transcript bridge must
return `{appId,taskId,generation,session,items,nextCursor?,unavailable?}`. A session
is `null` or `{id,kind:"codex"|"may",status?,updatedAt?}`. Items use
`{id,role,type,text,timestamp?,command?,status?}`; each page is chronological and
`nextCursor` retrieves older history. Only user, assistant, and tool messages are
shown; internal reasoning and system/developer instructions are omitted.
If newer messages have advanced beyond the retained page, the view switches to
the latest page and its current older-history cursor so intervening messages
remain reachable.

Task input uses `POST /api/task/input` with
`{appId,taskId,inputKind,message,idempotencyKey,expectedGeneration}`. An
`{accepted:true,appId,taskId,generation,eventId?,inboxId?,replayed?}` response must
match the submitted task and generation before the draft is cleared. Acceptance
is shown as saved for delivery, separately from agent acknowledgment or execution
progress. Retrying an unconfirmed delivery reuses its request ID, including when
the task has since changed generation or become terminal. The bridge checks
generation before new input admission; this is not an atomic admission fence.
Generation conflicts refresh task facts and keep the draft available for review.
New input is disabled when task facts are unavailable or the task is terminal.
The App decides how to consider feedback. Requirement revisions and approvals
continue through its existing typed workflow. Conversation executor Tasks use
their Conversation input route rather than this ordinary Task feedback route.

The page subscribes to `/ws` with
`{type:"subscribe",sessions:[],task:{appId,taskId}}`. Exact `app.task.updated`
events trigger debounced reads. Visible, nonterminal tasks also refresh every
20 seconds, including while the socket is healthy, because command output may
arrive without a task wake. Reconnect uses six bounded delays; the same read
polling continues when the socket is unavailable. Terminal tasks rely on
WebSocket events or manual refresh. Refresh can restart the socket retry budget.
These reads do not invoke models or start sessions.

Browser verification uses local fixture APIs and WebSocket events and serves
these actual assets. With the declared development dependencies installed:

```sh
PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome \
  bun test ./e2e/k8s-version-upgrade.test.ts --timeout 45000
```

Set `K8S_SUPPORT_SCREENSHOT_DIR` to capture desktop and mobile fixture screenshots.
If dependencies are supplied by another checkout, set `PUPPETEER_CORE_PATH`
to its absolute `node_modules/puppeteer-core` directory.
These tests do not read live tasks or contact models.
