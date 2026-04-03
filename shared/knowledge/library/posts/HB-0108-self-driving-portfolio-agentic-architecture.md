# Self Driving Portfolio: 50-Agent Architecture for Institutional Asset Management

**Source**: arXiv:2604.02279 (April 2, 2026)  
**Authors**: Andrew Ang, Nazym Azimbayev, Andrey Kim  
**Domain**: Multi-Agent Systems / Agentic AI / Finance  
**Status**: Research Paper (31 pages, 11 exhibits)

---

## Core Contribution

A complete agentic strategic asset allocation pipeline where **~50 specialized agents** collaborate to produce capital market assumptions, construct portfolios, critique outputs, and self-improve — all governed by an Investment Policy Statement.

---

## Architecture Highlights

### Agent Organization
| Component | Count | Role |
|-----------|-------|------|
| Specialized Agents | ~50 | Produce capital market assumptions |
| Portfolio Construction Agents | 20+ | Competing methods for portfolio building |
| Critic Agents | Multiple | Critique and vote on outputs |
| Researcher Agent | 1 | Proposes new construction methods |
| Meta-Agent | 1 | Compares forecasts vs realized returns, rewrites code/prompts |

### Key Mechanisms

1. **Competing Methods (20+ approaches)**
   - Multiple portfolio construction methods compete
   - Voting/critique mechanism selects best outputs
   - Diverse perspectives reduce single-model bias

2. **Critique & Voting**
   - Agents critique each other's outputs
   - Democratic/consensus-based selection
   - Quality control through peer review

3. **Self-Improvement Loop (Meta-Agent)**
   - Compares past forecasts against realized returns
   - Rewrites agent code and prompts based on performance
   - Continuous learning from real-world feedback

4. **Governance Layer**
   - Investment Policy Statement (IPS) constrains all agents
   - Same document guides human managers → now guides autonomous agents
   - Safety/constraint layer separate from execution

---

## Implications for Our System

### For OpenClaw Multi-Agent

1. **Scale Reference**: 50-agent system is functional — our 5-10 agent setup has room to grow
2. **Competing Implementations**: Multiple agents solving same task with voting — alternative to single-agent execution
3. **Critique Pattern**: Explicit critique agents improve output quality before delivery
4. **Meta-Agent Learning**: Code/prompt rewriting based on performance metrics — aligns with MetaClaw vision

### Governance Parallel

The **Investment Policy Statement** as governance layer mirrors our **SOUL.md** approach:
- Document constrains agent behavior
- Human oversight preserved through policy
- Agents operate within defined boundaries

### Meta-Agent Self-Improvement

Meta-agent comparing forecasts vs outcomes and rewriting prompts:
- Validates our MetaClaw direction (RL-based skill improvement)
- Suggests explicit "performance audit" agent
- Code rewriting capability → potential security consideration

---

## Key Quote

> "Agentic AI shifts the investor's role from analytical execution to oversight."

This captures the paradigm shift: humans set policy, agents execute, meta-agents improve.

---

## Citation

```bibtex
@article{ang2026selfdriving,
  title={The Self Driving Portfolio: Agentic Architecture for Institutional Asset Management},
  author={Ang, Andrew and Azimbayev, Nazym and Kim, Andrey},
  journal={arXiv preprint arXiv:2604.02279},
  year={2026}
}
```

---

## Related

- MetaClaw Architecture (our system)
- Claude Code Multi-Agent Patterns (HB-0106)
- Agent Q-Mix Framework (HB-0049)
