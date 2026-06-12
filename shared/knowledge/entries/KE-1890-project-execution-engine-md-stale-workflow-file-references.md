<ai_context>
The project-execution-engine.md design doc referenced project-execution-engine.ts in three
places, but that file was deleted and replaced by problem-solver.ts and
project-execution-watchdog.ts. The file listing also used the old V2 path
(projects/aks-rp-e2e/.app/) instead of the V3 path (projects/aks-rp-e2e.app/).
Fixed in this session. The old file is archived at
projects/aks-rp-e2e.app/archive/old-workflows/project-execution-engine.ts.
Triggers: project-execution-engine.md, project-execution-engine.ts, problem-solver.ts, coherence audit
Related: KE-1858, KE-1878, KE-1879
</ai_context>

# KE-1890: project-execution-engine.md — Stale Workflow File References

**Status**: resolved
**Discovered**: 2026-06-14
**Agent**: arc (heartbeat coherence audit)
**Scope**: design doc accuracy
**Related**: KE-1858 (task-tree-engine/project-execution-engine vocabulary split)

## Finding

The design doc `shared/may-agent-docs/2a-design/project-execution-engine.md` had
three stale references to `project-execution-engine.ts`:

1. **Line 1192** — file listing under the project app layout showed
   `project-execution-engine.ts` but this file was deleted. The current
   workflow set is: `project-planner.ts`, `task-worker.ts`, `problem-solver.ts`,
   `project-execution-watchdog.ts`.

2. **Line 1427** — "aks-rp-e2e V1 Plan" section listed
   `projects/aks-rp-e2e/.app/workflows/project-execution-engine.ts`. Two issues:
   - Wrong file name (deleted, replaced by `problem-solver.ts` + watchdog)
   - Wrong path format (old V2 `.app/` nested path vs V3 `.app` suffix)

3. **Line 1430** — described `project-execution-engine.ts` as the
   "compatibility/helper implementation" that "remains" in use. It no longer
   remains; it was archived to `projects/aks-rp-e2e.app/archive/old-workflows/`.

## Evidence

```bash
# HEAD tree shows no project-execution-engine.ts in active workflows
git ls-tree HEAD -- projects/aks-rp-e2e.app/workflows/
# Shows: problem-solver.ts, project-planner.ts, task-worker.ts,
#        project-execution-watchdog.ts, app-event-contract.test.ts, lib/

# Archived copy exists
ls projects/aks-rp-e2e.app/archive/old-workflows/project-execution-engine.ts
# Confirmed present
```

## Fix

Updated all three locations in `project-execution-engine.md`:
- File listing now shows `problem-solver.ts` and `project-execution-watchdog.ts`
- V1 plan section uses correct V3 path (`projects/aks-rp-e2e.app/workflows/`)
- Description now states the old file was archived, not "remains"

## Pattern

This is the third coherence cascade from the V2→V3 migration (after KE-1878, KE-1879).
Design docs that reference file paths are especially prone to drift when
files are renamed, deleted, or restructured. The V2 embedded `.app/` → V3 sibling
`.app` path change affected multiple docs.
