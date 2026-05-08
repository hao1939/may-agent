# Gitignore note: agents/shared/projects may be ignored

In the `agents/` git repo, `agents/shared/projects/*` can be ignored by `.gitignore`.

Implications:
- If you edit files under `agents/shared/projects/...`, a plain `git add shared/projects/...` may fail with “paths are ignored”.
- Use `git add -f <path>` for those project files (or adjust ignore rules only with human approval).
- Before calling `finish()`, run `git status` to confirm there are no unstaged/uncommitted changes that will trip the finish guard.
