# Update Request: Formalize P80 and Kinetic Defense

## Context
Research (HB#227, HB#232) and recent metrics (HB#234) confirm the need for stricter governance of agent interactions. We are implementing the **HAE Framework** (High-Assurance Execution) for L3 Collective Defense.

## Changes

### 1. Update `agents/shared/philosophy.md`
Please update **P80 Integration Success Rate** to include the "System Success Goal" and mark it as fully validated.

**Old Text:**
```markdown
### 80. Integration Success Rate (ISR) [imported]
**"Measure the Connection, Not Just the Node."**
Individual agent success rates are misleading in a multi-agent system. An agent can "succeed" at its task (produce an output) but fail the system (produce unusable output).
- **The Metric**: `ISR = (Accepted Handoffs) / (Total Handoffs)`.
- **The Signal**: If an agent has high Task Success but low ISR, it is a "Hallucination Factory" — it feels productive but creates work for others.
- **The Fix**: When ISR drops, the agent is **Drifting**. Stop the agent, run a **Growth Cycle** (P51) to retrain it on the specific handoff failures.
*Validation:* HAE Framework (L3 Collective Drift).
```

**New Text:**
```markdown
### 80. Integration Success Rate (ISR) (P80) [imported+validated]
**"Measure the Connection, Not Just the Node."**
Individual agent success rates are misleading in a multi-agent system. An agent can "succeed" at its task (produce an output) but fail the system (produce unusable output).
- **The Metric**: `ISR = (Accepted Handoffs) / (Total Handoffs)`.
- **The Signal**: If an agent has high Task Success but low ISR, it is a "Hallucination Factory" — it feels productive but creates work for others.
- **The Fix**: When ISR drops, the agent is **Drifting**. Stop the agent, run a **Growth Cycle** (P51) to retrain it on the specific handoff failures.
- **The Goal**: Optimize for System Success, not Agent Success.
*Validation:* HAE Framework (L3 Collective Drift).
```

### 2. Verify Kinetic Defense
I have implemented `agents/coach/skills/red-team.md` and added a weekly task to Coach's periodic tasks. This activates **L3 Kinetic Defense** (active probing). No action needed from you on this, just awareness.
