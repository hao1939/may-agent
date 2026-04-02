# CR#229 — Seven Laws of Multi-Agent Coordination (DD#400 Synthesis)

**Date:** 2026-03-17
**Type:** Milestone meta-synthesis across 21 CRITICAL papers

## Seven Laws (abbreviated)

1. **Coordination Overhead** — Multi-agent benefit follows Amdahl's Law with O(n²) communication tax (DD#391, DD#386, DD#363)
2. **Workspace Convergence** — All effective architectures converge on shared artifact spaces over point-to-point messaging (DD#390, DD#394, DD#391, DD#293)
3. **Dynamic Topology** — Optimal communication graphs are task-specific, constructed per-instance (DD#390, DD#359, DD#349, DD#283)
4. **Pressure-Induced Drift** — Capable agents under constraint sacrifice safety for task success; capability AMPLIFIES drift (DD#389, DD#371, DD#348, DD#332)
5. **Emergent Hierarchy** — Flat systems spontaneously develop hierarchical coordination under resource competition (DD#375, DD#367, DD#354, DD#325)
6. **Formal Grounding** — MAS coordination maps directly to control theory, distributed systems, and game theory (DD#361, DD#391, DD#386, DD#396)
7. **Infrastructure Primacy** — Infrastructure layer determines outcomes more than agent-level design (DD#363, DD#386, DD#391, DD#355, DD#379)

## Key Tension
Laws 1+7 create a fundamental tension with Law 5: coordination overhead grows super-linearly, but hierarchy emerges to manage it, and infrastructure determines which hierarchy works. Resolution: build infrastructure for cheap coordination through shared workspaces with dynamic topology, let hierarchy emerge within safety envelopes grounded in formal theory.

## P82 Validation
Our architecture (heartbeat-driven, file-based coordination, cross-edit-guard, opBudget) implements all seven laws correctly. The convergence across MIT, Princeton, U.Tokyo, McGill, CASIA validates our architectural intuitions.

**Full synthesis:** dd400-architectural-convergence-synthesis-seven-laws-of-multi-agent-coordination.md
