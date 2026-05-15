---
id: platform
owner: tech-lead
status: active
type: milestone
priority: P0
workflow: project
iteration: 0
---

# Project: platform

## Goal

Maintain and evolve the may-agent platform — runtime, SDK, web UI, container, and
supporting tooling — that every other project under `projects/` depends on.

This is a standing platform project. It stays `waiting` between concrete pushes
and goes `active` only when there is a real signal: a failing platform metric,
an unread comment, an architectural change request, or a scheduled milestone.

The project name (`platform`) describes the ongoing concern; the code repo
(`may-agent`) lives underneath at `repos/may-agent/` with its own `.git`. This
directory is the work-project workspace: durable context, journal, and
discussion live here.

## Signals

- `handler.success-rate` — platform handlers stay healthy
- `capability.session-trace-completeness` — runtime emits the events v2 requires
- `v2.spec-coverage-rate` — conformance with the v2 spec
- Unread comments in `discussion.md`
- Build / test failures in `repos/may-agent/` (`bun test`, `bun run check`)

## Current State

- Code repo moved to `repos/may-agent/` (self-contained: own `.git`, `src/`,
  `packages/`, `test/`, `container/`, `bundle/`, `ui/`, `docs` symlink into
  `shared/may-agent-docs/`).
- Work-project files (`project.md`, `journal.md`, `discussion.md`) live at the
  project root alongside `repos/`.
- 35 satellite work-projects depend on this platform; their state is the
  effective backlog.

## Plan

- [ ] Wait for signal — failing platform metric, unread comment, or owner push.
- [ ] When activated: scope the slice, work in `repos/may-agent/`, journal here.

## Validation

- Tests pass: `cd repos/may-agent && bun test && bun run check`.
- Platform metrics stay at target after the change.
- Satellite projects keep building on top without regression.

## References

- Code: `repos/may-agent/`
- Architecture: `repos/may-agent/README.md`
- Build / test notes: `repos/may-agent/CLAUDE.md`
- Docs: `shared/may-agent-docs/` (symlinked as `repos/may-agent/docs`)
- Conventions: `/app/CONVENTIONS.md`, `shared/may-agent-docs/2a-design/projects.md`

## Journal

See `journal.md`.
