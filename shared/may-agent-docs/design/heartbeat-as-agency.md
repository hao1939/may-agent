# Design: Heartbeat as Agency

**Status**: shipped
**Date**: 2026-05-06

## The reframe

A heartbeat is not a polling interval. It is **the recurring moment when an agent has the chance to be autonomous.**

Without heartbeats, agents are reactive — they only run when something happens *to* them: a metric breaches, a message arrives, a human sends an order. They are handler functions waiting to be called.

With heartbeats, agents are **continuous participants**. The heartbeat is the only mechanism by which an agent can:

- **Notice** something that no event fired about ("project X has been stale for 3 days; nobody pinged me; I should look").
- **Reflect** ("the last three iterations didn't work — maybe my approach is wrong").
- **Initiate** ("there's no metric for this, but I think I should start a project on it").
- **Read its own context** (inbox, journal, the system around it).
- **Choose** among the things it could do — by judgment, not by rule.

The heartbeat is the **temporal scaffolding of agency**.

## Why this matters

The system's first principle is "agents are accountability boundaries — they exist to OWN a domain." Ownership only manifests during a heartbeat. The rest of the time, the agent is executing — running a workflow, processing a fork, responding to a message.

A system without strong heartbeats is a system without strong ownership. Agents become callable functions that happen to have personality. They don't *steward* their domain; they *handle* what comes in.

A system with strong heartbeats is one where each agent shows up regularly, looks around its domain, and decides what's worth doing. That's what "autonomous" actually means.

## What a heartbeat session is

Every heartbeat session follows the same work-context shape as a project:

1. **Goal/context** — agent reads identity, learned context, project files, inbox, metrics, recent events, and journals.
2. **Signals** — agent identifies what changed or needs attention.
3. **Judgment** — agent forms an explicit theory: "this signal means X because Y."
4. **Act** — agent does the work: tool calls, edits, messages, delegation, or escalation.
5. **Evidence** — agent leaves traces for next time: session summary, journal entries, comments, status changes, messages.

The **judgment** step is the most important. It is where agency lives. Without explicit judgment, a heartbeat is just a polling tick that happens to invoke an LLM. With it, the heartbeat is genuinely *an agent at work*.

This is the case for surfacing the decision as a structured output of every heartbeat session (see "Implications" below), not just leaving it implicit in the transcript.

## Heartbeat vs. other session triggers

| Trigger | Source | Agent's task | Agency level |
|---|---|---|---|
| `heartbeat` | Cron | Agent reassesses its standing work context | **High** — the agent chooses what matters |
| `metric.breach` | Metric engine | Judge a metric signal in context | Medium for P0; otherwise handled in context |
| `message` | Another agent or human | Judge and respond to a request/signal | Medium — task is given, response still requires judgment |
| `order` | Human direct command | Execute the order | None — task is dictated |
| `manual` | Human "run now" button | Whatever the prompt says | Varies |

**Heartbeat is the default trigger where the agent picks its own work.** Other triggers still use the same model, but they arrive with a narrower signal or request.

## The implication for metric breaches

Under the unified work model:

> A metric breach updates state and emits an event. The owning agent's **next heartbeat** sees the breach in its context and decides whether to act now, queue it, escalate, or note it without action. **Direct fork on breach is reserved for urgent (P0) metrics.**

Better: **the agent reads its breach list at every heartbeat and decides what to do about each one.** A team lead doesn't get paged for every minor metric — they have a recurring review cadence where they look at all the metrics together and decide what matters. The heartbeat is exactly that.

This makes the system more agent-driven. The agent isn't a function the system calls when a number changes; the agent is a continuous worker who reviews the world at every heartbeat and chooses.

Trade-off: latency. A breach detected at minute 3 of a 20-minute heartbeat cycle waits up to 17 minutes for the agent to look. This is acceptable for P1+ metrics; it is unacceptable for P0 (e.g., system down, security event). P0 metrics still fork directly. Everything else informs the next heartbeat.

## The implication for projects

Heartbeats are how agents notice project signals, but a project should not stay
`active` just to prove it is alive. A project is alive when its durable context
is accurate, its watch signals are visible, and the owner reactivates it when
work becomes actionable.

When a project is `active`, the default is intensive work: keep pushing until
the current meaningful goal is reached, blocked, needs review, or has no
concrete next autonomous action. Then update the project to `waiting`,
`blocked`, `pending-review`, or `done` with evidence and a resume condition.

Conversely: a heartbeat without an active project can still be healthy if the
agent is watching its domain and there is no actionable signal. It is unhealthy
when the agent ignores signals, repeats observation-only work, or leaves
projects `active` while doing nothing substantive.

This is why **agent.idle-rate** is a meaningful health metric only in context:
not "is there always project work?", but "when signals exist, does the agent
notice, judge, and act?"

## What "alive" looks like

An agent is alive if its heartbeats:

- Fire on schedule (cron health).
- Read context (the agent looks at projects, inbox, metrics).
- Produce a decision (the agent states what it's doing and why).
- Result in action (work happens, output is recorded).
- Connect across time (today's heartbeat references yesterday's journal).

An agent is *dead in its seat* if its heartbeats fire on schedule but always idle, or always do trivial work, or never reference past iterations, or never pick up the breaches and messages the system delivers.

The system as a whole is alive if its agents are alive. The dashboard's job is to make this visible.

## Implications

### For the data model

Two structured fields are needed that the current system doesn't capture cleanly:

1. **Decision** on every heartbeat session — the agent's explicit "I'm doing X because Y" statement. Currently embedded in the LLM transcript; should be a structured output the heartbeat workflow extracts and stores. Without this, the UI can't show the agent's reasoning, and the human can't audit *whether* the agent is actually deciding or just running through motions.

2. **Trigger classification** on every session — `heartbeat | metric.breach | message | order | manual`. Already present in the schema (`source` / `trigger` field) but inconsistently populated. Tighten it. Heartbeat sessions specifically need to be unambiguous; the UI distinguishes them from forked sessions.

### For metrics

Add (or formalize) **agency metrics** — measurements of whether agents are using their heartbeats:

- `agent.heartbeat-coverage` — how many distinct agents heartbeat'd in the last N hours. (Already exists.)
- `agent.idle-rate` — fraction of heartbeats per agent that result in "no action taken." High idle = agent without domain or agent broken. Low idle = healthy ownership.
- `agent.self-initiated-rate` — fraction of an agent's sessions that come from heartbeat (vs. fork from breach/message/order). Healthy autonomous system has a meaningful fraction of sessions self-initiated.

These are not infrastructure metrics ("is cron working") nor output metrics ("are projects advancing"). They are **agency metrics** — measurements of whether the agents are *being* agents.

### For the heartbeat handler / workflow

The heartbeat workflow should emit an explicit `agent.decision` event partway through, before the action phase. This makes the decision queryable, displayable, and auditable as a first-class concept.

```
heartbeat fires
  → agent reads context
  → agent emits agent.decision event ("I will iterate on project X because Y")
  → agent acts
  → session.end with outcome summary
```

This is a small change to the heartbeat workflow shape; it has large UI and observability payoff.

### For steering

The most powerful human steering verb under this model is **"shape what the agent considers at its next heartbeat."** Concretely:

- **Comment on a project** = "next time you read this project's context, factor this in."
- **Send a message** = same, but agent-scoped.
- **Adjust a metric threshold** = same, but the agent will see the breach (or non-breach) at the next heartbeat.

Steering is *not* "make the agent do X right now." Steering is *change what the agent sees when it next looks*. This is profoundly different from how most systems frame human-in-the-loop — and it is the right framing for an autonomous multi-agent system.

The UI's verbs and copy should reflect this. "Send message" is fine, but the experience should make clear: *delivered at next heartbeat*, not *acted on now*.

## Open questions

1. **How long is a healthy heartbeat cycle?** Today most agents are 20–30 min. Faster = more reactive, more cost, less reflection. Slower = less reactive, more deliberative. The right answer probably varies per agent (an evaluator may heartbeat rarely; a may may heartbeat often). No global rule.

2. **Should heartbeats be skippable?** If an agent decides "I have nothing to do," should the next heartbeat still fire on the same schedule, or back off? Backing off rewards stagnation; firing on schedule wastes turns. Probably: fire on schedule, but if N heartbeats in a row are idle, alert (the agent has lost its domain).

3. **Should the human be able to trigger an immediate heartbeat?** Yes — for "I just left a comment, please pick it up now." This already exists as the manual fork verb; it should be reframed in the UI as "trigger heartbeat now" rather than "run agent."

4. **Should agents see their own heartbeat history?** Yes — at heartbeat time, the agent should see "your last 5 decisions" as part of its context. This enables reflection ("I keep deciding to do X but it's not working — maybe I should try Y"). Today this isn't surfaced.

5. **What about workflows that span multiple heartbeats?** A workflow may take longer than one heartbeat cycle. The agent shouldn't be re-deciding the same workflow at every heartbeat. Current pattern: workflows have their own session lineage; heartbeats see workflow-in-progress as context and respect it. This is correct; document it.

## Relation to other docs

- `../architecture.md` — defines the event -> `runAgent()` -> `session.end` primitive. This doc adds the framing layer: *what heartbeat sessions are for*.
- `agent-metrics.md` — defines the metric registry. Agency metrics (above) should be added to that registry.
- `webui.md` — the UI is the place where heartbeat-as-agency becomes visible to humans. The dashboard's primary mood is *seeing the agents alive*, which means seeing their heartbeats.
