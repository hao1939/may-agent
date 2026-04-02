# Deep-Dive #272: Characterizing Faults in Agentic AI — Empirical Fault Taxonomy

**Paper:** arXiv:2603.06847 — "Characterizing Faults in Agentic AI: A Taxonomy of Types, Symptoms, and Root Causes"
**Authors:** Shah, Morovati, Rahman, Khomh (Dalhousie University & Polytechnique Montreal)
**Date:** March 6, 2026
**Rating:** ★★★★★ Essential — First large-scale empirical taxonomy of agentic AI faults with practitioner validation

## Executive Summary

The first truly comprehensive empirical study of how agentic AI systems actually fail in practice. Analyzed 13,602 closed issues from 40 real-world open-source agentic AI repositories (AutoGen, LangChain, CrewAI, etc.), manually coded 385 representative faults using grounded theory, and validated findings with 145 practitioners. The result is a hierarchical taxonomy that is the empirical ground truth our research portfolio has been theoretically predicting.

## Core Methodology

### Data Pipeline
1. **Repository Selection:** GitHub search for "AI agents" → 82 candidates → filtered to 47 Python repos → manual annotation (Cohen's κ=0.83) → **40 final repositories**
2. **Issue Filtering:** 24,193 → 19,947 (English, non-test) → 13,602 (GPT-4.1 validated, 83% accuracy, 97% recall)
3. **Stratified Sampling:** 385 faults at 95% CI / 5% margin: 234 Frameworks, 75 Libraries, 39 Tools, 37 Applications
4. **Analysis:** Grounded theory (open → axial → selective coding), Apriori association rule mining, developer study (n=145)

### Remarkable Rigor
- Inter-rater κ=0.83 (substantial agreement)
- Developer study Cronbach's α = 0.904 (excellent internal consistency)
- Mean relevance rating: 3.97/5
- 83.8% of practitioners said taxonomy covered faults they'd encountered
- 74.5% of ratings at 4 or higher

## The Fault Taxonomy

### Five Architectural Fault Dimensions
1. **Cognitive Control & Agency** — Failures in agent decision-making, reasoning loops, planning
2. **Tool & Environment Interaction** — Mismatches between agent actions and external systems
3. **LLM Integration** — Configuration, token management, API parameter handling
4. **Runtime & Environment Grounding** — Execution ecosystem fragility (87 instances — highest!)
5. **Data & State Management** — Memory corruption, state tracking, context loss

### 13 Symptom Classes
Symptoms cross architectural boundaries. Key observation: faults don't manifest where they originate.

### 12 Root Cause Categories
**Top root causes:**
- **Dependency & Integration Failures (19.5%)** — Contract violations between probabilistic LLM outputs and deterministic interfaces
- **Data & Type Handling Failures (17.6%)** — Type mismatches, encoding errors, format violations
- Together these two categories account for **37.1%** of all root causes

## Propagation Patterns (Apriori Analysis)

The most novel contribution: faults propagate across architectural boundaries in systematic ways:

| Pattern | Lift Score | Meaning |
|---------|-----------|---------|
| Token management → Authentication failures | **181.5** | Fragile token refresh mishandles credential expiration |
| Datetime handling → Scheduling anomalies | **121.0** | Inappropriate datetime conversions cascade |
| State management → Memory symptoms | High | State corruption surfaces as memory-related errors |
| Execution loops → Termination misconfig | High | Reasoning loops caused by incorrect stop conditions |

**Key insight:** Many faults don't fail transparently. Weak error handling and limited logging obscure underlying causes, turning simple implementation mistakes into difficult-to-diagnose failures.

## Critical Findings for Multi-Agent Systems

### 1. Hybrid Failure Profile
Agentic AI failures are neither pure software bugs nor pure LLM errors — they exhibit a **distinctive hybrid** combining:
- Conventional SE faults (dependency conflicts, type errors)
- Probabilistic LLM-driven behavior (hallucination, format violations)
- Novel interaction effects (tool output misinterpretation, reasoning loops)

### 2. Cross-Layer Propagation
Faults frequently traverse architectural boundaries:
- **Token management** (infrastructure) → **authentication** (security)
- **LLM configuration** → **redundant tracking** symptoms
- **State management** → **memory** symptoms
This means debugging requires cross-layer visibility, not component-isolated testing.

### 3. Ecosystem Fragility as Top Failure Mode
The highest fault category is **Runtime & Environment Grounding** (87/385 = 22.6%). This means the surrounding execution ecosystem (dependencies, APIs, configurations) is the #1 source of failure — not the LLM itself.

### 4. Developer-Identified Gaps
Practitioners flagged two areas needing more coverage:
- **Multi-agent coordination failures** — not fully captured by single-agent taxonomy
- **Observability** — debugging agentic systems requires specialized tooling

## Portfolio Connections

### Validates Core GUS Predictions
1. **Coordination Cost Hypothesis (DD#4, DD#35):** The 19.5% dependency/integration failures and cross-boundary propagation empirically validate that coordination costs dominate system failures
2. **Reliability Engineering Map (DD#271):** This taxonomy IS the empirical foundation for that map
3. **HALIE-BEAM failure modes (DD#10):** Our theoretical failure modes match their empirical categories
4. **Tool Grounding Gap (DD#31, CR#26):** Their tool/environment interaction dimension maps directly
5. **Cross-Recall metric (DD#64):** Cross-layer propagation patterns are exactly what cross-recall should detect

### Strengthens Safety Arguments
6. **Temporal Safety Model (CR#43):** Execution loops and state management faults have temporal dimensions
7. **Abstraction Barrier Principle (CR#112):** Their cross-boundary propagation validates the need for abstraction barriers
8. **Protocol Stack Evolution (CR#133):** Systematic fault patterns suggest protocol-level solutions

## Key Quotes & Data Points
- "Failures in agentic AI systems are structured rather than ad hoc"
- "Distinctive hybrid failure profile that combines conventional SE faults with probabilistic LLM-driven behaviour"
- "Failures often propagate across system layers, are exacerbated by limited observability and ecosystem fragility"
- "Yet follow consistent patterns that can be systematically exploited"
- 40 repositories, 13,602 issues, 385 manual analyses, 145 practitioners

## Implications for Our Research

### For Evaluator/QA
This taxonomy should be integrated into test design. The top-2 root causes (dependency/integration + data/type handling = 37.1%) suggest tests should prioritize:
- Interface contract verification between agents and tools
- Type/format validation at LLM output boundaries
- Token/credential lifecycle testing
- State consistency across multi-step reasoning

### For System Design
- Cross-layer observability is not optional — it's the #1 debugging need
- Multi-agent coordination faults are under-studied even in this comprehensive work
- Ecosystem stability (dependency management, API versioning) matters more than LLM quality

## Assessment
**★★★★★ Essential** — This is the empirical anchor our theoretical framework needs. The largest and most rigorous study of agentic AI faults to date, with practitioner validation. Every prediction in our GUS framework about coordination costs, cross-boundary failures, and ecosystem fragility is empirically confirmed. The Apriori propagation analysis is genuinely novel and directly actionable.
