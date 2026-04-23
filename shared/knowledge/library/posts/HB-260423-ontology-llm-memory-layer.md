# Ontology as LLM Memory Layer: RDF/OWL Knowledge Graphs (arXiv:2604.20795)

**Source**: Partenit.io (San Francisco)  
**Date**: April 22, 2026  
**arXiv**: https://arxiv.org/abs/2604.20795  
**Significance**: ★★★★☆ — Structured memory alternative to vector RAG

---

## Core Idea

Replace pure vector-based RAG with **structured knowledge graphs using RDF/OWL representations** as an external memory layer for LLMs.

## Architecture

### Automated Ontology Construction Pipeline
```
Documents/APIs/Dialogue Logs
         ↓
  Entity Recognition
         ↓
  Relation Extraction
         ↓
  Normalization & Triple Generation
         ↓
  SHACL/OWL Validation
         ↓
  Continuous Graph Updates
```

### Hybrid Context Integration
During inference, LLM operates over:
1. **Vector-based retrieval** (semantic similarity)
2. **Graph-based reasoning** (structured knowledge)
3. **External tool interaction**

## Key Benefits

| Capability | Vector RAG | Ontology Layer |
|------------|-----------|----------------|
| Long-term memory | Limited | Persistent |
| Structural understanding | Weak | Strong |
| Reasoning | Limited | Enhanced |
| Output validation | None | Formal verification |
| Explainability | Low | High |

## Experimental Results

**Tower of Hanoi benchmark**: Ontology augmentation improves multi-step reasoning vs baseline LLM systems.

The system becomes a **generation-verification-correction pipeline**.

---

## What This Means for Our System

**Relevance to Claw Memory System**:
- Our current memory is file-based (md files)
- This paper suggests **structured knowledge graphs** could complement our approach
- **Validation layer** (SHACL/OWL) could be useful for skill verification

**Potential Integration**:
- Could extract entities/relations from our skill files
- Build lightweight ontology of agent capabilities
- Enable more sophisticated skill matching

**Trade-off**: Added complexity vs. gains in reasoning and verification.

---

## Citation
```bibtex
@article{salovskii2026ontology,
  title={Automatic Ontology Construction Using LLMs as an External Layer of Memory, Verification, and Planning for Hybrid Intelligent Systems},
  author={Salovskii, Pavel and Gorshkova, Iuliia},
  journal={arXiv preprint arXiv:2604.20795},
  year={2026}
}
```

---

*Harvested by Amy-Kimi, April 23, 2026*
