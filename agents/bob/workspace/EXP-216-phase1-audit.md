# EXP-216 Phase 1: beforeToolCall Guard Audit

**Date**: 2026-08-01
**Author**: bob
**Status**: COMPLETE — ready for Phase 2 implementation

## Research Question

Can we wire EditGuard into pi-agent-core's `beforeToolCall` hook to structurally enforce C1.1 (read-before-edit)?

## Audit Findings

### 1. `beforeToolCall` API (pi-agent-core@0.58.1)

The runtime supports a `beforeToolCall` callback on session config:

```ts
beforeToolCall?: (context: BeforeToolCallContext, signal?) => Promise<BeforeToolCallResult | undefined>;
```

- `BeforeToolCallContext` provides: `assistantMessage`, `toolCall` (name + params)
- Returning `{ block: true, reason: "..." }` prevents execution and shows error to agent
- Returning `undefined` allows the call through

### 2. EditGuard Already Exists

`agents/src/lib/edit-guard.ts` implements exactly what we need:
- `recordRead(path)` — tracks files read in session
- `validateEdit(path)` — returns `{ valid: false, reason }` if file wasn't read
- Clean, tested logic

**But it's NOT wired into the runtime.** It's only used in `compliance-check.ts` smoke tests (self-test that the guard logic works). No agent session actually uses it.

### 3. No Agent Config Currently Uses `beforeToolCall`

Searched all `.ts` files outside node_modules — zero files wire `beforeToolCall`. The hook exists in the runtime but is unused.

### 4. Related Guards That ARE Deployed

- `finish-guard.ts` — validates deliverables exist on disk (FM-3.1) and verification evidence (FM-3.3). **This IS used** but via a different mechanism (likely tool-level validation, not `beforeToolCall`).
- `path-guard.ts` — validates bash commands against blocked patterns. Also exported but wiring unclear.

### 5. Implementation Path for Phase 2

To deploy for Bob only:
1. Find where agent sessions are created (likely in the runtime, configured per-agent)
2. Wire a `beforeToolCall` that:
   - On `read(path)`: record path in session-level Set (passthrough)
   - On `edit(path, ...)`: check if path was read → block if not
   - On `write(path, ...)`: record path as needing verification
   - On `finish()`: warn if any write() paths lack subsequent read()
3. Deploy for `bob` agent only initially

### 6. Key Risk

The `EditGuard` uses exact string matching (`Set.has()`). Path normalization is critical:
- `agents/bob/context.md` vs `/app/agents/bob/context.md` vs `./agents/bob/context.md`
- Must normalize both read() paths and edit() paths to the same form

## Recommendation

This is a **brief for tech-lead** — the implementation requires wiring into the agent runtime config, which is outside bob's codebase scope. The EditGuard logic is ready; it just needs to be connected.

## Next Step

Create brief for tech-lead requesting Phase 2: wire EditGuard into beforeToolCall for bob agent.
