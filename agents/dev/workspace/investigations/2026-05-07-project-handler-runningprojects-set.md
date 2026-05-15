# Project handler failure: runningProjects placeholder changed Set to Array

## Signal
Recent `handler.failed` events show repeated failures from the May `project` handler:

```json
{"handler":"project","agent":"may","error":"runningProjects.has is not a function. (In 'runningProjects.has(projectId)', 'runningProjects.has' is undefined)"}
```

The latest readonly DB query showed four recent `handler.failed` rows with this exact error in the visible sample, so this was the dominant actionable handler failure.

## Root cause
`agents/may/handlers/project.ts` initialized `runningProjects` as `new Set<string>()`, then a placeholder block reassigned it to `[]`:

```ts
let runningProjects = new Set<string>();
// ...
runningProjects = []; // TODO: query DB for active project sessions
```

`agents/shared/lib/project-health.ts::diagnoseProject()` expects a `Set<string>` and calls `runningProjects.has(projectId)` for active projects. Reassigning to an array caused every active-project diagnosis path to throw before the handler could complete.

## Fix
Removed the array reassignment and left the initialized empty `Set` in place until live project-session state is available through `HandlerContext`.

This restores type/shape compatibility and preserves current behavior as "no known running projects" rather than crashing.

## Verification
- Read-back of `agents/may/handlers/project.ts` lines 69-77 confirms `runningProjects` remains `new Set<string>()` and is no longer reassigned to `[]`.
- `bun --syntax agents/may/handlers/project.ts` passes.
