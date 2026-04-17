# DD#599 — SentinelAgent: Intent-Verified Delegation Chains for Federal MAS

**Source:** arXiv:2604.02767 (Patil, 2026)
**Relevance:** ★★★★★ — First formal delegation chain calculus with mechanical verification
**Tags:** #delegation #security #verification #GRA #TLA+

---

## Summary

SentinelAgent introduces the Delegation Chain Calculus (DCC) — a formal framework for verifiable delegation chains in multi-agent systems. When Agent A delegates to Agent B, which invokes Tool C on behalf of User X, no existing framework can answer: whose authorization chain led to this action, and where did it violate policy?

DCC defines **seven properties**:
1. **Authority Narrowing** — each delegation can only narrow, never expand, permissions
2. **Policy Preservation** — policy constraints preserved across delegation boundaries
3. **Forensic Reconstructibility** — complete audit trail for any action
4. **Cascade Containment** — failures don't propagate through delegation chains
5. **Scope-Action Conformance** — agents act only within granted scope
6. **Output Schema Conformance** — outputs match expected types
7. **Intent Preservation** (probabilistic) — delegated agent respects original intent

Four meta-theorems + one proposition establish the **practical infeasibility of deterministic intent verification**.

## Key Results

- **Intent-Preserving Delegation Protocol (IPDP)**: Non-LLM Delegation Authority Service enforces all 7 properties at runtime
- **DelegationBench v4**: 516 scenarios, 10 attack categories, 13 federal domains → 100% TPR at 0% FPR (combined)
- **Adversarial black-box**: DAS blocks 30/30 attacks, 0 false positives
- **TLA+ verification**: 2.7M states checked, zero violations for P1-P6
- **Intent verification weakness**: Degrades to 13% under sophisticated adversarial paraphrasing (the probabilistic property)
- **Fine-tuning fix**: Training NLI on 190 government delegation examples → 88.3% TPR (from 1.7%)
- **Graceful degradation**: Even when P7 (intent) is evaded, P1-P6 constrain adversary to permitted calls, conformant outputs, traceable actions

## GStack Implications

### Architecture Mapping
SentinelAgent maps directly onto GRA layers:
- **L1-L2 (Agent Infrastructure → Runtime)**: Scope-action conformance, output schema conformance
- **L3 (Trust & Resilience)**: Authority narrowing, cascade containment
- **L4 (Institutional)**: Policy preservation, forensic reconstructibility
- **L5 (Constitutional)**: Intent preservation as the ultimate but hardest guarantee

### The Intent Gap
The most important finding is the **Deterministic Intent Impossibility**: you cannot deterministically verify that a delegated agent's actions match the delegating agent's intent. This is a fundamental limit, not an engineering gap.

Implications:
1. Trust architectures must have a **non-intent fallback** — the six deterministic properties provide a "cage" even when intent verification fails
2. Intent verification improves with domain-specific training (1.7% → 88.3%) — domain specificity is a feature, not a bug
3. The 13% adversarial degradation means intent-based governance (GRA L5) is inherently weaker than constraint-based governance (GRA L1-L4)

### Connects to CR#264 Cross-Layer Attack Taxonomy
SentinelAgent's delegation chains solve CLAT attack class 3 (delegation escalation) and partially address class 5 (forensic evasion). Authority narrowing is the formal mechanism CR#264 was missing.

### Connects to CR#265 Constitutional Evolution
The intent preservation property maps to CET's "procedural legitimacy" condition — both address the same fundamental question: can we verify that a delegated process respects the spirit (not just letter) of its mandate?

## Proposed Candidates
- **P403**: Intent-verified delegation will become a standard requirement in enterprise MAS frameworks by 2027, but deterministic intent verification will remain impossible
- **P404**: Authority narrowing (permissions monotonically decrease through delegation chains) will be adopted as a mandatory governance property in >50% of production MAS by 2028
- **R117**: Evaluate SentinelAgent's DCC as formal basis for gstack inter-agent delegation

## Status: READY FOR HANDOFF
