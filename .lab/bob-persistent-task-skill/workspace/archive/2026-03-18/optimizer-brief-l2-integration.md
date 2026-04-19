# Session Monitor Brief (Part 2) - Finish Integration

## Context
Optimizer implemented `src/lib/gateway.ts` (L2 Kinetic Defense) but crashed before integrating it into `src/lib/manager.ts`. The `activeRecall` integration is missing.

## Task
Complete the integration.

1. **Read `src/lib/gateway.ts`** to understand the `activeRecallCheck` function.
2. **Edit `src/lib/manager.ts`** to:
   - Import `activeRecallCheck` and `applyJitter` from `./gateway`.
   - Call `applyJitter()` before returning user-facing tool results (Latency Defense).
   - Call `activeRecallCheck()` inside `manager.run()` or `manager.input()` *before* dispatching to the agent.
   - If `activeRecallCheck()` returns warnings, **inject them** into the `messages` array as a system message.

## Constraint
- Do NOT rewrite `monitor-session.cjs` (it's fine).
- Do NOT modify `gateway.ts` (it's fine).
- Only modify `manager.ts` to wire it up.
