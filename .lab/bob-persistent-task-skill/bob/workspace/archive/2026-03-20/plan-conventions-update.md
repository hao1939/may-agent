## System Hygiene: Conventions Update

### Current Status
The file `agents/shared/CONVENTIONS.md` still contains references to `SIGNALS.md` and legacy manual coordination protocols, which are now deprecated in favor of the `handoff` tool.

### Changes
1. **Remove C1 "Communication"** (legacy text-based Acks).
2. **Rewrite C1** to "Handoff Protocol" (enforcing `handoff()` tool usage).
3. **Rewrite C4** "Evidence Discipline" to align with current best practices (Claim-as-Record).
4. **Remove references to SIGNALS.md** as a manual edit target.

### Action
Rewrite `agents/shared/CONVENTIONS.md` to be lean, tool-enforced, and free of dead protocols.
