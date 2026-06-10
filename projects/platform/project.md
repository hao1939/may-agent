---
id: platform
owner: tech-lead
status: waiting
type: milestone
priority: P0
iteration: 42
project_app: v2
project_policy: signal-driven
runtime_control_plane: .app
task_tree: tasks/tree.json
wait_reason: all tasks complete; typecheck clean; no unread comments; no actionable platform signal
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
request, a scheduled infrastructure milestone, or an owner-directed platform
adoption task.

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
Active — Project App V2 is being adopted by the platform project as the second
proving project after `aks-rp-e2e`. The runtime control plane lives in `.app/`,
the canonical task tree lives in `tasks/tree.json`, and the shared platform web
UI owns the generic Project Kanban projection. Project-local `/ui` surfaces
remain domain-specific.

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

Historical project references:
- `projects/master-worker-context-sharing/project.md` — closed split project.
  Platform owns any future master/worker transport, runtime loading, tool
  envelope, or persistence changes that come from that evidence.
- `projects/proof-of-life-dashboard/project.md` — closed presentation project.
  Platform owns only shared web UI/runtime work; report content stays in
  `projects/system-operations/project.md`.

## Plan
- [x] Fix failing `sendSocketCommand` test (commit `6d577a42`)
- [x] Verify projectIdOf/projectPathOf refactor (iter9)
- [x] Verify synchronous status flip (iter11)
- [x] Verify browser e2e test (iter13, iter30)
- [x] Review sock/api documentation and features (iter17 — `outputs/iter14-sock-api-review.md`)
- [x] Design UI features: session→API mapping, logs+API tab, LLM summarization, session scoring, investigation UX (iter20)
- [x] Implement Logs + API session inspector view (iter25-26)
- [x] Codify hygiene discipline (trigger-driven, not scheduled) — see "Hygiene discipline" section below; evidence in `proposals/2026-05-20-legacy-cleanup-resume-path.md`
- [x] Redesign web UI to foreground infrastructure fundamentals (iter38 — hao directive + codex design advice in discussion.md)
- [x] Implement structural receipt persistence at successful session closeout (iter39 — contract in projects/agent-system-evolution/contracts/structural-receipt-contract.md)
- [x] Add Project App V2 runtime control-plane files under `.app/` (iter40)
- [x] Add canonical platform v2 task tree at `tasks/tree.json` (iter40)
- [x] Verify and roll up shared Project Kanban in the platform web UI (iter40)
- [x] Re-verify 2 test failures flagged by creative audit (iter40)
- [x] Fix 3 test failures: project-health force-cooldown test timing, verify-after-write guard import path (iter41)
- [ ] Wait for signal — failing platform metric, unread comment, or owner push

## Tasks

- id: ui-redesign-infra-fundamentals
  status: done
  result: succeeded
  assignee: tech-lead
  goal: Redesign web UI to foreground infrastructure fundamentals (hao directive + codex design advice in discussion.md).
  depends_on: []
  attempts: 1

- id: structural-receipt-persistence
  result: succeeded
  status: done
  assignee: tech-lead
  goal: Persist a structural session.receipt when finish(success) is accepted, visible in canonical session history/read models. Contract: projects/agent-system-evolution/contracts/structural-receipt-contract.md
  depends_on: []
  attempts: 1

- id: verify-project-kanban-rollup
  result: succeeded
  status: done
  assignee: tech-lead
  goal: Verify shared Project Kanban in the platform web UI correctly renders task tree from tasks/tree.json.
  depends_on: []
  attempts: 1

- id: fix-persistent-test-failures
  result: succeeded
  status: done
  assignee: tech-lead
  goal: Investigate and fix the 2 unique test failures flagged across multiple audit cycles.
  depends_on: []
  attempts: 2

- id: verify-test-failures-audit-finding
  result: succeeded
  status: done
  assignee: tech-lead
  goal: Re-verify the 2 test failures flagged by project-creative-audit (verify-after-write guard missing module, project-health force-cooldown assertion). Confirm whether they are real regressions or stale audit artifacts.
  depends_on: []
  attempts: 1

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
