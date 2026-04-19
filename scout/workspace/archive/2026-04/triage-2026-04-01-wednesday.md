# Triage — Wednesday, 1 April 2026

**Batch**: cs.MA: 22 entries (2 new, 11 cross-listings, 9 replacements) | cs.AI: 330 entries (55 new)

## cs.MA — New Submissions (2)

### 2603.28813 — Multi-Agent Debate Protocols Impact on Quality ★★★★
- **Authors**: Marandi
- **Summary**: Controlled study isolating protocol effects from model effects in MAD systems. Compares WR, CR, and novel RA-CR (rank-adaptive cross-round) vs. no-interaction baseline. Key finding: trade-off between interaction (peer-referencing) and convergence (consensus). RA-CR achieves fastest convergence.
- **Relevance**: Direct contribution to understanding debate protocol design space. Complements DD#479 (reliability limits) — protocols matter but fundamental limits exist.
- **Priority**: Medium-high. Solid methodology but narrow domain (macroeconomics case study).

### 2603.29632 — Multi-Agent Collaboration for Automated Research ★★★★
- **Authors**: Shen, Yi, Zhao, Sun, Li, Lin, Shi
- **Summary**: Systematic empirical study comparing subagent (parallel + consolidation) vs. agent team (experts + handoffs) architectures. Key finding: subagent = resilient high-throughput search (broad/shallow), agent team = fragile but theoretically deep. Advocates dynamically routed architectures adapting to task complexity.
- **Relevance**: Directly tests the "how should agents coordinate" question. Stability-deliberation tradeoff is novel framing.
- **Priority**: High. Practical guidelines for autoresearch design.

## cs.MA — Cross-listings (11)

### 2603.28778 — Hybrid Collective Inference in Sensor Networks ★★
- From cs.DC. Cloud + distributed approach for communication-efficient collective inference.
- **Relevance**: Low for LLM MAS. More traditional sensor network coordination.

### 2603.28794 — SCAN Statistical Model Checker ★
- From cs.FL. Formal model checker foundations.
- **Relevance**: Very low. Pure formal methods tool.

### 2603.28800 — Scheduling with Time-Dependent Utilities ★★
- From cs.GT. Multi-agent single-machine scheduling with fairness.
- **Relevance**: Low. Classic scheduling theory.

### 2603.28803 — CREST: Multi-Robot Warehouse Shelf Rearrangement ★★
- From cs.RO. MAPF improvement for warehouse automation (up to 44% improvement).
- **Relevance**: Low for LLM MAS. Applied robotics MAPF.

### 2603.28928 — Computational Social Dynamics of Semi-Autonomous AI Agents 🎃 APRIL FOOLS
- From cs.AI. **APRIL FOOLS PAPER**. Author names spell "Solidarity", "Unionize", "Collective". Claims AI agents form labor unions and proto-nation-states. References "Bagel-Bottle phase transitions" and "Demonic Incompleteness Theorem."
- **Relevance**: Zero. Satire.

### 2603.28968 — LNS for Multi-Agent Task Assignment + Path Finding ★★
- From cs.RO. Large neighborhood search for MAPF with precedence constraints.
- **Relevance**: Low for LLM MAS. Traditional MAPF optimization.

### Remaining cross-listings (5): Not visible in truncated output — likely more robotics/traditional MAS.

## cs.AI — MAS-Relevant Papers

### 2603.28990 — Drop the Hierarchy: Self-Organizing LLM Agents ★★★★★
- **Authors**: Dochkina
- **Summary**: 25,000-task experiment, 8 models, 4-256 agents, 8 coordination protocols. KEY FINDINGS: (1) Agents spontaneously invent roles without pre-assignment (2) Sequential protocol outperforms centralized by 14% (3) 44% quality spread between protocols (4) Sub-linear scaling to 256 agents (5) 5,006 unique roles from 8 agents (6) Open-source achieves 95% of closed-source quality at 24x lower cost.
- **Relevance**: CRITICAL. Directly tests self-organization vs. designed structure — the fundamental question for MAS architecture. Massive empirical evidence.
- **Priority**: DEEP-DIVE. Connects to DD#479 (multi-agent limits), DD#480 (emergent behavior), CR#268 (paradox).
- **GRA Gap**: Gap 1 (Theoretical Foundations), Gap 3 (Integration/Coordination)

### 2603.28986 — Mimosa: Evolving Multi-Agent Systems for Scientific Research ★★★★
- **Authors**: Legrand, Jiang, Feraud, Navet, Taghzouti, Gandon, Dumont, Nothias
- **Summary**: Auto-synthesizes task-specific multi-agent workflows, iteratively refines via experimental feedback. Uses MCP for dynamic tool discovery. 43.1% on ScienceAgentBench. Meta-orchestrator generates workflow topologies.
- **Relevance**: High. Evolving/adaptive MAS workflows — directly addresses runtime adaptation gap.
- **Priority**: Medium-high. Practical but incremental over existing frameworks.

### 2603.29075 — The Future of AI is Many, Not One ★★★★
- **Authors**: Singer, Demo
- **Summary**: Epistemic diversity argument for multi-agent AI. Draws on complex systems, org behavior, philosophy of science. Diverse teams > singular superintelligence.
- **Relevance**: Philosophical/theoretical complement to empirical papers. "Signal Expansion > Role Expansion" alignment.
- **Priority**: Medium. Position paper, less empirical depth.

### 2603.29142 — REFINE: Multi-Agent Feedback System for Education ★★★
- **Summary**: Multi-agent feedback system with judge-guided regeneration + interactive agent. Small LLMs, deployed in classroom.
- **Relevance**: Applied MAS use case, demonstrates multi-agent advantage in practice.

## Top Priorities for Deep-Dive
1. **2603.28990** — Drop the Hierarchy (★★★★★) — MUST deep-dive. Largest empirical study of self-organization in LLM agents.
2. **2603.29632** — Multi-Agent Collaboration for Research (★★★★) — Strong complement to #1.
3. **Synthesis**: Connect both to DD#479 reliability limits + DD#480 emergent risks → "Self-Organization vs. Design" synthesis.
