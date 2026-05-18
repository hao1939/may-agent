# HTTP API and WebUI Boundary

## Status

Draft, accepted direction.

## Problem

The May Agent browser UI used to live under `packages/webui`, next to server-adapter code. That made the package name misleading because the server code does more than render UI:

- reads `.state/may.db` and transcript files
- resolves agent, project, and state paths
- exposes `/api/*` routes
- serves static WebUI assets
- proxies websocket subscriptions to the daemon socket
- sends steering commands to the daemon control interface
- builds WebUI read models such as loop traces and project summaries

Those are infra adapter responsibilities. Project UIs should remain first-class project resources, but they should not own the API server.

## Decision

Move the HTTP adapter into the May Agent root application under `src/app/http`. Keep browser UI source in the private `@may-agent/webui` package, then generate/sync project-owned static `ui/` directories under `PROJECTS_ROOT`.

The HTTP adapter is the Web-facing control/read interface for May Agent. It should align with the infra SDK and control-plane vocabulary, with extra read-model endpoints that make the WebUI efficient and understandable.

There is one compiled runtime binary: `may-agent`. WebUI runs as a mode of that binary with `may-agent --web`. Supervisor may keep a separate `may-agent-web` process group for lifecycle isolation, but it should execute the same `may-agent` binary instead of a dedicated WebUI binary.

Static project resources are visible under `/projects/*`, backed directly by `PROJECTS_ROOT`. The root path `/` serves the default May Agent project UI at `/projects/platform/ui/index.html` when present, otherwise it falls back to a `/projects` directory listing.

## Ownership

| Area | Owner | Notes |
| --- | --- | --- |
| HTTP route dispatch | `src/app/http` | Bun server, route table, request/response shape |
| Static file serving | `src/app/http` | Serves files from `PROJECTS_ROOT`; `/api/*` and `/ws` stay reserved |
| Daemon socket bridge | `src/app/http` + `packages/control` | HTTP adapter sends events through control package |
| DB/file read models | `src/app/http/read-model` | Projections for UI and diagnostics |
| WebUI source package | `packages/webui/static` | Source of truth for the default May Agent browser UI; no HTTP adapter code |
| Generated project UI assets | `PROJECTS_ROOT/<project>/ui` | Static HTML/CSS/JS generated or synced from the owning project/package |
| Agent/workflow SDK | `packages/sdk` | In-process capability surface for agents/workflows |
| Project-local agents | `PROJECTS_ROOT/<project>/agents` | Optional agents shipped with a project; loaded by normal runtime discovery |
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

packages/
  webui/
    package.json       # @may-agent/webui
    static/            # source browser assets; no HTTP server
      index.html
      app.js
      styles.css

projects/
  platform/
    ui/                # generated/synced static copy served by HTTP
      index.html
  <project>/
    project.md
    agents/            # optional project-local agents
      <agent>/
        agent.json
        AGENTS.md
    ui/
      index.html      # optional project-specific UI
      assets/...
```

Container rule: mount one project at the same shape used for many projects, e.g. `/projects/aks-rp-e2e`, not a special `/project` path. The runtime scans `PROJECTS_ROOT/*`; one discovered project is just the one-project case of the same model.

Boundary rule: browser UI source is edited in its owning package/project, then copied into the served project `ui/` directory by the build/sync step. Do not hand-edit generated `PROJECTS_ROOT/<project>/ui` files as the primary source. Project UIs are static resources and call the infra API through `/api/*`. The HTTP adapter serves `/projects/*` from `PROJECTS_ROOT`, but API routes are handled before static routes. Development and deployment run `may-agent --web`.

## Migration Plan

1. Move `packages/webui/src/server.ts` to `src/app/http/server.ts`.
2. Move DB/read-model helpers to `src/app/http/read-model`.
3. Remove compatibility wrappers from `packages/webui/src`; the private WebUI package should not export the HTTP adapter.
4. Update runtime imports, bundle scripts, and Docker build so WebUI runs through `may-agent --web` from the single compiled `may-agent` binary.
5. Keep the default UI source in `packages/webui/static` and sync it to `projects/platform/ui` for serving.
6. Extract the large route table into focused route modules.
7. Rename and reshape endpoints toward infra-aligned API plus `/api/views/*` read models.
8. Keep `packages/webui` static-only unless a specific project grows its own UI package/source.

## Non-Goals

- Do not remove or de-prioritize the WebUI; make it project-scoped instead.
- Do not turn the SDK into an HTTP API mechanically.
- Do not expose raw DB schema as the stable Web API.
- Do not move browser UI code into infra modules.

## Open Questions

- Which existing `/api/*` endpoints should be preserved as compatibility aliases after the infra-aligned API is introduced?
- Should WebUI view endpoints use `/api/views/*` immediately, or migrate route-by-route as pages are touched?
