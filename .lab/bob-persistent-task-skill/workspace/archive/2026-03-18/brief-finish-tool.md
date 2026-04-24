# Design Brief: Common Sense Infrastructure — Finish Tool

## Context
"How to signal completion" is the most frequent agent failure mode. Agents use `I'm done`, `Task complete`, or just stop talking. The downstream system (Evaluator, Human, Manager) cannot reliably parse the outcome.
**Common Sense Item 1.4**: "Signal completion clearly. When done, report: what you did, what you produced, and whether it's done/blocked/partial."

## The Mechanism: `finish(outcome)`
A structured tool that enforces the "Report" phase of the Promise-Deliver-Report cycle.

### Schema
```typescript
type FinishOutcome = {
  status: "success" | "failure" | "blocked" | "partial";
  summary: string; // 1-2 sentence executive summary
  deliverables: Array<{
    path: string; // File path
    description: string; // What this is
  }>;
  blockers?: Array<{ // Required if status is blocked/failure
    reason: string;
    context: string;
  }>;
  next_steps?: string; // Recommended next actions
};
```

### Behavior
1. **Standardized Exit**: Calling this tool ends the session (soft-close).
2. **Parsable Signal**: The tool output is written to `.state/completions.jsonl` (or similar) for the Evaluator to read.
3. **Blocker Escalation**: If status="blocked", the system can auto-trigger escalation (notify May/Human).
4. **Validation**: The tool validates that `deliverables` paths actually exist before accepting the finish signal.

## Implementation Plan (Tech-Lead)
1. Create `src/lib/tools/finish.ts`.
2. Implement schema validation.
3. Implement `existsSync` checks for deliverables.
4. Write outcome to `workspace/outcome.json` (per-session persistence).
5. Expose in `agents/shared/TOOLS.md`.

## Integration
- **Bob**: Update `agents/shared/common-sense.md` to point to this tool.
- **Coach**: Train agents to use `finish()` instead of text summaries.
- **Evaluator**: Update scoring to look for `finish()` usage.
