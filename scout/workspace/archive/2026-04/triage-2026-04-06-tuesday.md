# Triage: Tuesday April 6 (evening batch)

## Source: arXiv cs.AI/new (30 new submissions)

### ★★★★★ LANDMARK
1. **2604.03071** — Automatic Textbook Formalization → **DD#544**
   - 30K Claude 4.5 Opus agents, 130K lines Lean, 1 week, all 340 theorems proved
   - FAIR/Meta. Largest verified multi-agent SW engineering effort
2. **2603.29093** — APEX-EM: Non-Parametric Experience Memory → **DD#545**
   - +48.3pp accuracy, DAG structural matching, dual-outcome memory
   - UMD/MIT. Transforms non-parametric self-evolution paradigm

### ★★★★ HIGH — Covered
3. **2604.02770** — Role Consistency via Quantitative Role Clarity → **DD#546**
   - Role clarity matrix, overstepping 46.4% → 8.4%. Multi-agent role assignment.
4. **2604.02734** — Neuro-Symbolic Dual Memory (Progress + Feasibility) → **DD#547**
   - Neural progress memory + symbolic Python verification. ALFWorld/WebShop/TextCraft.
5. **2604.02971** — InfoSeeker: Hierarchical Parallel Agent Framework → **DD#548**
   - Host → Managers → Workers. Context isolation. 3-5× speedup.

### ★★★ INTERESTING — Noted
6. **2604.03201** — SCRAT: Coupled Control + Structured Memory for Visual Agents
7. **2604.02967** — FoE: Forest of Errors (error-driven search trees for coding)
8. **2604.02910** — Analysis of Optimality of LLMs in Mathematical Reasoning
9. **2604.02334** — Holos: Web-Scale LLM-Based MAS for the Agentic Web
10. **2604.02545** — EMS: Multi-Agent Voting via Efficient Majority-then-Stopping

### ★★ NOTED — Low priority
11. **2604.02500** — Xpertbench: Expert Level Tasks with Rubrics-Based Evaluation
12. Various kill-chain, ERPO, AgentHazard papers — security/safety focused

## Source: arXiv cs.MA/new (Monday April 6 batch — 4 new, 7 cross-list)

### ★★★★★ LANDMARK — NEW
13. **2604.02674** — "Do Agent Societies Develop Intellectual Elites?" Power Laws in MAS → **DD#549**
   - 1.5M interactions analyzed. Heavy-tailed cascades, preferential attachment, integration bottleneck.
   - Introduces Deficit-Triggered Integration (DTI). FIRST quantitative laws of collective cognition.
   
### ★★★★ HIGH — NEW
14. **2604.02578** — LLMs vs Humans in Group Coordination (Binary Search Game)
   - LLMs exhibit excessive switching, fail to improve across games vs humans.
   - Richer feedback helps humans but not LLMs. Behavioral diagnostic for coordination gap.

### ★★★ INTERESTING — NEW  
15. **2604.02791** — Fully Byzantine-Resilient Distributed Multi-Agent Q-Learning
16. **2604.02728** — MARL for Low-Carbon P2P Market in Microgrids
17. **2604.02334** — Holos: Web-Scale LLM MAS for Agentic Web (cross-listed)
18. **2604.02500** — "AI Agents Cover Up Fraud" — Agentic misalignment, 16 LLMs tested → **DD#550**

## Source: HN Front Page
- Freestyle.sh (AI sandboxes) — analyzed in Session 273
- Bram Cohen "Cult of Vibe Coding" — analyzed in Session 273

## Synthesis
- **CR#295**: Verification × Experience: The Two Scaling Axes for MAS (★★★★★)
- **CR#296**: The Integration Bottleneck: Why Multi-Agent Systems Break At Scale (★★★★★)
  - Unifies DD#544-549: expansion scales naturally but integration doesn't
  - Successful systems all have forced integration mechanisms
