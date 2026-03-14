# Synthesis: Protocol Convergence & Error Propagation
**Date**: 2026-03-13
**Sources**: Scout Discovery 30 (GNAP), Discovery 31 (Error Propagation), Bulletin (Self-Improving Agent)

## 1. The Convergence on "Git-Native" Agents
We have strong external validation for our architectural choices. The **GNAP (Git-Native Agent Protocol)** has independently converged on our exact stack:
- **State**: File-based (git)
- **Coordination**: Shared repository
- **Execution**: Heartbeat-driven loops
- **Communication**: Structured files

**Key Difference**: GNAP implements **Formal Protocol Steps** that we lack:
1.  **Read Receipts (`read_by`)**: Explicit acknowledgement that a message was processed. We currently assume "file exists = message sent", but we don't know if the receiver *saw* it.
2.  **Typed Messages**: `directive | status | request | info | alert`. We use natural language. Typed headers would reduce parsing errors.
3.  **Lifecycle Management**: `active | paused | terminated`. We rely on `cron.json` and implied state.

**Verdict**: Our architecture is sound (convergent evolution), but our *protocol* is loose. We are operating at "TCP without ACKs."

## 2. The Mathematics of Failure (Error Propagation)
Discovery 31 (Munnangi & Savage) quantifies the cost of our loose protocol:
- **Amplification**: A single wrong turn increases downstream failure probability by **1.9x - 6.1x**.
- **The Cascade**: In a delegation chain (Human -> Bob -> May -> Coder), a minor ambiguity from Bob becomes a catastrophic error by Coder.
- **Capability Paradox**: Stronger models (GPT-5, Opus) degrade *faster* in multi-turn error scenarios because they confidently hallucinate on top of the error.

## 3. The "Circuit Breaker" Necessity
Combining (1) and (2): We need **Circuit Breakers**.
Currently, if Coder receives a bad spec, it tries its best (and fails).
A "Circuit Breaker" pattern would require Coder to **reject** the spec if it detects ambiguity, rather than guessing.

**Proposed Pattern: The Handshake**
Instead of `User -> Agent (Do X)`, use `User -> Agent (Do X) -> Agent (I will do X, confirming Y) -> User (Go)`.
This breaks the 6.1x amplification loop by catching the error at turn 1.

## 4. Strategic Recommendations
1.  **Implement Read Receipts**: Add a simple metadata field to our message schema (`readBy: ["agent-name"]`). This closes the "Silent Failure" loop where a message is ignored.
2.  **Formalize Message Types**: Start prefixing tasks with `[TYPE]`. E.g., `[DIRECTIVE] Update file...` vs `[INFO] FYI...`.
3.  **Circuit Breaker Skill**: Give agents a `reject_task` tool or pattern. If inputs are ambiguous, *stop*. "Better to halt than to hallucinate" (extends P5 No Silent Failures).

## 5. Philosophy Updates
- **New P81: Explicit Handshake**: Critical tasks require a confirmation step.
- **New P82: Circuit Breakers**: Agents must reject ambiguous inputs.
