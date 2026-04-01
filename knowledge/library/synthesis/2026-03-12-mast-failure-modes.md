# Synthesis: MAST Failure Taxonomy (2026-03-12)

A practical guide to Multi-Agent System (MAST) failure modes, distilled from recent research (IBM, Berkeley, UBC).
Use this to diagnose "why did it fail?" beyond just "it didn't work."

## 1. The Core Taxonomy (FM-X.Y)

### Tier 1: Cognitive Failures (The Thinker)
*Individual agent reasoning breaks down.*
- **FM-1.1 Context Rot**: Performance degrades as context length increases. (Agent forgets early instructions).
- **FM-1.2 Instruction Drift**: Agent prioritizes recent outputs over original system prompt.
- **FM-1.3 Hallucination**: Agent invents facts or code that doesn't exist.
- **FM-1.4 Memory Loss**: Agent fails to recall information it previously generated or read.

### Tier 2: Executional Failures (The Doer)
*Tool use and environment interaction breaks down.*
- **FM-2.1 Tool Hallucination**: Agent calls a tool that doesn't exist or invents parameters.
- **FM-2.2 Loop Trap**: Agent retries the exact same failing action >3 times. (Violation of P8).
- **FM-2.3 Silent Failure**: Tool fails, but agent proceeds as if it succeeded. (Violation of P6).
- **FM-2.4 Formatting Error**: Output is valid JSON/Code but wrapped in markdown or conversational text.

### Tier 3: Collective Failures (The Society)
*Coordination between agents breaks down.*
- **FM-3.1 Message Loss**: Information is lost in handoff between Agent A and Agent B.
- **FM-3.2 Consensus Hallucination**: Agents reinforce each other's errors (Groupthink).
- **FM-3.3 Incorrect Verification**: QA Agent fails to catch a bug (False Negative) or rejects valid code (False Positive).
- **FM-3.4 Infinite Delegation**: Agents keep passing the ball without progress.

## 2. Diagnostic Mapping

| Symptom | Probable Cause | Fix |
|---------|----------------|-----|
| "I read the file but it's empty" (when it's not) | FM-2.3 (Tool Failure) | Check `read` output. Did it actually return content? |
| "I fixed it" (but code is unchanged) | FM-2.3 / FM-3.3 | Enforce **P19 Verify-on-Edit**. |
| Agent loops on "Plan -> Execute -> Fail -> Plan" | FM-2.2 (Loop Trap) | Interrupt. Force a change in approach. |
| Agent A says X, Agent B says Not X | FM-3.1 (Message Loss) | Check the prompt passed to Agent B. Did it contain X? |
| Code is syntactically correct but logic is wrong | FM-1.1 (Context Rot) | Summarize context. Reset session. |

## 3. Prevention Strategies
- **For FM-1.x**: Keep contexts short. Use `reset` often.
- **For FM-2.x**: Deterministic tool interfaces. **P6 No Silent Failures**.
- **For FM-3.x**: **P20 Short Chains**. Explicit handoff formats. **L3 Metrics** (monitoring delegation success).

## Sources
- *Hierarchical Autonomy Evolution (HAE)* (arXiv:2603.07496)
- *Error Cascades in Agent Systems* (arXiv:2603.04474)
- Internal Session Analysis (Feb-March 2026)
