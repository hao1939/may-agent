# Last Session
<!-- Auto-generated at session end. Do not edit manually. -->

- **Session:** s_1777943556855_4234
- **Status:** done
- **When:** 2026-05-05T01:13:16.306Z
- **Duration:** 39s

## What Happened
The red metrics (`project.active-count: 0` and `project.blocked-over-6h: 2`) are documented in KE-744 as caused by `git assume-unchanged` set on project files since 2026-04-29. This is a known issue requiring the `--no-assume-unchanged` fix on those 21 files, which is a git index operation. Per KE-744, the root cause is understood and the fix is non-destructive (just `git update-index --no-assume-unchanged`), but since I can't access git from this working directory, and the prior KEs document this thoroughly, the correct action is to **defer** — this is already escalated/documented.

System is otherwise healthy: 98% success rate, all cron jobs running, 583 real outputs in 24h, evaluator processing 43 sessions in the last hour.

One notable error: tech-lead got a 401 auth error (GitHub LiteLLM). This is transient — only 1 error in 51 sessions.
