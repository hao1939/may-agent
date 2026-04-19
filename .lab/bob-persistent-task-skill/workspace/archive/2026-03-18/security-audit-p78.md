# Security Audit: `run-checks.sh` — `eval "$cmd"` (P78)

**Auditor:** tech-lead  
**Date:** 2026-03-14  
**File:** `agents/shared/skills/check-state/run-checks.sh`

## Finding

`eval "$cmd"` is used in two places:
- `assert_exit_zero()` (line ~151)
- `assert_exit_code()` (line ~159)

## Q1: Is `$cmd` sanitized?

**No explicit sanitization.** `$cmd` comes from:
- Checklist files (agent-authored, one assertion per line), or
- `--inline` CLI arguments (agent-authored)

The flow: `run_assertion exit_zero npx tsc --noEmit` → `assert_exit_zero "npx" "tsc" "--noEmit"` → `cmd="npx tsc --noEmit"` → `eval "$cmd"`.

There is no user-facing input path — only agents write checklists, and agents are already inside the P53 trust boundary. The outer bash guard (`checkBashCommand()` in `agent-loader.ts` + `bash.ts`) validates all commands before they reach this script.

## Q2: Can we replace `eval` with direct execution?

**Partially.** For simple commands (`npx tsc --noEmit`, `grep -q foo bar`), `"$@"` works. But `eval` is needed for:
- Shell operators: `exit_zero cmd1 && cmd2`
- Pipes: `exit_zero cat foo | grep bar`
- Redirects: `exit_zero cmd > /dev/null`

Since checklist files are designed to support arbitrary shell commands in `exit_zero`/`exit_code` assertions, removing `eval` would break legitimate use cases.

**Recommendation:** Keep `eval` but add explanatory comments. The defense layers are:
1. **P53 bash guard** — blocks dangerous commands at agent-loader level
2. **Agent authorship** — only agents write checklists (not external users)
3. **No network input** — checklist files are local, committed to repo

## Q3: Safety comments added?

**Yes — see below.**

## Verdict: SAFE (with documentation)

`eval` is justified here. The command source is trusted (agent-authored checklists), protected by P53 bash guards, and needed for shell operator support. Risk: LOW.
