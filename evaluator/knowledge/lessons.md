# Evaluator lessons (rolling)

- If a session ends with `finish()` blocked by uncommitted changes, mark outcome quality down even if a deliverable file was written; require evidence the block was resolved (successful commit/clean tree) before scoring as done.
- When a worker is instructed to write under `agents/shared/projects/...`, ensure that path is actually tracked in the relevant git repo; if `git add` reports the path is ignored, treat as process failure and escalate rather than retrying `finish(success)`.
- When `finish()` reports specific uncommitted files, verify what actually got committed with `git show --name-only <sha>`; the initially reported files may have been reverted or never included in the commit.
