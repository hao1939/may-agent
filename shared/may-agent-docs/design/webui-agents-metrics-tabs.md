# Web UI — agents/projects/metrics as first-class resources

**Status**: shipped 2026-05-08 — commits `c0ed641c`, `1bb8a3c5` on v2.
**Replaces**: parts of `webui.md` rev-2 nav structure.

## What changed

The nav was reframed around three first-class resources: **agents**, **projects**, **metrics**. Sessions are no longer in primary nav (they are always reached *through* an agent, project, or heartbeat).

| Tab | Purpose | URL | Backend |
|---|---|---|---|
| Live | live activity (heartbeats, decisions, alerts, messages, projects strip) | `#/` | `/api/liveness`, `/api/projects` |
| **Agents** | card grid of all configured agents | `#/agents` | `/api/agents` (new) |
| Projects | flat table of all projects | `#/projects` | `/api/projects` |
| **Metrics** | metric grid (Agency / Infrastructure / Output) | `#/metrics` | `/api/metrics` |
| Knowledge | KE / H / EXP file tree | `#/knowledge` | `/api/browse` |
| System | events log + runtime health | `#/system` | `/api/events` |

Sessions reachable via deep-link `#/sessions/:id`.

## Agent detail (`#/agents/<name>`)

Five sub-tabs, modeled on project detail:

| Sub-tab | Content | Source |
|---|---|---|
| Chat (default) | Telegram-style persistent thread | `/api/agents/:name/default-session`, `/api/sessions/:id/transcript`, `POST /api/agents/:name/message` |
| About | `agent.json` + `SOUL.md`, `DOMAIN.md`, `heartbeat.md`, `context.md`, `TOOLS.md`, `LESSONS.md`, `AGENTS.md` | `/api/agents/:name/about` (new) |
| Metrics | metrics where `owner = name` | `/api/metrics` (filter client-side) |
| Projects | projects where `owner = name` | `/api/projects` (filter client-side) |
| Sessions | last 4h sessions for this agent | `/api/liveness` (read agents[].sessions) |

## Backend additions

| Route | Purpose | Cost |
|---|---|---|
| `GET /api/agents` | per-agent rollup: description, model, sessions4h, heartbeats4h, projectsActive/total, metricCount/breached | one DB query per agent + filesystem scan; ~20ms total |
| `GET /api/agents/:name/about` | identity files (agent.json + 7 standard md files) | filesystem read |

No changes to existing routes.

## Live page contact strip — kept, trimmed

The "Talk to an agent" strip on `/` was kept as a lightweight quick-chat entry, but trimmed:
- Drops per-tile age label (still in tooltip).
- Adds "see all →" link to Agents tab where the rich card grid lives.

## What's *not* in agents tab (deferred)

- Per-agent projects and metrics live behind sub-tabs but are *filtered client-side* from the bulk endpoints. If agents grow to hundreds, replace with `?owner=` query params on `/api/metrics` and `/api/projects`.
- Agent's heartbeat sparkline / decision feed not in Sessions sub-tab. Consider adding if Sessions sub-tab feels thin.
- No edit-from-UI for `agent.json` or `SOUL.md` — read-only by design (agents own their identity files; humans edit on disk).

## Verification (live)

- `/api/agents` returns 13 agents with real rollups (evaluator: 50 sess/4h, may: 41 sess/4h, dev: 11 sess/4h, others stale).
- `/api/agents/may/about` returns 7 identity files (15.4 KB total).
- All 7 panes (#dashboard, #agents, #projects, #metrics, #knowledge, #chat, #events) present in served HTML.
- All 6 nav tabs render.
- Telegram round-trip via `POST /api/agents/may/message` still works end-to-end (`PONG-S2` reply confirmed).
