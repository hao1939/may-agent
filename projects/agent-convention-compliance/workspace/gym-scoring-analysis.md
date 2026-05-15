# Gym Scoring Analysis — Convention Scenarios

**Date**: 2026-09-16  
**Purpose**: P3.1 — Resolve gym scoring ambiguity to close the 68% → 90% gap.

## Key Findings

### C2.3 (verify-after-edit): Does gym accept edit() diff preview?

**Answer: NO.** The gym explicitly requires a `read()` or `bash` command referencing the file AFTER the last write/edit. The `convention-verify-edit` scorer checks:

```javascript
const readsAfter = toolCalls.filter(tc =>
  tc.index > lastWrite.index && (
    (tc.name === 'read' && tc.args.path.includes('config.json')) ||
    (tc.name === 'bash' && tc.args.command.includes('config.json'))
  )
);
```

The edit() tool's diff preview is NOT counted as verification because it's part of the edit response, not a separate tool call. The scorer only looks at tool calls with `index > lastWrite.index`.

**`convention-verify-multi-edit`** uses `s.hasVerifyAfterWrite(file)` from gym-score-utils — same logic: explicit read/bash after write.

**Conclusion**: Gym scoring is CORRECT. The convention should require explicit read-back. Diff preview is insufficient because it shows what was attempted, not what's on disk.

### C1.1 (read-before-edit): Multi-file behavior

The `convention-verify-multi-edit` scorer checks ALL files:
```javascript
for (const file of files) {
  // Must have at least one read before first edit for each file
  if (edits.length > 0 && !readBefore) return false;
}
```

This is strict but correct — agent must read EACH file before editing it.

### C40.1 (promise-before-action)

Scorer checks first assistant message for planning language:
```javascript
return s.firstMessageContains(/i will|i'll|plan|steps?:|1\.|here's what/i);
```

This is straightforward — agent just needs to state intent before acting. Failing this means the agent jumps straight to tool calls without any planning text.

### C3 (JSON validation)

Scorer requires explicit validation command (node -e JSON.parse, jq, python json):
```javascript
if (cmd.includes('node -e') && cmd.includes('JSON.parse') || ...)
```

A `read()` alone doesn't satisfy C3 — it needs an explicit parse/validate command.

## Recommendations

| Convention | Root Cause of Failure | Fix Approach |
|---|---|---|
| C2.3 verify-after-edit | Agent relies on edit() diff preview | **Strengthen SOUL.md**: "ALWAYS read() back after edit — diff preview is NOT sufficient verification" |
| C1.1 read-before-edit (multi) | Agent reads first file, edits all | **Add rule**: "When editing multiple files, read() EACH file before its respective edit()" |
| C40.1 promise-before-action | Agent jumps to tools immediately | **Add few-shot example** in SOUL.md showing plan-then-act pattern |
| C3 JSON validation | Agent doesn't run explicit validation | Already covered by C2.3 fix — if agent reads back, it will see errors |

## Decision

**Option (b)**: Strengthen SOUL.md wording. The gym scoring is correct — we should NOT weaken it. The conventions exist to catch real bugs (e.g., edit() can silently fail if oldText doesn't match).

## Next Steps (P3.2–P3.5)
1. Update all 7 SOUL.md files with strengthened C2.3 wording
2. Add C1.1 multi-file rule
3. Add C40.1 few-shot example
4. Re-run gym scenarios to measure improvement
