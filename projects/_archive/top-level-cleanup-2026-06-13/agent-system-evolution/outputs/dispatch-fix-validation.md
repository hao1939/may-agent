# Dispatch Fix Validation Results

## Date: 2026-05-28

## Fix Deployment Status: ACTIVE ✓

The dispatch-path-delegation-fix is deployed and functional in production:

1. **SDK layer** (`node_modules/@may-agent/sdk/src/project-tasks.ts`): `context_files: string[]` and `success_criteria: string[]` are parsed from task definitions via `parseList()`.
2. **Handler layer** (`agents/may/handlers/project.ts`): Conditional injection of "Context Files" and "Success Criteria" sections into dispatched task prompts when fields are non-empty.

## Audit: 5 Recent Fork/Call Sessions

| Session | Task | context_files in prompt? | success_criteria in prompt? |
|---------|------|--------------------------|----------------------------|
| s_1779368884739 | evaluator-feedback-loop-closure | No | No |
| s_1779368884729 | dispatch-fix-validation | No | No |
| s_1779368825078 | project owner loop | N/A | N/A |
| s_1779368479204 | dispatch-path-delegation-fix (attempt 2) | No | No |
| s_1779368445120 | dispatch-path-delegation-fix (attempt 1) | No | No |

**Result: 0/5 sessions contain context_files or success_criteria in their dispatched prompts.**

## Root Cause

No project task definitions in any `project.md` include `context_files:` or `success_criteria:` fields. The infrastructure is ready but no task author has populated the fields.

## Delegation-Memo Adoption

**Current rate: 0%** (unchanged from baseline)

The delegation-memo convention relies on structured task fields being populated. Since no tasks define `context_files` or `success_criteria`, the convention remains unexercised.

## Conclusion

The fix is **technically live** but has **zero behavioral impact** because adoption requires task authors to add the fields to their task definitions. The pipeline works end-to-end (SDK parses → handler injects → prompt includes), but the input side is empty.

## Recommendation

To achieve actual adoption, either:
1. Add `context_files` and `success_criteria` to existing tasks in `project.md` files (manual population)
2. Auto-infer `context_files` from task `depends_on` outputs or project artifacts (requires handler enhancement)
3. Make the project owner loop automatically populate these fields when creating new tasks
