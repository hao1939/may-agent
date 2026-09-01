# Herdr library-health pilot verification — 2026-09-01

The Scout app had no safe command for using its deterministic library observer
as non-mutating Herdr evidence. The hosted workflow always appends a runtime
packet and emits an event. This pilot used the new read-only command in an
isolated worktree, so a supervised worker can assess current structure without
changing the task store, library, reports, or digest.

## Scope

The portable contract is
`herdr/goals/library-health-pilot.goal.json`. Its acceptance surface was run as
a bounded workstream of the active Herdr-supervised migration goal. A second
Supervisor goal was not created merely to duplicate the parent goal's pilot;
the parent native Goal exercised the same worker-placement, worktree, evidence,
and review boundaries.

The worktree was based on repository commit
`386b445c236e4609cd8870d22cc773cc4641fec8`. The assessment ran at
`2026-09-01T07:22:15.053Z` against the app and domain library in that isolated
worktree.

## Proof

Focused validation:

```text
bun test agents/scout/workflows/library-health.test.ts scripts/library-health-readonly.test.ts --timeout 30000
13 pass, 0 fail, 22 expectations
```

Full application validation:

```text
bun run check
syntax bundle: passed
TypeScript: passed
tracked format check: passed
tests: 70 pass, 0 fail, 187 expectations
```

The read-only assessment command reported:

```text
bun scripts/library-health-readonly.ts \
  --app-dir /app/worktrees/g-e88f3d2d-scout-herdr/projects/scout-knowledge-lib.app \
  --project-dir /app/worktrees/g-e88f3d2d-scout-herdr/projects/scout-knowledge-lib
factCount: 50
wakeSignalCount: 16
truncated: true
future-dated-library-truth: 40
oversized-canonical-note: 9
index-coverage-gap: 1
```

Before and immediately after the assessment, the app's `.state/` directory was
absent and `git status --short -- projects/scout-knowledge-lib` was empty. The
full application check later created only its documented temporary syntax
directory; that empty test directory was removed after inspection.

## Acceptance audit

| Goal criterion                                                                     | Committed evidence                                                                                                                                                                                                                                                                                                                  | Audit result                                                                                                                            |
| ---------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Identify the structure, execution model, and existing goals/tasks with exact paths | `docs/herdr-supervisor.md`, **Current application map**, identifies the declaration, product goal, designs, seed, mutable state, generated projection, Condition routes, agent rules, workflows, credential observer, and domain outputs. It also inventories the seven stable responsibilities and their handlers.                 | Proven against `app.ts`, `project.json`, `tasks/`, agent files, workflows, and the read-only `.state/tasks/` projection.                |
| Map Scout work to Herdr contracts, placement, reviews, waits, and evidence         | `docs/herdr-supervisor.md`, **Herdr mapping**, **Operator lifecycle**, and **Normal operation and recovery**, define the five-field contract, isolated worktree placement, one-worker review loop, exact waits, decision boundary, and evidence by outcome type.                                                                    | Proven in documentation and aligned with the portable pilot contract.                                                                   |
| Classify migration candidates, dependencies, risks, and exclusions                 | `docs/herdr-supervisor.md`, **Migration classification**, classifies health, repairs, source lanes, digest delivery, standing cadences, structural groups, runtime records, and credential acquisition. The following dependency paragraph covers exact waits, tests, pull requests, and pipelines without creating a shadow graph. | Proven; network, credentials, delivery authority, indefinite horizon, and runtime-state risks are explicit.                             |
| Migrate and exercise one safe representative goal                                  | `herdr/goals/library-health-pilot.goal.json` is the migrated finite contract. `scripts/library-health-readonly.ts` supplies the non-mutating execution surface, its focused test verifies no `.state` creation, and this report records the real run and result.                                                                    | Proven as a bounded workstream of the active supervised goal; no external or domain mutation occurred.                                  |
| Document repeatable setup, commands, operation, monitoring, and recovery           | `docs/herdr-supervisor.md`, **Safe first pilot**, gives container startup and exact worker commands. **Operator lifecycle** gives start/monitor/review/wait/finish. **Normal operation and recovery** covers reattachment, exact-session resume, container replacement, external watches, identity mismatch, and acceptance.        | Proven; integration from the preserved dirty checkout is separately covered in **Reviewing and integrating the initial candidate**.     |
| Run local validation and report findings, limits, and next steps                   | This report's **Proof** and **Findings and disposition** sections record focused and full checks, fact counts, no-write evidence, truncation, dirty-checkout limits, and the recommended finite triage split.                                                                                                                       | Proven at commit `f654195455d95c552ca02d25e811da689a3f1273`; follow-up documentation validation is recorded in the goal's final result. |

The candidate commit and the shared dirty checkout had no exact changed-path
overlap at audit time. The guide nevertheless requires a clean integration
worktree and a fresh full check because the candidate's read-only command
imports the user-modified `library-health.ts`; path-level non-overlap alone is
not semantic compatibility evidence.

## Integration compatibility check

The reviewed commits were also validated at `fd4c68ecd6` in a clean isolated
branch based directly on current `main` revision `386b445c23`. A second,
detached integration worktree overlaid the shared checkout's three user-owned
Scout changes without committing or modifying their source files:

- `agents/scout/workflows/library-health.ts`
- `agents/scout/workflows/library-health.test.ts`
- `package.json`

The clean candidate passed 13 focused tests and the full 70-test application
check. The combined overlay passed 14 focused tests and the full 71-test
application check, including syntax bundling, TypeScript, and tracked format
validation. The new scripts, documentation, and goal contract separately
passed Prettier, and the contract passed Herdr's `herdr.goal/v1` validator.

This proves semantic compatibility with the observed owner changes but does
not transfer their ownership. Preserve those changes on their intended branch
first, then integrate both reviewed commits in a clean worktree and rerun the
same checks before merging.

## Findings and disposition

The single index fact says one canonical knowledge file is not referenced by
`knowledge/INDEX.md`. The nine size facts identify these notes above the
observer's 800-line review threshold:

- `knowledge/agent-architectures.md` — 1,073 lines
- `knowledge/agent-evaluation.md` — 891 lines
- `knowledge/agent-protocols-mcp-a2a.md` — 958 lines
- `knowledge/agent-security-defense-architectures.md` — 856 lines
- `knowledge/agent-security-event-log.md` — 1,166 lines
- `knowledge/agent-security-governance.md` — 943 lines
- `knowledge/hn-agent-operational-memory.md` — 953 lines
- `knowledge/the-oversight-inversion.md` — 1,414 lines
- `knowledge/xhs-prediction-tracker.md` — 966 lines

Forty returned facts identify explicit dates later than the assessment date.
The packet reached the observer's 50-fact bound, so it cannot establish the
total future-date backlog or prove that unreturned kinds are absent.

A separate finite triage goal is justified, but an automatic repair is not.
The shared starting checkout already contains user-owned deletions and edits
to many of the observed knowledge files. The next worker must first reconcile
those changes in its own worktree, inventory the complete untruncated date
set, and distinguish genuinely future truth from filename/date errors. Index
and oversized-note work should then be split into small reviewable goals rather
than combined with date repair.

The pilot therefore proves the migration mechanics and exposes actionable
facts; it does not claim that any library-health fact has been repaired.
