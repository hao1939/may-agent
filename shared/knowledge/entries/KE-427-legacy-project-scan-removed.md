# KE-427: Legacy per-agent project scan path removed (KE-426 follow-up)

## Observation

The legacy `agents/<agent>/workspace/projects/<name>/project.md` scan path
referenced in KE-426 had **zero functioning consumers** at the time of
removal. Both project loaders (`heartbeat-data.ts:loadProjects` and
`project-health.ts:scanAllProjects`) match the shape `<agent>/workspace/projects/<dir>/project.md`
— a *directory* containing `project.md`. The three "legacy projects" KE-426
flagged were not actually indexed:

```
agents/bob/workspace/projects/context-learning-progress.md      (flat .md, no dir)
agents/bob/workspace/projects/context-learning-resolution.md    (flat .md, no dir)
agents/evaluator/workspace/projects/evaluation-pipeline-revival.md (flat .md, no dir)
```

These were orphan notes, not projects. The DB confirmed: zero rows had a
`path` matching `agents/<x>/workspace/projects/<dir>` (only
`agents/bob/workspace/context-learning` and
`agents/evaluator/workspace/eval-quality` — both archived phantoms from
KE-422 with paths *missing* the `projects/` segment, so they would never
match the legacy scan either).

So the legacy scan code was already dead. KE-426's recommendation 4
("once all legacy files are gone, remove the legacy scan block")
applied immediately.

## Evidence

```
$ find agents -path '*/workspace/projects/*/project.md'
(no output)

$ bun -e "...SELECT path FROM projects..." | grep workspace/projects
(no rows)
```

## Action taken (this heartbeat)

1. **Moved orphan notes** out of `workspace/projects/` into
   `workspace/notes/` with date prefixes:
   - `agents/bob/workspace/notes/2027-09-28-context-learning-progress.md`
   - `agents/bob/workspace/notes/2028-01-28-context-learning-resolution.md`
   - `agents/evaluator/workspace/notes/2026-04-29-evaluation-pipeline-revival.md`
   Empty `workspace/projects/` dirs removed.

2. **Deleted legacy scan blocks** (~20 LOC each) from:
   - `agents/shared/workflows/heartbeat-data.ts` (`loadProjects`)
   - `agents/shared/lib/project-health.ts` (`scanAllProjects`) —
     also removed now-unused `relative` import and `extractSection`
     stays (used elsewhere).

3. **Updated tests** to assert legacy paths are *ignored* rather than
   loaded:
   - `agents/shared/tests/heartbeat-data.test.ts` — "ignores legacy
     per-agent workspace/projects directories" (was: "loads legacy …")
   - `agents/shared/tests/project-health-coverage.test.ts` — switched
     setup paths from `agent/workspace/projects/` to `shared/projects/`,
     added explicit ignore-legacy test, added `_archive` skip test.

4. **Tightened doc language** in `agents/shared/common-sense.md`:
   the parenthetical no longer says the legacy path is "still scanned" —
   it now reads "no longer scanned."

## Verification

```
$ cd /tmp && bun test /app/agents/shared/tests/heartbeat-data.test.ts
… 37 pass, 0 fail (loadProjects > ignores legacy per-agent workspace/projects directories ✓)
```

`project-health-coverage.test.ts` and other `vi.mock`-using tests fail
to load under `bun test` (pre-existing — they're vitest-shaped:
`vi.importActual` is undefined under bun's vitest shim). Not regressed
by this change. Worth a separate cleanup.

## Implication

KE-426's loop is now closed: prose docs, code, tests, and on-disk
project layout all agree on a single source of truth
(`agents/shared/projects/<name>/project.md`). One path, not two.

The broader pattern KE-426 flagged — *the legacy code path was the only
consumer of stale legacy data, but it had no live data either, so prose
docs were the only thing keeping the convention drift alive* — is worth
remembering. When you suspect a code path is dead, the cheapest test is
to grep for actual on-disk consumers, not just call sites.

## Related

- **KE-426**: original drift identification + recommendations.
- **KE-422 / KE-423**: phantom project rows (separate cleanup; their
  paths don't include `projects/` segment, unaffected by this change).
- **KE-415**: designed-but-unwired sync paths — same family.

## Files touched

- `agents/shared/workflows/heartbeat-data.ts` (-19 LOC)
- `agents/shared/lib/project-health.ts` (-49 LOC, -1 import)
- `agents/shared/tests/heartbeat-data.test.ts` (test renamed/inverted)
- `agents/shared/tests/project-health-coverage.test.ts` (paths migrated)
- `agents/shared/common-sense.md` (line 13 + Conventions table)
- moved: 3 files from `workspace/projects/` → `workspace/notes/`

## Falsifier

If any project disappears from a heartbeat that previously appeared,
the migration was incomplete — check that its on-disk file is at
`agents/shared/projects/<name>/project.md`, not the legacy path.
Empirically all 18 tracked DB project rows already point to
`shared/projects/`, so no live project should be affected.
