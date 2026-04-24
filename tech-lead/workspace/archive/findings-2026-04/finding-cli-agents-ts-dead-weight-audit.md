# Dead Weight Audit: src/lib/cli-agents.ts (562 LOC)

**Date**: 2026-04-15  
**Auditor**: tech-lead  
**File**: `src/lib/cli-agents.ts`

## Summary

The file is mostly alive — all 3 tool factory functions (`createClaudeCodeTool`, `createGeminiCliTool`, `createCodexTool`) are actively consumed by `src/app/agent-loader.ts`. The main findings are: **1 unreachable line** (dead return), **3 re-exported-but-unused utilities**, and **significant code duplication** across the three tool factories.

## Findings

### 1. DEAD CODE: Unreachable return on line 408

**Severity**: Medium (dead code, minor confusion risk)  
**Lines**: 407–408  
**LOC removable**: 1

```ts
// Line 407 — this return always executes:
return textResult(truncateOutput(cleanOutput, maxOutput) + `\n\n[session_id: ${effectiveSessionId}]`);
// Line 408 — UNREACHABLE, never executes:
return textResult(truncateOutput(cleanOutput, maxOutput));
```

Line 408 is dead — the function always returns at line 407. This was likely left behind when session-ID tracking was added to the Claude Code tool. The old return (without session ID suffix) was not deleted.

**Action**: Delete line 408.

---

### 2. DEAD EXPORTS: truncateOutput, stripAnsi, spawnCliAgent (re-exported but zero external consumers)

**Severity**: Low (no runtime impact, minor API surface bloat)  
**Lines**: 127 (`truncateOutput`), 268 (`stripAnsi`), 181 (`spawnCliAgent`)  
**LOC removable**: 0 (keep the functions, just remove `export` keywords and index.ts re-exports)

These three functions are `export`-ed from `cli-agents.ts` and re-exported from `src/lib/index.ts` (lines 122–124), but **no file outside cli-agents.ts actually imports or uses them**:

- `truncateOutput` — used internally at lines 127, 398, 404, 407, 408, 476, 482, 485, 546, 552, 555
- `stripAnsi` — used internally at lines 393, 471, 541  
- `spawnCliAgent` — used internally at lines 389, 467, 537

Evidence: `grep -rn 'truncateOutput\|stripAnsi\|spawnCliAgent' src/ tests/ agents/ --include='*.ts'` returns hits ONLY in `cli-agents.ts` and `index.ts` (re-export barrel).

**Action**: Remove `export` keyword from all three. Remove re-exports from `src/lib/index.ts` lines 122–124. If a future consumer needs them, they can be re-exported then.

---

### 3. DEAD PATHS: resolveCliPath() nvm directories (lines 151–163)

**Severity**: Very Low (no runtime impact — guarded by try/catch + existsSync)  
**Lines**: 151–163  
**LOC removable**: 0 (the fallback logic is correct)

`resolveCliPath()` searches for `/home/hao/.nvm/versions/node` and `/root/.nvm/versions/node`. Neither path exists in the container environment. The function gracefully falls back to `process.env.PATH`. This is dead code in production but is harmless and may be useful for local development.

**Action**: No change needed. Could add a comment noting it's for local dev only.

---

### 4. CODE SMELL: Massive duplication across three tool factories (~150 LOC)

**Severity**: Low (maintainability, not dead weight)  
**Lines**: 275–413 (Claude), 418–490 (Gemini), 494–560 (Codex)

The three `create*Tool` functions share nearly identical structure:
- Same try/catch pattern
- Same timeout/truncation/error handling
- Same `stripAnsi` + `truncateOutput` pipeline
- Same textResult return patterns for timeout, non-zero exit, success, error

The only differences are: (a) CLI binary name and args construction, (b) env vars, (c) session continuity logic (Claude only).

**Action**: Consider extracting a shared `executeCliAgent()` helper that handles the common try/catch/timeout/truncation pattern. Each tool factory would only define args construction and env. This would eliminate ~100 LOC of duplication. **Not urgent — schedule as a refactor.**

---

## Totals

| Category | Items | LOC Removable |
|----------|-------|---------------|
| Dead code (unreachable) | 1 | 1 |
| Dead exports (no consumers) | 3 | ~3 (export keywords + 3 re-export lines in index.ts) |
| Dead paths (nvm) | 1 | 0 (harmless) |
| Duplication (refactor candidate) | 1 | ~100 (extractable) |
| **Total** | **6** | **~104 LOC** (1 dead + 3 export cleanup + ~100 refactor) |

## Recommended Follow-Up

1. **Quick fix**: Delete line 408 (unreachable return) — 30-second change
2. **Minor cleanup**: Remove `export` from `truncateOutput`, `stripAnsi`, `spawnCliAgent`; remove re-exports from index.ts
3. **Refactor (optional)**: Extract shared CLI execution pattern to reduce duplication ~100 LOC
