# Skill: Revert Change

## Description
Safely reverts the most recent modification to a specific file (reasoning core, skill, or configuration) using git. Used by the Evaluator to automatically rollback changes when "Fatal Drift" (>15% performance drop) is detected.

## Inputs
- `filePath` (string, required): The path to the file to revert (e.g., `agents/may/SOUL.md`).
- `sinceCommit` (string, optional): A commit hash to revert *back to*. If omitted, reverts the *last commit touching this file*.

## Behavior
1. **Safety Check**: Verify `filePath` is within an allowed agent directory (`agents/*/`).
   - *Deny*: `src/` (Codebase is off-limits for auto-revert).
   - *Deny*: `*.json` (Config files might break system parsing if reverted partially).
2. **Identify Commit**: Run `git log -n 1 --pretty=format:%H -- <filePath>` to find the last commit that touched this file.
3. **Revert**: Run `git revert <commitHash> --no-edit`.
   - If conflicts arise: `git revert --abort` and return error.
   - If successful: `git push`.
4. **Log**: Append entry to `agents/evaluator/revert-log.jsonl` with `{ timestamp, file, commit, reason: "DRIFT" }`.

## Output
- **Success**: `REVERTED <filePath> to <commitHash>`
- **Failure**: `ERROR: <reason>` (e.g., "Merge conflict", "File not allowed", "No recent changes").

## Constraints
- **Atomic Reverts**: Only reverts if the operation is clean. No manual conflict resolution.
- **Scope Limited**: Can only revert Markdown files (`.md`). Code/JSON changes require human intervention.
