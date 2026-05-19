# Heartbeat System

## Design Rationale

A heartbeat is not a polling interval. It is **the recurring moment when an agent has the chance to be autonomous.**

Without heartbeats, agents are reactive — they only run when something happens *to* them: a metric breaches, a message arrives, a human sends an order. They are handler functions waiting to be called.

With heartbeats, agents are **continuous participants**. The heartbeat is the only mechanism by which an agent can:

- **Notice** something that no event fired about ("project X has been stale for 3 days")
- **Reflect** ("the last three iterations didn't work — maybe my approach is wrong")
- **Initiate** ("there's no metric for this, but I think I should start a project")
- **Read its own context** (inbox, journal, the system around it)
- **Choose** among the things it could do — by judgment, not by rule

The heartbeat is the **temporal scaffolding of agency**.

| Trigger | Source | Agent's task | Agency level |
|---|---|---|---|
| `timer.heartbeat_due` | Cron | Agent reassesses its standing work context | **High** — the agent chooses what matters |
| `metric.breach` | Metric engine | Judge a metric signal in context | Medium for P0 |
| `message` | Another agent or human | Judge and respond to a request/signal | Medium |
| `order` | Human direct command | Execute the order | None |

## Overview

Every agent wakes up periodically via a heartbeat. A heartbeat is a
cron-triggered reassessment of the agent's standing self-maintenance context:
identity, learned context, inbox, owned metrics, alerts, and active projects.
It follows the same model as projects, metrics, and events: signals arrive, the agent judges, then acts or records why no action is needed.

## Data Flow

```
Cron tick → timer.heartbeat_due → heartbeat handler → heartbeat workflow
  → loads work context/signals → runs agent session → agent judges/acts/records evidence
```

Heartbeat follows the same work-context convention as projects:

| Project convention | Heartbeat source |
|--------------------|------------------|
| Goal | `AGENTS.md`, domain, standing responsibility |
| Owner | the agent |
| Signals | metrics, alerts, inbox, active projects |
| State | `context.md`, lessons, recent sessions |
| Plan | `heartbeat.md` and current priorities |
| Evidence | session summary, file changes, project journal updates |
| Validation | later metrics/events/tests/next heartbeat |

## What Gets Loaded

The heartbeat workflow helper (`packages/sdk/src/heartbeat-data.ts`) loads:

1. **Metrics** — owned metrics with current values, breaches, trends
2. **Projects** — active projects with status, milestones, last activity
3. **Alerts** — metric alerts requiring attention
4. **Inbox** — recent events (time-window, last 2h) targeted at this agent

All injected into the agent's task prompt as structured sections.

## Per-Agent Workflows

Each agent has a heartbeat workflow at `agents/<name>/workflows/<name>-heartbeat.ts`:
- Imports shared data loaders
- Builds the task prompt with loaded context
- Calls `ctx.runAgent()` with the agent name and assembled task

## Auto-Generation

Agents don't need explicit cron.json entries for heartbeats:
- `generateAutoHeartbeats()` scans agents with heartbeat workflows
- Creates synthetic cron entries with hash-based offsets
- Explicit cron.json entries override (name dedup)
- Opt-out: `"heartbeat": false` in agent.json

## Heartbeat.md (per-agent)

Each agent can have `agents/<name>/heartbeat.md` — role-specific guidance read
during heartbeat. It should describe recurring inspection and judgment duties,
not carry long-term project memory. Not in the system prompt — only loaded when
the heartbeat fires.

## Metric Breaches and Heartbeats

A metric breach updates state and emits an event. The owning agent's **next heartbeat** sees the breach in its context and decides whether to act now, queue it, escalate, or note it without action. **Direct fork on breach is reserved for urgent (P0) metrics.**

Trade-off: latency. A breach detected at minute 3 of a 20-minute cycle waits up to 17 minutes. Acceptable for P1+; unacceptable for P0.

## Projects and Heartbeats

Heartbeats are how agents notice project signals. A project should not stay
`active` just to prove it is alive. When a project is `active`, the default is
intensive work until the current goal is reached, blocked, needs review, or has
no concrete next autonomous action.

A heartbeat without an active project can still be healthy if the agent is
watching its domain and there is no actionable signal.

## What "Alive" Looks Like

An agent is alive if its heartbeats:

- Fire on schedule (cron health)
- Read context (the agent looks at projects, inbox, metrics)
- Produce a decision (the agent states what it's doing and why)
- Result in action (work happens, output is recorded)
- Connect across time (today's heartbeat references yesterday's journal)

## Steering via Heartbeats

The most powerful human steering verb: **shape what the agent considers at its next heartbeat.**

- **Comment on a project** = "next time you read this project's context, factor this in"
- **Send a message** = same, but agent-scoped
- **Adjust a metric threshold** = the agent will see the breach (or non-breach) at the next heartbeat

Steering is *change what the agent sees when it next looks*, not "make the agent do X right now."

## Implementation

- **Heartbeat helper:** `packages/sdk/src/heartbeat-data.ts`
- **Auto-generation:** `src/app/loader/heartbeat-loader.ts` → `generateAutoHeartbeats()`
- **Per-agent workflows:** `agents/<name>/workflows/<name>-heartbeat.ts`
- **Decision event:** heartbeat workflow emits `agent.decision` partway through

> **Status (KE-1250):** `handler.heartbeat-coverage` metric exists. `agent.idle-rate` and `agent.self-initiated-rate` were never registered.
