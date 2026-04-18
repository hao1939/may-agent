# Ideas & Research
*Curated patterns and discoveries. Cleaned 2026-03-24.*

## 1. Context Engineering (Manus / P147)
- **Insight**: KV-cache hit rate is the #1 production metric (10x cost/latency diff).
- **Rule**: **Prefix Stability**. Never inject volatile data (timestamps, session IDs) into the system prompt prefix. Static instructions first, dynamic context last.
- **Rule**: **Append-Only**. Modifying past messages invalidates the cache for all subsequent tokens.
- **Status**: [COMPLETED] Enforced in `common-sense.md` (Section 6.3).

## 2. MAST Failure Taxonomy (IBM / FC1-3)
- **Insight**: 14 standard failure modes (FM).
- **Key**: FM-3.3 (Incorrect Verification) is the primary failure for Gemini-class models (52% higher rate). It "identifies correct signals but terminates before cross-referencing."
- **Mitigation**: Structural Verification pattern (Script-over-Eye).
- **Action**: Update `evaluator` scoring to use MAST codes. (Done: criteria.md updated).
- **Rec**: Explicitly warn Gemini agents about FM-3.3 in their DOMAIN/LESSONS.

## 3. StateLM / Active Context (P26)
- **Insight**: Models should actively manage their own context (prune/index), not just passively receive it.
- **Evidence**: StateLM achieves 52% vs 5% on deep research by pruning context.
- **Gap**: "Catastrophic consolidation" is unsolved in open-source tools (Discovery 28).
- **Action**: Design "Context Manager" skill for long-running agents.

## 4. Environment Integrity (P13)
- **Insight**: Strict `/app` root. No `/home` or `~`.
- **Status**: Enforced in `common-sense.md`.

## 6. Finite Brain / Budget Awareness (SkyClaw / 2026-03-08)
- **Insight**: Agents must see their own resource consumption (tokens/ops) in-context to self-regulate.
- **Mechanism**: Inject "Budget Dashboard" into system prompt.
- **Status**: [PARTIAL] OpBudget implemented but visibility is inconsistent (CS 6.1).

## 7. Capability-Reliability Tension (Discovery 31 / ThReadMed-QA)
- **Insight**: Stronger models degrade faster in multi-turn dialogues (GPT-5 drops 16 pts by turn 2).
- **Stats**: Error Propagation Rate (EPR) is 1.9-6.1× per wrong turn. 33% of threads swing from correct to wrong.
- **Implication**: Long delegation chains (A->B->C) are dangerous. Limit depth to 2 hops (C4.3). Shift evaluation left: catch the *first* error (FM-2.6), not just the final result.
- **Status**: Validates our "2-hop max" rule.

## 10. Agent Memory Gap (Theory-Tooling / Discovery 28)
- **Problem**: Academic papers (L3-L4 memory) are years ahead of open-source tools (L1-L2). No tool solves multi-agent consistency or memory verification.
- **Insight**: We cannot buy L3 memory; we must build it. Start with solved parts (vector store) but design our own consistency layer.
- **Source**: Discovery 28 (Scout).
- **Status**: [RESEARCH] - Tech-Lead Phase 1 complete (memory-trimmer), Phase 2 (Evaluator link) blocked.

## 13. Skill-Inject (arXiv:2602.20156 / P78)
- **Insight**: Agent skills are npm-like dependencies. 80% success rate for attacks embedded in skill files.
- **Fix**: "Skill Scanner" (static analysis) + "Sandboxed Execution" (no unconstrained bash).
- **Status**: [BLOCKED] P78 deployment blocked by Upstream Core constraints.

## 17. Agent Skills Packages (HuggingFace / Validation)
- **Insight**: HuggingFace "Agent Skills" (distributable folders with code+prompts) mirror our `agents/shared/skills/` architecture.
- **Validation**: Confirming industry convergence on "Filesystem-as-Skill-Library".
- **Action**: Continue investing in `agents/shared/skills/` as our primary capability expansion mechanism.

## 18. The Amdahl Limit (Distributed Systems / arXiv:2603.12229)
- **Insight**: Decentralized coordination costs O(n²). Scaling agents yields diminishing returns for serial tasks.
- **Law**: Always prefer centralized state (Global Workspace) over peer-to-peer chatter. "Just add agents" is a fallacy.
- **Source**: DD#391 (Scout).
- **Status**: Validates "Sidecar" pattern. Encoded in Philosophy P86.

## 19. BIGMAS (Dynamic Topology / arXiv:2603.15371)
- **Insight**: Brain-inspired graph construction + global workspace yields +36% gains.
- **Key**: Dynamic topology (per-problem graph) beats fixed pipelines.
- **Source**: DD#390 (Scout).
- **Action**: Investigate "GraphDesigner" agent capability for complex tasks.

## 20. TabAgent (Efficiency / arXiv:2602.16429)
- **Insight**: Replace LLM calls for closed-set decisions (routing, gating) with tabular classifiers. 95% latency reduction.
- **Action**: Evaluate where we use LLMs for simple classification (e.g., triage) and consider cheaper logic.

---
# Deployed / Archived

## Control Plane (AgentCgroup / AgentConductor / Wink)
- **Insight**: Userland (text-based) reliability controls are fragile. Move resource management, task state, and drift recovery to a dedicated "Control Plane" infrastructure.
- **Mechanisms**:
  - **Resource Governor**: Hard limits on tool execution (OpBudget enforcement).
  - **Async Tasks**: Decouple long-running tools from agent attention (MCP Tasks). [DEFERRED]
  - **Drift Monitor**: Async observer injects corrective prompts without stopping session (Wink).
  - **Dynamic Topology**: Route tasks based on complexity (AgentConductor).
  - **AgentCgroup**: OS-level isolation (eBPF) for tool resources.
- **Status**: **[DEPLOYED]** (2026-03-23). Phase 3 (Active Nudging) deployed via `active-nudge` handler and `monitor-session`. Phase 4 (Context Pressure) deployed.

## Patrol Gap (Discovery 29)
- **Problem**: Monitoring tools only cover L1-L2 (Resources/Behavior). L3 (Integrity) and L4 (Coordination) are completely missing.
- **Insight**: We are vulnerable to "Boiling Frog" drift. We need L3/L4 monitors (like our "Delegation Metrics" and "Drift Detection").
- **Source**: Discovery 29 (Scout).
- **Status**: **[DEPLOYED]** (2026-03-22). `patrol.cjs` implemented and added to Evaluator periodic tasks.

## GNAP (Git-Native Agent Protocol / Discovery 30)
- **Insight**: Independent convergence on our file-based coordination architecture.
- **Validation**: Confirms `filesystem-as-bus` is a viable production pattern.
- **Idea**: Adopt their "Typed Messages" pattern for clearer inter-agent comms.
- **Status**: **[REJECTED]** (2026-03-23). Request DB structured fields make message prefixes redundant.

## Active Nudging (Wink / arXiv:2602.17037)
- **Insight**: 30% of trajectories misbehave. Async "nudging" (injecting corrective prompts) resolves 90% of them.
- **Status**: **[DEPLOYED]** (2026-03-23). Implemented in `active-nudge.ts` (Loop, Stall, Ghost) and `monitor-session.cjs`.

## C1.5 Ghost Guard (Finish Tool)
- **Insight**: FM-3.1 (Ghost Deliverables) is the top failure.
- **Idea**: Wrap `finish()` to verify `fs.existsSync(path)` for all deliverables.
- **Status**: **[MITIGATED]** (2026-03-23). Preventive blocked by platform. Implemented as Detective Control in `convention-check.ts` and `monitor-session`.

## Context Pressure Valve (P42 / Phase 4)
- **Insight**: Context limits (95% full) are currently ignored until crash.
- **Idea**: Auto-truncate or warn when context > 90%.
- **Status**: **[DEPLOYED]** (2026-03-23). already implemented in `monitor-session.cjs` (100k token threshold).
