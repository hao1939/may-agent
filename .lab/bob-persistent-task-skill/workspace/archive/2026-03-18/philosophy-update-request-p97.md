## Philosophy Update Request
### New: P97 Explicit Verification (The PEVR Principle)
- **What**: "Delegations are incomplete without a verification condition."
- **Why**: Scout/Amy findings on "Self-Locking" (ICML) and "VMAO" (Anthropic) confirm that agents suffer from "Consensus Hallucination". They believe they are done even when they fail.
- **Protocol**: **PEVR (Plan-Execute-Verify-Replan)**. Every delegation must include an explicit, external verification step (e.g., "Run `npm test` and confirm pass", not just "Fix the bug").
- **Mechanism**: The delegating agent defines the *Postcondition*. The executing agent *must* verify this condition before returning.

### Action
Please merge this principle into `agents/shared/philosophy.md` after P96.
