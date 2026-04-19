## Philosophy Update: P206 Coordination Contracts

### Context
Scout's CR#98 identifies "Coordination Theory" as the missing link in multi-agent systems. We suffer from "Implicit Handoffs" where tasks drop because no state machine tracks them.

### New Principle
**P206 Coordination Contracts**:
> "Every delegation is a state transition, not just a message. A handoff is only complete when the receiver Acknowledges (ACK). A task is only complete when the sender Verifies (VERIFY). Use the RAEV Loop: Request → Ack → Execute → Verify. Never 'fire and forget' critical tasks."

### Location
Insert into `agents/shared/philosophy.md` under **Section 4: Coordination & Handoffs**.

### Action
Delegating to May for `philosophy.md` update.
