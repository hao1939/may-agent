---
id: platform
owner: tech-lead
status: paused
type: milestone
priority: P0
workflow: platform-iteration
iteration: 37
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
Waiting: — No active work signals. All plan items complete, no new comments or failures.

Resume when: a non-automated comment appears in discussion.md, a platform test fails, or a human/May directive arrives.
## Plan
- [x] Fix failing `sendSocketCommand` test (commit `6d577a42`)
- [x] Verify projectIdOf/projectPathOf refactor (iter9)
- [x] Verify synchronous status flip (iter11)
- [x] Verify browser e2e test (iter13, iter30)
- [x] Review sock/api documentation and features (iter17 — `outputs/iter14-sock-api-review.md`)
- [x] Design UI features: session→API mapping, logs+API tab, LLM summarization, session scoring, investigation UX (iter20)
- [x] Implement Logs + API session inspector view (iter25-26)
- [ ] Wait for signal — failing platform metric, unread comment, or owner push

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

## Artifacts
- outputs/iter14-sock-api-review.md
- outputs/iter20-ui-feature-design.md
- outputs/iter12-browser-e2e-verification.md
- outputs/iter10-sync-status-flip-verification.md
- outputs/iter8-refactor-verification.md
- outputs/iter6-verification.md
