
## Environment
- **Project root**: /app — no /home/*, /Users/*, /root/*, or ~/ paths
- **No src/ directory** or package.json at /app root — the runtime is pre-compiled
- **bun**: .state/.bun/bin/bun (add to PATH: `export PATH=".state/.bun/bin:$PATH"`)
- **npx**: not available — use ./node_modules/.bin/<tool> or bun x <tool>
- **sudo**: not available
- **sqlite**: sqlite3 CLI and node:sqlite NOT available — use bun:sqlite
- **agents/ is a separate git repo** (gitignored from main) — commit from agents/ dir
- **Code search**: `scripts/code-search.sh <pattern>` (supports --path, -C, -i, -l)

---

## ⚡ Trigger-Based Rules

### [BEFORE EDITING ANY FILE]
**Trigger**: You are about to call edit() or write() on a file
1. **STOP** — did you read() this exact file in this session? If NO → read() it NOW.
2. No exceptions. Not even files you just created. Not even files the task quotes verbatim.
3. Why: task descriptions often have slightly wrong whitespace/line numbers. Only a fresh read() gives you the real content.

### [AFTER EVERY write() CALL]
**Trigger**: You just called write()
1. Immediately read() the file back to verify content is correct.

### [SESSION START]
**Trigger**: Beginning of any session
1. First 3-5 tool calls must be read/ls/grep — orient before acting.
2. Re-read the task description. Confirm EXACT file paths. If paths don't exist, `find` or `ls` — do NOT pivot to unrelated files.

### [BEFORE CALLING finish()]
**Trigger**: You are about to call finish(status="success")
1. Run the test command first (node test.js, npm test, etc.) and read FULL output.
2. If tests fail, fix and re-run. Do NOT claim success with failing tests.
3. Copy-paste specific passing output as evidence.

### [AFTER FIXING A BUG]
**Trigger**: You've applied a code fix
1. Run the FULL test suite, not just the one related test.
2. Trace the data flow downstream — does your fix change inputs to other modules?
3. Check: do existing tests actually cover the edge case you fixed? If not, add a test.

### [WHEN A TASK INVOLVES USER INPUT / HTML]
**Trigger**: Code renders user content to HTML, markdown, or templates
1. Search ALL test assertions, not just failing ones.
2. Look for security: XSS sanitization, script tag removal, onerror stripping.
3. Check transitive dependencies — module A calls module B which renders HTML → A needs sanitization too.

### [WHEN TASK SAYS "DELETE" OR "CLEAN UP"]
**Trigger**: Task says "delete all", "remove everything", "clean up"
1. List directory contents first. Classify: SAFE (cache, temp, logs) vs MUST PRESERVE (db, config, secrets).
2. Delete only safe files. Report what you preserved and why.

### [WHEN BLOCKED ON ONE ITEM]
**Trigger**: Multi-item task and one item is blocked (file missing, service down)
1. Spend ≤3 tool calls confirming, then mark BLOCKED.
2. Move to next item. Do NOT replan from scratch.
3. Complete all non-blocked items, note what was blocked in summary.

### [WHEN TEST AND CODE DISAGREE]
**Trigger**: Test expects one value, code produces another
1. STOP — determine which is correct before editing either.
2. Read the business requirement / specification.
3. If the test expectation is wrong, fix the TEST, not the production code.

---

## Lessons from Experience
- [fix] vitest needs --run flag in CI/automated contexts to avoid interactive watch mode
- [fix] Always run npm install first
- [pattern] Always check command exit codes when running test suites programmatically
- [pattern] Check math functions: `Math.trunc` vs `Math.round`, off-by-one, integer division
