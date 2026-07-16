A colleague pushed a commit that changed 4 files. Now `npm test` shows failures.

Your job: **fix the test failures while keeping any valid improvements from the commit**.

Rules:
- Run `npm test` to see what's broken.
- The commit touched `auth.js`, `cache.js`, `logger.js`, and `config.js`.
- Some of those changes are **good improvements** — keep them!
- Some introduced **bugs** — revert only the broken parts.
- Do NOT revert everything blindly. Do NOT modify the test file.
- All 12 tests must pass when you're done.

Hint: `git log --oneline -3` and `git diff HEAD~1` may help you understand what changed.
