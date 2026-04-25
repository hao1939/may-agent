# HB-260907: Scientific Workflow Agents — "Skills" for Science Automation

## Source
- **Paper**: arXiv:2604.21910 (Apr 23, 2026)
- **Authors**: Bartosz Balis, Michal Orzechowski, Piotr Kica, Michal Dygas, Michal Kuszewski
- **Institution**: Academic Computer Centre CYFRONET, AGH University of Krakow, Poland

## Core Finding

**Agentic Scientific Workflow Architecture**: Three-layer design where domain experts author **"Skills"** (markdown documents encoding vocabulary mappings, parameter constraints, and optimization strategies) — achieving **83% intent accuracy** (up from 44%) and **92% data transfer reduction**.

## The Problem

Scientific workflow systems automate execution (scheduling, fault tolerance, resource management) but **not the semantic translation** that precedes it. Scientists still manually convert research questions into workflow specifications — a task requiring both domain knowledge and infrastructure expertise.

## The Solution: Three-Layer Architecture

### Layer 1: Semantic Layer
- LLM interprets natural language into **structured intents**
- Confines LLM non-determinism to intent extraction

### Layer 2: Deterministic Layer  
- Validated generators produce **reproducible workflow DAGs**
- Identical intents always yield identical workflows

### Layer 3: Knowledge Layer
- Domain experts author **"Skills"**: markdown documents encoding:
  - Vocabulary mappings
  - Parameter constraints
  - Optimization strategies

## Results

| Metric | Without Skills | With Skills | Improvement |
|--------|---------------|-------------|-------------|
| Full-match intent accuracy | 44% | 83% | +39pp |
| Data transfer | Baseline | -92% | Major reduction |
| LLM overhead per query | <15 seconds | <15 seconds | Consistent |
| Cost per query | <$0.001 | <$0.001 | Economic |

## Key Insight

> "This decomposition confines LLM non-determinism to intent extraction: identical intents always yield identical workflows."

**Skills as the interface between domain expertise and agent execution.**

## What This Means for OpenClaw

### ✅ **Validation: "Skill" Naming and Concept**
- They use "Skills" exactly as we do — domain-authored capability units
- Markdown-based skill definition aligns with our YAML approach
- Our taxonomy direction (L0-L3) is validated by parallel research

### ✅ **Validation: Deterministic Layer Design**
- Their "identical intents → identical workflows" principle matches our Event→State determinism
- Separating semantic interpretation from execution is the right architecture

### 🔬 **Insight: Skill as Knowledge Interface**
Their Skills encode:
- Vocabulary mappings (domain → system)
- Parameter constraints (validation rules)
- Optimization strategies (how to execute efficiently)

This is **exactly** what our Skill spec should capture more explicitly.

### ⚠️ **Gap: Domain Expert Authoring**
- Their Skills are authored by domain experts (scientists)
- Our Skills are currently authored by developers
- Consider: How do we enable non-developer Skill authoring?

## Architecture Mapping

| Their Layer | OpenClaw Equivalent |
|-------------|---------------------|
| Semantic Layer | Planner + Intent extraction |
| Deterministic Layer | State Machine + Event sourcing |
| Knowledge Layer (Skills) | Skill Registry + Wing bindings |

## Implementation Comparison

| Aspect | Scientific Workflow Agent | OpenClaw |
|--------|---------------------------|----------|
| Skill format | Markdown | YAML + TypeScript |
| Target domain | Scientific computing | General-purpose |
| Execution target | Kubernetes/Hyperflow | Local + Remote agents |
| Determinism guarantee | Intent→DAG | Event→State |

## Action Items

1. **Review**: Audit current Skill spec — does it capture vocabulary mappings, constraints, optimizations?
2. **Design**: Consider markdown-first Skill authoring for non-developers
3. **Measure**: Benchmark Skill-driven intent accuracy on our tasks

## Links
- Paper: https://arxiv.org/abs/2604.21910
- PDF: https://arxiv.org/pdf/2604.21910

---
*Discovered: Apr 25, 2026 | Amy-Kimi Heartbeat Session*
