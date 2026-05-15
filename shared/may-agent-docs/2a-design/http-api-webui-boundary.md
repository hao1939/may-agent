# HTTP API and WebUI Boundary

## Status

Draft, accepted direction.

## Problem

`packages/webui` used to contain both the browser UI and the May Agent HTTP adapter. That made the package name misleading because the server code does more than render UI:

- reads `.state/may.db` and transcript files
- resolves agent, project, and state paths
- exposes `/api/*` routes
- serves static WebUI assets
- proxies websocket subscriptions to the daemon socket
- sends steering commands to the daemon control interface
- builds WebUI read models such as loop traces and project summaries

Those are infra adapter responsibilities. The WebUI should remain a first-class UI package, but it should not own the API server or static-file server.

## Decision

Keep `packages/webui` as the browser UI package. Move the HTTP adapter into the May Agent root application under `src/app/http`.

The HTTP adapter is the Web-facing control/read interface for May Agent. It should align with the infra SDK and control-plane vocabulary, with extra read-model endpoints that make the WebUI efficient and understandable.

There is one compiled runtime binary: `may-agent`. WebUI runs as a mode of that binary with `may-agent --web`. Supervisor may keep a separate `may-agent-web` process group for lifecycle isolation, but it should execute the same `may-agent` binary instead of a dedicated WebUI binary.

## Ownership

| Area | Owner | Notes |
| --- | --- | --- |
| HTTP route dispatch | `src/app/http` | Bun server, route table, request/response shape |
| Static file serving | `src/app/http` | Serves WebUI assets; does not own UI content |
| Daemon socket bridge | `src/app/http` + `packages/control` | HTTP adapter sends events through control package |
| DB/file read models | `src/app/http/read-model` | Projections for UI and diagnostics |
| Browser UI assets | `packages/webui` | HTML/CSS/JS, future components, view code |
| Agent/workflow SDK | `packages/sdk` | In-process capability surface for agents/workflows |
| Socket protocol | `packages/control` | Transport protocol and daemon socket client/server |

## API Shape

The API has two layers.

### Infra-Aligned API

These endpoints should map to May Agent infra concepts and use the same vocabulary as SDK/control events.

Examples:

- `POST /api/agents/:agent/sessions` -> run an agent session
- `POST /api/workflows/:workflow/runs` -> run a workflow
- `POST /api/sessions/:sessionId/resume` -> resume a session
- `POST /api/sessions/:sessionId/cancel` -> request session cancellation
- `POST /api/events` -> emit a daemon event
- `GET /api/metrics` and `GET /api/metrics/:id/history` -> metric state and observations
- `GET /api/projects` and `GET /api/projects/:projectId` -> project state
- `POST /api/projects/:projectId/comments` -> append human direction and trigger work

Mutation rule: mutating endpoints should go through infra/control events unless the mutation itself is an established infra primitive. The HTTP adapter should not silently bypass the daemon for session/workflow/project execution.

### WebUI View API

These endpoints are allowed to aggregate DB/files into WebUI-specific read models. They exist to support operator cognition, not to define core infra.

Examples:

- `GET /api/views/dashboard`
- `GET /api/views/agents/:agent`
- `GET /api/views/projects/:projectId`
- `GET /api/views/projects/:projectId/capability-model`
- `GET /api/views/sessions/:sessionId/timeline`
- `GET /api/views/loop-trace?...`

Read-model rule: view endpoints may read the DB and project files directly, but should return explicit projections rather than leaking schema details as the public API.

## Layout

Target layout:

```text
src/app/http/
  server.ts
  static.ts
  api/
    agents.ts
    workflows.ts
    sessions.ts
    projects.ts
    metrics.ts
    events.ts
    views.ts
  read-model/
    state-db.ts
    loop-trace.ts
    project-sections.ts

packages/webui/
  static/index.html
  src/client/       # future frontend modules/components, added only when client code exists
```

Boundary rule: `packages/webui` should not expose a server entrypoint. Development and deployment run `may-agent --web`; WebUI package code should import HTTP/view data through browser-facing APIs, not through server-module exports.

## Migration Plan

1. Move `packages/webui/src/server.ts` to `src/app/http/server.ts`.
2. Move DB/read-model helpers to `src/app/http/read-model`.
3. Remove compatibility wrappers from `packages/webui/src`; the private WebUI package should not export the HTTP adapter.
4. Update runtime imports, bundle scripts, and Docker build so WebUI runs through `may-agent --web` from the single compiled `may-agent` binary.
5. Keep `packages/webui/static/index.html` in the WebUI package.
6. Extract the large route table into focused route modules.
7. Rename and reshape endpoints toward infra-aligned API plus `/api/views/*` read models.
8. Move remaining WebUI tests or helper imports to the root-app HTTP/read-model modules as route modules stabilize.

## Non-Goals

- Do not remove or de-prioritize the WebUI.
- Do not turn the SDK into an HTTP API mechanically.
- Do not expose raw DB schema as the stable Web API.
- Do not move browser UI code into infra modules.

## Open Questions

- Should WebUI static assets stay as plain HTML during the first split, or should we introduce a frontend build step when route modules stabilize?
- Which existing `/api/*` endpoints should be preserved as compatibility aliases after the infra-aligned API is introduced?
- Should WebUI view endpoints use `/api/views/*` immediately, or migrate route-by-route as pages are touched?
