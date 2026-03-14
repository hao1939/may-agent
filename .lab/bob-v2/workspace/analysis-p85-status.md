# Evidence
- **command/read**: `agents/bob/workspace/synthesis/synthesis-brief-security-hierarchy.md` — EMPTY
- **command/read**: `src/lib/types.ts` — `opBudget` present in `SubagentDefinition`, but `SessionInfo` does NOT have `opCount`.
- **command/call**: `tech-lead` (session s_1773395769849_222) — Confirms `opCount` and `opBudget` are ALREADY implemented in `manager.ts` internally (just not exposed in `SessionInfo` type yet).
- **command/call**: `tech-lead` — Reports 1 test failure: `verify_skill` preset missing.

# Analysis
- **P85 Compliance**: `op_budget` is implemented internally in `manager.ts` (enforcement logic exists). My previous `grep` failed because I grepped for `op_budget` (snake_case) but the code uses `opBudget` (camelCase).
- **Type Gap**: `SessionInfo` in `types.ts` is missing `opCount`. This means external tools (like `list`) won't see the count, but the runtime logic works.
- **Verification**: The system is safer than I thought. P85 is active.
- **New Issue**: `evaluator` agent config references `verify_skill` tool, but it's missing from presets. This causes a test failure.

# Actions
1. **Fix Type Definition**: Add `opCount` to `SessionInfo` in `types.ts` so we can see it in `list`.
2. **Fix Evaluator Config**: `verify_skill` tool needs to be properly registered or the config updated.

I will fix the type definition first to complete the "P85 Visibility" task.
