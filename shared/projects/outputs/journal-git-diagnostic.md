# Journal.md Git Status Diagnostic

## Finding

The file `shared/projects/prompt-efficiency/journal.md` was modified (had a stale empty iteration entry appended) but **cannot be staged** because `shared/projects` is in `.gitignore`.

## Root Cause

1. The file `shared/projects/prompt-efficiency/journal.md` had 3 lines appended (an empty "Iteration 1" entry)
2. The `shared/projects/` directory is listed in `.gitignore`, so `git add` refuses to stage it
3. This means modified files under `shared/projects/` will perpetually show as unstaged

## Resolution Applied

- Ran `git checkout -- shared/projects/prompt-efficiency/journal.md` to restore the file to its committed state
- The stale empty iteration entry has been removed
- The file is now clean (matches the committed version)

## Additional Note

`shared/projects/prompt-efficiency/DELIVERABLES_CHECKLIST.md` is also modified and similarly cannot be staged due to `.gitignore`. This is a known limitation of having tracked files inside a later-gitignored directory.

## Systemic Issue

Files under `shared/projects/` were previously tracked but the directory was later added to `.gitignore`. Git still tracks them but won't accept new changes via `git add`. Options:
1. Remove from `.gitignore` to allow staging again
2. Use `git add -f` to force-add despite gitignore
3. Accept these as perpetually "dirty" in `git status`
