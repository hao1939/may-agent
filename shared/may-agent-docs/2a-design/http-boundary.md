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

## Current API Inventory

This inventory reflects the route table in `src/app/http/server.ts` as of
2026-06-08. It is intentionally grouped by role instead of by implementation
order.

| Role | Current endpoints | Boundary read |
|------|-------------------|---------------|
| Platform health | `GET /api/liveness`, `GET /api/stats`, `GET /api/digest` | Infra/read model. |
| Event stream and ingress | `GET /api/events`, `POST /api/events`, `GET /ws` | Events can be queried, streamed, and emitted through the daemon socket. |
| Agent views | `GET /api/agents`, `/activity`, `/timeline`, `/health`, `/:agent/detail`, `/:agent/about`, `/:agent/default-session` | WebUI projections over agents, sessions, and files. |
| Agent/session steering | `POST /api/agents/:agent/message`, `POST /api/agents/:agent/heartbeat-now`, `POST /api/sessions/:id/message`, `POST /api/sessions/:id/cancel` | Convenience steering endpoints. They should keep routing through the daemon socket and leave durable events/traces. |
| Session diagnostics | `GET /api/sessions/:id`, `/transcript`, `/raw-log`, `/eval`, `POST /api/sessions/:id/eval`, `/eval/comment` | Read models plus evaluator dispatch convenience. |
| Metrics and alerts | `GET /api/metrics`, `GET /api/metrics/:id/history`, `POST /api/metrics/:id/threshold`, `POST /api/alerts/:id/resolve` | Mixed: reads are projections; threshold/resolve currently update DB directly and emit best-effort events. |
| Projects | `GET /api/projects`, `/content`, `/artifact`, `/detail`, `/lineage`, `/journal`, `/discussion`, `/sessions`, `POST /api/projects/comment` | WebUI project projections plus a comment convenience endpoint. |
| Terminals | `GET/POST /api/terminals`, terminal websocket, resize, restart | Local WebUI operator tool, not project/domain API. |
| Static project UI | `/projects/<name>/...` | Static files from project-owned UI directories. `/api/*` remains infra-owned. |
| Benchmarks/browse/learning/trace | `/api/benchmarks*`, `/api/browse`, `/api/learning`, `/api/loop-trace` | Diagnostics/read-model surfaces; keep or migrate behind explicit view endpoints. |

No generic project action endpoint is part of the current accepted API. A
hardcoded `/api/projects/action` experiment was rejected because it put
project-domain execution inside the HTTP adapter and bypassed the event-first
boundary.

## API Convergence Proposal

Keep the HTTP adapter small:

1. **Reads return views.** Project dashboards, feature maps, session timelines,
   metrics, and diagnostics should be explicit read models. They may aggregate
   DB rows and project artifacts, but they should not become hidden project
   controllers.
2. **Writes enter through events or established infra commands.** If a browser
   action starts work, changes ownership, runs a project behavior, or asks an
   agent to do something, the durable activation path is an event/control frame
   through the daemon.
3. **Project code owns project meaning.** The HTTP adapter must not know AKS,
   evaluator calibration, platform operations, or any other project domain.
4. **Compatibility endpoints are allowed when they are simpler for users.**
   Their implementation should still route through the daemon/event path and
   should not introduce a second semantics.

### Event Ingress

Add one generic event ingress endpoint:

```http
POST /api/events
```

Body:

```json
{
  "type": "project.action.requested",
  "source": "web-ui",
  "owner": "agent:aks-explorer",
  "data": {
    "projectPath": "projects/aks-rp-e2e",
    "action": "replan",
    "params": {
      "selectedPathIds": ["path.managedsystem.rest-add-existing.minimal-rest"]
    }
  }
}
```

Rules:

- Dot-named events must use the canonical envelope from `events.md`:
  `type`, `source`, `owner`, `data`.
- The HTTP adapter validates the envelope and sends it to the daemon socket.
- The response only means the event was accepted by the transport; it does not
  mean downstream handlers finished.
- Event-specific fields stay under `data`.

### Project UI Activation

Do not add `/api/projects/action`.

For project UIs:

- Read current state from project artifacts or view endpoints.
- For side-effecting requests, emit a canonical event through `POST /api/events`.
- Let the project app or project handler decide whether to start an agent
  session, run a workflow, write evidence, or ignore the request.

Recommended event names:

| Event | Meaning |
|-------|---------|
| `project.comment.created` | Human comment/direction for a project. |
| `project.action.requested` | UI or operator requested a named project behavior. |
| `project.tick` | Timer-triggered project lane. |
| `project.task.dispatched` / `project.task.finished` | Task-driven project execution lifecycle. |

### Existing Convenience Routes

Keep these as user-friendly aliases while converging the internals:

| Route | Target behavior |
|-------|-----------------|
| `POST /api/projects/comment` | Emit `project.comment.created`; project app/handler decides wake behavior. |
| `POST /api/agents/:agent/message` | Resolve or start an agent chat through the daemon; leave canonical message/session trace events. |
| `POST /api/sessions/:id/message` | Steer/resume the existing session through the daemon. |
| `POST /api/sessions/:id/cancel` | Send the established session cancel control event. |
| `POST /api/agents/:agent/heartbeat-now` | Emit canonical `heartbeat.trigger`. |
| `POST /api/metrics/:id/threshold` and `/api/alerts/:id/resolve` | Either become established infra primitives with durable trace events or move behind event ingress. |

### Route Shape Target

Near-term target:

```text
GET  /api/events
POST /api/events

GET  /api/projects...
POST /api/projects/comment      # compatibility alias for project.comment.created

GET  /api/views/...             # new explicit read models as pages are touched
POST /api/agents/:agent/message # compatibility steering alias
POST /api/sessions/:id/message  # compatibility steering alias
POST /api/sessions/:id/cancel   # established infra command
```

Avoid adding new route families until they answer one of two questions:

- "What read model does the UI need?"
- "What canonical event/control action is being accepted?"

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
