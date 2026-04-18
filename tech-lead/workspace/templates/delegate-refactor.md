# Template: Delegate Refactor to Coder

Use via `workflow.run("implement-and-verify", ...)`.

```
Refactor: <WHAT_AND_WHY_ONE_LINE>
Prior finding (if any): <PATH_TO_LENS_MD>
Files in scope: <EXPLICIT_LIST>
Out of scope: <FILES_TO_LEAVE_ALONE>
Behavior must not change. Public API must not change: <EXPORTS>
Acceptance:
  - All existing tests still pass: `bun test`
  - Types clean: `./node_modules/.bin/tsc --noEmit`
  - No new call sites, no new deps
Verify command: `./node_modules/.bin/tsc --noEmit && bun test`
```

Slots: WHAT_AND_WHY_ONE_LINE, PATH_TO_LENS_MD, EXPLICIT_LIST, FILES_TO_LEAVE_ALONE, EXPORTS.
