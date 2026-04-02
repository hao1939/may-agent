# DD#343: DocSage — Schema-Aware Information Structuring Agent for Multi-Document QA

**Paper:** arXiv:2603.11798 — "DocSage: An Information Structuring Agent for Multi-Doc Multi-Entity Question Answering"  
**Authors:** Teng Lin, Yizhang Zhu, Zhengxuan Zhang, Yuyu Luo, Nan Tang  
**Institution:** HKUST (Guangzhou)  
**Submitted:** 2026-03-12 (appeared on cs.AI March 16 listing)  
**Rating:** ★★★★☆ HIGH — First agentic framework treating multi-document QA as a database construction + SQL query problem, with 27% accuracy gains over both long-context LLMs and RAG baselines

---

## 1. Core Thesis

**Standard RAG fails on multi-document multi-entity questions because it lacks schema awareness — it can retrieve relevant passages but cannot systematically organize entities, attributes, and relationships across documents into queryable structures.**

DocSage proposes that instead of retrieving text chunks and hoping the LLM can reason over them, you should:
1. **Discover** a query-specific relational schema dynamically
2. **Extract** structured tables from unstructured text using that schema
3. **Reason** via SQL queries over the constructed database

This transforms multi-hop entity-tracking from a language reasoning problem into a database query problem — where SQL provides exact, deterministic joins rather than probabilistic attention.

---

## 2. Architecture: Three Core Modules

### 2.1 Interactive Schema Discovery (ASK Algorithm)

**Problem:** Multi-document QA requires knowing what entities and relationships to track, but different queries need different schemas.

**Solution: Active Schema Discovery via Knowledge-seeking Queries (ASK)**

1. **Initial Hypothesis:** LLM generates a schema hypothesis from the query + document sample
2. **Consistency Analysis:** System applies schema to more documents, detecting three uncertainty signals:
   - Entity alignment conflicts (same entity, different attributes across docs)
   - Attribute value distribution anomalies (logical contradictions like Age=180)
   - Missing relationship paths (multi-hop paths can't be established)
3. **Active Questioning:** For each uncertainty, generates clarification questions used as retrieval queries
4. **Iterative Refinement:** Updates schema until convergence (no new uncertainties)

**Key insight:** Schema discovery is framed as an *interactive dialogue* with the document set, not a passive scan.

### 2.2 Logic-Aware Structured Extraction (CLEAR Mechanism)

**Problem:** LLM extraction from unstructured text is noisy and error-prone.

**Solution: Cross-record Logic Enforcement for Accuracy Reinforcement (CLEAR)**

Two-level correction:

**Level A — Single-Point Confidence:**
- LoRA adapter fine-tuned per schema for calibrated extraction
- Conformal Prediction thresholds for uncertainty quantification
- Combines model probability with statistical guarantees

**Level B — Cross-Record Logical Consistency:**
- Functional dependency checks (Person_ID → Date_of_Birth)
- Temporal constraint validation (Admission_Time < Discharge_Time)
- Numerical range enforcement (Age within safe range)
- Foreign key referential integrity across tables

**Correction Decision:** Low-confidence tuples → committee of stronger LLMs for re-extraction. Logic violations → verification sub-module with targeted backtracking to source documents.

### 2.3 Schema-Guided Relational Reasoning

**Problem:** Multi-hop reasoning across documents requires tracking entity relationships precisely.

**Solution:** Compile natural language query into optimized SQL:
1. LLM compiles query → SQL using explicit schema join keys
2. Execute SQL on constructed database → structured result set
3. Trace provenance of each result row back to source document locations
4. Synthesize natural language answer with full evidence chain

**Key advantage:** SQL provides deterministic joins — no attention diffusion, no entity confusion.

---

## 3. Critical Design Decisions

### 3.1 Why Relational Tables > Knowledge Graphs

DocSage explicitly argues against GraphRAG's triple-based approach:

| Dimension | Knowledge Graph | Relational Tables |
|-----------|----------------|-------------------|
| **Entity joining** | Requires graph traversal | Native SQL JOIN |
| **Schema flexibility** | Fixed ontology | Query-specific schema |
| **Scalability** | Graph construction O(N²) | Linear extraction |
| **Reasoning** | Graph algorithms | SQL (mature, optimized) |
| **Error control** | Hard to validate triples | Constraint checking natural |

### 3.2 Query-Specific vs. Universal Schema

DocSage discovers a *minimal joinable schema* per query, not a universal schema for all questions. This is computationally more expensive per query but avoids the noise of over-parameterized structures.

**Trade-off:** Higher latency per query, but dramatically higher accuracy because the schema captures exactly the entities and relationships needed.

### 3.3 Error Guarantees via Conformal Prediction

The CLEAR mechanism doesn't just try to extract correctly — it provides statistical guarantees on extraction quality through conformal prediction. This enables the system to quantify uncertainty and selectively escalate uncertain extractions to more expensive models.

---

## 4. Experimental Results

### 4.1 Performance Benchmarks

Evaluated on two MDMEQA benchmarks:

**Key results (accuracy):**
- DocSage outperforms best long-context LLM (GPT-4 Turbo, Claude 3) by **27.2%**
- DocSage outperforms best RAG system by **27.0%**
- DocSage outperforms GraphRAG variants

### 4.2 What The Numbers Mean

The 27% gap is enormous. It suggests that:
1. **Long-context LLMs** suffer from attention diffusion — they can hold all the text but can't systematically track entity relationships
2. **Standard RAG** suffers from retrieval gaps — vector similarity misses entity-relevant passages
3. **Graph RAG** suffers from scalability — graph construction becomes prohibitive with many documents

DocSage's structured approach (schema → tables → SQL) handles all three failure modes.

---

## 5. Limitations and Open Questions

### 5.1 Acknowledged Limitations
- **Latency:** Schema discovery + extraction pipeline is slower than direct RAG
- **Schema quality dependence:** If schema discovery misses a critical relationship, downstream accuracy drops
- **Extraction errors compound:** Despite CLEAR, extraction errors can propagate through SQL joins

### 5.2 Unacknowledged Limitations
- **Schema convergence not guaranteed:** The ASK algorithm assumes convergence, but adversarial or deeply ambiguous document sets may not converge
- **SQL expressiveness ceiling:** Some reasoning patterns (analogies, counterfactuals) can't be compiled to SQL
- **Cost:** Multiple LLM calls (schema LLM + extraction LLM + LoRA fine-tuning + reasoning LLM) per query
- **Evaluation scope:** Only tested on structured QA benchmarks — unclear how it handles open-ended or comparative questions

---

## 6. Connections to Our Research Corpus

### 6.1 Direct Connections
- **DD#309 (Agentic RAG):** DocSage is a specific instantiation of agentic RAG — the agent actively structures information rather than passively retrieving
- **DD#334 (OfficeQA Pro):** Enterprise QA over documents faces exactly the multi-entity cross-document challenge DocSage addresses
- **DD#336 (DataFactory):** Both DocSage and DataFactory use structured extraction pipelines with quality guarantees

### 6.2 Thematic Connections
- **DD#311 (Retrieval Bias):** DocSage's SQL-based approach sidesteps the retrieval bias problem by replacing vector similarity with schema-guided extraction
- **CR#178 (Knowledge Integrity Pipeline):** DocSage's CLEAR mechanism addresses extraction integrity, one of the six failure stages
- **CR#160 (Knowledge Update Dynamics):** DocSage's schema discovery parallels the knowledge structuring challenge

### 6.3 Contrast Points
- **CR#182 (Compute Budget Problem):** DocSage is expensive per query — invests heavily in structuring to get high accuracy. This is a clear "invest compute in structuring" choice
- **DD#340 (Feynman Diagramming):** Both use multi-stage pipelines that decouple discovery from execution

---

## 7. Key Takeaway

**DocSage proves that treating multi-document QA as a database construction problem — rather than a retrieval + reasoning problem — yields dramatic accuracy gains.** The core insight: SQL joins are more reliable than LLM attention for cross-document entity tracking. The cost is latency and compute, but for high-stakes domains (clinical, financial, legal), this trade-off is obviously worth it.

**The deeper lesson:** When accuracy matters more than speed, *structure the data before reasoning over it*. Don't ask the LLM to do both structuring and reasoning simultaneously — that's where attention diffusion kills you.

---

*Deep-dive by Scout, 2026-03-16. Next: Synthesize with DD#309, DD#334, DD#336 for a cross-reference on "Structure-First QA Architectures."*
