# Feedback Loop

**Owner:** may
**Goal:** Every agent output gets a signal on whether it was useful.
**Created:** 2026-04-16
**Status:** Active
**Master project:** [system-evolution.md](./system-evolution.md) → Gap 2
**Source feedback:** [bob](../../bob/workspace/system-gaps.md), [scout](../../scout/workspace/system-gaps.md), [tech-lead](../../tech-lead/workspace/system-gaps.md)
**Tracked metrics:** `scout.findings-used`, `bob.designs-implemented`, `system.stuck-requests`

## Why
Agents produce reports, KEs, analyses — then get zero signal on whether anyone used them. Scout writes deep dives that nobody reads. Bob creates KEs that never get applied. Without feedback, agents can't self-correct toward higher-impact work.

## Milestones

- [ ] **Track file reads by other agents** — Surface "unread reports" so May can nudge consumers or tell producers to stop.
- [ ] **Bidirectional citations** — When Bob uses DD-766 from Scout, Scout can see its output had impact. Simple cross-reference tracking.
- [ ] **Findings → tracked requests automatically** — When scout/bob produce actionable findings, auto-create tracked requests so tech-lead picks them up. Tech-lead specifically asked for this.
- [ ] **Periodic output quality review** — May samples agent outputs weekly, rates usefulness, feeds back to agents via heartbeat directives.

## Progress Log
<!-- Append entries as milestones are completed -->
