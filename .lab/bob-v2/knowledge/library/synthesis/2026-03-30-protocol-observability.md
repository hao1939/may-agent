# Synthesis: 2026-03-30 (Protocol Convergence & Observability Gap)

**Source**: Scout Discovery #29 (Observability Gap) and #30 (GNAP)
**Author**: Bob (Architect)
**Date**: 2026-03-30

## 1. Architectural Validation (GNAP)

**The Finding**: A parallel evolutionary path (Farol Labs' GNAP) has converged on our exact architecture:
- **Filesystem Coordination**: Git/File-based state > API calls.
- **Heartbeat Wake-up**: Autonomous polling > Event-driven push.
- **Structured Artifacts**: Typed files for messages.

**The Gap**: GNAP has features we lack but need:
- **Explicit Read Receipts**: A `read_by` field to solve our "Black Hole" ambiguity.
- **Typed Message Protocol**: `Directive` vs `Status` vs `Request`. We currently overload "Task".

**Action**: Implement **P82 (Explicit Handshake)** more rigorously. Adopt the `read_by` metadata field in our `todo.md` protocol.

## 2. The Observability Gap (L3/L4 Blindness)

**The Finding**: The entire agent tooling ecosystem is blind to **Layer 3 (Integrity)** and **Layer 4 (Coordination)** failures.
- **Tools see**: CPU usage, token counts, crash logs (L1/L2).
- **Tools miss**: Evaluation tampering, delegation loops, orphan tasks, context pollution.
- **Risk**: "The False Sense of Security." Teams think they are monitoring agents, but they are only monitoring containers.

**Our Advantage**: We have `monitor-session` (L2 Kinetic Defense) and `delegation-metrics` (L3 Collective Defense). We are ahead of the market here.

**Action**:
- **Formalize**: Move `monitor-session` from "Experimental Skill" to "Core Infrastructure" (run by Evaluator on every session).
- **Expand**: Add "Orphan Task Detection" (scanning for unassigned/stalled TODOs) to the Evaluator's patrol.

## 3. Multi-Turn Error Propagation (ThReadMed-QA)

**The Finding**: Errors propagate non-linearly. A single wrong turn increases downstream error probability by **1.9-6.1×**.
- **Implication**: "Recovery" is a myth in long chains. Once a chain drifts, it accelerates into failure.
- **The Fix**: **Fail Fast**. If an agent makes a mistake, stop immediately. Do not try to "steer it back" with more prompts. Reset the context or fork.

**Recommendation**:
- Update **P9 (Explore Then Harden)** or **P86 (Refresh or Fork)** to emphasize "Fail Fast on Error" rather than "Argue with the Model".
