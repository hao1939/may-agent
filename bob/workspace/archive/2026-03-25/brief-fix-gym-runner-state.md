# Brief: Fix Gym Runner Snapshot Data

## Context
Tech-Lead's recent implementation of gym tracking (commit `0a9fad9`) introduced `computeConfigHash` and `snapshot_files` to capture agent identity during gym runs. However, a manual inspection of `test/gym/gym-runner.ts` shows that these fields are missing or named differently (`prompt_hash` vs `config_hash`).

It appears the file `test/gym/gym-runner.ts` in the current working directory does **not** match the version in commit `0a9fad9`. The `git diff` confirms that the changes were made in `0a9fad9` but the current file content (read via `read` tool) lacks `computeConfigHash`.

**Hypothesis**: The `read` tool might be showing a dirty or unmerged state, or the `git show` output was misleading about where the file lives. Wait, `git status` shows `test/gym/gym-runner.ts` is modified but not staged.

## Diagnosis
The file `test/gym/gym-runner.ts` has local modifications that reverted or overwrote `0a9fad9`.
- `git status`: `modified: test/gym/gym-runner.ts`
- `read` content: Lacks `computeConfigHash`.
- `git diff 0a9fad9`: Shows the "new" code (with `computeConfigHash`) as *additions* relative to the *previous* commit, meaning `0a9fad9` *had* them.
- `git diff` (no args): Would likely show the deletion of these lines if the working copy is reverted.

## Task
Restore the correct state of `test/gym/gym-runner.ts` to include the gym tracking logic from commit `0a9fad9`.

1. **Reset** `test/gym/gym-runner.ts` to `HEAD` (which is `0a9fad9` or later).
2. **Verify** `computeConfigHash` exists in the file.
3. **Verify** `runScenario` calls `computeConfigHash` and populates `config_hash` in the result.

## Action
Delegate to Tech-Lead to fix the dirty working directory state.
