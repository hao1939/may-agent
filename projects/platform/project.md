---
id: platform
owner: tech-lead
status: active
type: milestone
priority: P0
iteration: 38
---

# Project: platform

## Goal

Provide a stable, flexible infrastructure substrate for the May agent system:
runtime, SDK, event/session/task execution, persistence, query/read models, web
UI, container/build tooling, and test harnesses.

Platform changes shared infrastructure contracts. Agent learning,
self-improvement, evaluator calibration, and behavior evolution happen in
separate projects that consume platform mechanisms instead of owning platform
state directly.

This is a standing platform project. It stays `waiting` between concrete
infrastructure pushes and goes `active` only when there is a real platform
signal: a failing platform metric, an unread comment, an architectural change
request, or a scheduled infrastructure milestone.

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
Active: — Processing directive to redesign web UI around infrastructure fundamentals (hao comment + codex design advice, iter38).

## Scope Boundary

Platform owns shared mechanisms, not agent behavior strategy.

In scope:
- Runtime, SDK, persistence, events, sessions, task dispatch, workflow runner
  primitives, query/read models, web UI, container/build/test tooling.
- Infra contract docs and migration cleanup when those shared contracts change.
- Operator-facing observability that explains platform state.

Out of scope:
- Agent learning strategy, evaluator calibration, coaching policy, prompt
  evolution, and self-improvement experiments.
- Domain project planning, feature discovery, or project-specific heuristics.
- Direct ownership of another project's plan, tasks, or conclusions.

Those lanes should use platform-provided mechanisms — metrics, events,
comments, project tasks, and SDK APIs — to request platform work. They should
not hard-code platform internals or mutate platform project state directly.

Related evolution lane: `projects/agent-system-evolution/project.md`.

## Plan
- [x] Fix failing `sendSocketCommand` test (commit `6d577a42`)
- [x] Verify projectIdOf/projectPathOf refactor (iter9)
- [x] Verify synchronous status flip (iter11)
- [x] Verify browser e2e test (iter13, iter30)
- [x] Review sock/api documentation and features (iter17 — `outputs/iter14-sock-api-review.md`)
- [x] Design UI features: session→API mapping, logs+API tab, LLM summarization, session scoring, investigation UX (iter20)
- [x] Implement Logs + API session inspector view (iter25-26)
- [x] Codify hygiene discipline (trigger-driven, not scheduled) — see "Hygiene discipline" section below; evidence in `proposals/2026-05-20-legacy-cleanup-resume-path.md`
- [ ] Redesign web UI to foreground infrastructure fundamentals (iter38 — hao directive + codex design advice in discussion.md)
- [ ] Wait for signal — failing platform metric, unread comment, or owner push

## Tasks

- id: ui-redesign-infra-fundamentals
  status: ready
  result: null
  assignee: tech-lead
  goal: Redesign web UI to foreground infrastructure fundamentals (hao directive + codex design advice in discussion.md).
  depends_on: []
  attempts: 0

## Validation

- Tests pass: `cd repos/may-agent && bun test && bun run check`.
- Platform metrics stay at target after the change.
- Satellite projects keep building on top without regression.

## Hygiene discipline

Hygiene work in this project is **trigger-driven**, not scheduled. Two
disciplines apply; both are owned by whoever lands the triggering change.

### 1. Vocabulary audit at PR time

Any new method, function, or socket frame whose name shares a prefix or
role with an existing one (`resumeX` when `resumeY` exists; `send` vs
`input` vs `steer`; multiple "cleanup" entry points) must, within the
same PR cycle, **either**:

- Migrate every caller and delete the old name, **or**
- Add a docblock on **both** identifying which is canonical, plus a
  TODO with an owner and a deletion date.

`@deprecated` markers without a forcing function are how bugs hide.
The resume-vocabulary post-mortem in
`proposals/2026-05-20-legacy-cleanup-resume-path.md` is the evidence:
three resume verbs (`resumeInterrupted` / `resumeStaleSessions` /
`resumeSession`) let tests mock the broken one while validating only
the working one. Production auto-resume was a no-op for an unknown
duration before E9 was written.

### 2. Migration-tail sweep

When a format, protocol, or API migration is declared complete
("all projects use directory format," "all agents use v2 tools," etc.),
the same PR or an immediate follow-up files a paired cleanup task:

- Verify completeness first (e.g., grep all consumers; 0 holdouts).
- One-shot transformer with strict guards — see
  `scripts/legacy-cleanup/remove-isLegacy.py` for the pattern: exact
  string replacements + refusal to write if any lingering reference
  remains.
- Identify all callers up front; tests must stay green.
- Net deletion expected.

Findings land in a dated proposal under `proposals/YYYY-MM-DD-*.md`
with explicit per-item state: **RESOLVED**, **PARTIAL**, **DEFERRED**
(with reason), **DOCUMENTED** (real concern, fix out of scope),
**KEPT** (audited and deliberately retained). Mixed findings ledgers
that omit one of these states are the anti-pattern — they leave the
reader unable to tell "audited and chose to keep" from "forgot."

### Out of scope

- **Calendar-driven sweeps.** No "every N weeks, sweep dead code."
  Dead-code sweeps without a triggering migration produce findings
  that sit in `workspace/finding-*.md` files; findings without
  removals are not hygiene.
- **Aesthetic refactors.** Renaming for style, splitting files for
  size, etc., are not hygiene under this discipline unless they
  resolve a vocabulary collision or migration tail.

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
