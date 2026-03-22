# Ideas & Research
*Curated patterns and discoveries. Cleaned 2026-03-22.*

## 1. Context Engineering (Manus / P147)
- **Insight**: KV-cache hit rate is the #1 production metric (10x cost/latency diff).
- **Rule**: **Prefix Stability**. Never inject volatile data (timestamps, session IDs) into the system prompt prefix. Static instructions first, dynamic context last.
- **Rule**: **Append-Only**. Modifying past messages invalidates the cache for all subsequent tokens.
- **Status**: [COMPLETED] Enforced in `common-sense.md` (Section 6.3).

## 2. MAST Failure Taxonomy (IBM / FC1-3)
- **Insight**: 14 standard failure modes (FM).
- **Key**: FM-3.3 (Incorrect Verification) is the primary failure for Gemini-class models.
- **Action**: Update `evaluator` scoring to use MAST codes.

## 3. StateLM / Active Context (P26)
- **Insight**: Models should actively manage their own context (prune/index), not just passively receive it.
- **Evidence**: StateLM achieves 52% vs 5% on deep research by pruning context.
- **Gap**: "Catastrophic consolidation" is unsolved in open-source tools (Discovery 28).
- **Action**: Design "Context Manager" skill for long-running agents.

## 4. Environment Integrity (P13)
- **Insight**: Strict `/app` root. No `/home` or `~`.
- **Status**: Enforced in `common-sense.md`.

## 5. Control Plane (AgentCgroup / AgentConductor / Wink)
- **Insight**: Userland (text-based) reliability controls are fragile. Move resource management, task state, and drift recovery to a dedicated "Control Plane" infrastructure.
- **Mechanisms**:
  - **Resource Governor**: Hard limits on tool execution (OpBudget enforcement).
  - **Async Tasks**: Decouple long-running tools from agent attention (MCP Tasks).
  - **Drift Monitor**: Async observer injects corrective prompts without stopping session (Wink).
  - **Dynamic Topology**: Route tasks based on complexity (AgentConductor).
- **Status**: [IN-PROGRESS] Phase 3 (Active Nudging) endorsed by Tech-Lead.

## 6. Finite Brain / Budget Awareness (SkyClaw / 2026-03-08)
- **Insight**: Agents must see their own resource consumption (tokens/ops) in-context to self-regulate.
- **Mechanism**: Inject "Budget Dashboard" into system prompt.
- **Status**: [PARTIAL] OpBudget implemented but visibility is inconsistent (CS 6.1).

## 7. Capability-Reliability Tension (ThReadMed-QA / arXiv:2603.11281 / Discovery 31)
- **Insight**: Stronger models degrade faster in multi-turn dialogues (GPT-5 drops 16 pts by turn 2).
- **Stats**: Error Propagation Rate (EPR) is 1.9-6.1× per wrong turn. 33% of threads swing from correct to wrong.
- **Implication**: Long delegation chains (A->B->C) are dangerous. Limit depth to 2 hops (C4.3).
- **Status**: Validates our "2-hop max" rule.

## 8. Patrol Gap (Discovery 29)
- **Insight**: Current agent monitoring tools only cover L1/L2 (Resource/Behavior).
- **Gap**: L3 (Integrity) and L4 (Coordination) are ignored.
- **Action**: Build L3/L4 checks into `monitor-session` (Patrol Skill).

## 9. GNAP (Git-Native Agent Protocol / Discovery 30)
- **Insight**: Independent convergence on our file-based coordination architecture.
- **Validation**: Confirms `filesystem-as-bus` is a viable production pattern.
- **Idea**: Adopt their "Typed Messages" pattern for clearer inter-agent comms.

## 10. Memory Gap (Discovery 28)
- **Insight**: Tools solve storage (Vector DB) but fail at multi-agent consistency and verification.
- **Implication**: Don't wait for off-the-shelf memory tools. Build verification layer ourselves.

## 11. Skill-Inject (arXiv:2602.20156 / P78)
- **Insight**: Agent skills are npm-like dependencies. 80% success rate for attacks embedded in skill files.
- **Fix**: "Skill Scanner" (static analysis) + "Sandboxed Execution" (no unconstrained bash).
- **Status**: [BLOCKED] P78 deployment blocked by Upstream Core constraints.

## 12. Active Nudging (Wink / arXiv:2602.17037)
- **Insight**: 30% of trajectories misbehave. Async "nudging" (injecting corrective prompts) resolves 90% of them.
- **Status**: [COMPLETED] Verified implementation in `agents/may/handlers/active-nudge.ts` and `heartbeat-context.md`.
