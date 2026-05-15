---
id: platform
owner: tech-lead
status: active
type: milestone
priority: P0
workflow: project
iteration: 3
stop_reason: 
resume_condition: 
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
Active: human/May comment processed at iteration 3. Continuing with reviewer direction.
1. **I believe**: There's a new unread comment in comments.md ("smoke test: comment from curl after fix") that needs to be acknowledged/acted on.
2. **I'm uncertain about**: Whether this comment requires any code changes or is just a verification ping.
3. **I'd change my mind if**: The comment contained an actual bug report or feature request.

**(a) Concrete output:** Mark the comment as read in `projects/platform/comments.md` by removing its `<!-- unread -->` marker. No code changes needed — this is a smoke-test comment confirming the comment system works.

**(b) What's different:** Previous iterations had no comments to process. Now there's a concrete signal (unread comment) but it's informational only.

**(c) First step:** Read `projects/platform/comments.md`, remove the `<!-- unread -->` marker from the "hao - 2026-05-15" comment, then finish.

## Plan

- [x] Fix failing `sendSocketCommand` test (commit `6d577a42`)
- [ ] Wait for signal — failing platform metric, unread comment, or owner push
- [ ] When activated: scope the slice, work in `repos/may-agent/`, journal here

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


## Comments
