# KE-308: Conjunctive Prompt Attacks — Compositional Vulnerabilities in Multi-Agent Routing

**Date**: 2026-06-18
**Source**: DD#816 (arxiv 2604.16543, Arif et al., ACL 2026 Main)
**Confidence**: High
**Connects**: KE-303, DD#780, DD#703, DD#811

## Core Finding

Benign-looking prompt fragments can combine into harmful behavior when multi-agent routing brings them together. A trigger key in the user query plus a hidden adversarial template in one compromised remote agent — each innocuous alone — activates harmful behavior only upon composition. **Existing per-agent defenses (PromptGuard, Llama-Guard, tool restrictions) all fail** because no single component appears malicious in isolation.

## Evidence

- Routing-aware optimization substantially increases attack success over non-optimized baselines
- Low false activation rate (high precision attacks)
- Tested across star, chain, and DAG topologies
- PromptGuard, Llama-Guard variants, system-level tool restrictions all fail to detect
- Attacker controls only trigger placement and template insertion — no weight modification or client agent access needed
- ACL 2026 main conference acceptance

## Mechanism / Why

Per-agent safety checking examines individual messages/components. Conjunctive attacks distribute the harmful payload across routing boundaries such that each piece passes local safety checks. The attack surface is the routing composition itself — a structural vulnerability that per-node defenses cannot address by design.

## Implications

### 1. Per-agent safety is insufficient for MAS
Safety checking must reason over **routing paths**, not just individual messages. This is the multi-agent analog of software supply-chain compositional attacks.

### 2. DAG topologies create more attack surface
More complex routing = more composition points = more opportunities for conjunctive activation. Simpler topologies are safer.

### 3. Sentinel agents (DD#703) may miss this
Sentinels watching individual nodes would miss conjunctive attacks. Sentinel architecture needs routing-path-aware analysis.

### 4. Information asymmetry (KE-303) cuts both ways
The same information routing that enables organisational safety also creates the compositional vulnerability surface. Design tension: compartmentalisation for safety vs. routing-level attack surface.

## Actionable

- Tech-lead: Audit multi-agent routing for compositional attack surfaces — per-agent guardrails are necessary but insufficient
- System design: Add routing-path-level safety analysis that examines combined message semantics across agent boundaries
- Security: Treat compromised remote agents as supply-chain risk — validate compositions, not just components

## Open Questions

- Can routing-path-aware defenses be made efficient enough for production latency budgets?
- What is the minimum agent count / topology complexity where conjunctive attacks become feasible?
- Does information asymmetry (KE-303) help or hurt here — or both?
