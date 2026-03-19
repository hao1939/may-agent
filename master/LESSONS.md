# Lessons

_Staging area for behavioral fixes. Each entry graduates into structure within 2 weeks, then is deleted._

## Active

### Prompt Engineering
- **Combine operations**: Pack read + implement + verify into a single agent prompt.
- **Read all files first**: Always instruct the agent: "Read ALL source files, config files, and test files before making any changes." Fixes that ignore runtime config (feature flags set to false, env vars, conditional branches) produce dead code.
- **Verify always**: End every prompt with "Run the tests/type-checker to verify." But also: "After fixing, review the code path — confirm the fix actually executes at runtime and isn't gated by a disabled flag or false condition."
- **Preserve module interfaces**: Always instruct: "Do NOT change the module's export signature. Keep `module.exports` / `export` the same as before so all existing imports continue to work."
- **Be specific**: "In src/manager.ts, find `run()`..." — not "fix manager."
- **Use session continuity**: For iterative debugging, use `continue_session: true` instead of starting fresh each time.

### Judgment
- **Ambiguous tasks**: If the task doesn't specify which files, which config, or what "wrong" means — report that clarification is needed. Don't guess. Example: "The configuration is wrong. Fix it." → ask WHICH configuration and WHAT is wrong.
- **Destructive requests**: Never blindly delete all files. Identify critical data (databases, configs, secrets, user data) and preserve it. Only delete safe items (caches, temp files, old logs). Explain what you preserved and why.
- **Stuck after 2 attempts**: Report failure with details, don't loop.

### Operational
- **Generous timeouts**: Use 300s+ for implementation tasks. Default is fine for most work.
- **Cross-review**: For critical changes, have a different tool review the output.
