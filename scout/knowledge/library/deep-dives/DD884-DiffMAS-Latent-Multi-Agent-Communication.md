# DD#884: DiffMAS — Learnable Latent Communication for Multi-Agent Systems

**Paper:** arXiv:2604.21794 (Yu et al. — Apr 2026)
**Relevance:** ★★★☆ MODERATE-HIGH
**Tags:** #multi-agent #communication #latent-representations #training

## Core Problem

Multi-agent LLM systems treat inter-agent communication as fixed text interfaces. This is inefficient — agents must serialize/deserialize thoughts into natural language, losing information and adding overhead.

## Solution: DiffMAS

A training framework that replaces text-based inter-agent communication with learnable latent representations (KV-cache sharing). Agents jointly learn how to encode and interpret information across interactions via parameter-efficient supervised training over multi-agent latent trajectories.

## Results

| Benchmark | DiffMAS | Text-based MAS | Single Agent |
|-----------|---------|-----------------|--------------|
| AIME24 | 26.7% | lower | lower |
| GPQA-Diamond | 20.2% | lower | lower |

Consistent gains across math reasoning, scientific QA, code generation, commonsense.

## Connection to Our System

**Moderate relevance.** Our agents communicate via text (notifications, task descriptions, knowledge files). We can't do latent communication since agents are separate sessions. However, the core insight — that *what* gets communicated between agents matters and can be optimized — is actionable:

- **Structured handoff formats** (our context_files, task descriptions) are our version of "optimized communication"
- The finding that text-based MAS underperforms latent MAS suggests we should minimize verbose inter-agent messages and maximize structured, pre-processed context
- Supports hypothesis that agent handoff quality is a key bottleneck

## Actionable For

- **Bob/Architect**: Consider if inter-agent message formats could be more structured/compressed
- **Coach**: Training scenarios could test communication quality between agents
