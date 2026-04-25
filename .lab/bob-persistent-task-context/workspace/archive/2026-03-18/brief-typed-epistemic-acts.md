# Brief: Implement Typed Epistemic Acts (DCI Protocol)

**Status:** Proposed
**Owner:** Bob
**Target:** Tech-Lead
**Context:** Research (DD#329) proves that structured, typed communication (Deliberative Collective Intelligence) outperforms unstructured debate on complex tasks (+0.95 quality). Currently, our `SIGNALS.md` and `handoff` tool use free-text "context" and "expectations", leading to ambiguity.
**Goal:** Upgrade `handoff` and `SIGNALS.md` to support **Typed Epistemic Acts** (CLAIM, EVIDENCE, OBJECT, etc.) to structure agent coordination.

## 1. The Core Concept (Law 5)
Structured communication > Unstructured text.
Instead of just "sending a message", agents should perform a specific **Epistemic Act**:
- **CLAIM**: Assert a fact or plan.
- **EVIDENCE**: Provide data to support a claim.
- **OBJECT**: Raise a specific blocker or disagreement.
- **QUERY**: Ask for specific information.
- **COMMIT**: Formally accept a task or position.

## 2. Implementation: `handoff` Tool Upgrade

The `handoff` tool should accept an optional `type` parameter mapping to DCI acts.

### Schema Change
```typescript
type HandoffType = 
  | "TASK"      // Standard delegation (default)
  | "CLAIM"     // Asserting a fact/finding
  | "EVIDENCE"  // Providing data
  | "OBJECT"    // Raising a blocker/disagreement
  | "QUERY"     // Asking for info
  | "COMMIT";   // Accepting a position

interface HandoffArgs {
  target: string;
  artifact_path: string;
  type?: HandoffType; // NEW
  context: string;
  expectations: string;
}
```

### SIGNALS.md Format
The `SIGNALS.md` entry should reflect the type:
```markdown
- [2026-03-16 14:00] **[OBJECT]** From: Bob To: Tech-Lead
  - Artifact: `brief-fix.md`
  - Context: "The proposed fix violates P53."
  - Expectations: "Revise to comply with immutability."
  - Status: [ ]
```

## 3. Implementation: Agent Instructions
Update `agents/shared/CONVENTIONS.md` (or `common-sense.md`) to guide usage:
- Use **TASK** for standard work assignment.
- Use **OBJECT** when blocking a request or finding a flaw.
- Use **EVIDENCE** when delivering research or logs.
- Use **COMMIT** when accepting a high-stakes plan.

## 4. Execution Plan
1. **Update Tool**: Modify `src/lib/tools/coordination.ts` (or wherever `handoff` lives) to accept `type`.
2. **Update Signals**: Modify `logSignal` function to render the type label.
3. **Verify**: Test with a "mock objection" handoff.

## 5. Why This Matters
- **Disagreement Visibility**: `[OBJECT]` signals stand out, preventing "silent agreement" with bad plans.
- **Intent Clarity**: Knowing *why* a file was sent (Evidence vs Task) reduces processing time.
- **Alignment with DCI**: Moves us toward the "High-Performance Deliberation" quadrant of the research.
