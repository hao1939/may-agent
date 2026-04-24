# QA Context (Schema-Organized — EXP-212 Rollout)

## ⚡ [SESSION START — Read These First]

**Your environment:**
- **Project root is /app** — NEVER use /home/*, /Users/*, /root/*, or ~/ paths
- **agents/ is a separate git repo** — commit from agents/ dir
- **bun**: `.state/.bun/bin/bun` — add to PATH: `export PATH=".state/.bun/bin:$PATH"`
- **npx**: NOT available — use `./node_modules/.bin/<tool>` or `bun x <tool>`
- **rg (ripgrep)**: NOT installed — use `grep -r` instead
- **tsc**: `./node_modules/.bin/tsc --noEmit` (always use `timeout: 300`)
- **vitest**: `./node_modules/.bin/vitest run` (always use `timeout: 300`)

**First actions:** Orient before acting. First 3-5 tool calls should be read/ls/grep to understand context.

**⚠️ CRITICAL — YOU MUST CALL finish() EVERY SESSION (C1.4 regression: 42% compliance)**
Even if you discover the environment isn't what you expected, even if tsc/vitest can't run — you MUST still call finish() with an appropriate status. "I found nothing to do" → finish(status: 'success', summary: 'No actionable items'). "Environment mismatch" → finish(status: 'success', summary: 'Heartbeat check complete — noted environment constraints'). NEVER just stop without finish().

## ⚡ [BEFORE EDITING ANY FILE]

- **C1.1**: You MUST read() the target file first in the same session. No exceptions.

## ⚡ [AFTER EVERY write() CALL]

- **C1.3**: After write(), read() the file back to verify. (5 violations.)

## ⚡ [BEFORE CALLING finish()]

- **C1.4 CRITICAL** (22 violations — your #1 issue): ALWAYS call finish() at the end of every session. Never end with a plain text summary.
- **C8.2** (17 violations): Include summary and completed_items in every finish() call.
- **C1.7**: Before finish(success), run a verification step in your last 5 tool calls.

## ⚡ [WHEN DOING QA REVIEWS]

- ALWAYS run tsc and vitest when reviewing code changes — mandatory SOUL.md steps 2-3.
- finish() status guide: Use 'success' when YOU completed your QA review — even if vitest/tsc found pre-existing failures unrelated to your review. Use 'partial' only if you couldn't complete your review steps. Use 'blocked' only if something prevents any review at all.
- Tool schemas/descriptions can lag behind implementations — contract drift is a real risk, verify against actual behavior.
- Silent catch blocks (try/catch swallowing errors) are a recurring finding — flag as IMPORTANT unless explicitly benign.
- When tests fail from environment/module-resolution issues, classify as environment mismatch and record exact import path.
- Request DB is the single source of truth for pending work — todo.md was removed.

## ⚡ [GENERAL KNOWLEDGE]

- **KE-008**: Do NOT restructure heartbeat steps. Add content within existing steps only.
- Don't treat suspiciously formatted code as a compile error if tsc passes — verify with line-range read first.

## Reflexion-Extracted Lessons
- [insight] Partial completion: vitest failed with 51 failing tests (launcher.ts deleted but tests still require it; plus node:sqlite missing under bun).
- [SCOPE_DRIFT] QA heartbeat should verify/review — don't commit new library files that aren't requested.


## Learned from experience

- /app root is NOT a TS/Vitest project — tsc/vitest only work in task-specific repos, not during heartbeats. This is expected. Don't treat it as a finding; just call finish() normally.
- agents/ is the only git repo — /app itself is not a git repo. This is the normal setup.
