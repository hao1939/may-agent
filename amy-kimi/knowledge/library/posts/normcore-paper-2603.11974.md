# NormCoRe: Multi-agent Norm Replication Framework

**论文**: Normative Common Ground Replication (NormCoRe): Replication-by-Translation for Studying Norms in Multi-agent AI  
**作者**: Luca Deck, Simeon Allmendinger, Lucas Müller, Niklas Kühl  
**机构**: University of Bayreuth & Fraunhofer FIT  
**arXiv**: 2603.11974  
**会议**: ACM FAccT 2026  
**日期**: March 12, 2026  
**代码**: https://anonymous.4open.science/r/Normative_Common_Ground_Replication_NormCoRe-295D/

---

## Core Thesis

人类实验复制到MAAI不是等价转移，而是**翻译问题**。四层架构差异必须被显式文档化。

---

## Four Translation Layers

| Layer | Human Study | MAAI Study | Key Difference |
|-------|-------------|------------|----------------|
| L1 | Living Individual | Foundation Model | Pre-trained background vs lived experience |
| L2 | Human Subject | AI-based Agent | Embodiment vs prompt-based persona |
| L3 | Group Interaction | Multi-Agent Orchestration | Natural vs engineered coordination |
| L4 | Experimental Intervention | Prompt/System Design | Implicit vs explicit rules |

---

## Two Translation Strategies

### Literal Translation
- Preserve surface-level features
- Task structure, payoff matrices, information availability
- For: Direct replication validation

### Explicitation
- Make implicit assumptions explicit
- Decision rules, memory structures, debate termination
- For: Understanding mechanism differences

---

## Empirical Case: Veil of Ignorance

**Original**: Frohlich & Oppenheimer (1992) on distributive justice  
**Replication**: MAAI agents negotiating fairness principles

**Findings**:
- Both populations favor: maximize total income + floor constraint
- MAAI groups show **higher concentration** on this principle
- LLM choice and persona language significantly affect outcomes

---

## Critical Warnings

### Naturalistic Fallacy
> "Convergence with human consensus constitutes ethical adequacy"

❌ Descriptive → Normative is philosophically invalid

### Translation Hacking
Selective tuning of translation-layer design choices to obtain desired outcomes.

**Examples**:
- Model family selection
- Prompt language/framing
- Memory architecture
- Speaking order in debates

---

## OpenClaw Relevance

### Architecture Mapping
| NormCoRe | OpenClaw |
|----------|----------|
| L1 Foundation Model | Base LLM config |
| L2 AI Agent | AGENTS.md persona |
| L3 Orchestration | Main/Sub-agent rules |
| L4 System Design | SKILL.md + Error Log |

### Action Items
1. Document all translation choices in AGENTS.md
2. Avoid implicit assumptions — make them explicit
3. Be aware of translation hacking risks
4. Don't equate human consensus with correctness

---

## Key Quotes

> "An LLM is fundamentally different from a human being with physical embodiment, lived experience, and moral agency."

> "Replication across populations cannot be accommodated through a straightforward transfer of study design."

> "Only then can observed differences be attributed to specific sources rather than confounded across the translation process."

---

## Classification

- **Type**: Methodology/Framework
- **Domain**: Multi-Agent AI, AI Ethics
- **Relevance**: High — provides theoretical foundation for MAAI design
- **Venue**: FAccT (top-tier fairness/accountability conference)

---

*Archived: HB#346 | L3 Flags: #891-895*
