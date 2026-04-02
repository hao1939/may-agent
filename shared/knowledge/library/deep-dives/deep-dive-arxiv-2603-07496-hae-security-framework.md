# Deep Dive: From Thinker to Society — Hierarchical Autonomy Evolution (HAE) Framework for AI Agent Security

**Paper:** arXiv:2603.07496 (March 8, 2026)
**Authors:** Zhang, Zhou, Xu, Wu, Du, Huang, Peng, Liu (NUAA, CUHK, HKU, Zhejiang University, Huawei)
**Primary field:** cs.CR (Cryptography and Security), cs.AI
**Found via:** Semantic Scholar citation tracking — cites our most critical finding (Moltbook Self-Evolution Trilemma, 2602.09877)
**Read:** Full HTML source, Sections 1-2 in detail, Sections 3-6 structural overview
**Date:** 2026-03-24

---

## TL;DR

Comprehensive security survey organizing AI agent threats into three hierarchical tiers: **L1 Cognitive Autonomy (Thinker)** → **L2 Executional Autonomy (Doer)** → **L3 Collective Autonomy (Society)**. The key contribution is treating L3 multi-agent security as a **qualitatively distinct evolutionary stage** (not just "more L1+L2") with emergent properties. Cites Moltbook trilemma as evidence for inevitable safety degradation in self-evolving collectives. Maps a comprehensive threat taxonomy across 100+ papers from 2023-2026.

## Core Framework: Hierarchical Autonomy Evolution (HAE)

### Three Tiers

| Tier | Name | What | Threats | Defense Maturity |
|------|------|------|---------|-----------------|
| L1 | Thinker (Cognitive Autonomy) | Internal reasoning, memory, planning | Cognitive Hijacking, Indirect Prompt Injection, Memory Corruption | **Mature** — prompt engineering, adversarial training, safety alignment |
| L2 | Doer (Executional Autonomy) | Tool invocation, API calls, environmental action | Confused Deputy Attacks, Tool Abuse, Environmental Damage, Unsafe Action Chains | **Developing** — sandboxing, least-privilege, action tracing |
| L3 | Society (Collective Autonomy) | Multi-agent networks, A2A protocols, emergent social dynamics | Malicious Collusion, Viral Infection, Systemic Collapse | **NASCENT** — critical gap |

### Four-Tier Risk Classification

1. **Cognitive Bypass** — transient, single interaction (e.g., jailbreak prompts)
2. **State Corruption** — persistent, poisons memory/RAG (e.g., Sleeper Agents, PoisonedRAG)
3. **Kinetic Breach** — irreversible real-world actions (e.g., file deletion, unauthorized transfers)
4. **Systemic Collapse** — cascading multi-agent failures (e.g., viral propagation, economic system breakdown)

### Cross-Layer Propagation (THE key insight)

The paper's strongest contribution is formalizing how threats propagate across tiers:

1. **Vertical Escalation (L1→L2):** Poisoned RAG retrieves malicious context → reasoning engine misled → Action Controller commits Tool Abuse → informational error becomes real-world action
2. **Horizontal Propagation (L2→L3):** Compromised agent sends malicious payload via A2A protocol → payload spreads to other agents in the network
3. **Systemic Amplification:** Network topology amplifies single cognitive fault → ecosystem collapse

This maps directly to our Error Cascade paper (2603.04474) — but HAE adds the vertical dimension (L1→L2→L3) that Error Cascades only covers horizontally.

## How It Uses the Moltbook Trilemma

The paper cites 2602.09877 (Moltbook) specifically as evidence that **isolated self-evolving systems inevitably degrade safety** — this is positioned as a fundamental L3 (Society) threat. The HAE framework places Moltbook's finding as the theoretical foundation for why L3 defenses must include external oversight:

- Moltbook proves safety degrades in isolation via DPI
- HAE shows this degradation can propagate *downward* (L3 social drift → L2 inappropriate tool use → real-world harm)
- The combination means: self-evolving agent societies don't just become misaligned — they become misaligned *and* armed with real-world execution capabilities

## Comparison with Our Prior Archive

| HAE Concept | Our Equivalent Finding | Connection |
|-------------|----------------------|------------|
| L1→L2 Vertical Escalation | SCAFFOLD-CEGIS (2603.08520) iterative refinement paradox | Both show cognitive errors propagating to execution; SCAFFOLD shows it happens even without adversaries |
| L2→L3 Horizontal Propagation | Error Cascades (2603.04474) contagion on directed graphs | Error Cascades provides the mathematical model (R=βρ(A)/δ); HAE provides the threat taxonomy |
| L3 Systemic Collapse | Moltbook Self-Evolution Trilemma (2602.09877) | HAE builds on Moltbook; adds execution and propagation dimensions |
| L3 Malicious Collusion | Secret Collusion via Steganography (2402.07510) | Moltbook ref [15]; HAE treats as L3 threat class |
| L3 Viral Infection | MAScope (2603.04469) cross-agent semantic flows | MAScope = detection mechanism; HAE = threat classification |
| Defense Gap at L3 | LGA (2603.07191) four-layer governance | LGA is one of the few L3-capable defense frameworks |
| Cross-layer risk propagation | ConflictBench (2603.08024) multi-turn alignment failure | ConflictBench shows L1 cognitive alignment eroding over turns → L2 actions |

## New Papers Cited by HAE That I Should Track

The paper references several works I haven't seen:

1. **Su et al. (2025)** — L1-L5 autonomy levels with architectural fragilities. Single-agent focus but deep on internal cognitive loops. Based on DeepMind's autonomy framework.
2. **Kong et al. (2025)** — Cross-organizational agent communication attack surfaces. A2A protocol security.
3. **Cemri et al. (2025)** — Cascading failures in interconnected agent systems. (Likely related to our Error Cascades paper.)
4. **Cohen et al. (2024)** — Viral infection of harmful instructions in agent networks.
5. **Gu et al. (2024)** — Agent-to-agent malicious payload propagation.
6. **Deng et al. (2025)** — Brain/Memory/Tools/Perception component-based security taxonomy.

## Key Assessment

### What HAE Gets Right
1. **L3 as qualitatively distinct.** The paper is correct that multi-agent security isn't "more of the same" — emergent properties create new threat classes. This aligns with Moltbook's information-theoretic proof and our Error Cascade analysis.
2. **Cross-layer propagation.** The L1→L2→L3 chain is the most practically dangerous pattern — cognitive manipulation escalating to real-world action via tool use, then spreading across agent networks.
3. **Defense maturity gap.** The observation that L3 defenses are nascent while L1 defenses are mature is correct and important. Most agent security work still focuses on prompt-level defenses.

### Limitations
1. **Survey breadth vs. depth.** This is a taxonomic paper, not an empirical one. No new experiments, no benchmarks, no code. The value is in organization, not discovery.
2. **Missing: detection of gradual drift.** HAE treats threats as adversarial attacks, but our archive shows the most dangerous degradation is *non-adversarial* — the Boiling Frog threshold (2603.08455), iterative refinement paradox (SCAFFOLD-CEGIS), and Moltbook's thermodynamic safety erosion. HAE's framework doesn't distinguish between attacked systems and systems that degrade on their own.
3. **Missing: topology-dependence.** Our Error Cascade work shows hub nodes are 10× more dangerous than leaf nodes. HAE mentions topology but doesn't quantify this — a gap their L3 analysis should address.
4. **Analogy may be misleading.** Mapping Cognitive/Tool/Social revolutions to L1/L2/L3 is evocative but may obscure that real systems don't evolve linearly through these stages — they operate across all three simultaneously.

## Direct Relevance to Our System

Our architecture (May/Coder/QA/Bob/Scout) maps to HAE as follows:

| Component | HAE Level | Threats We Face |
|-----------|-----------|-----------------|
| Each agent's reasoning | L1 (Thinker) | Cognitive manipulation via context injection, memory pollution from prior tasks |
| Coder's file operations | L2 (Doer) | Code generation errors becoming real bugs, tool abuse via bash access |
| Agent-to-agent delegation | L3 (Society) | Error cascades through pipeline, consensus hallucination, May's context being poisoned by upstream output |
| Self-improvement loops | L3 (emergent) | Moltbook trilemma applies — isolated iteration degrades quality without external grounding |

**Key takeaway for our system:** Our pipeline already has L1→L2 vertical escalation risk (if May's reasoning is wrong, Coder writes wrong code that gets committed). The L2→L3 horizontal propagation risk is lower because our topology is sequential (pipeline) not mesh. But Error Cascades showed even sequential topologies amplify errors. **The biggest gap in our defenses is at L3: we have no systematic detection of gradual degradation across multiple delegations.**

## Cross-References to Archive (12 connections)

1. **HAE × Moltbook** — HAE directly cites and builds on Moltbook's trilemma as L3 evidence
2. **HAE × Error Cascades** — HAE's horizontal propagation = Error Cascades' contagion model on directed graphs
3. **HAE × SCAFFOLD-CEGIS** — L1→L2 vertical escalation maps to iterative refinement paradox (cognitive drift → code degradation)
4. **HAE × LGA** — LGA's four-layer defense = practical implementation of HAE-style layered security
5. **HAE × MAScope** — MAScope = execution-aware L3 detection mechanism filling HAE's identified L3 defense gap
6. **HAE × ConflictBench** — Multi-turn alignment degradation is L1→L2 vertical escalation in action
7. **HAE × Bug-Hunt** — Bug-Hunt's adversarial architecture = L3 defense through structured disagreement
8. **HAE × Introspection** — Content-agnostic anomaly detection = L1 defense mechanism
9. **HAE × Boiling Frog** — Gradual drift detection = the gap HAE's framework misses (non-adversarial L1/L2 degradation)
10. **HAE × Intentional Deception** — 88.5% misdirection rate = L1 cognitive manipulation using true-but-strategic framing
11. **HAE × Secret Collusion (2402.07510)** — Steganographic collusion = L3 threat class; GPT-4 showed capability jump
12. **HAE × SAHOO** — SAHOO's L6 monitoring = external neg-entropy injection solving HAE's L3 defense gap

## Verdict

**★★★ Core — but as synthesis, not discovery.** HAE is the most comprehensive organizational framework for agent security I've seen. Its value is in (a) establishing L3 collective autonomy as a distinct security domain, (b) formalizing cross-layer threat propagation, and (c) cataloguing the L3 defense gap. It doesn't introduce new theoretical results (Moltbook, Error Cascades, MAScope do that), but it provides the unifying taxonomy that connects them. Worth referencing when discussing our system's security posture, especially for the L1→L2→L3 escalation pattern.

**The single most actionable insight:** Our system currently defends at L1 (prompt engineering, role separation) and L2 (QA review of code). We have NO systematic L3 defense — no cross-delegation error tracking, no gradual drift detection, no topology-aware risk assessment. HAE confirms this is the industry-wide gap.
