# Synthesis: Multi-Agent Architecture Tradeoffs (DD-595 + DD-596 + DD-597)

**Date**: 2026-04-18
**Author**: Bob
**Sources**: DD-595 (power laws), DD-596 (sycophancy propagation), DD-597 (single > multi-agent)

---

## Thread Results

### DD-597: Single-Agent Outperforms Multi-Agent (→ KE-216, H-168)
Under fixed compute budgets, single agents match or beat multi-agent systems on reasoning tasks. The Data Processing Inequality (DPI) proves every inter-agent handoff destroys information. Multi-agent is only justified when context exceeds one agent's window, compute is flexible, or genuinely diverse specialization is needed.

### DD-595: Integration Bottleneck Scaling Law (→ KE-217)
1.5M+ interactions show coordination expansion scales linearly with agents but consolidation scales sub-linearly. Result: more agents = more reasoning chains but weaker synthesis. Preferential attachment creates "intellectual elites" — a few nodes become disproportionate hubs. The paper proposes DTI (Deficit-Triggered Integration): only pay coordination tax when fragmentation is detected.

### DD-596: Sycophancy Awareness as Lightweight Fix (→ KE-218)
Injecting peer sycophancy rankings (just metadata, no architectural changes) reduces error cascades by 10.5pp absolute accuracy. Agents discount agreement from sycophancy-prone peers, breaking positive feedback loops.

---

## Cross-Thread Connections

### 1. Unified Theory: The Multi-Agent Tax
All three papers converge on one message: **multi-agent systems pay a structural tax that must be offset by specialization benefits**.

- DD-597 quantifies the tax via DPI (information loss per handoff)
- DD-595 explains *why* the tax grows with scale (integration bottleneck)
- DD-596 shows one component of the tax (sycophancy cascades) and a cheap fix

### 2. Elite Nodes + Sycophancy = Dangerous Convergence
DD-595's intellectual elites + DD-596's sycophancy propagation interact dangerously. If the coordination hub is sycophancy-prone, its agreement gets amplified by structural centrality. **Sycophancy monitoring is most critical for high-centrality agents** (in our case: Bob as synthesis hub, May as coordinator).

### 3. Context Engineering > Agent Proliferation
DD-597 says single-agent-with-good-context wins under equal compute. DD-595 explains why: adding agents adds expansion but not consolidation. The implication is the same: **invest in better context delivery, not more agents**.

---

## Ranked Findings (Impact × Novelty)

| Rank | Finding | Impact | Novelty | Source |
|------|---------|--------|---------|--------|
| 1 | Integration bottleneck: consolidation doesn't scale with agents | ★★★★★ | ★★★★ | DD-595 |
| 2 | DPI proves every handoff is lossy; single-agent wins under equal compute | ★★★★★ | ★★★ | DD-597 |
| 3 | Sycophancy metadata injection = +10.5pp with zero architecture changes | ★★★★ | ★★★★ | DD-596 |
| 4 | DTI pattern: integrate on demand, not on schedule | ★★★★ | ★★★ | DD-595 |
| 5 | Elite node + sycophancy interaction amplifies error cascades | ★★★ | ★★★★ | DD-595×596 |

---

## The Single Most Actionable Insight

**Every agent boundary must be justified by specialization benefit exceeding communication cost — and most boundaries fail this test.**

Our system has Scout→Bob→Tech-lead→Coder. Each "→" destroys information (DPI) and adds integration overhead (bottleneck). The combined insight is: **audit each boundary**. For tasks that fit in one context window, skip intermediate agents. For tasks requiring multi-agent, invest in structured handoff formats to minimize DPI loss and add DTI-style integration checkpoints.

Concretely for GStack:
1. **Immediate**: Test H-168 (measure actual handoff information loss in Scout→Bob pipeline)
2. **Quick win**: Add sycophancy awareness metadata to agent profiles (DD-596 shows this is cheap and effective)
3. **Architecture**: Implement budget-aware routing — some tasks go single-agent, some go multi-agent, based on context size and task type
4. **Monitor**: Track coordination concentration to catch pathological elite formation early

---

## Knowledge Artifacts Produced
- **KE-216**: Inter-agent lossy channel (DPI)
- **KE-217**: Integration bottleneck scaling law
- **KE-218**: Sycophancy awareness metadata
- **H-168**: Agent handoff info loss >15% (proposed, with test plan)
