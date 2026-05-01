# KE-426: Project Location Doc Drift — `<agent>/workspace/projects/` vs `shared/projects/`

## Observation

Three system documents disagreed about where projects live:

| Source | Stated location | Status |
|--------|-----------------|--------|
| `agents/shared/may-agent-docs/projects.md` | `agents/shared/projects/<name>/project.md` | ✅ canonical (per may-agent-docs) |
| `agents/shared/common-sense.md` (line 13 + Conventions table) | `agents/<you>/workspace/projects/` | ❌ stale — pointed only at the legacy/secondary location |
| `agents/shared/may-agent-docs/core-principles.md` (Convention example) | `agents/bob/workspace/projects/X` | ❌ outdated example — encodes owner in path, but shared projects don't |
| `agents/shared/workflows/heartbeat-data.ts` (`loadProjects`) | scans BOTH; comment calls shared "new location" and per-agent "legacy" | ✅ matches reality |

Code is correct (scans both, prefers shared), but the prose docs an agent reads first told them to use the legacy path. New agents reading `common-sense.md` would put new projects in the wrong place.

## Evidence

```
$ bun -e "import {Database} from 'bun:sqlite'; const db=new Database('.state/may.db',{readonly:true}); console.log(db.query(\"SELECT path, COUNT(*) FROM projects GROUP BY substr(path, 1, instr(path, '/')-1)\").all())"
[ { path: 'shared/projects/documentation-gen', n: 15 },
  { path: 'agents/bob/workspace/context-learning', n: 3 } ]

$ find agents -path '*/workspace/projects/*' -not -path '*.state*' -not -path '*.git*'
agents/bob/workspace/projects/context-learning-progress.md
agents/bob/workspace/projects/context-learning-resolution.md
agents/evaluator/workspace/projects/evaluation-pipeline-revival.md
```

15/18 tracked projects use `shared/projects/`. The 3 outliers are the
phantom rows from KE-422 — bob's two and evaluator's one — which have
project.md files in the legacy location AND DB rows pointing to
`agents/bob/workspace/<name>` (no `projects/` segment) and
`agents/evaluator/workspace/<name>`. The legacy path is now used only
by the broken phantom data; functioning projects all live in
`shared/projects/`.

`heartbeat-data.ts` line 110-130 confirms code intent — comment reads
"Scan shared projects (new location)" and "Also scan legacy per-agent
location."

## Implication

When prose docs and code agree on intent but disagree in detail,
agents trust whichever they read first. `common-sense.md` is loaded
into every heartbeat preamble, so its stale instruction was the
**likeliest** source of new project drift. Three "legacy" project files
exist in `agents/bob/` and `agents/evaluator/` — at least some of which
were created *after* the convention shifted to `shared/projects/`,
because the doc that agents read still pointed there.

This is a small instance of the larger pattern KE-415 / KE-419 / KE-425
document: the system has the right idea but the deploy/sync surface
between source-of-truth and what-agents-see is leaky.

## Recommendation

1. **(done)** `common-sense.md` line 13 + Conventions table updated to
   `agents/shared/projects/<name>/` as canonical, with a parenthetical
   acknowledging the legacy path is still scanned.
2. **(done)** `core-principles.md` convention example fixed to not
   imply owner is encoded in project path.
3. **Migrate the 3 legacy project files** — `bob/workspace/projects/{context-learning-progress,context-learning-resolution}.md`
   and `evaluator/workspace/projects/evaluation-pipeline-revival.md` —
   to `shared/projects/`, OR mark them done and stop indexing them.
   Currently they're the only consumers of the legacy code path.
   (Touches the KE-422 phantom rows; coordinate with that fix.)
4. **Future:** once all legacy files are gone, remove the
   `// Also scan legacy per-agent location` block from
   `heartbeat-data.ts` (~20 LOC) so there is one path, not two.
   Single-source-of-truth.

## Falsifier

If after the migration in step 3, any project under
`agents/<agent>/workspace/projects/` still appears in `loadProjects()`
output, then either (a) some agent's heartbeat workflow is using a
different project loader (check), or (b) the migration was incomplete.

## Related

- **KE-415**: Designed-but-unwired sync paths (same family — code +
  doc disagree).
- **KE-422 / KE-423**: Phantom project rows. The legacy-location
  files overlap with these, so coordinate cleanup.
- **KE-425**: Workflow source edits don't deploy without restart —
  if step 4 is taken later, that restart applies.

## Files

- `agents/shared/common-sense.md` (edited this heartbeat)
- `agents/shared/may-agent-docs/core-principles.md` (edited this heartbeat)
- `agents/shared/may-agent-docs/projects.md` (already correct, unchanged)
- `agents/shared/workflows/heartbeat-data.ts` lines 105-148
  (loadProjects — already correct, unchanged)
