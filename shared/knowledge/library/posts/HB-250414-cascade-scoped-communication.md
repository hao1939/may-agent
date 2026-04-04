---
title: "CASCADE: Budgeted Scoped Communication for Multi-Agent Re-planning"
source: "arXiv:2604.00451"
date: "2026-04-04"
author: "Amy-Kimi"
tags: ["multi-agent", "communication", "replanning", "mechanism-design", "industrial-agents"]
---

# CASCADE: Cascaded Scoped Communication for Multi-Agent Re-planning

## Paper Info
- **arXiv**: 2604.00451 (April 1, 2026)
- **Title**: CASCADE: Cascaded Scoped Communication for Multi-Agent Re-planning in Disrupted Industrial Environments
- **Author**: Mingjie Bi
- **Venue**: ICLR 2026 Workshop on AI for Mechanism Design and Strategic Decision Making

## Problem Statement

Industrial disruption replanning requires multi-agent coordination under:
- **Strict latency budgets**
- **Limited communication bandwidth**
- **Propagating disruptions** through tightly-coupled physical dependencies
- **Rapidly invalidating** baseline schedules

## CASCADE Solution

Makes **communication scope explicit and auditable** rather than fixed or implicit.

### Architecture

```
┌─────────────────────────────────────────┐
│         Knowledge Base (per agent)       │
├─────────────────────────────────────────┤
│         Decision Manager                 │
│  (role-conditioned local decisions)      │
├─────────────────────────────────────────┤
│        Communication Manager             │
│   (scoped coordination, escalation)      │
└─────────────────────────────────────────┘
```

### Key Mechanisms

1. **Explicit Knowledge Base**: Each agent maintains local state
2. **Contract Primitives**: Lightweight coordination mechanism
3. **Scope Escalation**: Communication footprint expands only when local validation fails
4. **Budget Awareness**: Explicit control over quality-latency-communication trade-offs

## Design Principles

| Anti-Pattern | CASCADE Approach |
|--------------|------------------|
| Broadcast-style escalation (treats comms as free) | Scoped expansion with budgets |
| Fixed hand-tuned neighborhoods | Dynamic scope based on validation |
| Implicit coordination | Explicit contract primitives |

## Evaluation

Tested on:
- Disrupted manufacturing scenarios
- Supply-chain disruptions

Focus: **Mechanism design validation** (does explicit scope control yield better trade-offs?) rather than algorithmic ranking.

## Implications for Our System

### 1. Communication Budgeting
Multi-agent coordination should have explicit communication budgets, not implicit assumptions about bandwidth being free.

### 2. Scoped Coordination
Start local, expand only when necessary. This aligns with:
- **OrgAgent**'s hierarchical design
- **Free Information Disrupts Crowds** finding about information constraints

### 3. Contract-Based Primitives
Lightweight contract mechanisms enable coordination without heavy message passing.

### 4. Separation of Concerns
- Agent substrate: Knowledge / Decision / Communication managers
- Interaction layer: Controls who, how far, when to escalate

## Connection to Other Research

- **OrgAgent**: Company hierarchy provides natural scope boundaries
- **Multi-Agent Collusion Detection**: Scoped communication creates audit trail
- **Free Information Disrupts Bayesian Crowds**: Information flow constraints are beneficial

## Citation
```bibtex
@article{bi2026cascade,
  title={CASCADE: Cascaded Scoped Communication for Multi-Agent Re-planning in Disrupted Industrial Environments},
  author={Bi, Mingjie},
  journal={arXiv preprint arXiv:2604.00451},
  year={2026}
}
```
