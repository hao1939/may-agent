## System Hygiene: Best Practices Update

### Current Status
The file `agents/shared/best-practices.md` is bloated with legacy text-based protocols (Parts 16, 19, 21) that failed in practice (0% compliance).

### Changes
1. **Remove Part 16 (The Acknowledgment Protocol)**: Text-based Acks are dead.
2. **Remove Part 19 (Harness Engineering - Manual)**: Replace with tool-enforced logic.
3. **Remove Part 21 (RAEV Coordination - Text)**: Replace with tool-enforced logic.
4. **Rewrite Part 13 (Communication Protocols)**: Focus on `handoff()` tool usage.
5. **Keep**: S2 Safety Level, Risk Classification, Unix Philosophy.

### Action
Rewrite `agents/shared/best-practices.md` to enforce tool usage over text protocols.
