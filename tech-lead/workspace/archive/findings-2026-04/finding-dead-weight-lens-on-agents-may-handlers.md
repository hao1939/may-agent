# Dead Weight Analysis: agents/may/handlers/convention-check.ts (849 lines)

**Verdict: Mostly lean — no major dead code blocks, but several minor items.**

## Findings

### 1. Unused parameter `_persistDir` in `findUncheckedSessions` — Low
- `convention-check.ts:254` — parameter `_persistDir: string` is declared but never used (underscore-prefixed). The function only uses `db`. The caller at `:177` passes `persistDir` unnecessarily.
- **Action**: Remove parameter from function signature and call site.
- **Savings**: ~2 lines, cleaner API.

### 2. Unused parameter `_agent` in `checkC12_1_sessionStart` — Low
- `convention-check.ts:636` — `_agent: string` is declared but unused.
- **Action**: Remove parameter; update call at `:371` (inside `runAllChecks`).
- **Savings**: Trivial.

### 3. `TranscriptEntry.name` field never read — Low
- `convention-check.ts:17` — the `name?: string` field on `TranscriptEntry` interface is declared but never accessed in `loadToolCalls` or anywhere else.
- **Action**: Remove the field.

### 4. One-time retroactive fix (`applyRetroactiveFix`) is permanently dead after first run — Medium
- `convention-check.ts:810-835` — This 25-line function runs once (gated by a flag file), then becomes dead code forever. It was a one-time migration. Every subsequent invocation just checks `existsSync` and returns.
- **Action**: Verify the flag file exists in production (`.state/may/convention-checks/retro-fix-applied.flag`), then delete the function and its call at `:174`. Saves ~30 lines.

### 5. `pendingCalls` Map tracks tool results but `resultContent`/`isError` only used by 3 checks — Not dead, but noted
- `convention-check.ts:299-340` — The result-matching logic is substantial (~40 lines) and feeds `isError`/`resultContent` which are used by C1.3 (`:423`), C1.5 (`:468`), and C2.1 (`:498`). This is **not dead** but is the heaviest section relative to its consumers.

### 6. No dead exports
- `ConventionCheckResult` and `runConventionChecks` are exported and consumed by `compliance-check.ts:18`.
- `create` is the handler entry point. All exports are live.

### 7. No duplicate logic with `compliance-check.ts`
- `compliance-check.ts` is a thin wrapper that calls `createConventionCheck` — no duplication.

## Summary

| Item | Severity | Lines Saveable |
|------|----------|---------------|
| Remove `_persistDir` param | Low | 2 |
| Remove `_agent` param | Low | 2 |  
| Remove `TranscriptEntry.name` | Low | 1 |
| Remove `applyRetroactiveFix` (one-time migration) | Medium | ~30 |
| **Total** | | **~35 lines** |

The file is well-structured with no significant dead weight. The biggest cleanup opportunity is removing the one-time retroactive fix function.
