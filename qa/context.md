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

- ### Summary
This heartbeat found no active production alerts, but there is a **pre-existing environment mismatch** with the mandatory QA toolchain: this repo root (`/app`) is **not a TS/Vitest project (source: s_1776987499850_118, 2026-04-24)
- ### Summary
Heartbeat review found the repo is **not a git repository**, and the standard QA toolchain commands (**tsc**/**vitest**) cannot run because those binaries are not installed (only `better-s (source: s_1776987186483_112, 2026-04-24)
- ### Summary
No pending events/alerts, so I performed a heartbeat verification sweep. `/app` is **not** a git repo (only `/app/agents` is), and the mandatory TS/Vitest QA checks **cannot run** here bec (source: s_1776985699689_106, 2026-04-24)
