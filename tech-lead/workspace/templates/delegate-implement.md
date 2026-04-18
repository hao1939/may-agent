# Template: Delegate Implement-Feature to Coder

Use via `workflow.run("implement-and-verify", ...)` or `persistent-task` for multi-iteration.

```
Implement: <ONE_SENTENCE_GOAL>
Spec: <SPEC_FILE_OR_INLINE>
Files to create/modify: <EXPLICIT_LIST>
Out of scope: <FILES_TO_LEAVE_ALONE>
Interfaces to keep stable: <EXPORTS_OR_SIGNATURES>
Acceptance:
  - <OBSERVABLE_BEHAVIOR>
  - Types clean: `./node_modules/.bin/tsc --noEmit`
  - Tests pass: `bun test <TEST_FILE_OR_GLOB>`
Verify command: `./node_modules/.bin/tsc --noEmit && bun test <TEST_GLOB>`
```

Slots: ONE_SENTENCE_GOAL, SPEC_FILE_OR_INLINE, EXPLICIT_LIST, FILES_TO_LEAVE_ALONE, EXPORTS_OR_SIGNATURES, OBSERVABLE_BEHAVIOR, TEST_FILE_OR_GLOB.
