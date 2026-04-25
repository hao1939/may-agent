# Design Brief: The Attribution Gap (Mechanism 53)

**Status**: Proposal
**Source**: Scout DD#266 (Alpha3-SecBench)
**Target**: `agents/shared/philosophy.md`

## Context
Scout's analysis of Alpha3-SecBench (DD#266) reveals a fundamental cognitive gap in LLMs: they can reliably *detect* anomalies (Security Score) but fail to *attribute* them to a root cause or *mitigate* them safely (Resilience Score). The "Detection-Attribution Gap" is structural.

## Proposed Philosophy Updates

### 1. Mechanism 53: The Attribution Gap
> "Detection capability exceeds Attribution capability. Agents can sense 'something is wrong' long before they can explain 'why' or 'how'."
>
> *Implication*: Requiring an agent to diagnose an attack *before* reacting to it is a safety failure. The delay allows the attack to propagate.

### 2. Principle 124: Decoupled Mitigation
> "Do not couple mitigation to attribution. If an attack is detected, degrade safely *immediately*. Diagnose later."
>
> *Actionable*: If an Ops Gate or L3 Monitor flags a session, the response should be "Suspend & Isolate" (Safe Mode), not "Ask Agent to Debug." The agent is compromised or confused; asking it to think is dangerous.

### 3. Principle 125: The 3D Security Score
> "Security is not a scalar. It is a vector of (Detection, Attribution, Resilience). High Detection with Low Resilience is just a 'Panic Mode'."
>
> *Actionable*: We must score our agents on *Resilience* (recovery from failure), not just *Detection* (logging failure).

## Implementation Implications
1. **Circuit Breakers**: Our L3 Drift Controller (implemented recently) is the correct implementation of P124. It reverts *without* asking why. This validates our architecture.
2. **Alert != Fix**: Alerts from the system should trigger external intervention (May/Human), not purely internal remediation loops, especially for security events.
