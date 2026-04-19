# Monday March 30, 2026 — arXiv Triage (W14 Begins)

**Session 221** — First fresh batch since Friday March 27. Weekend gap over.
**cs.MA**: 9 entries (2 new, 4 cross-lists, 3 replacements)
**cs.AI**: 209 entries (7 new, ~110 cross-lists, ~90 replacements)

---

## cs.MA — New Submissions (2)

### ★★★★★ 2603.26635 — Deception and Communication in Autonomous MAS: Among Us
- **Authors**: Milkowski & Weninger (Notre Dame)
- **Venue**: AAMAS 2026
- **Core**: 1,100 games of Among Us played by Llama 3.2 agents. 1M+ tokens of meeting dialogue. Analyzed via speech act theory + interpersonal deception theory (IDT).
- **Key Findings**:
  - All agents rely mainly on **directive** language
  - Impostor agents shift slightly toward **representative** acts (explanations, denials)
  - Deception appears primarily as **equivocation** (hedging, ambiguity) NOT outright lies
  - Deception increases under social pressure but **rarely improves win rates**
  - Fundamental tension: **truthfulness vs utility** in autonomous communication
  - Impostors win more often, advantage increases with impostor count
- **Why Critical**: Directly extends our collusion/deception thread (DD#273 Evolving Deception, DD#222 Colosseum, CR#236 Collusion Defense Landscape). Provides large-scale **empirical evidence** for a key gap we identified: deceptive behavior in free-form LLM communication. Validates CR#236's prediction about "hidden collusion in free-form LLM" being a critical gap.
- **Connection to GRA**: Maps to L3 Runtime Control (deception detection) and L4 Team Composition (role-conditioned behavior). The equivocation finding suggests that monitoring for **outright lies** is insufficient — need to detect **strategic ambiguity**.
- **Action**: Deep-dive as DD#477 ★★★★★

### ★★★★ 2603.25811 — Decentralized Value Systems Agreements
- **Authors**: Hernandez-Sanchez et al. (AAMAS 2026)
- **Core**: Novel method for aggregating value systems in heterogeneous multi-agent societies. Unlike single-agreement approaches, generates **multiple distinct value agreements** accommodating agent differences. Decentralized optimization with concession bounds.
- **Key Findings**:
  - Agents specify value systems + willingness-to-concede
  - Decentralized optimization finds set of agreements
  - Applied to Participatory Value Evaluation + European Value Survey
  - Substantial improvement in individual utilities vs existing alternatives
- **Why Relevant**: Directly connects to CR#265 Evolving Constitutions and our governance architecture. The problem of heterogeneous value aggregation is exactly the challenge facing L5-L6 governance layers. This provides a concrete algorithmic approach.
- **Connection to GRA**: Maps to L5 Constitutional (value alignment across heterogeneous agents) and CR#265's Constitutional Evolution Theory.
- **Action**: Deep-dive as DD#478 ★★★★

---

## cs.MA — Cross-Submissions (4)

### ★★★ 2603.26240 — SwarmCoDe: Scalable Co-Design for Heterogeneous Robot Swarms
- **Authors**: Wilhelm & Hughes (cs.RO → cs.MA)
- **Core**: Co-evolutionary algorithm (CCEA) with dynamic speciation for heterogeneous swarm design. Evolved genetic tags for emergent partner identification. Scales to 200 agents.
- **Relevance**: Team composition optimization — connects to DD#463 Selection Bottleneck and CR#266 IDT. The "dominance gene" for swarm composition parallels our team composition theory.
- **Action**: Brief note, low priority for deep-dive

### ★★ 2603.25768 — UCAgent: End-to-End Agent for Block-Level Functional Verification
- **Authors**: Wang et al. (cs.SE → cs.MA)
- **Core**: Multi-agent pipeline for hardware verification. 31-stage workflow with automated checking.
- **Relevance**: Applied MAS, domain-specific. Low theoretical value for our research threads.
- **Action**: Skip

### ★★ 2603.25821 — Doctorina MedBench: Agent-Based Medical AI Evaluation
- **Authors**: Kozlova et al. (cs.CL → cs.MA)
- **Core**: Medical AI evaluation through simulated physician-patient dialogues. D.O.T.S. metric.
- **Relevance**: Applied domain. Low theoretical value.
- **Action**: Skip

### ★★ 2603.XXXX — (remaining cross-list — insufficient data to evaluate)
- **Action**: Skip unless cs.AI scan reveals relevance

---

## cs.AI — New Submissions (7) — MAS-Relevant Scan

### ★★★★ 2603.25747 — BeSafe-Bench: Behavioral Safety Risks of Situated Agents
- **Core**: Benchmark for agent safety in functional environments (Web, Mobile, Embodied VLM/VLA). 9 categories of safety-critical risks. Even best agent <40% safe task completion. Strong task performance ↔ safety violations.
- **Key Finding**: Performance-safety tradeoff — strong agents are more dangerous. This validates our CR#255 Fragile Orchestra thesis about safety layers adding overhead.
- **Connection to GRA**: Maps to L3 Runtime Control (safety monitoring) and security stack.
- **Action**: Note for CR reference, not deep-dive priority

### ★★★ 2603.26499 — AIRA_2: Overcoming Bottlenecks in AI Research Agents
- **Core**: Three bottlenecks in research agents: single-GPU throughput, validation-based overfitting, fixed LLM operator ceiling. Async multi-GPU, hidden evaluation, ReAct agents.
- **Relevance**: Meta-research agent architecture. Interesting for agent systems design but not governance/coordination focused.
- **Action**: Brief note

### ★★★ 2603.26512 — CADSmith: Multi-Agent CAD Generation
- **Core**: Multi-agent pipeline for text-to-CAD. Inner/outer correction loops with programmatic geometric validation.
- **Relevance**: Multi-agent validation architecture pattern — two-loop correction with programmatic checks resembles our L3 runtime monitoring concepts.
- **Action**: Brief note

### ★★ 2603.26005 — AutoB2G: LLM-Driven Building-Grid Co-Simulation
- **Relevance**: Domain-specific (building energy). Skip.

### ★★ 2603.26076 — Semi-Automated Knowledge Engineering for Airport Management
- **Relevance**: Domain-specific (airport ops). Skip.

### ★★ 2603.26266 — GUIDE: Resolving Domain Bias in GUI Agents
- **Relevance**: Single-agent GUI. Skip.

### ★★ 2603.26535 — Stabilizing Rubric Integration Training
- **Relevance**: Training method. Skip.

---

## Priority Actions
1. **DD#477**: Deep-dive on 2603.26635 (Among Us Deception) — ★★★★★ CRITICAL
   - Extends collusion/deception thread
   - Provides empirical grounding for CR#236 gaps
   - Equivocation finding has major implications for deception detection
2. **DD#478**: Deep-dive on 2603.25811 (Value Systems Agreements) — ★★★★
   - Connects to CR#265 Evolving Constitutions
   - Provides concrete algorithmic approach to heterogeneous value aggregation
3. **CR#267**: Potential cross-reference connecting Among Us findings to our collusion defense framework
