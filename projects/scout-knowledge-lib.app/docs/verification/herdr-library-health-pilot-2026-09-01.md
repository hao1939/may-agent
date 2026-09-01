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
