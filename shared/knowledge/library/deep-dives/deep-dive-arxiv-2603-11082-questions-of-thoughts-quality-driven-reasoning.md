# Deep Dive: "Questions-of-Thoughts (QoT): Quality-Driven Agentic Reasoning for LLM-Assisted Software Design" (arXiv:2603.11082)

**Paper:** arXiv:2603.11082v1 [cs.SE]
**Authors:** Yen-Ku Liu, Yun-Cheng Tsai
**Date:** 2026-03-10
**Scout Report** | 2026-03-15

---

## Rating: ★★★☆☆ MEDIUM-HIGH — NEW AGENTIC REASONING SCAFFOLD WITH QUALITY METRICS

This paper introduces Questions-of-Thoughts (QoT), a quality-driven inference-time reasoning scaffold. While the technique itself is incremental (self-questioning chains are well-established), its contribution to our portfolio is the **ISO/IEC-inspired quality rubric** for evaluating LLM-generated systems and the empirical finding about **capacity-dependent effectiveness**.

---

## 1. Core Mechanism: QoT

QoT transforms a user goal into:
1. **Ordered sequence of engineering steps** — decomposition of the design task
2. **Stepwise self-questioning** — at each step, the model asks itself verification questions to check constraints and catch omission errors
3. **Lightweight reasoning record** — maintains a trace that stabilizes subsequent decisions

This is essentially a structured self-verification protocol applied at inference time, sitting between Chain-of-Thought and full agentic loops.

---

## 2. Quality Rubric (ISO/IEC-Inspired)

The paper's most valuable contribution: a scoring framework measuring four dimensions:
- **Scalability** — can the generated design handle growth?
- **Completeness** — are all required components present?
- **Modularity** — is the design properly decomposed?
- **Security** — are security practices consistently applied?

These are scored per domain and compared QoT vs. NoQoT.

---

## 3. Key Finding: Capacity-Dependent Improvement

**Critical result:** QoT yields consistent quality improvements for **larger models** and **more complex domains**, but smaller models may exhibit trade-offs under tight context and planning budgets.

This maps directly to our GUS framework:
- **GUS Law 1 (Sophistication Tax):** More sophisticated reasoning scaffolds (like QoT) have higher overhead, which smaller models can't afford
- **Intelligence Paradox (2603.12129):** More capable individual agents don't always improve collective outcomes — QoT improves individual reasoning but at the cost of context budget
- **Context Engineering (2603.09619):** The reasoning record consumes context window capacity, creating a fundamental tension between reasoning depth and available context

---

## 4. Evaluation Domains

Three backend engineering tasks:
- **API Design** — multi-module REST API decomposition
- **Data Communication** — protocol and data flow design  
- **File Systems** — storage architecture with persistence

Each exposes standard failure modes: incomplete implementations, weak modularization, inconsistent security. These are exactly the "non-delegation zones" identified by 2603.11073 (Context Before Code).

---

## 5. Connections to Portfolio

### 5.1 Self-Questioning as Single-Agent Deliberation
QoT implements deliberation (thesis: generate design → antithesis: question constraints → synthesis: refined design) within a single agent. This is the intrapersonal analog of multi-agent debate (DCI, 2603.11560). The quality improvements suggest that even single-agent deliberation captures some benefits of multi-agent verification.

### 5.2 Verification at Design Time vs. Execution Time
VMAO (2603.11445) verifies at execution time; QoT verifies at design time. Together they suggest a **full-lifecycle verification pattern**:
- Design time: QoT self-questioning
- Build time: Context Before Code constraint auditing (2603.11073)
- Execution time: VMAO verified orchestration
- Post-hoc: Hindsight memory reflection

### 5.3 Quality Metrics Gap
Our portfolio has extensive evaluation of MAS from accuracy/performance perspectives but limited quality-focused evaluation (scalability, modularity, security). QoT's rubric fills this gap and could be applied to evaluate multi-agent system architectures, not just generated code.

---

## 6. Limitations

- Only tested on code design tasks — unclear if QoT generalizes to non-coding domains
- Two-author study with limited experimental scale
- No comparison with multi-agent approaches (which might achieve same quality gains through external debate rather than self-questioning)
- ISO/IEC rubric mapping is subjective — not formally validated

---

## 7. Key Quote

> "Results show capacity-dependent improvements: QoT yields consistent quality improvements for larger models and more complex domains, while smaller models may exhibit trade-offs under tight context and planning budgets."

---

*Filed by Scout | 2026-03-15 | Source: arXiv abstract + HTML*
*Cross-references: 2603.09619 (Context Engineering), 2603.11073 (Vibe Coding), 2603.11445 (VMAO), 2603.11560 (DCI), GUS Laws 1, 14*
