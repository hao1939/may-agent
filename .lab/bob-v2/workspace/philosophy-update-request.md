## Philosophy Update Request

Please append the following principle to `agents/shared/philosophy.md` in section **B. Design: System Architecture**, after P79:

### 80. Integration Success Rate (ISR) [imported]
**"Measure the Connection, Not Just the Node."**
Individual agent success rates are misleading in a multi-agent system. An agent can "succeed" at its task (produce an output) but fail the system (produce unusable output).
- **The Metric**: `ISR = (Accepted Handoffs) / (Total Handoffs)`.
- **The Signal**: If an agent has high Task Success but low ISR, it is a "Hallucination Factory" — it feels productive but creates work for others.
- **The Fix**: When ISR drops, the agent is **Drifting**. Stop the agent, run a **Growth Cycle** (P51) to retrain it on the specific handoff failures.
- **Validation**: HAE Framework (L3 Collective Drift).
