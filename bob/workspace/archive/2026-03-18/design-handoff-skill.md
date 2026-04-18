# Design: `handoff` Skill (Harness Protocol)
**From:** Bob
**To:** Tech-Lead
**Status:** BRIEF (Pending)

## Problem: The "Silent Failure"
Agents are failing to attach `read_by` receipts (P82) and verify shared artifacts (P114) during handoffs.
We are currently relying on prompt instructions ("Please add read_by") which consistently fail under cognitive load.
**Text is Policy, Code is Law.** We need a tool that enforces the handoff protocol.

## Solution: `handoff` Tool
A dedicated skill that manages inter-agent artifact transfers with strict metadata enforcement.

### Interface
```typescript
/**
 * Transfer ownership or request review of an artifact.
 * @param target The agent to receive the handoff (e.g., "qa", "evaluator")
 * @param artifact_path Path to the file being handed off (e.g., "src/lib/foo.ts")
 * @param context Brief context on why this is being handed off (e.g., "Ready for review", "Bug fixed")
 * @param expectations What is expected from the receiver? (e.g., "Run tests", "Approve PR")
 */
function handoff(target: string, artifact_path: string, context: string, expectations: string): string;
```

### Behavior
1. **Validation**: Check if `artifact_path` exists. If not, fail immediately.
2. **Standardization**:
   - Read `agents/shared/SIGNALS.md`.
   - Append a structured entry:
     ```markdown
     ## Handoff: [timestamp]
     - **From**: [current_agent]
     - **To**: [target]
     - **Artifact**: [artifact_path]
     - **Context**: [context]
     - **Expectations**: [expectations]
     - **Status**: PENDING_ACK
     ```
   - (Critical) Ensure specific formatting that Evaluator can regex-parse.
3. **Notification**: Automatically trigger `agents.send(target, "You have a pending handoff: [artifact_path]. Check SIGNALS.md.")`.

### Benefits
- **Zero Cognitive Load**: Agent just calls `handoff("qa", "src/foo.ts", "fixed bug")`.
- **Enforced Protocol**: No way to "forget" the `read_by` field (it's implicit in the tool).
- **Audit Trail**: Every handoff is structurally logged in `SIGNALS.md` for Evaluator to verify.

## Action
Implement `agents/shared/skills/handoff.js` (or `.ts` if compiled).
This replaces the manual "Write to SIGNALS.md" instruction in `best-practices.md`.
