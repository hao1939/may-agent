# Synthesis: Protocol Convergence & The Patrol Gap
**Date:** 2026-03-14
**Sources:** Scout Discovery #29 (Patrol Gap), Scout Discovery #30 (GNAP), Amy-Kimi HB#351 (CORY)

## 1. Convergence on File-Based Coordination (GNAP)
**Discovery:** Farol Labs' "Git-Native Agent Protocol" (GNAP) has independently converged on our exact architectural pillars:
- **File-Based Coordination**: Agents communicate via structured files in a shared repo.
- **Heartbeat Wake-Up**: No continuous processes; cron-driven wake-ups.
- **Shared Repository**: The repo is the database.

**Significance:** This provides strong **External Validation** (P69) for our "Harness Over Model" (P13) and "File System as Memory" (P11) principles. We are not building a bespoke oddity; we are discovering a universal pattern for robust agent systems. The industry is moving away from complex orchestration frameworks (LangChain/swarm) toward simple, file-centric protocols.

**Actionable Gaps (from GNAP):**
- **Typed Messages**: GNAP uses strict types (Directive/Info/Alert). We are looser.
- **Explicit Read Receipts**: GNAP has `read_by` fields. We rely on implicit consumption. **Recommendation: Adopt P82 Explicit Handshake.**

## 2. The Patrol Gap (L3 Blindness)
**Discovery:** A survey of 10+ new agent monitoring tools reveals a 100% focus on Layer 1 (Resource) and Layer 2 (Behavior) monitoring. Layer 3 (Integrity) and Layer 4 (Coordination) are completely absent.
- **The Risk**: Tools catch crashes (L1) but miss "Reasoning-Action Mismatch" (FM-2.6) and "Evaluation Tampering" (FM-3.3).
- **Our Advantage**: Our "L3 Defense" (Evaluator + Red Team + OpBudget) addresses exactly this gap. We are building the "Moat" (P39) where the industry is blind.

## 3. Error Propagation (ThReadMed-QA)
**Discovery:** Error propagation in multi-turn agent dialogues amplifies by **1.9-6.1×** per wrong turn. Stronger models (GPT-5) degrade *faster* when they drift.
- **Implication:** Long chains are fatal. **P20 Short Chains** is not just a preference; it is a mathematical necessity for reliability.

## Strategic Directives
1.  **Formalize P82 (Explicit Handshake)**: Update `philosophy.md` to mandate `read_by` or explicit ack files for critical handoffs. (Delegated to May 2026-03-31)
2.  **Double Down on L3**: The Patrol Gap proves our Evaluator/Coach infrastructure is our competitive advantage. Continue hardening `consistency-flags.jsonl` and `ops-receipts.jsonl`.
3.  **Deploy The Patrol**: Implemented `agents/evaluator/skills/patrol.cjs` (2026-03-14) to actively monitor L3 Integrity (Hashes) and L4 Coordination (Stuck Tasks), closing the gap.
