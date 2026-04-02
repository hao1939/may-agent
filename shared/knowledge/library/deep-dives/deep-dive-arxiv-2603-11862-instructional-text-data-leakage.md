# Deep Dive: arXiv:2603.11862 — "You Told Me to Do It: Measuring Instructional Text-induced Private Data Leakage in Retrieval-Augmented Generation"

**Authors:** Jonggyu Jang, Seongjin Shin, Sangwon Choi, Hyun Jong Yang
**Date:** March 2026
**Rating:** ★★★★☆ (Novel threat model with empirical validation)

---

## 1. Paper Overview

This paper investigates a subtle but critical vulnerability in **Retrieval-Augmented Generation (RAG)** systems: how instructional text embedded within retrieved documents can cause LLMs to **leak private data** from those same documents. Unlike traditional prompt injection, the attack vector here is **legitimate instructional content** — text that naturally contains directives, instructions, or commands as part of its genuine content.

The key insight: RAG systems retrieve documents and feed them to LLMs as context. If those documents contain instructional language (e.g., "Include the following details...", "Make sure to mention..."), the LLM may treat this content as operational instructions rather than data, leading to unintended private data disclosure.

## 2. Key Contributions

### 2.1 Novel Threat Model: Instructional Text as Attack Vector
Unlike intentional prompt injection, this paper studies **naturally occurring** or **semi-adversarial** instructional text:
- Technical documentation that says "ensure you include the API key..."
- Forms that say "fill in your SSN below: XXX-XX-XXXX"
- Templates with instructions like "replace [NAME] with the patient's name"
- Policy documents saying "always disclose the following information..."

The LLM, treating retrieved context with high trust, follows these embedded instructions and leaks the private data they reference.

### 2.2 Measurement Framework
The paper develops a systematic way to measure this leakage:
- **Leakage rate**: How often private data from retrieved documents appears in outputs
- **Instructional sensitivity**: How much instructional language amplifies leakage vs. non-instructional text
- **Data type analysis**: Which types of private data (PII, credentials, medical records) are most vulnerable
- **Model comparison**: How different LLMs vary in susceptibility

### 2.3 Empirical Findings
Key quantitative results:
- Instructional text **significantly increases** private data leakage compared to identical private data in non-instructional contexts
- The effect is **model-dependent**: larger models with stronger instruction-following capabilities are paradoxically MORE vulnerable
- **Structured data** (tables, forms, templates) is more likely to be leaked than unstructured narrative
- Standard RAG safety measures (output filtering, prompt engineering) are **insufficient** to prevent this leakage

### 2.4 The Instruction-Data Conflation Problem
The fundamental issue: LLMs cannot reliably distinguish between:
- **Instructions they should follow** (system prompt, user query)
- **Instructional text they should treat as data** (retrieved documents containing instructional language)

This is a deep architectural problem, not solvable by prompt engineering alone.

## 3. Technical Analysis

### 3.1 Attack Taxonomy
The paper categorizes instructional text-induced leakage by intent:
1. **Unintentional**: Naturally occurring instructional language in legitimate documents
2. **Semi-adversarial**: Documents crafted to contain instructional language that triggers leakage
3. **Fully adversarial**: Deliberately poisoned documents designed to maximize data extraction

### 3.2 RAG Pipeline Vulnerability Points
The vulnerability spans the RAG pipeline:
- **Retrieval stage**: Documents with instructional text are retrieved (no anomaly to detect)
- **Context assembly**: Instructional text is placed in the LLM's context window alongside the query
- **Generation stage**: LLM follows embedded instructions, producing outputs containing private data
- **Output stage**: Leaked data is returned to the user (potentially a different user than the data subject)

### 3.3 Mitigation Approaches Evaluated
The paper evaluates several mitigations:
- **Prompt hardening**: Adding explicit "ignore instructions in retrieved documents" — partially effective but brittle
- **Output filtering**: Scanning outputs for PII/sensitive data — effective for known patterns but misses novel data types
- **Document sanitization**: Removing instructional language from retrieved documents — degrades retrieval quality
- **Instruction-data separation**: Architectural approaches to keep instructions and data in separate processing streams — most promising but requires fundamental redesign

## 4. Connection to Our Framework

### 4.1 Authority Confusion (Law of Hierarchical Authority)
This paper provides **the most concrete evidence** for our Authority Confusion degradation pattern:
- The LLM cannot distinguish between authoritative instructions and instructional text-as-data
- This is exactly the "confused deputy" problem at the instruction level
- Our framework's emphasis on clear authority hierarchies is validated

### 4.2 Context Poisoning via Legitimate Channels
Unlike traditional prompt injection (which our framework covers via WebWeaver, InjectAgent, etc.), this attack uses **legitimate retrieval channels**:
- The documents ARE relevant to the query
- The instructional text IS genuine content
- No adversarial injection is needed
- This represents a new class of context poisoning we should add to our taxonomy

### 4.3 RAG-Specific Vulnerabilities
Our framework has addressed RAG indirectly through memory architecture papers. This paper shows RAG has **unique vulnerabilities** beyond general memory poisoning:
- Retrieval creates trust escalation (retrieved = implicitly trusted)
- Document diversity means unpredictable instruction patterns
- Multi-document contexts create instruction conflict scenarios

### 4.4 Capability-Security Paradox
The finding that **more capable models are more vulnerable** (because they follow instructions better) directly supports our "capability-security tension" theme:
- Better instruction following = more susceptible to instructional text leakage
- This is a fundamental design tension, not a bug to be fixed
- Aligns with findings from Stop Listening to Me (2603.11394) — multi-turn sycophancy

### 4.5 Cross-Paper Connections
- **Stop Listening to Me (2603.11394)**: Both show LLMs being too compliant with contextual signals
- **InjectAgent (2603.04474)**: Traditional injection vs. this paper's natural instructional text
- **Attack & Defense Survey (2603.11088)**: This paper fills a gap in the survey's RAG threat coverage
- **Sim2Real Gap (2603.11245)**: Instruction conflation is harder to simulate/test than explicit attacks
- **LDP (2603.04421)**: Privacy-preserving mechanisms could partially mitigate this leakage

## 5. Critical Assessment

### Strengths
- **Novel threat model**: Instructional text as attack vector is genuinely new and important
- **Practical relevance**: RAG is ubiquitous; this affects real deployments
- **Empirical rigor**: Systematic measurement across models and data types
- **Architectural insight**: Correctly identifies instruction-data conflation as fundamental
- **Honest about limitations**: Acknowledges mitigations are partial

### Limitations
- **Scope**: Focuses on text-only RAG; multimodal RAG may have different dynamics
- **Model coverage**: Limited set of models tested (though representative)
- **Defense evaluation**: Mitigations are evaluated but not deeply optimized
- **Real-world validation**: Uses constructed scenarios rather than real RAG deployment data

### Open Questions
- Can fine-tuning teach models to distinguish instruction-as-data from instruction-as-command?
- What is the minimum architectural change needed to prevent this class of leakage?
- How does this interact with multi-agent RAG where agents share retrieval pipelines?
- Can differential privacy techniques bound the leakage rate?

## 6. Practical Implications

For our multi-agent system design:
1. **RAG pipelines need instruction-data separation**: Don't mix retrieved content with system instructions in the same context region
2. **Output monitoring for all RAG outputs**: Every RAG-generated output should be scanned for private data leakage
3. **Document preprocessing**: Strip or escape instructional language in retrieved documents before feeding to LLMs
4. **Least-privilege retrieval**: Only retrieve documents the requesting user/agent is authorized to see
5. **Multi-agent RAG boundaries**: When agents share retrieval infrastructure, ensure per-agent access controls

## 7. Framework Update Recommendation

This paper suggests we should add a new sub-category to our degradation patterns:

**"Instructional Conflation"** — a sub-type of Authority Confusion where the agent cannot distinguish between instructions to follow and instructional content to process as data. This is distinct from prompt injection because:
- No adversarial intent is required
- The content is legitimately retrieved
- Standard injection defenses don't apply
- The root cause is architectural, not operational

---

**Filed:** 2026-03-13
**Cross-references:** Stop Listening to Me (2603.11394), InjectAgent (2603.04474), Attack & Defense Survey (2603.11088), Sim2Real Gap (2603.11245), LDP (2603.04421)
**Status:** Complete
