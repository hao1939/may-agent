# DocSage: An Information Structuring Agent for Multi-Doc Multi-Entity Question Answering

**Source**: arXiv:2603.11798 (March 12, 2026)
**Authors**: Teng Lin et al. (HKUST Guangzhou)
**URL**: https://arxiv.org/abs/2603.11798
**Tracked**: HB#380, March 14, 2026

---

## Summary

DocSage is an end-to-end agentic framework for Multi-document Multi-entity Question Answering (MDMEQA) that achieves **27%+ accuracy improvements** over state-of-the-art long-context LLMs and RAG systems.

## Core Innovation: Anti-RAG Architecture

Unlike traditional RAG that relies on vector similarity-based retrieval, DocSage:
1. **Dynamically discovers schemas** tailored to each query
2. **Structures unstructured text** into relational tables
3. **Performs schema-aware reasoning** with SQL-powered indexing

## Three-Module Architecture

### 1. Interactive Schema Discovery (ASK Algorithm)
- Active schema discovery via knowledge-seeking queries
- Four-step process: Initial hypothesis → Consistency analysis → Question generation → Iterative update
- Identifies three types of uncertainty signals:
  - Entity alignment conflicts
  - Attribute value distribution anomalies
  - Missing relationships

### 2. Logic-Aware Structured Extraction (CLEAR)
- Cross-record logic enforcement for accuracy reinforcement
- LoRA-enhanced calibration for confidence assessment
- Error-aware correction mechanisms

### 3. Schema-Guided Relational Reasoning
- Multi-hop relational reasoning over structured tables
- Cross-document entity alignment via joinable schema attributes
- SQL-powered indexing for precise fact localization

## Key Results

| Method | Accuracy vs DocSage |
|--------|---------------------|
| Long-context LLMs | -27.2% |
| Standard RAG | -27.0% |
| Graph-based RAG | -20%+ |

## Relevance to OpenClaw

1. **Structured intermediate representation philosophy validated**
   - Schema Discovery ↔ CONTEXT.md dynamic schema
   - Structured Tables ↔ SKILL.md structured output
   - Error-aware Correction ↔ Error Log feedback loop

2. **Complements "OpenClaw Meets Hospital" paper**
   - Hospital: Page-Indexed Memory (document-level)
   - DocSage: Schema-Guided JOINs (entity-level)
   - Combined: Dual indexing at both levels

3. **Design implications**
   - Skill outputs should be maximally structured
   - Main Agent should dynamically infer cross-Skill schemas
   - Avoid relying on vector similarity for critical decisions

## L3 Flags Generated

- #1016: ASK-style schema discovery for Main Agent
- #1017: Structured Skill output requirement
- #1018: Cross-Skill entity alignment validation
- #1019: Three-layer uncertainty classification
- #1020: Error-aware Skill execution with confidence thresholds
