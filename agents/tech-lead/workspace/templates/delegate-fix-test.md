# Template: Delegate Fix-Test to Coder

Use via `workflow.run("implement-and-verify", ...)`.

```
Fix failing test: <TEST_FILE>::<TEST_NAME>
Root cause (if known): <ONE_LINE>
Files in scope: <EXPLICIT_LIST>   # ONLY these — do NOT modify others
Out of scope: <FILES_TO_LEAVE_ALONE>
Acceptance:
  - <TEST_FILE> passes: `bun test <TEST_FILE>`
  - No new failures: `npm run check` exit 0
Verify command: `./node_modules/.bin/tsc --noEmit && bun test <TEST_FILE>`
```

Slots: TEST_FILE, TEST_NAME, EXPLICIT_LIST, FILES_TO_LEAVE_ALONE.
