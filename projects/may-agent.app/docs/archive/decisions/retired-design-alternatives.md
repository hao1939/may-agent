# Retired Design Alternatives

**Status:** thoughts and alternatives, not active design
**Date:** 2026-05-19

This note preserves useful ideas from the retired
`2a-design/archive-legacy-shared-designs/` folder. The source archive docs were
removed so active readers do not mistake old statuses for current guidance.

Use this file as background only. Canonical design lives in `1-principles/`,
`2a-design/`, and `2b-manual/`.

## Metrics As Vitals

Useful idea: metrics are system vital signs, not commands. A breach should create
durable state and an event, then the owner judges it in context. P0 can interrupt
immediately; P1+ should normally surface through heartbeat, project context, or
steward review.

Keep:

- small active metric set;
- registry/runtime as the source of concrete thresholds;
- balanced project metrics;
- owner accountability for alert judgment;
- direct fork only for urgent P0 cases.

## Guard Review Discipline

Useful idea: guards are system-scope behavior and need review proportional to
their blast radius. Guards should observe, warn, repair, or block only when the
signal is strong enough. They must explain the reason and leave evidence.

Keep:

- `finish()` must remain a clean exit path;
- blocking guards need an escalation path;
- dangerous/security/data-integrity checks can be hard blocks;
- noisy or uncertain checks should emit guard signals for later review;
- guard changes that affect all agents need May/Hao-level review.

## Heartbeat As Agency

Useful idea: heartbeat is the recurring moment where an owner looks around,
forms judgment, and chooses work. It is not just polling.

Keep:

- heartbeat loads inbox, metrics, alerts, projects, and identity context;
- the owner chooses among signals rather than reacting to every signal directly;
- `agent.decision` can be useful if transcripts are too weak for UI/audit;
- metric breaches below P0 should generally inform the next heartbeat.

## Project-First Work

Useful idea: project context is the durable unit for goal, plan, state, evidence,
and validation. Sessions execute attempts; events wake work; metrics provide
signals.

Keep:

- compact `project.md` as a context map, not a data dump;
- long evidence in outputs/artifacts instead of the project entrypoint;
- project lifecycle driven by useful next action, blocker, review need, or done;
- milestones as evidence, not automatic completion.

## Persistent Worker/Reviewer Sessions

Useful alternative: long-lived worker/reviewer session pairs can reduce repeated
context loading on high-context projects.

Why it is not active: the simpler project workflow plus file-backed context is
easier to reason about, test, and recover. Revisit persistent paired sessions
only if repeated cold-start context loading becomes a measured bottleneck.

## Command Surface

Useful idea: distinguish control-plane commands against a running daemon from
standalone execution that starts a new instance.

Keep:

- socket/control adapters normalize actions into daemon events;
- socket `ok` means accepted, not completed;
- commands should have one validation path and leave durable event evidence;
- standalone run/workflow remains separate from live-daemon control.

## Event Model

Useful idea: typed core events and a durable operational-status appendix prevent
silent drift between design and runtime.

Keep:

- one canonical event taxonomy;
- dynamic adapter evidence allowed only at edges;
- operational tables that say what is actually emitted/consumed;
- explicit convergence gaps instead of teaching multiple names.

## Web UI Alternatives

Useful idea: the UI should be organized around operator goals, not just data
tables.

Keep:

- first screen answers whether the system is alive and what needs attention;
- agents, projects, and metrics can be first-class navigation resources;
- knowledge needs search, not only a file tree;
- agent/project detail pages should expose communication and current work;
- system metrics group better by Agency / Infrastructure / Output than by owner
  when the operator is diagnosing health.
