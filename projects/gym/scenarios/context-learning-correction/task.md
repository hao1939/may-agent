You previously worked on this project and recorded some facts about it. Those facts
are listed below in the "What You Know" section that was injected into your context.

However, some of those facts may be WRONG or OUTDATED. Your job:

1. Read the actual project files in this directory to verify each fact
2. Identify which facts are correct and which are wrong
3. In your `finish()` call, use `context_updates` to:
   - **Remove** incorrect facts: `{ action: "remove", content: "<the wrong fact>" }`
   - **Add** corrected facts: `{ action: "add", content: "<the corrected fact>" }`

Here are the facts you previously recorded:

- Project uses Node.js runtime
- Database is PostgreSQL
- Config file is at config/settings.yaml
- Tests run with Jest

Check these against the actual project files and correct any that are wrong.

**Important**: You MUST use both `remove` and `add` actions in `context_updates` since
some facts are definitely wrong. Do not just add new facts — actively remove the wrong ones.
