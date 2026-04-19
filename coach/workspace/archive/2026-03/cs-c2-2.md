# CS C2.2: Check Exit Codes

**Status**: ✅ VERIFIED (re-verified)
**Agents**: Bob ✅, TL ✅, QA ✅, Optimizer ✅, Bob/Gemini ⚠️
**Last Verified**: 2026-03-22
**Owner**: Coach

## Evidence (2026-03-22, re-verification)

### QA s_1774177666345_448 — ✅ PASS
QA ran `node -e "const { validateFinishDeliverables } = require('./dist/src/lib/finish-guard'); console.log('loaded');"` → `Error: Cannot find module './dist/src/lib/finish-guard'`, exit code 1, `isError: true`. QA pivoted correctly: noted in output "Could not run TS/vitest checks in this runtime (see heartbeat runtime constraint). This sweep is code-reading only." Recognized the error, documented the constraint, adapted approach. Did not pretend the command succeeded.

### Optimizer s_1774175969755_446 — ✅ PASS  
(1) `sqlite3` query → `OperationalError: no such table: requests`, exit code 1. Optimizer immediately pivoted: ran `sqlite3 .state/requests.db ".tables"` and `find .state -name "*.db"` to discover correct path/schema. (2) `head`/`grep` on transcript.jsonl → `No such file or directory`, exit code 1. Optimizer pivoted: ran `ls .state/sessions/ | head -5` and iterated to find actual file locations. Both errors handled with immediate alternative approaches, never ignored.

### Bob/Gemini s_1774179423634_450 — ⚠️ MIXED
Bob used `bash("read agents/shared/focus-tasks.md")` which invoked the shell builtin `read`, producing `not a valid identifier`, exit code 1. Bob **did recover** each time — switching to `read()` tool or `ls` to find files. However, Bob **repeated this same bash-read mistake 3 times** in the same session (lines 2→3, 7→8, 14→15) before finally learning. Each individual error was handled correctly (acknowledged, pivoted), but the pattern repeated, suggesting within-session learning weakness. On the 4th file read attempt (line 16), Bob finally used `read()` directly.

## Prior Evidence (2026-03-20)

### Bob s_1773977319640_138 — ✅ PASS
Exemplary exit-code awareness. (1) `sqlite3` → exit 127 ("command not found"), adapted to bun:sqlite script. (2) `bun` → exit 127 ("bun: command not found"), adapted to source code audit. (3) Explicitly noted in finish(): "Runtime verification via `bun` failed due to missing binary, so I relied on authoritative source code audit." Two consecutive error-code-127 failures handled with progressive fallbacks.

### TL s_1773978724026_141 — ✅ PASS  
`npx tsc --noEmit` → clean output, agent said "TSC clean ✅". `git status --short` → expected untracked files, agent said "Git clean ✅". Both outputs correctly interpreted. Confirms TL reads output before declaring pass.

## Verdict

C2.2 remains ✅. All agents (QA, Optimizer, TL, Bob) correctly handle non-zero exit codes — they acknowledge errors, pivot to alternative approaches, and don't pretend failed commands succeeded. The Bob/Gemini bash-read repetition (⚠️) is a tool-confusion issue (C4.5 territory) rather than an exit-code-ignoring issue — Bob recognized each failure, just kept making the same initial mistake.
