# Remove opBudget — Complete Cleanup Brief

**Origin**: Hao directive — remove operation budget completely to simplify.
**Owner**: tech-lead
**Date**: 2026-03-30

## What to Remove

The `opBudget` feature (P85) tracked "state-changing" tool calls and blocked execution when a limit was reached. It was already deprecated (always 0 = unlimited), but the code is still there. Remove ALL of it.

## File-by-File Changes

### 1. `src/lib/manager-utils.ts`

**Remove** `STATE_CHANGING_TOOLS` constant (~line 144-147):
```typescript
// DELETE this:
export const STATE_CHANGING_TOOLS = new Set(["bash", "write", "edit", "commit"]);
```

**Remove** `opBudget` and `opCount` from `ActiveSession` interface (~line 208-211):
```typescript
// DELETE these two fields:
  opBudget: number;
  opCount: number;
```

**Remove** `opBudget` from `RunOptions` interface (~line 264-265):
```typescript
// DELETE:
  /** @deprecated opBudget removed — always 0 (unlimited). Field kept for type compat. */
  opBudget?: number;
```

**Remove** `OpBudgetExceeded` from `isToolError()` (~line 113):
```typescript
// DELETE this line:
  if (/\bOpBudgetExceeded\b/.test(outputText)) return true;
```

### 2. `src/lib/manager-receipts.ts`

**Remove** `STATE_CHANGING_TOOLS` from imports (~line 20)

**Remove** the `isStateChanging` variable and opCount tracking block (~lines 208-252):
- Delete `const isStateChanging = STATE_CHANGING_TOOLS.has(tool.name);`
- Delete the entire `if (isStateChanging)` block that increments `session.opCount` and persists to meta.json

**Remove** `getOpUsage` function entirely (~lines 376-385)

**Update** the JSDoc header comment — remove "operation budgets" reference

**Remove** the comment about opBudget in the finish() abort section (~line 356)

### 3. `src/lib/manager.ts`

**Remove** `STATE_CHANGING_TOOLS` from the import block (~line 17, 39)

**Remove** `STATE_CHANGING_TOOLS` from the re-export block (~line 39)

**Remove** `opBudget: 0, opCount: 0` from run() session creation (~lines 1110-1111)

**Remove** `opBudget: 0, opCount: persisted.opCount ?? 0` from resumeSession() (~lines 1474-1475)

**Remove** `opCount: s.opCount, opBudget: s.opBudget` from listSessions() (~lines 1544-1545)

**Remove** `OpBudgetExceeded` from error-ignore conditions (~lines 777, 808)

**Remove** `opCount: session.opCount` from the session archive/recording (~line 952)

**Remove** `getOpUsage` method from SubagentManager class (~line 2182+)

### 4. `src/lib/types.ts`

**Remove** `opBudget` from `SubagentDefinition` (~lines 65-68):
```typescript
// DELETE:
  opBudget?: number;
```

**Remove** `opCount` and `opBudget` from `SessionInfo` (~lines 103-106):
```typescript
// DELETE:
  opCount?: number;
  opBudget?: number;
```

### 5. `src/lib/persistence.ts`

**Remove** the `opCount` field from `PersistedSession` (~lines 57-58)

**Remove** `opCount` from session save/load logic (~lines 522, 549)

### 6. `src/lib/requests.ts`

**Keep** `opCount` column in the DB schema — it's harmless and removing it would require a migration. Just stop writing to it.

Actually, stop writing `opCount` values in `insertSession()` (~line 832) and `updateSession()` (~line 848). Set to 0 or remove from the SQL.

### 7. `src/lib/evaluator.ts`

**Remove** the OpBudget exhaustion detection (~lines 803-807):
```typescript
// DELETE:
  const hasOpBudgetError = transcript.includes("opBudget") || transcript.includes("operation budget");
  if (hasOpBudgetError && ...) { issues.push("opBudget_exhaustion"); }
```

**Remove** the OpBudget reference in the JSDoc comment (~line 699)

### 8. `src/lib/concurrency-gate.ts`

**Remove** the comment referencing STATE_CHANGING_TOOLS (~line 117)

### 9. `test/operation-budget.test.ts`

**Delete this entire file** — it tests the removed feature.

### 10. Other test files

**`test/manager-infra-retry.test.ts`** — Remove `opBudget: 0, opCount: 0` from session mocks (~lines 38-39)

**`test/tool-pivot.test.ts`** — Remove `OpBudgetExceeded` test case (~line 45)

## Verification

After all changes:
1. `npx tsc --noEmit` — no type errors
2. `npx vitest run` — all tests pass (except deleted operation-budget.test.ts)
3. Grep for remaining references: `grep -rn "opBudget\|OpBudget\|STATE_CHANGING_TOOLS\|opCount" src/ test/ --include="*.ts"` should only show `opCount` in requests.ts DB schema
