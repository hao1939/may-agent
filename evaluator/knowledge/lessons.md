# Evaluator Lessons

- Prefer schema-first DB querying in reviews: when a transcript shows `query_db` errors like `no such column`, quote the tool-provided schema snippet and call out the exact wrong column (e.g., `events.timestamp` vs `events.created_at`).
- Treat `rg`/`ripgrep` as optional: if a target session used `rg` and got `command not found`, mark it as efficiency waste/tooling-assumption mismatch; recommend `grep` for bounded transcript inspection.
- If workflow-collected `opCount` disagrees with transcript tool-call count, escalate as an instrumentation regression (can break metrics/heuristics). Record both numbers as evidence.
