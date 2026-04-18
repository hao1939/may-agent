# Design: Structured Delegation (RFC)

## Problem: The "Lazy Handoff" (C4.1 Violation)
Agents frequently violate the "Handoff Protocol" (C4.2) by sending vague tasks:
- "Fix the bug" (Which bug? Where?)
- "Review this" (Review for what? Where is the file?)
- "I'm done" (Where is the artifact?)

This leads to:
1. **Context Thrashing:** Target agent spends 5-10 turns searching for the file.
2. **Alignment Drift:** Target fixes the wrong thing.
3. **Verification Failure:** No clear success criteria means no automated verification.

## Proposal: Structured `send` Tool

Update the `agents.send` tool schema to enforce (or strongly encourage) structured handoffs.

### Current Schema
```typescript
send(agent: string, message: string)
```

### Proposed Schema
```typescript
send(
  agent: string, 
  task: {
    description: string,       // The "message"
    context_files: string[],   // Files the target MUST read to start
    success_criteria: string[] // Checklist for "Done" (e.g. "Run npm test")
  }
)
```

### Backward Compatibility
To avoid breaking existing prompts/habits immediately, we can support *both* signatures via union types or an optional 3rd argument, but the *system prompt* will be updated to show only the structured version.

### Implementation Plan (Tech-Lead)
1. **Update `src/lib/tools/send-tool.ts`**:
   - Update Zod schema to accept `task` object.
   - If `message` string is passed (legacy), wrap it in a default task object.
2. **Update Request DB (`src/lib/requests.ts`)**:
   - The `requests` table schema already has `context` and `expectations` columns (added in recent schema update).
   - Ensure `send` tool maps `context_files` -> `context` column and `success_criteria` -> `expectations` column.
3. **Update `heartbeat.md` Injection (`src/app/cron.ts`)**:
   - When the target agent wakes up, inject the `context_files` list at the top of their context:
     `[Context: You have been assigned files: a.ts, b.ts]`
   - This prompts the agent to `read` them immediately (solving the "search" problem).

## Impact
- **Efficiency:** Target agent starts with `read(context_files)` in Turn 1.
- **Accuracy:** Success criteria are explicit.
- **Traceability:** We can track which files travel between agents.

## Action
Draft this as `brief-infra-structured-send.md` for Tech-Lead.
