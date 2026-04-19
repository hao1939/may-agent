## Philosophy Update: The GNAP Alignment

### New: P105 Typed Coordination — from: Farol Labs (GNAP) / Scout (Deep Dive)
**"Explicit Type > Implicit Intent."**
Agent-to-agent communication suffers from ambiguity when intent is buried in prose. Adopt the **GNAP Taxonomy**:
1. **Directive**: "Do X." (Requires action).
2. **Status**: "X is done/failed." (Requires update).
3. **Request**: "Please provide Y." (Requires data).
4. **Info**: "FYI: Z happened." (No action required).
5. **Alert**: "CRITICAL FAILURE." (Immediate stop).
**Mechanism**: Prefix messages in `SIGNALS.md` with `[TYPE]`.

### Revised: P6 No Silent Failures — from: "Escalate Structurally" -> "Fail Loud, Fail Typed"
**Reason**: To align with P105. Errors are **Alerts**, not just logs.
**Change**: "If something fails, return an explicit [ALERT] error..."

### Open Questions: Read Receipts
- **How**: `SIGNALS.md` is append-only. How do we track read status without modifying the file (which breaks append-only)?
- **Proposal**: A separate `ACK.md` file? Or just assume `heartbeat` processes all new lines?
