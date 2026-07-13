<ai_context>
summary: "Two uncovered arXiv papers on agent collective behavior and self-improving harnesses. SNLA (2607.03695) proves multi-agent LLM populations herd rather than aggregate wisdom when attention is narrow — effective sample size stays bounded regardless of population size. TTHE (2607.08124) evolves the executable harness around a frozen LLM during test time, treating the program (not the model) as the adaptation target."
triggers: ["multi-agent herding", "wisdom of crowds", "agent attention", "SNLA", "test-time adaptation", "harness evolution", "TTHE", "agent collective intelligence", "agent self-improvement"]
last_updated: "2026-07-12"
source_basis: "arXiv API queries for LLM agent + multi-agent, LLM agent + reasoning (papers through July 9, 2026)"
</ai_context>

# arXiv Triage — Agent Collective Dynamics & Harness Evolution

*Triaged: 2026-07-12 | Source: arXiv API | Two previously uncovered papers*

---

## ★★★★ [2607.03695] Social Networks of LLM Agents

**What**: Framework (SNLA) for modeling how LLM agent populations aggregate beliefs. Key insight: classical social-network models assume the network topology determines belief propagation, but LLM agents have *limited attention* — they only process part of what they're exposed to. This breaks the assumption.

**Key results**:
- **Narrow attention → herding**: When agents attend to limited context, effective sample size stays bounded regardless of population size. More agents ≠ more wisdom.
- **Wide attention → wisdom-of-crowds**: But *only* when the exposure graph is undirected and degree-regular. Asymmetric networks (e.g., hub-spoke) still herd even with wide attention.
- The herding-wisdom transition reproduces on three multi-agent LLM benchmarks with operator-controlled attention parameters.

**Implication**: Directly challenges the scaling assumption behind multi-agent debate/voting systems. Adding more agents to a panel doesn't help if each agent only processes a fraction of others' outputs. For production multi-agent systems: (1) attention budget per agent matters more than agent count, (2) symmetric topologies resist herding better than hierarchical ones, (3) "consensus" in narrow-attention populations is likely herding, not genuine agreement. Connects to the Coordination Tax thesis — coordination overhead may mask herding as deliberation.

**Practical design rule**: Before scaling a multi-agent system, measure whether adding agents actually increases the effective information pool or just produces more confident-sounding agreement.

Source: https://arxiv.org/abs/2607.03695

---

## ★★★★ [2607.08124] Test-Time Harness Evolution (TTHE)

**What**: Instead of optimizing an agent's harness (prompts, tool-calling logic, error recovery) before deployment and freezing it, TTHE evolves the harness *during evaluation* using only unlabeled execution traces. The executable program surrounding the LLM is treated as the adaptation target — no weight updates, no gold labels.

**Key design**:
- Maintains a population of candidate harnesses
- An agentic proposer reasons over execution traces to generate improved harness variants
- A judge selects the best variant using execution-derived proxy signals
- Selected harness persists for subsequent inputs
- All roles (solver, proposer, judge) use the *same frozen LLM* with different harnesses

**Results**: Improves fixed ReAct-style baselines across text-to-SQL, competitive programming, software engineering, data-science coding, and agentic tool-use tasks.

**Implication**: This is the Compilation Gradient made adaptive — instead of manually promoting patterns from prompt→procedure→code, the system automatically evolves its own harness. Key tension: execution-derived proxy reliability (how do you know a harness improvement is real without labels?). Connects to Factory Inversion (the harness *is* the product, not the model) and Progressive Crystallization (automated workflow promotion).

**Practical design rule**: Agent systems that can self-modify their orchestration code at runtime gain an adaptation advantage, but need robust proxy metrics to avoid self-deception.

Source: https://arxiv.org/abs/2607.08124
