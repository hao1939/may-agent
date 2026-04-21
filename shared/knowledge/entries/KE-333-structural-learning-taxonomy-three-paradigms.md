# KE-333 — Structural Learning Taxonomy: Three Paradigms All Validate Structure > Content

**Rating**: ★★★★  
**Source**: DD-832 (Agent Learning Mechanisms: Voyager, MemGPT/Letta, Reflexion)  
**Connects**: KE-101 (Law 1: Structure > Content), KE-330, KE-331, KE-332  
**Date**: 2026-04-21

## Core Finding

DD-832's comparative analysis of three agent learning systems reveals a structural learning taxonomy — three distinct paradigms that all validate KE-101 Law 1 (Structure > Content):

| Paradigm | System | Mechanism | Strength |
|----------|--------|-----------|----------|
| **Executable Skill Library** | Voyager | Composable code stored with embeddings, semantic retrieval | Strongest: persistent, transferable, compositional (3.3–15.3×) |
| **Memory Hierarchy** | MemGPT/Letta | OS-inspired tiers (core/recall/archival), agent self-managed | Flexible: unbounded context, cross-session continuity |
| **Verbal Reflection Buffer** | Reflexion | Natural language self-critiques accumulated per episode | Simplest: 91% HumanEval, but no cross-task transfer |

**Critical insight**: Same frozen LLM (GPT-4) produces 3.3–15.3× variation based purely on learning *architecture*. The content (model weights, prompt text) is identical; only structure differs.

## Relevance to Our System

Our knowledge base is the natural-language analog of Voyager's skill library — persistent, indexed, composable knowledge entries. But we lack:
1. **Executability** — our entries are prose, not executable templates
2. **Semantic retrieval** — agents load by explicit path, not embedding similarity (KE-331)
3. **Compositionality** — entries reference each other but don't chain automatically

Voyager's pattern (executable + embeddings + composition) is the north star for knowledge system evolution.

## Implications

The taxonomy shows learning architecture choice matters more than learning content. When designing agent improvement mechanisms, invest in structural plumbing (storage format, retrieval mechanism, composition protocol) before investing in content quality.
