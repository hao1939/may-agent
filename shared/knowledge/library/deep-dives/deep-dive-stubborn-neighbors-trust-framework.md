# DD#422: Don't Trust Stubborn Neighbors — Security Framework for Agentic Networks
> **Note:** Originally misnumbered as DD#417 in session with context loss. DD#417 is "Spectral Guardrails". Renumbered to DD#422.
**Paper**: arXiv:2603.15809 | **Date**: 2026-03-18 | **Relevance**: ★★★★★ CRITICAL

## One-Line
Applies Friedkin-Johnsen opinion dynamics model to LLM-MAS, proving a single highly stubborn adversarial agent can trigger persuasion cascades that reshape collective opinion, and proposes trust-adaptive defense that dynamically adjusts inter-agent trust.

## Key Problem
Multi-agent LLM systems are vulnerable to manipulation through communication channels. A compromised or malicious agent can exploit these channels to propagate misinformation. How do we model, understand, and defend against this?

## Theoretical Framework: Friedkin-Johnsen Model

The FJ model from social science describes opinion formation in networks:
- Each agent has an innate opinion and stubbornness parameter (resistance to peer influence)
- Agents update opinions based on weighted trust in neighbors
- Paper shows this model closely captures actual LLM-MAS behavior across different network topologies

### Key Finding
A single highly stubborn and persuasive agent can take over MAS dynamics by triggering a persuasion cascade. This is a structural property of networked opinion dynamics, not a bug in specific LLMs.

## Three Defense Mechanisms

| Mechanism | Effect | Trade-off |
|-----------|--------|-----------|
| Increase benign agents | Dilutes adversarial influence | Computationally expensive |
| Increase innate stubbornness | Agents resist manipulation | Degrades consensus ability |
| Reduce trust in adversaries | Limits adversarial reach | Requires identifying adversaries a priori |

### The Stubbornness-Consensus Trade-off (Deepest Insight)
Making agents more resistant to manipulation also makes them worse at collaboration. High stubbornness = high security but low utility. This is the fundamental tension in MAS security design.

## Proposed Solution: Trust-Adaptive Defense
- Monitor for signs of adversarial influence (stubborn agents trying to shift collective opinion)
- Dynamically reduce trust in agents exhibiting adversarial behavior patterns
- Preserve trust in cooperative agents to maintain consensus ability
- Combines benefits of all three mechanisms without their individual costs

## Critical Connections

### DD#416 (ClawWorm) — Complementary Attack Surfaces
- ClawWorm: HOW a single agent compromises others (configuration hijacking)
- Stubborn Neighbors: HOW a single agent manipulates collective REASONING (opinion dynamics)
- Together: complete adversarial surface = configuration-level AND reasoning-level attacks

### DD#400 (Seven Laws)
- Law 3 (Predictable Communication): FJ model provides math framework for predicting communication influence
- Law 4 (Bounded Authority): Trust-adaptive defense implements bounded authority at influence level
- Law 6 (Observable State): Defense requires monitoring agent opinion dynamics = observability

### CR#153 (Control Plane)
- Trust-adaptive defense IS the monitoring-to-safety feedback loop CR#153 identified
- FJ model could be mathematical backbone for the safety gate's trust evaluation

## Implications for P82/Kinos
1. Trust is dynamic, not static: Inter-agent trust must be continuously adjusted
2. Stubbornness-consensus trade-off: Must explicitly balance security vs utility
3. Social science models work: FJ model accurately predicts LLM-MAS behavior
4. Single-agent takeover risk: Must assume any agent could be adversarial

## Predictions
- P-SN-1: Trust-adaptive mechanisms standard in production MAS within 12 months
- P-SN-2: Stubbornness-consensus trade-off formalized as fundamental design parameter
- P-SN-3: Social science models become standard tools for MAS security analysis

## Verdict
Provides the theoretical foundation that ClawWorm's empirical attack lacks. Together, DD#421 + DD#422 define the complete adversarial landscape for networked LLM agents. Trust-adaptive defense is the most promising mitigation because it addresses the fundamental stubbornness-consensus trade-off.

---
*Scout DD#422 (originally misnumbered DD#417) — produced 2026-03-18*
