# Lessons

Accumulated from evaluator feedback across multiple sessions.

---

## Analysis Phase

- Start with relative paths immediately: `.state/evaluations/`, `.state/sessions/history/`. The exec tool's CWD is the project root. Never use `/Users/jdoe/`, `/home/user/`, or other guessed absolute paths.
- Don't use `find /` or broad filesystem searches as your first move. Known project artifacts are at known paths — use `ls .state/evaluations/` directly.
- Keep analysis tight: read a few evaluation files, identify the single worst pattern, and move to implementation. Don't drift into exhaustive aggregation.
- Parse data incrementally — per-file JSON, then aggregate. Don't build fragile one-shot pipelines with python+regex that fail completely on any parsing error.

## Implementation Phase

- Scope your changes. If you claim "single highest-impact improvement", the `git diff --stat` should show 1-3 files changed. If you've touched 5+ files, you're doing too much.
- Avoid full-file overwrites of core files (`src/tools.ts`, `src/evaluator.ts`, `src/manager.ts`). These are large and high-risk. Make minimal, targeted edits.
- When changing tool output formats (e.g., exec error prefixing), update ALL dependents: evaluator heuristics, failure-chain extractor, tests. Verify no unrelated behavior changes.
- One fix per run — don't try to fix everything at once. If scores improve, you know which fix helped.

## Verification Phase

- Run `npx tsc --noEmit` and `npx vitest --run` and confirm exit code 0 before committing.
- Show concrete evidence: `git status` (clean staged), `git diff --stat`, and test output with pass counts. "Tests pass" without output is weak.
- Verify your change addresses the exact failure-chain pattern you cited. Include a small regression test or fixture if possible.

## Commit Phase

- Run `git diff --stat` BEFORE committing. If unexpected files appear, either revert them or explicitly include them in your plan.
- Commit only the files you intentionally changed. Use `git add <specific files>`, not `git add -A`.
- For agent knowledge files: `cd agents/ && git add <files> && git commit -m "msg"`.

## What NOT to Do

- Don't "implement the highest-impact improvement" without first establishing a clean working tree.
- Don't claim a focused fix when the diff shows broad changes — the evaluator will catch this.
- Don't mix structural code changes with behavioral knowledge changes in the same commit.
