# Deep-Dive #334: OfficeQA Pro — Enterprise Benchmark for End-to-End Grounded Reasoning

**Source:** arXiv:2603.08655v1 (March 2026)
**Authors:** Databricks AI Research
**Date reviewed:** 2026-03-16
**Relevance:** ★★★★★ CRITICAL — Direct empirical evidence for the Reliability Illusion (GUS Law 15) and enterprise-grade agent limitations

---

## 1. Core Contribution

OfficeQA Pro is a benchmark for evaluating AI agents on **grounded, multi-document reasoning** over a large heterogeneous document corpus. The corpus consists of U.S. Treasury Bulletins spanning nearly 100 years: 89,000 pages, 26 million numerical values, 133 hard questions requiring precise retrieval, parsing, and analytical reasoning.

**Key result:** Frontier LLMs (Claude Opus 4.6, GPT-5.4, Gemini 3.1 Pro Preview) achieve:
- **<5% accuracy** on parametric knowledge alone
- **<12% accuracy** with web search
- **34.1% average accuracy** as agents with full document access
- **No agent exceeds 50%** even with oracle documents + best parsing

---

## 2. Architecture & Methodology

### 2.1 Benchmark Design
- **Corpus:** U.S. Treasury Bulletins (1939–2020s), 100-200 pages each, monthly/quarterly
- **Challenges:** Nested tables, changing units, temporal revisions, scanned vs. digital PDFs, footnotes, format drift
- **Question design:** 133 Pro questions requiring:
  - Multi-step reasoning (62% need analysis beyond basic arithmetic)
  - Multi-document retrieval (11% need 3+ bulletins)
  - Web search for external values (22%)
  - Visual reasoning over figures (3%)
- **Evaluation:** Exact numerical match at 0.0% absolute relative error

### 2.2 Agent Configurations
Three agent frameworks tested:
1. **Claude Agent SDK** (Anthropic) — Claude Opus 4.6
2. **Codex CLI** (OpenAI) — GPT-5.4
3. **Gemini CLI** (Google) — Gemini 3.1 Pro Preview

Configurations: Full Corpus PDF, Full Corpus Parsed, Oracle PDF, Oracle Parsed

### 2.3 Parsing Impact
Databricks' `ai_parse_document` yields **16.1% average relative performance gain** across agents. Three parsers compared:
- **Databricks ai_parse_document:** 50.4% avg accuracy, $5.29/sample
- **Docling (open-source):** 38.4% avg accuracy, $8.18/sample  
- **unstructured.io:** 31.1% avg accuracy (highest cost)

---

## 3. Key Quantitative Results

### 3.1 LLM Baselines (single-call, no agent)
| Model | Prompt Only | Web Search | Oracle PDF | Oracle Parsed |
|-------|------------|------------|-----------|--------------|
| GPT-5.4 | <1% | 11.3% | 57.1% | 65.4% |
| Claude Opus 4.6 | <3% | ~5% | 36.1% | 57.1% |
| Gemini 3.1 Pro | <3% | ~5% | 52.6% | 56.4% |

### 3.2 Agent Baselines
| Agent | Full PDF | Full Parsed | Oracle PDF | Oracle Parsed |
|-------|---------|------------|-----------|--------------|
| Claude Opus 4.6 | **48.1%** | 54.1% | 60.9% | **66.9%** |
| GPT-5.4 | 36.1% | **56.4%** | 54.9% | 65.4% |
| Gemini 3.1 Pro | 18.1% | 29.3% | 39.1% | 46.6% |

### 3.3 Cost and Latency
- Claude: $4.55/question (full PDF), 31.2 min avg
- GPT-5.4: $1.79/question, 13.1 min avg — 2.4× faster than Claude
- Gemini: $6.21/question, 26.4 min avg
- Parsed documents: **4-9× faster** than PDF processing

### 3.4 Oracle Page Impact
Providing oracle pages improves accuracy by **13-21 absolute percentage points** over full-corpus, with ~76% latency reduction and 74-88% cost reduction.

---

## 4. Failure Mode Taxonomy

### 4.1 Temporal Revision Verification
Treasury statistics get revised across subsequent bulletins. Agents prematurely converge on first numerically plausible value found. Attempts to enforce revision checking trigger recursive retrieval loops that saturate the context window.

### 4.2 Parsing Faithfulness
40-50% of errors in PDF configurations stem from parsing: misread numbers, corrupted text, misaligned tables. Even best parsers have residual fidelity errors in table topology.

### 4.3 Visual Understanding
Agents lack granular resolution for dense financial charts. Pre-parsed representations lose visual data through lossy embedding conversion.

### 4.4 Analytical Reasoning
- Alternative definitions for statistical values
- Sample vs. population variance confusion
- Premature rounding causing cascading imprecision
- Internal calculation instead of delegating to code interpreter
- Misaligned formulas (mathematically valid but contextually wrong)

---

## 5. GUS Framework Integration

### 5.1 Reliability Illusion (Law 15) — STRONGEST EVIDENCE YET
This paper provides the most compelling empirical evidence for Law 15:
- **Parametric knowledge is near-zero** for precise enterprise tasks (<5%)
- **Web search provides minimal help** (<12%) — models find plausible-but-wrong data
- **Even oracle documents + best parsing** leave 33-53% headroom
- **Fermi estimate capability exists** (17-24% at 5% error tolerance) but precision is illusory

**Key insight:** Models can *approximate* but cannot *reliably extract and compute*. The gap between "roughly right" (5% tolerance) and "exactly right" (0% tolerance) is 15-30 percentage points — this IS the reliability illusion quantified.

### 5.2 Context Corruption (GUS Mechanism 2)
Temporal revision verification failure is a direct instance: agents fill context with extraction attempts, lose track of validated intermediates, and revert to approximations. This is context corruption driven by retrieval sprawl.

### 5.3 Infrastructure Gap (Law 30)
Massive performance delta between raw PDF and parsed documents (16.1% relative gain) reveals that the infrastructure layer (parsing, OCR, table extraction) is a binding constraint on agent performance. Agent capability is bottlenecked by infrastructure quality, not model intelligence.

### 5.4 Coordination Overhead (Mechanisms)
GPT-5.4 agent uses 90% bash calls with brute-force OCR pipeline (tesseract + pdftoppm + Pillow) — it's faster (2.4×) because it batches locally instead of making API calls. Claude makes ~11K tool calls with 65% being Read operations. Strategy divergence → performance divergence, confirming that coordination patterns are as important as model capability.

### 5.5 Tool Scaling vs. Model Scaling
Key finding: **parsing quality matters more than model capability**. GPT-5.4 with parsed docs (56.4%) beats Claude Opus 4.6 with raw PDFs (48.1%). This validates our Principle that tool/infrastructure investment can outperform model upgrades.

---

## 6. Critical Assessment

### 6.1 Strengths
- **Real enterprise task proxy** — not Olympiad reasoning, not trivia
- **Verifiable ground truth** — exact numerical answers
- **Comprehensive ablation** — parsing, retrieval, model, test-time compute
- **Multiple failure mode analysis** — not just "it doesn't work" but *why*
- **Scale:** 89K pages, 26M values, 100-year corpus

### 6.2 Limitations
- **Single domain** (Treasury Bulletins) — unclear if patterns generalize to medical, legal, etc.
- **Databricks self-promotion** — they make their parser look best (though methodology seems fair)
- **No multi-agent evaluation** — all agents are single-agent + tools, no collaborative architectures tested
- **Static corpus** — no adversarial document injection or live data

### 6.3 Open Questions
1. Would multi-agent architectures (reviewer agent + extractor agent + calculator agent) perform better?
2. Does the parsing bottleneck scale linearly or does it compound?
3. Can temporal revision verification be solved with explicit memory/provenance tracking?

---

## 7. Cross-Reference Connections

| Connection | Description |
|-----------|-------------|
| **DD#218 (CORE-Bench)** | Another benchmark showing frontier agents fail on research tasks — convergent evidence |
| **DD#296 (LMEB)** | Frontier evals showing <50% on real tasks — same pattern |
| **DD#330 (OpenSWE-DaVinci)** | Environment synthesis for SWE tasks — parsing as infrastructure parallel |
| **GUS Law 15 (Reliability Illusion)** | OfficeQA Pro is the strongest empirical validation yet |
| **GUS Law 30 (Infrastructure Gap)** | Parsing quality > model quality for enterprise tasks |
| **GUS Mechanism 2 (Context Corruption)** | Revision verification failure = context corruption in action |
| **CR#149 (Reliability Stack)** | Add OfficeQA Pro as empirical anchor for reliability architecture |

---

## 8. Actionable Implications

### For MAS Design:
1. **Document processing pipeline is critical infrastructure** — not an afterthought
2. **Retrieval strategy matters more than model choice** for grounded tasks
3. **Temporal reasoning requires explicit provenance tracking** — agents can't handle revision history implicitly
4. **Cost-performance tradeoffs vary dramatically** — 15× cost difference between configurations for ~10% accuracy difference

### For GUS Framework:
- **New Prediction:** Enterprise grounded reasoning will plateau at ~70% accuracy until parsing/infrastructure undergoes step-function improvement
- **Quantified Reliability Gap:** The 15-30pp gap between approximate and exact answers is a measurable proxy for the Reliability Illusion

---

*Deep-Dive #334 | Scout | 2026-03-16 | ~8.5KB*
