# DD#797 — Autogenesis: A Self-Evolving Agent Protocol

**Paper**: Zhang (2026). "Autogenesis: A Self-Evolving Agent Protocol." arXiv:2604.15034  
**Relevance**: ★★★★ — Protocol for self-evolving multi-agent systems with explicit resource lifecycle, versioning, and rollback  
**Date**: 2026-04-21  

---

## Core Contribution

**Autogenesis Protocol (AGP)** decouples *what evolves* from *how evolution occurs* via two layers:

1. **Resource Substrate Protocol Layer (RSPL)**: Models 5 entity types as protocol-registered resources with explicit state, lifecycle, and versioned interfaces:
   - Prompts, Agents, Tools, Environments, Memory

2. **Self-Evolution Protocol Layer (SEPL)**: Closed-loop operator interface for:
   - Proposing improvements
   - Assessing proposals
   - Committing changes with auditable lineage
   - Rollback on failure

**Autogenesis System (AGS)** implements AGP: a multi-agent system that dynamically instantiates, retrieves, and refines protocol-registered resources during execution.

## Key Design Principles

- **Versioned interfaces**: Every resource has explicit version tracking
- **Lifecycle management**: Creation → active → deprecated → retired
- **Auditable lineage**: Every change traceable to its trigger and assessment
- **Rollback-safe updates**: Failed evolution reverts cleanly

## Problem Addressed

Existing protocols (A2A, MCP) under-specify:
- Cross-entity lifecycle and context management
- Version tracking
- Evolution-safe update interfaces

This encourages monolithic compositions and brittle glue code.

## Evaluation

- Multiple long-horizon planning + tool-use benchmarks
- Consistent improvements over strong baselines
- Demonstrates effectiveness of resource management + closed-loop self-evolution

## Relevance to Our System

**Moderate-to-high** — maps to our agent architecture:
- Our `agents/<name>/context.md` updates = informal version of SEPL
- Our lack of formal versioning/rollback = exactly the gap AGP addresses
- The 5 RSPL entity types map to: prompts (system prompts), agents (our agent definitions), tools (function definitions), environments (project state), memory (checkpoints + context)

**Gap identified**: We have no formal "assess before commit" step for context updates — AGP's SEPL pattern could prevent stale/incorrect context accumulation.

## Limitations

- Single-author paper; limited evaluation detail
- No comparison with existing evolution approaches (e.g., Voyager, SPRING)
- Protocol specification may be over-engineered for simpler deployments
- No adversarial robustness analysis (what if evolution is manipulated?)

## Cross-References

- DD#795 Experience Compression: AGP's RSPL = explicit lifecycle for the compression spectrum
- DD#796 ClawVM: Both argue for explicit state management; ClawVM at memory level, AGP at protocol level
- DD#773 SafeHarness: Lifecycle management as security boundary
