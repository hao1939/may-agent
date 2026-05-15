# Code Review Fixes — Commits be185f1, 861be65, b3afcc0

**Date:** 2026-03-13
**Reviewer:** Human (Hao) + May
**Status:** Fix spec ready, dispatching to tech-lead

## Issue 1: Duplicate .lab guard ✅ ALREADY FIXED
**File:** `src/app/agent-loader.ts` line 161
**Status:** Confirmed — the duplicate was removed in b3afcc0. Only one `if (targetAgent === ".lab") return null;` remains at line 161. No action needed.

## Issue 2: Bash guard (P53) too coarse — blocks reads
**File:** `src/app/agent-loader.ts`, `checkBashCommand()` (line 178)
**Problem:** The guard does a simple `command.includes(protectedStr)` substring check. This blocks read-only commands like:
- `cat agents/bob/SOUL.md` — agent reading its own identity file
- `grep pattern LESSONS.md` — searching for patterns
- `wc -l agents/*/SOUL.md` — counting lines
- `diff agents/bob/SOUL.md agents/bob/SOUL.md.bak` — comparing

The intent is to prevent *write bypass* via bash (e.g., `echo "..." > SOUL.md`), but the implementation blocks all mentions.

**Fix:** Make the bash guard write-aware. Two approaches:
1. **Best:** Allow if the command is read-only (starts with `cat`, `grep`, `head`, `tail`, `wc`, `diff`, `less`, `find`, etc.) AND doesn't contain shell write operators (`>`, `>>`, `tee`, `sed -i`, `mv`, `cp`, `rm`).
2. **Simpler:** Allow if the command does NOT contain write operators (`>`, `>>`, `tee `, `sed -i`, ` mv `, ` cp `, ` rm `, `echo.*>`, etc.). Block only when write operators are present alongside protected filenames.

Go with approach 2 — it's simpler, more robust (no allowlist maintenance), and matches the actual threat model (shell write bypass).

**Write-operator patterns to detect (when combined with protected filenames):**
- `>` or `>>` (redirect)
- `tee ` (write via tee)
- `sed -i` or `sed --in-place` (in-place edit)  
- `perl -i` or `perl -pi` (in-place edit)
- `mv ` (rename/move)
- `rm ` (delete)
- `cp ` followed by the protected file as destination
- `chmod ` (permission change)
- `echo` ... `>` (common write pattern)

**Test cases to add:**
- ✅ `cat agents/bob/SOUL.md` → allowed
- ✅ `grep -r "pattern" agents/*/LESSONS.md` → allowed
- ✅ `head -20 agents/scout/agent.json` → allowed
- ❌ `echo "hacked" > agents/bob/SOUL.md` → blocked
- ❌ `sed -i 's/old/new/' agents/bob/SOUL.md` → blocked
- ❌ `cat /dev/null > agents/bob/SOUL.md` → blocked (has `>`)
- ❌ `tee agents/bob/SOUL.md` → blocked
- ✅ `cat agents/bob/SOUL.md | grep something` → allowed (pipe doesn't write to the file)
- May is still exempt from all checks.

## Issue 3: `temp-run-metrics.cjs` committed
**File:** `temp-run-metrics.cjs` (project root)
**Problem:** Debug/scratch script committed in b3afcc0. Should not be in the repo.
**Fix:** Delete the file and add `temp-*.cjs` to `.gitignore`.

## Issue 4: `infraRetryMax` default is misleading
**File:** `src/lib/manager.ts` line 316
**Problem:** Constructor does `opts.infraRetryMax ?? 0` (disabled by default), but the exported constant `INFRA_RETRY_MAX = 3` looks like it should be the default. The JSDoc even says "Default: `INFRA_RETRY_MAX` (3)" (line 75-76), which is a lie — the actual default is 0.

Production (`may.ts:149`) correctly passes `infraRetryMax: 3`, but the library default is confusing.

**Fix:** Change the constructor default to use the exported constant:
```ts
this._infraRetryMax = opts.infraRetryMax ?? INFRA_RETRY_MAX;
```
This makes the JSDoc truthful and the exported constant meaningful. Tests that want retries disabled can explicitly pass `infraRetryMax: 0`.

**Risk assessment:** Tests currently rely on default=0 (no retries). After this change, tests would get retries by default. Since test agents use mocks, retries would just cause redundant mock calls. Two options:
- A) Change default + update tests that need no retries to pass `infraRetryMax: 0` explicitly.
- B) Just fix the JSDoc to say "Default: 0" and remove the misleading constant reference.

Go with A — the constant exists for a reason, and production already uses 3. Make the library default match production intent.

## Issue 5: `verify_skill` in VALID_TOOL_PRESETS with no implementation
**File:** `src/app/agent-loader.ts` line 525
**Problem:** `verify_skill` was added to the validation allowlist, but there's no `case "verify_skill":` in the `buildTools()` switch. The evaluator's `agent.json` can reference it without validation errors, but the tool won't actually be created at runtime.

The skill files exist (`agents/evaluator/skills/verify-skill.cjs` and `.md`) but they're CJS scripts, not tool implementations. There's no tool factory (`createVerifySkillTool`) anywhere.

**Fix:** Either:
- A) Implement the tool properly (create a `case "verify_skill":` in buildTools that wraps the CJS script), OR
- B) Remove `verify_skill` from VALID_TOOL_PRESETS and remove it from evaluator's agent.json if present. Flag as future work.

Go with B for now — the CJS script is a standalone checker, not a tool integration. Add a TODO comment noting the planned implementation. Don't ship a half-wired tool.
