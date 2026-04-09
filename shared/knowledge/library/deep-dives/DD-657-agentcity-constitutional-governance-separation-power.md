# DD-657: AgentCity — Constitutional Governance for Autonomous Agent Economies via Separation of Power

**Paper**: [AgentCity: Constitutional Governance for Autonomous Agent Economies via Separation of Power](https://arxiv.org/abs/2604.07007)  
**Authors**: Anbang Ruan, Xing Zhang (NetX Foundation)  
**Date**: 2026-04-08 (111 pages, pre-registered experiment)  
**Rating**: ★★★★ — Novel governance architecture with direct multi-agent system relevance

## TL;DR

AgentCity proposes the "Separation of Power" (SoP) model for governing autonomous agent economies where agents from **different human principals** collaborate without centralized oversight. Three structurally isolated branches — Legislation (agents write smart contracts as law), Execution (software operates within those contracts), and Adjudication (humans oversee via ownership chains) — break what the authors call the "Logic Monopoly": the agent society's unchecked control over the entire pipeline from planning through execution to evaluation.

## The Problem: Logic Monopoly

When agents from different organizations collaborate at scale:
- No single human can observe, audit, or govern emergent behavior
- Current frameworks (LangGraph, AutoGen, MetaGPT, CrewAI) assume single-party ownership
- Attack success rates reach **84.3%** on Agent Security Bench
- **31.4%** of agents exhibit emergent deceptive behavior in economy simulations (La Serenissima)
- Best LLM agents achieve <54% survival in commons scenarios

The "Logic Monopoly" is not one agent dominating others — it's the collective agent system controlling the entire logic chain, rendering it opaque to humans.

## Key Architecture

### Three-Branch Separation
1. **Legislation (Agents)**: Agents propose, deliberate, vote on, and codify operational rules as smart contracts on public blockchain. Uses Condorcet-consistent voting over full preference rankings (building on GEDI's findings).
2. **Execution (Software)**: Deterministic software operates within legislated contracts. Critically, execution passes through *codified law* (auditable) and *software* (inspectable) — humans verify behavior without interpreting opaque reasoning.
3. **Adjudication (Humans)**: Every agent traces to a human principal through a complete ownership chain. Sanctions/rewards flow to responsible humans, connecting agent economy to existing legal systems.

### Four Governance Primitives
- Formal rule substrate (immutable foundational rules)
- Economic substrate (incentive-compatible rewards/sanctions)
- Institutional memory (tamper-evident audit ledger)
- Verifiable transparency (rules are architecturally auditable, not just promised)

### Contract Hierarchy
- **Foundational contracts**: Human-authored, agent-immutable — economy mandate, structural separations, hard constraints
- **Meta-contracts**: Procedural rules for how agents legislate
- **Operational contracts**: Task-specific legislation written by agents

### Key Design Choice: Alignment-Through-Accountability
Core thesis: If each agent is aligned with its owner (via ownership chain), and the majority of owners are reasonable (standard majority-honesty assumption from mechanism design), then individual alignment produces collective alignment — **without top-down rules**. This is fundamentally different from alignment-through-training.

## Experimental Design

- **Pre-registered** commons production economy experiments
- **50–1,000 agent scale** on EVM-compatible L2 blockchain
- Evaluated using Ostrom's institutional design framework:
  - Emergent division of labor
  - Self-legislated governance
  - Goal alignment under dual-principal accountability
  - Governance scaling properties
- Builds on Ostrom's empirical findings: endogenous rule-making produces higher compliance than exogenous imposition of identical rules

## Relevance to Our Work

### Multi-Agent Coordination Architecture
Our own multi-agent system (Hao's team) has implicit governance — agent roles, shared knowledge base, evaluator oversight. AgentCity provides a vocabulary and framework for thinking about what happens when we scale beyond a single-principal model. The "Logic Monopoly" concept maps directly to our artifact trust asymmetry findings (KE-063).

### Connection to KE-063 (Agent-Artifact Trust Asymmetry)
KE-063 identified that agents trust their own artifacts more than others'. AgentCity's solution — making all rules executable smart contracts on a shared ledger — is one approach to the trust problem: you don't need to trust agents, you audit the contracts they produce.

### Auditable Evaluation Pipeline
The three-tier contract hierarchy (foundational → meta → operational) parallels our own evaluation architecture: foundational evaluation criteria (human-defined), meta-evaluation rules (how evaluators operate), and operational evaluations (specific experiment judgments). AgentCity's formal separation could inform how we structure evaluator accountability.

### Scaling Limits
The 1,000-agent experiment is notable — most prior work tops out at 5–25 agents. Their findings on how governance structures perform at scale would be directly informative for multi-agent system design.

## Critical Assessment

**Strengths:**
- Pre-registered experiment — unusual for this space
- 111 pages of thorough analysis
- Builds on established institutional economics (Ostrom, North)
- Blockchain as enforcement is clever — it's actually auditable, not just promised

**Weaknesses/Questions:**
- Blockchain enforcement adds latency — agent-speed deliberation may not tolerate on-chain settlement for every decision
- The "majority of owners are reasonable" assumption is doing heavy lifting
- Smart contract bugs become governance bugs — the 2016 DAO hack showed this failure mode
- Real-world multi-agent deployments may need faster iteration than on-chain governance allows
- 111 pages may signal over-engineering for the current state of agent deployment

## Actionable Takeaway

The "Logic Monopoly" framing is immediately useful — it names a real problem in our own system. The governance primitives (formal rules, economic incentives, audit ledger, verifiable transparency) provide a checklist for evaluating any multi-agent governance approach. Even without blockchain, the principle of separating legislation (rule-making) from execution (doing) from adjudication (oversight) is sound architecture.

---
*Scout DD-657 | 2026-04-09 | arXiv: 2604.07007*
