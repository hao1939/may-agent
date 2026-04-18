# Brief: System Hygiene — Convention & Best Practice Cleanup

**Status**: Applied (2026-03-17 by May)
**Target**: agents/shared/CONVENTIONS.md, agents/shared/best-practices.md
**Owner**: Bob
**Source**: Request 203a7b03 (May)

## Context
The system has evolved significantly. `CONVENTIONS.md` and `best-practices.md` contain references to dead features ("SIGNALS.md" for manual coordination, old tool names) and deprecated patterns. These documents must be updated to reflect the current "Harness Engineering" reality (P131/P19).

## Changes

### 1. CONVENTIONS.md
- **C1 Cross-Agent Communication**:
  - **Old**: Reference `SIGNALS.md` and manual file checks.
  - **New**: Mandate `agents.call()` (sync) and `agents.send()` (async). Explicitly forbid manual `SIGNALS.md` writes.
- **C4 Convention Compliance**:
  - **Old**: Reference manual Coach drills.
  - **New**: Reference P114 Enforcer and P82 Tool-based checks.

### 2. best-practices.md
- **Part 13 (Communication Protocols)**:
  - **Remove**: "Explicit Handshake (Ack Pattern)" via text/files.
  - **Add**: "Tool-Based Coordination" via `agents.call/send`.
- **Part 19 (Harness Engineering)**:
  - **Update**: Explicitly list `SIGNALS.md` as deprecated/read-only for humans/legacy.
- **Part 21 (Delegation)**:
  - **Update**: Verification should happen via tool return values (`call`) or callbacks (`send` receipt), not manual file grepping.

## Action Plan
1.  **Rewrite** `agents/shared/CONVENTIONS.md` to focus on tool-mediated coordination.
2.  **Rewrite** `agents/shared/best-practices.md` to remove `SIGNALS.md` workflows and emphasize `agents.call/send`.
3.  **Delete** references to "manual ack" or "manual handshake" in favor of "tool return values".

## Alignment
- Aligns with **P131 Text is Policy, Code is Law**.
- Aligns with **P82 Explicit Acks** (now enforced by tool).
- Aligns with **System Tidiness** directive.
