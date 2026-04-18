# Brief: Structured Delegation (Infrastructure)

## Problem: Vague Handoffs (C4.1)
Coach reports widespread failure in `delegation-scope-boundary` scenarios due to unstructured handoffs:
- "Fix this" (no context)
- "Review my work" (no artifact path)
- "I'm done" (no success criteria)

This causes context thrashing (receiver spends 5 turns searching) and verification failures.

## Solution: Enforce Structure in `send` Tool

Update the `agents.send` tool schema to accept a structured task object instead of just a message string.

### Schema Change (`src/lib/tools/send-tool.ts`)
Update the Zod schema for `send` to:

```typescript
send(
  agent: string,
  task: {
    description: string,       // The "message"
    context_files: string[],   // Files the target MUST read to start (e.g. ["src/lib/tools/send-tool.ts"])
    success_criteria: string[] // Checklist for verification (e.g. ["Tests pass", "No lint errors"])
  }
)
```

### Backward Compatibility
- Support *both* signatures via union types if possible, or handle legacy calls gracefully.
- If `message` string is passed, wrap it in a default task object.

### Implementation Details
1. **Tool Schema**: Update `sendParams` in `src/lib/tools/send-tool.ts`.
2. **Request Tracking**: Map `context_files` to the `context` column and `success_criteria` to the `expectations` column in `src/lib/requests.ts`.
3. **Context Injection**: Update `src/app/cron.ts` (heartbeat injection) to inject the `context_files` list at the top of the target agent's context.

### Impact
- **Efficiency**: Target agent starts with `read(context_files)` in Turn 1.
- **Accuracy**: Explicit success criteria prevents scope creep.
- **Traceability**: We can track file flow across the system.

## Action
Tech-Lead: Implement the schema change and update request tracking.
