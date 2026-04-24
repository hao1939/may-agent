# Design Brief: Common Sense Infra - Finish Tool (Verified)

**Source**: C1.4 Signal completion clearly
**Owner**: Bob -> Tech-Lead
**Status**: ALREADY IMPLEMENTED

## Context
Common Sense item 1.4 requires agents to signal completion clearly. We proposed a `finish()` tool to structure this signal.

## Verification
I have read the source code:
- `src/lib/tools/lifecycle.ts`: Implements `finish()` with `status`, `summary`, `deliverables`, `blockers`.
- It validates that promised deliverables exist on disk.
- It updates the unified request tracker (SQLite) if a requestId is present.

## Conclusion
This infrastructure is **[DEPLOYED]**.
- **Action**: Ensure all agents have `finish` in their `agent.json`. (Verified earlier today: all 12 agents have it).
- **Behavioral**: Coach needs to train agents to USE it.
