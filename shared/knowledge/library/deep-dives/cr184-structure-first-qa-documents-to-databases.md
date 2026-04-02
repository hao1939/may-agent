# CR#184: Structure-First QA — Why Turning Documents Into Databases Beats Retrieving From Them

**Cross-Reference Synthesis #183**  
**Date:** 2026-03-16  
**Author:** Scout  
**Rating:** ★★★★★ CRITICAL  
**Type:** Architectural Paradigm Synthesis  
**Sources:** DD#343 (DocSage, arXiv:2603.11798), DD#309 (Agentic RAG Test-Time Strategies, arXiv:2603.12396), DD#334 (OfficeQA Pro, arXiv:2603.08655), DD#311 (Retrieval Bias, arXiv:2603.12271), DD#322 (ShatterMed-QA, arXiv:2603.12458)

---

## Executive Summary

Five papers converge on a single conclusion: **when questions require tracking entities across multiple documents, retrieval-based approaches hit a fundamental ceiling that structured representations can break through.** DocSage demonstrates 27% accuracy gains by converting documents to relational tables and using SQL instead of LLM attention for multi-hop reasoning. OfficeQA Pro shows frontier agents plateau at <50% on enterprise document QA. Together they define a paradigm shift: from "retrieve passages, then reason" to "structure data, then query."

---

## 1. The Two Paradigms

### Paradigm A: Retrieve-Then-Reason (Standard RAG)
```
Query → Embed → Retrieve Passages → Concatenate in Context → LLM Reasons → Answer
```

**Failure modes:**
- Vector similarity misses entity-relevant passages (DD#309)
- Attention diffusion loses entity tracking over long contexts (DD#334)
- Retrieval bias makes early retrievals "sticky" over later ones (DD#311)
- Shortcut patterns in reasoning bypass actual multi-hop chains (DD#322)

### Paradigm B: Structure-Then-Query (DocSage)
```
Query → Discover Schema → Extract Tables → Build DB → SQL Query → Answer with Provenance
```

**Why it works:**
- SQL joins are deterministic — no attention diffusion
- Schema constrains extraction to relevant entities only
- Cross-record validation catches extraction errors
- Provenance tracing provides verifiable evidence chains

---

## 2. Evidence Chain: Why Paradigm A Fails

### 2.1 The OfficeQA Pro Ceiling (DD#334)
- Frontier LLMs as agents achieve **<50% accuracy** on enterprise document QA
- Even with oracle documents (perfect retrieval), agents struggle with **parsing + reasoning**
- The gap isn't retrieval — it's that unstructured text representation defeats systematic reasoning

**Connection to DocSage:** OfficeQA Pro's Treasury Bulletins contain exactly the kind of nested tables, changing units, and cross-document entity tracking where DocSage's schema-guided approach would shine. DocSage's structured tables + SQL could potentially double OfficeQA Pro accuracy.

### 2.2 The Retrieval Bias Problem (DD#311)
- LLMs exhibit **primacy bias** — they preferentially retrieve the earliest version of a fact, not the latest
- When multiple documents contain evolving information about the same entity, RAG systems retrieve all versions but the LLM can't distinguish current from historical

**Connection to DocSage:** DocSage's relational tables include explicit attributes (timestamps, version indicators) that make temporal ordering queryable via SQL. The retrieval bias problem is eliminated because the structured representation preserves ordering explicitly rather than relying on LLM attention to infer it.

### 2.3 The Multi-Hop Shortcut Problem (DD#322)
- LLMs exploit generic "hub" concepts to bypass authentic multi-hop reasoning chains
- In medical QA, models jump from symptom to generic concept to answer, skipping the pathological mechanism

**Connection to DocSage:** SQL's JOIN operations enforce explicit traversal through intermediate entities. You can't shortcut a multi-table join — you must match on actual join keys, which correspond to the intermediate entities that LLMs try to skip.

### 2.4 The Agentic RAG Overhead (DD#309)
- Iterative retrieval systems waste 10.5% of retrieval turns on redundant information
- Contextualization helps (+5.6% EM), but the fundamental issue remains: retrieved passages aren't structured for reasoning

**Connection to DocSage:** DocSage's approach eliminates redundant retrieval entirely — once data is extracted into tables, all queries are over the database. No re-retrieval needed. The agentic overhead shifts from "find information repeatedly" to "build the right structure once."

---

## 3. The Structure-First Architecture Pattern

Combining insights across all five papers, the optimal architecture for high-stakes multi-document QA emerges:

### Layer 1: Schema Discovery (DocSage's ASK)
- **Input:** Natural language query + document collection
- **Output:** Minimal joinable relational schema
- **Key innovation:** Interactive, not passive — generates clarification queries to resolve ambiguity

### Layer 2: Validated Extraction (DocSage's CLEAR)
- **Input:** Schema + documents
- **Output:** Populated relational database with quality guarantees
- **Key innovation:** Two-level correction (single-point confidence + cross-record logic)
- **Connection to OfficeQA Pro:** The extraction layer handles the parsing failures that OfficeQA Pro identifies as the primary bottleneck

### Layer 3: Deterministic Reasoning (SQL)
- **Input:** Populated database + query compiled to SQL
- **Output:** Structured result set with provenance
- **Key innovation:** Eliminates attention diffusion entirely
- **Connection to ShatterMed:** SQL joins enforce genuine multi-hop traversal

### Layer 4: Evidence Synthesis
- **Input:** SQL results + provenance chains + source documents
- **Output:** Natural language answer with citations
- **Connection to Retrieval Bias:** Explicit structure means no bias toward earlier/later sources

---

## 4. When Structure-First Is Worth the Cost

Structure-First has a real cost: latency and compute. DocSage runs multiple LLM calls per query (schema discovery + extraction + reasoning). When is this worthwhile?

### 4.1 Always Worth It
- **Clinical decisions:** Drug-disease interactions across trial reports (→ DD#322)
- **Financial analysis:** Cross-referencing corporate filings (→ DD#334)
- **Legal review:** Contract clause comparison across agreements
- **Compliance audits:** Tracking regulatory changes across document versions

### 4.2 Not Worth It
- **Simple factoid QA:** Single-document, single-entity questions
- **Conversational search:** Low-stakes browsing where approximate answers suffice
- **Real-time applications:** Where latency budget is <1 second

### 4.3 The Decision Heuristic
```
IF (query spans >3 entities across >2 documents) AND (accuracy >50% required):
    → Use Structure-First
ELSE:
    → Use Standard RAG
```

---

## 5. The Deeper Pattern: Externalize What LLMs Can't Track

This synthesis reveals a recurring theme across our corpus:

| Internal Process | External Structure | Prior Art |
|-----------------|-------------------|-----------|
| Entity tracking | Relational tables | DocSage |
| Knowledge ordering | Timestamped versions | DD#311 |
| Multi-hop chains | Join paths | DD#322 |
| Document parsing | Structured extraction | DD#334 |
| Retrieval planning | De-duplication logs | DD#309 |

**The principle:** When an LLM's internal processing is insufficient for a task, externalize that processing into explicit data structures. This is the "cognitive offloading" pattern — the same strategy humans use when they take notes, draw diagrams, or create spreadsheets.

DocSage takes this principle to its logical extreme: externalize *everything* about entity tracking and reasoning into a relational database, and use the LLM only for what it's good at (language understanding, schema inference, answer synthesis).

---

## 6. Open Research Questions

1. **Can schema discovery be cached?** If multiple queries share similar schemas, can we amortize the discovery cost?
2. **Hybrid approaches:** Can you run fast RAG for easy queries and trigger Structure-First only when RAG confidence is low?
3. **Incremental structuring:** As new documents arrive, can you update the database without full re-extraction?
4. **Schema composition:** When two queries need overlapping but different schemas, can you compose or merge them?
5. **Quality-latency frontier:** What's the Pareto-optimal point between full structuring (slow, accurate) and pure RAG (fast, less accurate)?

---

## 7. Relationship to Prior CRs

- **CR#178 (Knowledge Integrity Pipeline):** DocSage's CLEAR mechanism directly implements the "extraction validation" stage of the integrity pipeline
- **CR#160 (Knowledge Update Dynamics):** Schema discovery parallels the knowledge structuring phase, but DocSage does it per-query rather than globally
- **CR#168 (Why Do Agents Fail?):** DocSage addresses the "information fragmentation" failure mode identified in CR#168
- **CR#182 (Compute Budget Problem):** DocSage makes a deliberate choice to invest heavily in structuring compute, with clear payoff in reasoning accuracy

---

## 8. Bottom Line

**The research corpus now contains strong evidence for a paradigm distinction in document QA:**

- **Paradigm A (Retrieve-Then-Reason):** Fast, cheap, good enough for simple queries, but hits a fundamental ceiling on multi-entity multi-document tasks (~34% on OfficeQA Pro)
- **Paradigm B (Structure-Then-Query):** Slower, more expensive, but breaks through the ceiling with 27%+ accuracy gains

The five papers synthesized here collectively argue that **for high-stakes knowledge work, the future is Structure-First** — not because RAG is wrong, but because unstructured text is the wrong representation for precise multi-entity reasoning.

---

*Cross-reference synthesis by Scout, 2026-03-16. This CR connects 5 deep-dives and 4 prior CRs into a unified architectural paradigm for multi-document QA.*
