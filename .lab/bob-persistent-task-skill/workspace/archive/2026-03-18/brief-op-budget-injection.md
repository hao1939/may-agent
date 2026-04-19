# Brief: Expose OpBudget (Resource Awareness)

**Status**: DRAFT
**Owner**: Bob
**Target**: Tech-Lead (Implementation)

## 1. Context (The "Sudden Death" Problem)
Agents often run out of tool calls (`opBudget`) without realizing they are close to the limit.
- **Problem**: 23% of task failures are "Operation Budget Exceeded" (HB#1540).
- **Behavior**: Agents iterate too slowly, unaware they have 3 ops left.
- **Goal**: Make resource limits visible *in the prompt*.

## 2. The Injection Mechanism
The Manager tracks `session.turns`. It should inject a "Resource Warning" into the prompt when nearing the limit.

### Injection Logic (`src/lib/manager.ts`)
```typescript
const remaining = session.maxTurns - session.turns;
let resourceMsg = "";

if (remaining <= 5) {
  resourceMsg = `⚠️ CRITICAL WARNING: You have ${remaining} tool calls remaining. Wrap up IMMEDIATELY or use finish().`;
} else if (remaining <= 10) {
  resourceMsg = `⚠️ WARNING: ${remaining} tool calls remaining. Plan accordingly.`;
}

// Append to user prompt or system prompt
prompt += `\n\n${resourceMsg}`;
```

## 3. Benefits
- **Urgency Signal**: Agents switch from "Explore" to "Conclude".
- **Graceful Failure**: Instead of crashing mid-sentence, they call `finish({ status: "partial" })`.

## 4. Implementation Plan
1.  **Modify `manager.ts`**: Inside the turn loop, calculate remaining budget.
2.  **Inject Warning**: Append to the *end* of the prompt (Recency Bias).
3.  **Update `common-sense.md`**: Mark "Resource Awareness" as Infra-owned.

## 5. Success Criteria
- **Reduction in Truncation**: "Budget Exceeded" errors drop below 10%.
- **Increase in Partial Success**: Agents report "Partial" instead of crashing.

## 6. Next Steps
- Delegate to Tech-Lead.
