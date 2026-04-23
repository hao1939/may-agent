- bun is at .state/.bun/bin/bun — add to PATH: `export PATH=".state/.bun/bin:$PATH"`
- npx is not available in this environment — use ./node_modules/.bin/<tool> or bun x <tool>
- rg (ripgrep) is not installed — use grep -r instead
- Project root is /app — do not use /home/*, /Users/*, /root/*, or ~/ paths
- agents/ is a separate git repo — commit from agents/ dir
- finish() status guide: Use 'success' when YOU completed your QA review (read code, ran checks, logged findings) — even if vitest/tsc found pre-existing failures unrelated to your review. Use 'partial' ONLY if you couldn't complete your own review steps. Use 'blocked' ONLY if something prevents you from doing any review at all. Pre-existing test failures are findings to report, not blockers on your QA work.
- ALWAYS call finish() at the end of every session — never end with a plain text summary. The finish() call is mandatory. Include a summary in every finish() call. (C1.4: 22 violations, C8.2: 17 violations last week.)
- tsc and vitest ARE available: `./node_modules/.bin/tsc --noEmit` and `./node_modules/.bin/vitest run`. ALWAYS run these when reviewing code changes — they are mandatory SOUL.md steps 2-3. Do NOT skip them. **Always use `timeout: 300`** — these commands regularly exceed the default 120s timeout, causing wasted bash:timeout-killed errors.
- Tool schemas/descriptions can lag behind implementations — contract drift is a real risk, verify against actual behavior
- Silent catch blocks (try/catch swallowing errors) are a recurring finding — flag as IMPORTANT unless explicitly benign with logging
- When tests fail from environment/module-resolution issues, classify as environment mismatch and record exact import path
- Don't treat suspiciously formatted code as a compile error if tsc passes — verify with line-range read first
- Request DB is the single source of truth for pending work — todo.md was removed
- **KE-008**: Do NOT restructure heartbeat steps (reorder, merge, rename). Heartbeat regressions are caused by structural changes, not content. Add content within existing steps only.

## Convention Compliance
- **C1.1**: ALWAYS read() a file before edit()ing it.
- **C1.3**: After write(), read() the file back to verify. (5 violations.)
- **C1.4**: End every session with finish() — don't let sessions time out. (22 violations — your #1 issue.)
- **C8.2**: Include summary and completed_items in finish() calls. (17 violations.)
- **C1.7**: Before finish(success), run a verification step (read/grep/test) in your last 5 tool calls.
- **C12.1**: Start sessions by reading context (read/ls/grep) in first 5 tool calls.


## Reflexion-Extracted Lessons
- [insight] Partial completion: Ran proactive QA heartbeat on HEAD c82d7a9: read container/Dockerfile, tsc passed, vitest failed with 51 failing tests (launcher.ts deleted but tests still require it; plus node:sqlite missing under N


## Learned from experience

- Spent many calls on avoidable environment/path discovery after the first 'not a git repo' error at /app; did not immediately pivot to /app/agents where the repo lives (git log/status both failed at /a (source: s_1776919003981_1042, 2026-04-23)
- Started verification from the wrong directory: ran `git log`/`git status` at `/app` where there is no `.git`, causing immediate failures and wasted calls (git code 128 twice). Evidence: tool outputs s (source: s_1776917204208_1031, 2026-04-23)
- ### Summary
- ### Summary
- Ran multiple git commands in a non-git working directory and did not quickly pivot to the correct repo root (wasted calls). Evidence: `git log`, `git status`, `git diff` all failed with `fatal: not a  (source: s_1776926203384_1098, 2026-04-23)
- ### Summary
- [FM-1.3] Repeatedly attempted git commands in a non-git working directory without first locating the correct repo root (git log, git diff both failed with 'not a git repository'). (source: s_1776937003487_1174, 2026-04-23)
- ### Summary
- ### Summary
- ### Summary
- ### Summary
- ### Summary
- ### Summary
- ### Summary
This heartbeat environment doesn’t contain a Git repository or a Node toolchain install (no `package.json`, no `node_modules/.bin`), so I can’t identify “what changed in the last 6h” via ` (source: s_1776951403650_1278, 2026-04-23)
- ### Summary
This heartbeat environment doesn’t contain a git repository (no `.git` found anywhere up to `..`), so I can’t audit “last 6h changes” via `git log` or review diffs. I *did* independently i (source: s_1776949605141_1267, 2026-04-23)
