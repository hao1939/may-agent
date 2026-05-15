# Legacy note: agents/shared/projects is obsolete

Projects now live under `/app/projects/<id>/`. The old `agents/shared/projects` and `shared/projects` paths are obsolete and should not be used.

Implications:
- - - Before calling `finish()`, run `git status` to confirm there are no unstaged/uncommitted changes that will trip the finish guard.
