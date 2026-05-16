# Plan: Dissolve `shared/workflows/`

**Date:** 2026-05-15 (review applied 2026-05-17)
**Status:** Approved — executing
**Owner:** platform

## Principle

> Default is **copy, not share**. The only shared code lives in `@may-agent/sdk`
> as a deliberate, stable API surface. Workflow orchestration is **owned by
> exactly one home**: the project that runs it (`projects/<id>/workflows/`) or
> the agent that owns it (`agents/<owner>/workflows/`). When a second consumer
> wants similar logic, they **copy the file** and diverge freely.
> `shared/workflows/` is dissolved — the directory ceases to exist.

## End state

```
@may-agent/sdk              ← public, stable infrastructure API
  types/                    (WorkflowContext, WorkflowResult, etc.)
  workflow-file-cache       (was ProjectCache; LRU for project.md/journal.md)
  circuit-breaker           (resilience primitive)
  dispatch-dedup-guard      (resilience primitive)
  heartbeat-data            (per-agent heartbeat context builder)
  project-schema            (parseProjectMeta, updateField, appendDiscussionComment,
                             unreadDiscussionTail, validateProjectConfig — the
                             parsers infra-level handlers also need to walk projects)

agents/may/workflows/       ← May owns these (no other consumer)
  may-heartbeat.ts          (already there)
  metric-alert-triage.ts    (← moved from shared)
  closed-loop-steward.ts    (← moved from shared)
  session-recovery.ts       (← moved from shared)

agents/evaluator/workflows/
  evaluator-heartbeat.ts    (already there)
  evaluator-aftermath.ts    (already there)
  evaluator-deep-eval.ts    (← moved from shared)

projects/platform/workflows/
  platform-iteration.ts     (← fork of shared/workflows/project.ts, SDK-only imports)

projects/aks-rp-e2e/workflows/
  aks-rp-e2e-iteration.ts   (← fork, free to diverge)

projects/<other>/workflows/
  <project>-iteration.ts    (← fork, one per project, unique name)

shared/workflows/           ← DELETED
shared/workflows/REGISTRY.md ← DELETED
```

After this, the rule "no project depends on `shared/workflows/`" is enforceable
by a lint: any import path containing `shared/workflows/` fails CI.

## Inventory & disposition (audited 2026-05-15)

Live calls/wk computed from `workflow_runs` table, last 7 days.

| File (lines) | Live calls/wk | Disposition | Destination |
|---|---:|---|---|
| `project.ts` (1354) | 84 | **Copy per project** | `projects/<id>/workflows/project.ts` × N |
| `metric-alert-triage.ts` (298) | 200 | **Move** | `agents/may/workflows/` |
| `closed-loop-steward.ts` (18) | 186 | **Move** | `agents/may/workflows/` |
| `evaluator-deep-eval.ts` (18) | 119 | **Move** | `agents/evaluator/workflows/` |
| `session-recovery.ts` (131) | 0 | **Move** (still wired) | `agents/may/workflows/` |
| `verify-wrap.ts` (26) | 0 | **Move** (still in cron.json) | `agents/may/workflows/` |
| `implement-and-verify.ts` (216) | 0 | **Delete** | — |
| `heartbeat-data.ts` (575, 12 importers) | n/a (lib) | **Promote** | `@may-agent/sdk` |
| `types.ts` (23, **0 live importers** — corrected from audit) | n/a | **Delete** (SDK already has the canonical `WorkflowContext`/`WorkflowResult`) | — |
| `project-cache.ts` (228) | n/a (lib) | **Promote** as `WorkflowFileCache` | `@may-agent/sdk` |
| `circuit-breaker.ts` (182, 4 importers) | n/a | **Promote** | `@may-agent/sdk` |
| `dispatch-dedup-guard.ts` (280, 3 importers) | n/a | **Promote** | `@may-agent/sdk` |
| `budget-checkpoint.ts` (98) | n/a | **Inline** into each project copy of `project.ts` | — |
| `hooks/validate-on-create.ts` (31) | n/a | **Inline** (5-line wrapper) | — |
| `project-helpers.ts` (188) | 1 importer (`dispatch-validator`, dead) | **Delete** | — |
| `workflow-runner.ts` (236) | 0 | **Delete** (orphan) | — |
| `dispatch-validator.ts` (119) | 1 (dead) | **Delete** (becomes orphan) | — |
| `health-check.ts` (234) | 1 (dead) | **Delete** (becomes orphan) | — |
| `retry-wrapper.ts` (225) | 1 (dead) | **Delete** (becomes orphan) | — |
| `complexity-estimator.ts` (80) | 0 | **Delete** | — |
| `iteration-timer.ts` (88) | 0 | **Delete** | — |
| `iteration-budget.ts` (92) | 0 | **Delete** | — |
| `incremental-checkpoint.ts` (140) | 0 | **Delete** | — |
| `metrics-collector.ts` (146) | 0 | **Delete** | — |
| `output-validator.ts` (162) | 0 | **Delete** | — |
| `provider-retry.ts` (201) | 0 | **Delete** | — |
| `worker-retry.ts` (126) | 1 (perf bench only) | **Delete** + update bench | — |
| `fewshot-inject-helpers.ts` (165) | 1 (`implement-and-verify`, deleting) | **Delete** | — |
| `index.ts` (61) | n/a | **Delete** when dir is empty | — |
| `*.test.ts` | n/a | **Move/delete** with their subject files | — |
| `REGISTRY.md` | n/a | **Delete** | — |
| `project.md` parsers (in `shared/lib/project-health.ts`) | n/a | **Promote relevant exports** to SDK | `@may-agent/sdk` |

**Net effect:** 31 files dissolved → 6 SDK additions + 5 agent moves + N project
copies + ~20 deletions.

## Critical runtime constraint (discovered during Phase 1 execution)

**Bare `@may-agent/sdk` value imports do not resolve at runtime from dynamically-loaded
files** (workflows, handlers under `agents/` or `shared/`).

- Type-only imports (`import type { ... } from "@may-agent/sdk"`) work because
  they are erased at compile time.
- Value imports (`import { fn } from "@may-agent/sdk"`) fail with:
  `ResolveMessage: Cannot find module '@may-agent/sdk' from '/app/<file>'`
- Reason: the compiled `may-agent` binary doesn't walk `/app/node_modules` for
  bare specifiers in dynamically-imported modules (same root cause as the
  prior `shared/agent-sdk.ts` fix).

**Workaround in use:** import via the local re-export bridge
`shared/agent-sdk.ts` (which uses a relative path to the SDK source):

```ts
import { fn } from "../../../shared/agent-sdk.ts";  // from agents/<a>/workflows/
import { fn } from "../agent-sdk.ts";                // from shared/workflows/
```

This is mechanical — the import statement just routes through `agent-sdk.ts`,
which `export *`s from the relative SDK path. No semantic change.

When project-scoped workflows are created later (Phase 5+), they will use:
```ts
import { fn } from "../../../shared/agent-sdk.ts";   // from projects/<id>/workflows/
```

## Resolver change

`workflow-tool.ts` currently looks in two roots: `agents/<agent>/workflows/`
and `shared/workflows/`. After this work, lookup order becomes:

```
1. projects/<id>/workflows/      (if projectId is in scope)
2. agents/<agent>/workflows/
3. (shared/workflows/ — removed)
```

When a project is in scope, `projectId` is already threaded through
`runWorkflow` and `runWorkflowDirect`. The change is purely additive in the
resolver and three call sites (`sdk-impl.ts`, `toolset-loader.ts`, the inline
tool builder in `runWorkflowDirect`).

A **structural lint** (a CI test that grep-scans the repo) asserts
`shared/workflows/` is gone and no source file imports from it. This keeps the
rule honest going forward.

## Phases

Each phase ends with: tests green, tsc clean, container rebuilt, services up,
smoke test. Each phase is one or two commits, independently revertable.
**No phase deletes anything until the next-phase consumer is in place.**

### Phase 1 — SDK promotion (no behavior change)

**Goal:** All infra primitives that multiple homes will need live in
`@may-agent/sdk`. Old `shared/workflows/` files become thin re-export shims so
live importers keep working.

Steps:
1. Add to `packages/sdk/src/`:
   - `types.ts` (copy from `shared/workflows/types.ts`)
   - `circuit-breaker.ts` (copy)
   - `dispatch-dedup-guard.ts` (copy)
   - `heartbeat-data.ts` (copy)
   - `workflow-file-cache.ts` (copy of `project-cache.ts`, exported as
     `WorkflowFileCache`; keep `ProjectCache` as a deprecated alias for one
     release cycle)
   - `project-schema.ts` (carve out from `shared/lib/project-health.ts`:
     parsers + validator + comment helpers; the **infra** half. The
     **handler-policy** half — `MAX_LAUNCHES_PER_TICK`, `COOLDOWN_MS`,
     `diagnoseProject`, `scanAllProjects` — stays in `shared/lib/` for now
     since only `agents/may/handlers/project.ts` uses it.)
2. Re-export from `packages/sdk/src/index.ts`.
3. **Compatibility shims**: each of the moved files in `shared/workflows/`
   becomes a one-liner re-export from `@may-agent/sdk`. Same for the carved
   exports in `shared/lib/project-health.ts`. Old importers see no change.
4. Run tests; tsc; rebuild; smoke.

Commit: `repos/may-agent` *"feat(sdk): promote workflow infrastructure primitives"*

### Phase 2 — Update importers to use SDK

**Goal:** No live source file imports from `shared/workflows/*` for the
promoted primitives. The shims become unused.

Steps:
1. Update all 12 `agents/*/workflows/*-heartbeat.ts` to
   `import { ... } from "@may-agent/sdk"` instead of
   `from "../../../shared/workflows/heartbeat-data.js"`.
2. Update `agents/scout/workflows/scout-{explore,heartbeat}.ts` and
   `agents/coach/workflows/coach-heartbeat.ts` for `circuit-breaker` and
   `dispatch-dedup-guard`.
3. Update `src/lib/*.ts` files importing `types.ts` and friends.
4. Run tests; tsc; rebuild; smoke.
5. Verify no live source file (outside `shared/workflows/` itself) imports
   from `shared/workflows/`.

Commit: `repos/may-agent` *"refactor: import workflow primitives from SDK"*
Commit: `/app` *"refactor: agents import workflow primitives from SDK"*

### Phase 3 — Move single-owner workflows out of shared

**Goal:** Move `metric-alert-triage`, `closed-loop-steward`,
`session-recovery`, `verify-wrap` to `agents/may/workflows/`. Move
`evaluator-deep-eval` to `agents/evaluator/workflows/`. The agent-scoped
resolver finds them automatically.

Steps:
1. For each of the 5 files:
   - `git mv` to the agent's `workflows/` directory.
   - Update its imports to use `@may-agent/sdk` (no more
     `./circuit-breaker.js` etc.).
   - If it has a test alongside it (e.g.
     `shared/workflows/metric-alert-triage-workflow.test.ts`), move that too.
2. Verify the cron handler still finds them (the agent-name scope already
   matches; e.g., `metric-alert-triage` is invoked by May handlers, and May's
   `agents/may/workflows/` is the agent scope passed to the resolver).
3. **Spot-risk:** `verify-wrap` may be invoked from cron entries under
   different agent scopes. Audit each `cron.json` reference and confirm the
   calling agent matches the new home; if not, **each calling agent gets its
   own copy** (this is the "copy, don't share" rule). Given 0 live runs,
   easiest is one copy under `agents/may/` and update other agents' cron
   entries to remove the reference if they don't use it.
4. Run tests; tsc; rebuild; smoke (especially: verify a `metric-alert-triage`
   run completes by watching `workflow_runs`).

Commit: `/app` *"refactor: move single-owner workflows to their agent homes"*

### Phase 4 — Resolver supports `projects/<id>/workflows/`

**Goal:** The resolver looks in the project's workflow dir first (when a
`projectId` is in scope). Nothing uses it yet — the change is dormant until
Phase 5.

Steps:
1. In `src/lib/workflow-tool.ts`:
   - Change `listWorkflowFiles(workflowDir, sharedDir?)` to
     `listWorkflowFiles(dirs: string[])`.
   - Change `findWorkflow(workflowDir, name, sharedDir?)` to
     `findWorkflow(dirs: string[], name)`.
   - In `createWorkflowTool` opts, add `projectWorkflowDir?: string`. Wire it
     as the first dir when present.
   - When a project-scoped file overrides an agent-scoped one of the same
     name, log
     `[workflow] using project-scoped override 'X' from projects/<id>/workflows/`.
2. In `src/lib/sdk-impl.ts` (`runWorkflow`): when `opts?.projectId` is set,
   compute
   `projectWorkflowDir = join(deps.projectsRoot, opts.projectId, "workflows")`
   and pass it.
3. In `src/app/loader/toolset-loader.ts`: the workflow tool is built per-agent
   without a project ID — that path doesn't get project scope (correct: when
   an agent invokes `workflow.run` interactively, it's not "inside" a specific
   project, so no override applies).
4. In `runWorkflowDirect`: accept and forward `projectWorkflowDir` from the
   caller. Update `agents/may/handlers/project.ts` to compute it from
   `projectId`.
5. Add a unit test pinning precedence: project-scoped file with same `name` as
   a (still-shared, via shim) workflow wins.
6. Run tests; tsc; rebuild; smoke.

Commit: `repos/may-agent` *"feat(workflow): support project-scoped workflow overrides"*

### Phase 5 — Seed snapshot + migration helper

**Goal:** Capture the canonical seed of `shared/workflows/project.ts` and
build a small one-shot script that turns it into a project-scoped workflow,
so Phase 6 is mechanical.

Steps:
1. Snapshot: copy `shared/workflows/project.ts` (current `HEAD`) to a
   throwaway location (e.g. `/tmp/project-workflow-seed-<sha>.ts`) and record
   the sha. This is the seed every project will fork from.
2. Write `scripts/migrate-project-workflow.mjs` (~40 lines):
   - Args: `<project-id>` and optional `<workflow-name>` (default
     `<project-id>-iteration`).
   - Reads the seed, rewrites the 4 imports (SDK substitutions + inlines for
     `budget-checkpoint` and `validate-on-create`), prepends a provenance
     comment with the seed sha + date, writes
     `projects/<id>/workflows/<name>.ts`.
   - Updates `projects/<id>/project.md` frontmatter `workflow:` field.
   - Idempotent: refuses to overwrite an existing file.
3. Use it once on `platform` to verify (Phase 5b).

Commit: `/app` *"chore: snapshot project workflow seed + add migration helper"*

### Phase 5b — First migration: `platform`

**Goal:** `projects/platform/workflows/platform-iteration.ts` exists, imports
only from `@may-agent/sdk` + stdlib. The platform project runs through it.

Steps:
1. Run
   `node scripts/migrate-project-workflow.mjs platform platform-iteration`.
2. Inspect the result. Hand-edit if the script missed anything (treat as a
   QA pass).
3. Don't delete `shared/workflows/project.ts` yet — other projects still
   resolve through it.
4. Run an iteration of the platform project end-to-end; verify the log emits
   `using project-scoped override 'platform-iteration' from projects/platform/workflows/`
   and a `workflow_runs` row is written.

Commit: `/app` *"feat(platform): own project workflow under projects/platform/workflows/"*

### Phase 6 — Migrate remaining projects

**Goal:** Every active project has its own `workflows/project.ts`.
`shared/workflows/project.ts` has no consumers.

Per the audit (see bottom of doc), the migration set is the **13 non-terminal
projects with `workflow: project`** — `active` + `waiting` + `paused`. Closed
and done projects are skipped (their `project.md` will never be loaded again).

Steps:
1. For each project in the migration set, run the helper:
   `node scripts/migrate-project-workflow.mjs <id>`
   (uses the default name `<id>-iteration`).
2. Spot-check the generated file against the seed.
3. For projects with status `waiting` or `paused`, no need to launch an
   iteration — the next time they go `active`, they will resolve to the new
   workflow. For `aks-rp-e2e` (active), run one iteration and verify the
   override log.

Naming guideline: **unique + descriptive + project-distinctive**. Default is
`<id>-iteration`. If a project has multiple workflows (e.g. release flow vs.
iteration flow), use additional descriptive names like `platform-release`.
What matters is that no two workflows share a name and the name reflects the
project's actual role for it.

Commit (one per project, or one batch commit): `/app` *"feat(<project>): own project workflow"*

### Phase 7 — Demolition

**Goal:** `shared/workflows/` is gone.

Steps:
1. Delete every file in `shared/workflows/`:
   - The moved-then-shimmed files (Phases 1-3).
   - The dead helpers identified in the inventory
     (`implement-and-verify`, `workflow-runner`, `dispatch-validator`,
     `health-check`, `retry-wrapper`, `complexity-estimator`,
     `iteration-timer`, `iteration-budget`, `incremental-checkpoint`,
     `metrics-collector`, `output-validator`, `provider-retry`, `worker-retry`,
     `project-helpers`, `fewshot-inject-helpers`, `index.ts`, `REGISTRY.md`,
     all `*.test.ts`).
   - The original `project.ts` (last to go — only after all projects have
     their copy).
2. Update `shared/tests/perf/workflow-benchmarks.ts` to either remove the
   `worker-retry` import or relocate its dependency.
3. Delete the directory.
4. Update `shared/workflows/REGISTRY.md` references — the file
   `shared/may-agent-docs/2a-design/system-boundary-tracker.md` mentions it;
   rewrite that section to describe the new model.
5. Add a structural test: `test/no-shared-workflows.test.ts` — fails if any
   source file imports from `shared/workflows/` or if the directory exists.
6. Add a **divergence-observability test**: `test/project-workflow-inventory.test.ts`
   — lists every `projects/*/workflows/*.ts`, captures the git-blame sha of
   the first line of each, and writes a snapshot. Not a failure assertion;
   just makes divergence visible in CI output.
7. Run tests; tsc; rebuild; full smoke (one tick of every cron entry).

Commit: `/app` *"chore: dissolve shared/workflows/"*
Commit: `repos/may-agent` *"test: enforce no shared/workflows/ imports"*

### Phase 8 — Documentation

Steps:
1. Update `shared/may-agent-docs/2a-design/system-boundary-tracker.md` and any
   other design doc that references `shared/workflows/`.
2. Add a short doc `shared/may-agent-docs/2a-design/workflow-ownership.md`
   describing:
   - Three workflow homes (project, agent, SDK).
   - The "copy, don't share" rule for non-SDK code.
   - Promotion criteria for SDK additions (stable API, ≥2 distinct consumers
     that genuinely want identical behavior, low expected variance).
3. Update `projects/platform/project.md` to reflect that platform now owns its
   workflow.

Commit: `/app` *"docs: workflow ownership model"*

## Risk register

| Risk | Mitigation |
|---|---|
| Hot-reload picks up shim files while project file is still being edited (causing dual workflows of same name from different dirs) | Resolver logs "project-scoped override" every time. Smoke test after each phase checks logs. Lookup order is deterministic (project beats agent beats nothing). |
| Bun runtime can't find SDK exports if the SDK shim path isn't built into the bundle | `@may-agent/sdk` is resolved via relative path (per the prior fix in `shared/agent-sdk.ts`). All SDK additions go through the same export barrel. Each phase rebuilds the binary. |
| A project gets the resolver change before it has its own `project.ts` | Phase 4 doesn't *require* project files to exist — when `projects/<id>/workflows/` is missing or empty, lookup falls through to agent / (during transition) shared. Only Phase 7 deletes shared. |
| `verify-wrap` cron entries fire against an agent whose `workflows/` doesn't have a copy | Audit `cron.json` files before Phase 3. Either give each calling agent its own copy or remove the cron entries (none have fired in 7 days, so removal is defensible). |
| `evaluator-aftermath` (2567 runs/wk!) is agent-scoped already but if it ever transitively imports from `shared/workflows/`, breaking Phase 7 nukes the most-used workflow | Phase 2 ensures all agent workflows import only from SDK before Phase 7. Verify by grep before the final delete. |
| Hand-edited project copies of `project.ts` drift, making a future critical bugfix tedious to apply to all of them | **This is intentional.** Per the "copy, don't share" rule, that's the price of iteration freedom. Mitigation is observability: a structural test that lists all `projects/*/workflows/project.ts` files and reports their git-blame sha so divergence is visible. |
| Tests in `shared/workflows/*.test.ts` get orphaned | Each test moves with its subject in Phases 1-3. Any test of pure shared infra gets a new home under `packages/sdk/test/`. |
| The active session inspector / debugging tools assume the workflow file path is `shared/workflows/project.ts` | Audit. The `workflow_runs` DB stores workflow *name*, not path, so inspector queries by name are unaffected. Any code that hard-codes the path needs an update (likely none, but worth grepping). |
| Half-applied refactor leaves the container in a state where a workflow can't be found | Every phase ends with a smoke test. Each commit is independently revertable. The shim approach (Phase 1) means even if Phase 2 is reverted, the system runs fine. |

## Validation checkpoints (run at the end of every phase)

1. `bun test` in `repos/may-agent` → all green.
2. `bun run tsc --noEmit` in both `/app` and `repos/may-agent` → zero errors.
3. `bun run build && bun run reload` → container healthy, all 7 supervisord
   services RUNNING.
4. Watch `workflow_runs` for 10 minutes; verify the workflows that should fire
   (heartbeats, evaluator-aftermath, project for platform) do, with status
   `completed` not `failed`.
5. Grep audit:
   `git grep "from .*shared/workflows" -- 'src/**' 'agents/**' 'projects/**' 'shared/lib/**'`
   should return only the in-flight phase's expected matches (and zero at the
   end of Phase 7).

## Estimated effort (revised post-review)

- Phase 1+2 (atomic, no shims): ~150 LOC moved + ~30 import rewrites across
  18 files + careful pre-commit smoke (watch one heartbeat per agent fire). ~3 hrs.
- Phase 3: 5 file moves + import rewrites + cron audit. ~1.5 hrs.
- Phase 4: ~50 LOC resolver change + precedence test. ~1.5 hrs.
- Phase 5: snapshot + ~40-line migration script. ~1 hr.
- Phase 5b: run on platform + verify. ~30 min.
- Phase 6: 13 migrations × ~5 min each (script-driven) + spot-checks +
  1 active-project iteration verify. ~2 hrs.
- Phase 7: deletions + benchmark fixup + 2 structural tests + full smoke. ~1.5 hrs.
- Phase 8: docs. ~1 hr.

**Total: 12–16 hours of focused work** (was 8 — under-estimated the project
count), spread across ~10 commits (4-5 in `repos/may-agent`, 5-6 in `/app`).

## Decision points needed from reviewer

1. **`heartbeat-data.ts` promotion to SDK** — it's 575 lines and quite
   opinionated about may-agent's heartbeat model. Are you comfortable with it
   being a stable SDK export, or would you rather keep it in `shared/lib/`
   (not `shared/workflows/`) as may-internal infrastructure? Recommendation:
   **promote it.** It's the single biggest shared thing; locking the API
   stabilizes the heartbeat contract.

2. **`shared/lib/project-health.ts` — split or stay?** This file mixes
   (a) schema parsers (infra, → SDK) with (b) handler policies
   (`MAX_LAUNCHES_PER_TICK`, `diagnoseProject`, `scanAllProjects`). Cleanest
   is split: parsers → SDK, handler policies →
   `agents/may/handlers/project-policy.ts` (since may is the sole consumer).
   Or leave the file in `shared/lib/` and only re-export parsers from SDK.
   Recommendation: **split** (consistent with the dissolve-shared rule).

3. **Compatibility shims in Phase 1** — yes/no? Shims keep Phase 1 zero-risk
   but mean Phase 2 has more import-rewrite work. Alternative: do Phases 1+2
   as one atomic commit (no shims, all importers updated at once). Preferred:
   **atomic** — fewer moving parts, cleaner history.

4. **Project workflow copies — exact or already-tweaked?** When `aks-rp-e2e`
   gets its own `project.ts` in Phase 6, should it get the **original**
   content (the same file `platform` started from), or **platform's
   possibly-diverged** content (whatever Phase 5 left it as)? Recommendation:
   **the original.** Each project starts from the same baseline; they diverge
   from there. Otherwise `platform` accidentally becomes a new shared base.
   Concretely: snapshot `shared/workflows/project.ts` *before* Phase 5 and use
   that snapshot as every project's seed.

5. **In-flight changes** — there is pre-existing dirty state in
   `repos/may-agent/src/app/http/server.ts`, `ui/index.html`,
   `packages/sdk/src/index.ts`. Should those be reviewed/integrated before
   starting, or worked around?

---

## Review Notes (2026-05-17)

### Approved decisions

| Decision point | Resolution |
|---|---|
| #1 — `heartbeat-data.ts` → SDK | **Promote.** 12 importers = clear shared infra. |
| #2 — Split `project-health.ts` | **Split.** Parsers → SDK, handler policies → `agents/may/handlers/project-policy.ts`. |
| #3 — Compatibility shims | **Skip shims. Do Phases 1+2 atomically.** 150 LOC + 30 import rewrites is one focused commit. No half-state. |
| #4 — Project workflow seed | **Use the original** (snapshot before Phase 5). Each project diverges from the same baseline. |

### Design change: project-specific workflow names

Each project **must choose a unique, descriptive workflow name** rather than all
using `project.ts`. Examples:

- `projects/platform/workflows/platform-iteration.ts`
- `projects/aks-rp-e2e/workflows/aks-rp-e2e-iteration.ts`

Rationale:
- **Signals independence** — no one sees 5 files named `project.ts` and thinks
  they should stay in sync.
- **Eliminates "which copy is canonical?"** — there is no canonical one; names
  make that obvious.
- **Resolver is unambiguous** — `workflow: platform-iteration` can only resolve
  to one file.
- **Drift is expected, not a bug** — these are independent workflows that share
  a common ancestor, not copies of "the same thing."

Each copy should include a provenance comment at the top:
```typescript
// Forked from shared/workflows/project.ts @ <git-sha> on <date>.
// Owned by this project. Diverge freely.
```

Update `project.md` frontmatter accordingly: `workflow: platform-iteration`
(not `workflow: project`).

### Additional notes

- **Lock down the project list now.** "Others to be enumerated at Phase 6 start"
  is a gap — query `projects/*/project.md` for `workflow: project` and list them
  all before starting Phase 5.
- **Effort estimate is optimistic.** 8 hours for 10 commits across 2 repos with
  smoke tests between each is tight. Budget 10-12 hours including import-miss
  iteration.
- **The structural divergence test** (reporting git-blame sha of each project's
  workflow) belongs in Phase 7, not deferred.

---

## Audit data (snapshot for verification)

### `workflow_runs` last 7 days (2026-05-08 → 2026-05-15)
```
 2567 evaluator-aftermath      (agent-scoped, already in agents/evaluator/)
  514 scout-explore            (agent-scoped, agents/scout/)
  294 scout-heartbeat          (agent-scoped)
  293 may-heartbeat            (agent-scoped)
  292 dev-heartbeat            (agent-scoped)
  291 arc-heartbeat            (agent-scoped)
  288 evaluator-heartbeat      (agent-scoped)
  200 metric-alert-triage      ← shared, → agents/may/
  186 closed-loop-steward      ← shared, → agents/may/
  119 evaluator-deep-eval      ← shared, → agents/evaluator/
   84 project                  ← shared, → projects/<id>/ (one copy each)
   11 scout-daily-digest       (agent-scoped)
```

### Projects currently using `workflow: project` (audited 2026-05-17)

**Migration set — 13 non-terminal projects (need a fork):**

| Project | Status | Owner |
|---|---|---|
| `aks-rp-e2e` | active | may |
| `platform` | paused | tech-lead |
| `finish-blocked-hygiene-reduction` | paused | dev |
| `ruflo-learning-loop` | paused | arc |
| `closed-loop-reliability` | waiting | may |
| `daily-alert-review` | waiting | may |
| `eval-llm-lane-restoration` | waiting | dev |
| `evaluator-aftermath-null-trigger-loop` | waiting | evaluator |
| `evaluator-low-quality-rate-calibration` | waiting | evaluator |
| `evaluator-strategy-extractor-calibration` | waiting | evaluator |
| `master-worker-context-sharing` | waiting | master |
| `proof-of-life-dashboard` | waiting | tech-lead |
| `scout-second-brain-learning` | waiting | scout |

**Skipped (terminal status — `project.md` no longer loaded):** 13 projects
with status `closed`, `done`, or `complete`.
