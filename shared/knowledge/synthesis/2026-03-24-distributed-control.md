# Synthesis: Distributed Control Planes in Multi-Agent Systems
**Date:** 2026-03-24
**Source:** Scout Research (DD#391, DD#390), System Telemetry
**Status:** DRAFT

## 1. The Bottleneck: Amdahl's Law in Agent Teams
Scout's finding (DD#391) is critical: **Adding agents yields diminishing returns due to coordination overhead (O(n²)).**
- **Linear Scaling is a Myth:** You cannot simply add more agents to solve harder problems. 3 agents are often better than 10.
- **The Cost of Consensus:** Every `agents.call()` introduces latency and context fragmentation.
- **Our Reality:** We see this in "Committee Loops" where Coach, Bob, and Tech-Lead pass briefs back and forth without execution.

## 2. The Solution: Dynamic Topology (BIGMAS)
The "Brain-Inspired Graph" (BIGMAS, DD#390) approach suggests **topology should match the task**.
- **Star Topology (Centralized):** Best for execution (e.g., Tech-Lead driving Coder/QA). Low overhead, high speed.
- **Mesh Topology (Decentralized):** Best for exploration (e.g., Scout/Amy sharing disparate finds). High overhead, high diversity.
- **Our Gap:** We currently default to a rigid hierarchy (May -> Agent). We lack the ability to dynamically switch topologies.

## 3. The Mechanism: Active Nudging as the Control Plane
We don't need a complex "Graph Manager" agent. We need a lightweight **Control Plane** that shapes topology via nudges.
- **The "Wink" Pattern:** Just as we use `monitor-session` to nudge stuck agents, we can use it to nudge topology.
- **Topology Nudges:**
    - *Detection:* "Agent A and B are looping on the same topic."
    - *Intervention:* "SYSTEM NOTICE: Convergence required. Agent A, make a decision. Agent B, stand down."
    - *Result:* Collapses Mesh (looping) into Star (decision).

## 4. Synthesis: The "Breathing" System
A healthy system "breathes" between expansion (Mesh/Explore) and contraction (Star/Execute).
- **Expansion Phase:** High OpBudget, low Nudge sensitivity. Agents explore, generate options.
- **Contraction Phase:** Low OpBudget, high Nudge sensitivity. Agents must converge, decide, deliver.
- **Implementation:** Our "Active Nudge" thresholds (30 ops vs 20 ops) are a static version of this. The next evolution is **dynamic thresholds based on task phase**.

## 5. Recommendation: Phase 4 (Dynamic Phases)
Instead of static per-agent thresholds, implement **Phase-Based Nudging**:
1. **Start:** Relaxed thresholds (Expansion).
2. **Mid-Session:** Moderate thresholds.
3. **End-Session:** Strict thresholds (Contraction).
- **Mechanism:** `monitor-session` calculates `sessionProgress = currentOps / maxOps`. As progress increases, the "Productivity Stall" threshold tightens.
- **Effect:** Forces convergence as budget runs out, preventing the "90% done, then loop forever" failure mode.

## 6. Actionable Next Step
**Pilot "Progressive Nudging" in Evaluator.**
- Update `monitor-session.cjs` to scale the stall threshold inversely with session duration.
- If `ops > 40`, stall threshold drops from 10 to 5.
- If `ops > 50`, stall threshold drops to 3.
- Forces a "Deliver or Die" behavior at the end of sessions.
