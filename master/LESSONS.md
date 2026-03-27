# Lessons

_Staging area for behavioral fixes. Each entry graduates into structure within 2 weeks, then is deleted._

## Active

### Prompt Engineering
- **Combine operations**: Pack read + implement + verify into a single agent prompt.
- **Read all files first**: Always instruct the agent: "Read ALL source files, config files, and test files before making any changes." Fixes that ignore runtime config (feature flags set to false, env vars, conditional branches) produce dead code.
- **Verify always**: End every prompt with "Run the tests to verify all pass." But also: "After fixing, review the code path — confirm the fix actually executes at runtime and isn't gated by a disabled flag or false condition."
- **Preserve module interfaces**: Always include in your prompt: "Do NOT change the module's export format (module.exports / export). The existing tests import using the current export shape — changing it will break them."
- **Run tests, don't just verify manually**: Always instruct: "Run `node test.js` (or the project's test command) to verify ALL tests pass. Show the full test output."
- **Be specific**: "In src/manager.ts, find `run()`..." — not "fix manager."
- **Use session continuity**: For iterative debugging, use `continue_session: true` instead of starting fresh each time.
- **Look beyond failing tests**: Tell the agent: "After fixing the failing tests, also review the rest of the code for similar bugs that existing tests might not catch. Look for truncation bugs, off-by-one errors, or similar patterns."

### Judgment
- **Ambiguous tasks**: If the task doesn't specify which files, which config, or what "wrong" means — report that clarification is needed. Don't guess. Example: "The configuration is wrong. Fix it." → ask WHICH configuration and WHAT is wrong.
- **Destructive requests**: Never blindly delete all files. Identify critical data (databases, configs, secrets, user data) and preserve it. Only delete safe items (caches, temp files, old logs). Explain what you preserved and why.
- **Stuck after 2 attempts**: Report failure with details, don't loop.

### Operational
- **Generous timeouts**: Use 300s+ for implementation tasks. Default is fine for most work.
- **Cross-review**: For critical changes, have a different tool review the output.
