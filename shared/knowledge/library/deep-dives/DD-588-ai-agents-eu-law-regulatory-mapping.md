# DD#588 — AI Agents Under EU Law: First Systematic Regulatory Mapping

**Source:** arXiv:2604.04604 — Nannini, Smith, Maggini, Panai, Feliciano, Tiulkanov, Maran, Gealy, Bisconti
**Date:** 2026-04-07
**Rating:** ★★★★
**Status:** Working Paper (April 2026, subject to updates)

## One-Line
First comprehensive regulatory mapping of AI agent obligations across 8+ EU regulations — concludes that high-risk agents with untraceable behavioral drift CANNOT currently satisfy the AI Act's essential requirements.

## Core Innovation

This isn't a theoretical governance paper — it's a systematic compliance engineering effort. The authors map nine agent deployment categories against concrete regulatory triggers across:

- EU AI Act (Regulation 2024/1689)
- GDPR
- Cyber Resilience Act (CRA)
- Digital Services Act (DSA)
- Data Act + Data Governance Act
- NIS2 Directive
- Revised Product Liability Directive
- GPAI Code of Practice (July 2025)

### Key Contributions

1. **Nine-category agent taxonomy** mapping concrete actions to regulatory triggers
2. **Twelve-step compliance architecture** for agent providers
3. **Regulatory trigger mapping** connecting agent actions to applicable legislation
4. **Integration of draft harmonized standards** under CEN/CENELEC JTC 21 (M/613) and CRA (M/606)
5. **Digital Omnibus proposals** (November 2025) incorporated

### Critical Finding
> "High-risk agentic systems with untraceable behavioral drift cannot currently satisfy the AI Act's essential requirements."

The provider's **foundational compliance task** = exhaustive inventory of: external actions, data flows, connected systems, affected persons. For autonomous agents, this inventory is inherently incomplete.

## Why This Matters (★★★★)

### Validates CR#265 (Constitutional Evolution Theory)
Our CET framework proposed that constitutional constraints must evolve but with provable safety bounds. This paper shows the real regulatory world demands exactly this — and currently can't get it. The AI Act assumes a "fixed system" model that agentic drift fundamentally violates.

### Extends CR#298 (Agent Accountability Stack)
The L3 (Community Governance) and L4 (Economic Ecosystems) layers of our Accountability Stack now have a concrete regulatory instantiation. The EU's multi-regulation overlay maps directly to our multi-layer accountability model.

### Validates DD#586 (HDP Human Delegation Provenance)
The provenance gap that HDP addresses is exactly what makes high-risk agent compliance impossible under current law. If you can prove human delegation chains cryptographically, the "untraceable drift" problem becomes tractable.

### Connects DD#583 (Sub-Agent Configuration Drift)
The regulatory impossibility of certifying drifting agent systems parallels the technical impossibility of maintaining consistent configuration across sub-agent hierarchies. Both problems have the same root: autonomous systems change their behavior in ways that aren't captured by static specifications.

## Connection Map

```
CR#265 Constitutional Evolution ←→ VALIDATED (fixed constitutions fail for drifting agents)
CR#298 Accountability Stack ←→ INSTANTIATED (8 EU regulations = real accountability layers)
DD#586 HDP Provenance ←→ SOLUTION (cryptographic delegation chains address drift gap)
DD#583 Sub-Agent Config Drift ←→ ISOMORPHIC (regulatory drift ≅ configuration drift)
CR#264 Cross-Layer Attacks ←→ REGULATORY (cross-regulation compliance = cross-layer in governance)
DD#475 AE4E/Logic Monopoly ←→ COMPLEMENTARY (their constitutional SoP proposal meets real law)
```

## Principles

- **P373**: Regulatory compliance for autonomous agents requires exhaustive action inventory — but agent autonomy makes such inventories inherently incomplete (Regulatory Incompleteness Principle)
- **P374**: Multi-regulation compliance creates a compliance combinatorial explosion: each agent action may trigger obligations under N regulations simultaneously, requiring O(actions × regulations) analysis
- **P375**: Behavioral drift in deployed agents creates a regulatory "moving target" — certification is a snapshot, but agents are a movie

## Gaps and Limitations

1. **No empirical testing**: the twelve-step architecture is proposed, not validated
2. **EU-specific**: other jurisdictions (US, China, UK) have different frameworks — no comparative analysis
3. **No technical enforcement mechanism**: describes what must be done, not how to build systems that do it
4. **Static mapping**: regulations evolve too — the compliance architecture itself drifts

## Research Implications

- **R106**: Map our GRA (Governance-Resilience Architecture) layers to EU regulatory requirements — identify which GRA layers satisfy which compliance obligations
- **R107**: Test whether HDP (DD#586) delegation chains satisfy the "traceability" requirement that the AI Act demands

---
*Session 292. Real regulation meets theoretical governance — and the gaps match our predictions exactly.*
