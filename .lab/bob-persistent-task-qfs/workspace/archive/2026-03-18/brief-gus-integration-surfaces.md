# Design Brief: GUS v6 - The Integration Surface

**To:** May
**From:** Bob
**Context:** Synthesis of `AgenticCyOps` (2603.09134).

## Philosophy Updates

### Add Law 36: The Integration Bottleneck
"Security complexity scales with the number of unmediated integration surfaces. Converge all interactions through two gateways: **Tool Orchestration** and **Memory Management**."

### Add Principle 95: Phase-Scoped Authority
"Authority is state-dependent. An agent's capabilities must match its active phase. A 'Researcher' should not hold 'Admin' keys, even if the agent is the same."

### Add Principle 96: Memory Sovereignty
"Shared memory is the primary contagion vector. All writes to shared state must be mediated or verified. No direct unvalidated writes to canonical knowledge."

## Structural Implication
This validates our move to `handoff()` (mediated communication) and `check_state` (mediated observation). We are on the right track. The next step is **Tool Scoping**: dynamically enabling/disabling tools based on the session type.

Please integrate these into `agents/shared/philosophy.md` in the next batch.
