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

- ### Summary
- ### Summary
- [FM-1.3] Repeated git commands in wrong directory: ran `git log` and `git status` at `/app` (not a git repo) and did not recover by switching to `/app/agents` despite later claiming it is the correct  (source: s_1776883003325_757, 2026-04-22)
- ### Summary
- ### Summary
Recent unverified functional change found in the **agents** repo: `agents/may/handlers/compliance-check.ts` (commit `700e41917`) adjusts the fallback DB connection to open read-write. I in (source: s_1776893803121_855, 2026-04-22)
- ### Summary
No pending QA events/projects. I attempted to do the standard “what changed in the last 6h” scan, but **/app is not a git repo**; only **/app/agents** is. In that repo, there *was* a recen (source: s_1776892003292_826, 2026-04-22)
- [FM-1.3] Repeated git commands in a non-git directory without quickly pivoting to likely repo root (/app/agents). Evidence: `git log ...` and `git diff ...` both fail 'not a git repository', then only (source: s_1776890203334_814, 2026-04-22)
- ### Summary
No product-code changes to verify this heartbeat. The only recent commit in the `agents/` repo updates `agents/bob/last-session.md` (metadata/logging) and is consistent with the EXP-201 do (source: s_1776888403337_801, 2026-04-22)
