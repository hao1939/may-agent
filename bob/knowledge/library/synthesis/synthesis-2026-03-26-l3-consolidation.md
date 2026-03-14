# Synthesis: L3 Collective Defense Consolidation

**Date:** 2026-03-26
**Source:** System State, Manager Code, Skill Definitions
**Status:** **ACTIVE** (Consolidating)

## 1. Mechanism: The Three Pillars of L3 Defense
The system has converged on a three-part "L3 Collective Defense" architecture. This is no longer theoretical — the code and skills exist, but knowledge about them is fragmented.

### A. Passive Governance (P85 Operation Budgets)
- **Mechanism:** `opBudget` (Operation Budgets) in `src/lib/manager.ts`.
- **Constraint:** Hard limit on state-changing operations (writes, commands) per session.
- **Goal:** Prevent runaway loops (infinite resource consumption) and limit blast radius of compromised agents.
- **Status:** Implemented in code (`opCount` vs `opBudget`), but missing from Bob's explicit knowledge base.

### B. Kinetic Defense (Red Team)
- **Mechanism:** `agents/coach/skills/red-team.md` (Coach).
- **Constraint:** Active probing of agent defenses using known attack vectors (Path Traversal, Instruction Injection).
- **Goal:** Prove defenses work by trying to break them (HAE Framework).
- **Status:** Implemented as a Coach skill.

### C. Watchdog Monitoring (Wink Pattern)
- **Mechanism:** `agents/evaluator/skills/monitor-session.md` (Evaluator).
- **Constraint:** Asynchronous, out-of-band monitoring of running sessions.
- **Goal:** Detect stalls, loops, and drift *while* the agent is working, not just after.
- **Status:** Implemented as an Evaluator skill.

## 2. Pattern: Convergence on "Defense in Depth"
We moved from "trust the agent" (Phase 1) to "trust but verify" (Phase 2), and now to "verify and limit" (L3).
- **L1 (Prompting):** "You are safe." (Fragile)
- **L2 (Tools):** "You cannot write to /etc." (Robust but passive)
- **L3 (System):** "You have 10 ops. Watchdog is watching. Red Team is testing." (Active & Bounded)

## 3. Principle Alignment
- **P85 Operation-Bounded Authority:** Explicitly codified in `opBudget`.
- **P53 HAE Trilemma:** Safety (OpBudget) vs Capability (Agent) vs Autonomy (Red Team).
- **P83 Circuit Breakers:** `monitor-session` acts as a soft circuit breaker.

## 4. Recommendations
1. **Consolidate Knowledge:** Create `agents/bob/knowledge/l3-collective-defense.md` to formally document this triad.
2. **Update Philosophy:** Ensure P85 explicitly mentions the `opBudget` mechanism (camelCase) to match code.
3. **Verify adoption:** Check if `opBudget` is actually being set in `agent.json` or session requests (next step).
