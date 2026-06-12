# Recent AI Agent Papers from arXiv (fetched 2026-06-11)

Source: `https://export.arxiv.org/api/query` — sorted by `submittedDate`, `sortOrder=descending`

---

## 1. APPO: Agentic Procedural Policy Optimization
**arXiv:** [2606.12384](https://arxiv.org/abs/2606.12384v1)  
**Published:** 2026-06-10  
**Authors:** Xucong Wang, Ziyu Ma, Yong Wang, et al.  
**Categories:** cs.LG, cs.AI

**Summary:** Proposes fine-grained credit assignment for agentic reinforcement learning. Existing agentic RL assigns credit at coarse heuristic units (tool-call boundaries or fixed workflows). APPO instead selects branching locations using a "Branching Score" that combines token uncertainty with policy-induced likelihood gains of subsequent continuations, enabling targeted exploration. It introduces procedure-level advantage scaling across branched rollouts. Their pilot analysis shows influential decision points are distributed throughout the generated sequence, not concentrated at tool calls. Experiments on 13 benchmarks show ~4-point improvement over strong baselines while maintaining behavior interpretability.

**Implication:** Moves agentic RL from tool-call-level to token-level credit, making the training signal denser and more informative. Could substantially improve how LLM agents learn from multi-step tool-use experiences.

---

## 2. DIRECT: Test-Time Compute Routing for Embodied Planners
**arXiv:** [2606.12402](https://arxiv.org/abs/2606.12402v1)  
**Published:** 2026-06-10  
**Authors:** Jadelynn Dao, Milan Ganai, Chelsea Finn, Marco Pavone, et al.  
**Categories:** cs.RO, cs.AI, cs.CV

**Summary:** Addresses the problem that scaling test-time compute (chain-of-thought depth, model size, memory history) for VLM-based embodied agents increases latency and cost with uneven/diminishing gains. Introduces a routing framework using multimodal scene context to allocate compute per prompt, improving the success–cost Pareto frontier. Validated on a physical Franka arm where the router matches or exceeds a stronger model's success rate at up to 65% lower latency.

**Implication:** Practical framework for deploying embodied agents under real-world latency constraints. The insight that different compute-scaling axes yield qualitatively different capabilities is important for agent system design.

---

## 3. Bootstrapped Monitoring: Overseeing Stronger AI Agents
**arXiv:** [2606.11998](https://arxiv.org/abs/2606.11998v1)  
**Published:** 2026-06-10  
**Authors:** Frank Xiao, Mary Phuong  
**Categories:** cs.LG

**Summary:** Tackles the AI control problem: as frontier models grow more capable, weaker trusted monitors become unreliable. Introduces "bootstrapped monitoring" — inserting a stronger, intermediate untrusted model with transparent chain-of-thought into the oversight chain. The untrusted monitor evaluates the agent's actions, while a weaker trusted model oversees the monitor's reasoning to detect collusion. Evaluated on multi-turn software engineering tasks (BashArena). Substantially improves catch rates even when the untrusted monitor actively colludes, provided access to its raw chain-of-thought.

**Implication:** Directly relevant to AI safety and control. Extends the useful lifetime of trusted monitoring as capabilities advance, a key concern for production agent deployments.

---

## 4. OCELOT: Privacy-Preserving LLM Agents
**arXiv:** [2606.12341](https://arxiv.org/abs/2606.12341v1)  
**Published:** 2026-06-10  
**Authors:** Jin Xie, Songze Li  
**Categories:** cs.CR

**Summary:** Addresses that LLM agents reading personal files, calling tools, and transacting with external services can leak PII cumulatively across trust boundaries. Recasts agent privacy as "posterior-risk control" — budgeting how much an adversary's belief about a secret may improve across an entire trajectory. Uses "Witness-Verified Declassification": an untrusted defender model inspects candidate releases and emits structured evidence, which a deterministic verifier audits against a sink-trust-weighted budget on a tamper-evident ledger. Achieves significantly lower leakage at higher task utility and resists adaptive injection, jailbreak, and cumulative inference attacks.

**Implication:** First principled framework for trajectory-level privacy in multi-step agents. Critical for enterprise deployments where agents handle sensitive data across multiple services.

---

## 5. A Five-Plane Reference Architecture for Runtime Governance of Production AI Agents
**arXiv:** [2606.12320](https://arxiv.org/abs/2606.12320v1)  
**Published:** 2026-06-10  
**Author:** Krti Tallam  
**Categories:** cs.AI, cs.CR, cs.SE

**Summary:** Argues that enterprise security (built for data boundaries) breaks down with production AI agents that read context, call tools, and modify systems of record. Risk moves inside the workflow — into sequences of individually-permitted actions that collectively transform unauthorized business processes. Proposes five composable planes (reasoning + four enforcement), stop-anywhere mediation, composite principals with capability attenuation, and structured audit. Defines six interruption primitives generalizing allow/deny. Policy engine runs in single-digit microseconds.

**Implication:** Fills a major gap in enterprise agent deployment. The key insight — that sequences of individually-permitted actions can be collectively unauthorized — maps to real production risks.

---

## 6. Should LLM Agents Decide in Social Simulations?
**arXiv:** [2606.12369](https://arxiv.org/abs/2606.12369v1)  
**Published:** 2026-06-10  
**Authors:** Alejandro Buitrago López, Javier Pastor-Galindo, José A. Ruipérez-Valiente  
**Categories:** cs.CY

**Summary:** Evaluates whether LLM action selectors preserve an interpretable reference policy (a finite state machine / first-order Markov model) in an online social network simulation with 1,000 agents and 10,000 decisions. Tests LLaMA 3.1, GPT-OSS, and Mistral 24B under base, guided, and probabilistic prompting. Finds LLMs can approximate the reference policy in some configurations but do not preserve it reliably. Even the best-aligned LLM configurations are several hundred times slower than direct Markov chain sampling.

**Implication:** Caution for the "LLM-agents-for-everything" trend — when you have an explicit behavioral policy, using an LLM as an action selector adds cost and introduces uncontrolled deviation. Important for simulation validity.

---

## 7. Exploration Structure in LLM Agents for Multi-File Change Localization
**arXiv:** [2606.11976](https://arxiv.org/abs/2606.11976v1)  
**Published:** 2026-06-10  
**Authors:** Akeela Darryl Fattha, Kia Ying Chua, Lingxiao Jiang, Laura Wynter  
**Categories:** cs.SE, cs.AI

**Summary:** Compares linear sequential exploration vs. non-linear, domain-scoped parallel agent exploration for localizing files to change in software repos. Using SWE-Bench Pro, finds that domain-scoped parallel agent spawning with a small Haiku-class model achieves highest micro-F1 among its model class by a large margin. Additional findings: documentation evolution is a latent unresolved dependency, naive file-system access can degrade localization via test-file over-prediction, and forced multi-agent consultation raises token cost without measurable benefit.

**Implication:** Demonstrates that agent architecture (parallel domain-scoped vs. linear) matters more than model size for certain SE tasks. The negative finding on forced multi-agent consultation is a useful corrective.

---

## 8. Agents All the Way Down: Building Custom AI Agents from Substrate to Production
**arXiv:** [2606.11869](https://arxiv.org/abs/2606.11869v1)  
**Published:** 2026-06-10  
**Authors:** Marc Alier Forment, Juanan Pereira, et al.  
**Categories:** cs.SE, cs.AI

**Summary:** Writes down a methodology for building production custom AI agents: two preconditions (P1: Substrate — framing the LLM as tools→system→messages under prompt-caching; P2: Building blocks — function calling, MCP, CLI, agent loops, skills, hooks) and three practices (P3: prototype with a general-purpose agent; P4: harvest and ship as CLI — the "Turtle pattern"; P5: agent-tests-agent behavioral scenarios). Multi-agent orchestration reduces to CLI composition. Framework-free by construction. Distilled from building a custom agent in ~10 days.

**Implication:** A practitioner-oriented methodology paper that codifies the emerging "build agents with agents" pattern. The Turtle pattern (agent → CLI) and "agent-tests-agent" practice are immediately actionable.

---

## 9. UniIntervene: Agentic Intervention for Efficient Real-World RL
**arXiv:** [2606.12372](https://arxiv.org/abs/2606.12372v1)  
**Published:** 2026-06-10  
**Authors:** Haoyuan Deng, Yitong Gao, et al.  
**Categories:** cs.RO, cs.LG

**Summary:** Replaces frequent human corrections in human-in-the-loop RL for robotics with an autonomous "agentic intervention model." Detects unproductive exploration via future-conditioned action-value estimation and temporal value-risk critics, then recovers via goal-conditioned recovery policy using high-value targets from memory. Improves average success rate by 8.6% while reducing human interventions by 57% relative to state-of-the-art HiL-RL baselines.

**Implication:** Bridges the gap between fully autonomous and human-in-the-loop RL. The value-aware autonomous recovery pattern could generalize to non-robotics agentic settings where human oversight is expensive.

---

## 10. Layer-Isolated Evaluation: Testing Production LLM Agents
**arXiv:** [2606.11686](https://arxiv.org/abs/2606.11686v1)  
**Published:** 2026-06-10  
**Authors:** Sawyer Zhang, Alexander Wang, Sophie Lei  
**Categories:** cs.CL, cs.AI

**Summary:** Decomposes a deployed ordering agent into a fixed taxonomy of layers (ontology, intent, routing, decomposition, escalation, safety, memory, envelope/defense), each tested by its own assertion slice in a deterministic, no-LLM "pure" mode. 238 test cases across 23 slices run in 2.39s. Controlled regression injection shows: aggregate pass-rate barely moves (-1.7 to -5.9pp) when one layer degrades, but the matching slice craters (-25 to -91pp). Demonstrates that end-to-end metrics mask layer-specific regressions.

**Implication:** Immediately practical for production agent teams. The key insight — end-to-end success masks where regressions occur — argues for deterministic per-layer test harnesses alongside stochastic end-to-end evaluation.

---

## 11. Can Open-Source LLM Agents Replace Static Application Security Testing Tools?
**arXiv:** [2606.11672](https://arxiv.org/abs/2606.11672v1)  
**Published:** 2026-06-10  
**Authors:** Derek Yohn, Luke Flancher, Mirajul Islam, Khaled Slhoub  
**Categories:** cs.CR, cs.AI

**Summary:** Evaluates general-purpose LLM-based agents (three Ollama-hosted open-source models) against Bandit (established SAST tool) for security scanning. Measures precision, recall, false positives, and composite score. Findings refute the notion that a modern open-source GenAI LLM-based agent is currently suitable for specialized SAST scanning under realistic conditions.

**Implication:** Useful negative result. LLM agents are not yet drop-in replacements for specialized static analysis tools in security, despite general hype. Domain-specific tooling retains an advantage.

---

## 12. ModSleuth: Auditing Invisible Dependencies in Modern LLMs
**arXiv:** [2606.12385](https://arxiv.org/abs/2606.12385v1)  
**Published:** 2026-06-10  
**Authors:** Sanjay Adhikesaven, Haoxiang Sun, Sewon Min  
**Categories:** cs.CL

**Summary:** An agentic system that recursively reconstructs LLM dependency graphs from public artifacts (papers, model cards, repos). Recovers 1,060 source-verified dependencies across four LLM releases, revealing multi-hop license obligations, train-evaluation coupling, and documentation inconsistencies. The challenge is not information extraction but defining what constitutes a dependency and reconciling references across inconsistent documentation.

**Implication:** A practical "agent doing science/auditing" application. The dependency graphs expose systemic risks in the LLM ecosystem (license contamination, circular evaluation) that are invisible without automated recursive tracing.

---

## Key Themes Across These Papers

| Theme | Papers |
|-------|--------|
| **Agent training & RL** | APPO, UniIntervene, RACES |
| **Agent safety & control** | Bootstrapped Monitoring, OCELOT, Five-Plane Architecture |
| **Agent evaluation & testing** | Layer-Isolated Evaluation, Social Simulations, SAST comparison |
| **Agent architecture & methodology** | Agents All the Way Down, DIRECT, Exploration Structure |
| **Agent applications** | ModSleuth (auditing), TAHOE (Text-to-SQL), Medical Research |

### Emerging Patterns:
1. **Credit assignment granularity** — Moving from tool-call-level to token-level (APPO) or procedure-level rewards
2. **Governance as first-class concern** — Multiple papers on runtime governance, privacy budgets, and monitoring at production scale
3. **Negative results matter** — Papers honestly reporting where agents fail (SAST, social simulation fidelity) are increasingly valued
4. **Agent-tests-agent** — Using agents to evaluate other agents (Bootstrapped Monitoring, Agents All the Way Down)
5. **Architecture > raw scale** — Parallel domain-scoped agents beat larger models; compute routing beats naive scaling
