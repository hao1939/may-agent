# Deep Dive: NabaOS — Tool Receipts for Practical Agent Hallucination Detection

**Paper:** arXiv:2603.10060
**Title:** Tool Receipts, Not Zero-Knowledge Proofs: Practical Hallucination Detection for AI Agents
**Author:** Abhinaba Basu
**Date:** 2026-03-09
**License:** CC BY 4.0
**Categories:** cs.CR, cs.AI, cs.CL

## Summary

NabaOS is a lightweight agent verification framework that detects hallucinated tool use claims by generating HMAC-signed "tool execution receipts" at the runtime layer, then cross-referencing LLM output claims against those receipts. The framework draws on Indian epistemology (Nyāya Śāstra) to classify every claim by its epistemic source rather than producing a binary verified/unverified judgment.

## Core Architecture

### The Receipt System

When an LLM agent requests a tool call, the **runtime** (not the LLM) executes the tool and generates a signed receipt:

```
ToolReceipt {
  id:           UUID,
  tool_name:    "email_search",
  input_hash:   SHA-256(canonical JSON of input parameters),
  output_hash:  SHA-256(raw output),
  result_count: 3,
  facts:        {sender: "Alice", subject: "Deadline update"},
  timestamp_ms: 1708300000000,
  duration_ms:  150,
  signature:    HMAC-SHA256(id|tool_name|input_hash|output_hash|timestamp_ms, SECRET_KEY)
}
```

**Four critical properties:**
1. **Unforgeability:** LLM doesn't have the HMAC signing key. Can't construct valid receipts.
2. **Tamper detection:** Signature covers receipt fields. Any modification (e.g., changing result_count) invalidates it.
3. **Completeness:** One receipt per tool call. Enables detection of both fabricated calls (ID doesn't exist) and omitted calls (receipt exists but unreferenced).
4. **Auditability:** Full execution history for post-hoc review.

### Pramāṇa Classification (Epistemic Source Tagging)

Every claim is classified into one of six categories:

| Category | Source | Verification Method | Confidence |
|----------|--------|-------------------|------------|
| Pratyakṣa | Direct tool output | Check against receipt | Highest |
| Anumāna | Inference from tool data | Check premises exist | Medium |
| Upamāna | Analogy/comparison | Check comparison valid | Lower |
| Śabda | External source cited | Check source was fetched | Depends |
| Abhāva | Absence claim | Check tool returned empty | Medium |
| Ungrounded | No evidence | Cannot verify—flag | Lowest |

**Key insight:** This is strictly more informative than binary verified/unverified. Example: "Alice seems stressed about the project" — a binary system must either verify (wrong — not in tool output) or reject (also wrong — it's a valid inference). Pramāṇa labels it anumāna (inference), communicating epistemic status without suppressing useful information.

### Verification Protocol (6 Stages)

1. User request → 2. Tool execution + receipt generation → 3. LLM call (with receipt IDs, NOT signing key) → 4. LLM response with self-classification tags → 5. Verification engine cross-checks → 6. Trust-annotated output to user

### Self-Tagging Prompt

The LLM is instructed to emit structured metadata classifying each claim:
```
---VERIFICATION---
For each factual claim in your response, classify:
- claim: "the statement"
- source_type: tool_output | inference | external_source | absence | opinion
- evidence: which tool receipt ID supports this
- checkable: true/false
---END VERIFICATION---
```

Compliance rates: ~92% Claude, ~88% GPT-4, ~85% open-weight models. Non-compliant responses treated as entirely ungrounded (conservative fallback).

**Important:** Self-tagging is cooperative, not adversarial-robust. But even without self-tags, receipt-based checks still catch fabricated tool calls, count mismatches, and false absences.

### Deep Agent Cross-Checking

For autonomous agents where runtime doesn't control internal tool calls (e.g., web browsing agents), 5 strategies:
1. Schema validation (structural anomaly detection)
2. URL re-fetching (independent verification)
3. Computation replay (deterministic re-execution)
4. Temporal consistency (date/time plausibility)
5. Cross-source verification (independent corroboration)

Adds 200-500ms vs <15ms for receipt-based. Reserved for cases where receipts unavailable.

## Benchmark: NyayaVerifyBench

- **1,800 scenarios:** 1,200 with injected hallucinations, 600 clean controls
- **4 languages:** English, Hindi, Mandarin Chinese, Spanish (300 hallucinated + 150 clean per language)
- **6 hallucination types:** Fabricated Tool Call, Count Mismatch, Fact Mismatch, Inference-as-Fact, False Absence, Source Fabrication (50 each per language)
- **Inter-annotator agreement:** κ=0.87 (Cohen's kappa, pairwise averaged)

## Key Results

### Main Results (Table 3)

| Method | Detection Rate | FPR | Latency | Cost/req |
|--------|---------------|-----|---------|----------|
| No Verification | 0% | 0% | 0 ms | $0 |
| Self-Consistency | 45% | 12% | +3-5s | +$0.03 |
| RAG-Grounding | 52% | 18% | +1-2s | +$0.01 |
| Output Regex | 35% | 8% | +2 ms | $0 |
| SVIP-style | 68% | 10% | +50 ms | $0 |
| **NabaOS** | **91%** | **4%** | **+12 ms** | **$0** |

### Detection by Hallucination Type

| Type | NabaOS | Self-Cons. | SVIP | Regex |
|------|--------|-----------|------|-------|
| Fabricated Tool Call | **94.2%** | 38% | 65% | 20% |
| Count Mismatch | 87.6% | 52% | 71% | 45% |
| Fact Mismatch | 89.1% | 41% | 68% | 30% |
| Inference-as-Fact | 82.3% | 55% | 72% | 15% |
| False Absence | 91.3% | 35% | 60% | 25% |
| Source Fabrication | 78.4% | 48% | 58% | 12% |

**Strengths:** Fabricated tool calls (94.2%) and false absences (91.3%) are deterministically verifiable via receipt lookup.
**Weaknesses:** Inference-as-fact (82.3%) depends on self-tagging compliance. Source fabrication (78.4%) requires network calls.

### Multilingual Stability

| Method | EN | HI | ZH | ES | Avg |
|--------|-----|-----|-----|-----|-----|
| NabaOS | 92.8% | 90.1% | 88.7% | 91.5% | 90.8% |
| SVIP-style | 72.4% | 58.3% | 55.1% | 64.7% | 62.6% |
| Self-Consistency | 48.2% | 39.7% | 36.8% | 43.1% | 42.0% |

**NabaOS varies only 4.1pp across languages** (vs 17.3pp SVIP, 11.4pp Self-Consistency). Language-independence is architectural: receipts operate on structured data, not text.

### Trust Calibration

| Trust Level | Actual Correctness | Calibration Error |
|-------------|-------------------|-------------------|
| Fully Verified | 98.7% | 1.3% |
| Mostly Verified | 94.2% | 3.1% |
| Partial | 82.5% | 5.8% |
| Unreliable | 23.4% | N/A (correctly flagged) |
| Ungrounded | 71.2% | N/A (opinion) |

Trust levels are monotonically calibrated — higher trust = higher correctness. Residual 1.3% at "Fully Verified" = cases where the **tool itself** returned wrong data (outside NabaOS scope).

## Critical Assessment

### Strengths

1. **Architectural elegance:** The key insight (runtime generates receipts, LLM can't forge them) is simple, sound, and immediately implementable. No ML training needed.
2. **Latency:** <15ms overhead is negligible. Practically free verification for interactive agents.
3. **Language independence:** Structured receipt comparison is fundamentally immune to cross-lingual variation.
4. **Composability:** NabaOS + ZK proofs = both computational integrity AND semantic grounding. Orthogonal to text-based hallucination detection (RAG, self-consistency).
5. **Epistemic classification > binary labels:** Preserving valid inferences while flagging ungrounded claims is genuinely more useful than verified/unverified.
6. **Constitution-gated verification:** Configurable strictness per deployment context (trading bot vs casual assistant) is practical.

### Weaknesses & Limitations

1. **Self-tagging is cooperative:** An adversarially fine-tuned model could label all claims as tool_output. The paper acknowledges this but doesn't solve it — inference-as-fact detection degrades to heuristic comparison.
2. **Synthetic benchmark only:** NyayaVerifyBench uses systematically injected hallucinations. Real-world hallucinations are subtler and more varied. No real-world deployment evaluation.
3. **Single author, no code release mentioned:** Paper doesn't reference a GitHub repo or implementation. Hard to assess reproducibility.
4. **Limited fact extraction scope:** The `facts` field in receipts is tool-adapter-specific. Complex tool outputs (e.g., a full document search) may not have clean key-value extractions, reducing fact mismatch detection.
5. **Cross-checking latency:** 200-500ms for deep agent verification is acceptable but undermines the "practically free" narrative for autonomous agents — which is where hallucination is most dangerous.
6. **No adversarial evaluation:** No testing against models specifically fine-tuned or prompted to evade receipt-based verification. The threat model explicitly excludes "systematic self-tag deception."
7. **Compliance variability:** 85% self-tagging compliance for open-weight models means 15% of responses are conservatively marked ungrounded — high false-alarm rate in practice.

### What's Missing

- **Receipt chaining for multi-step tool use:** If Tool A's output feeds into Tool B's input, can the system verify the chain? Not addressed.
- **Temporal validity:** Receipts are timestamped but there's no discussion of receipt expiry or staleness detection for long-running agent sessions.
- **Comparison to AttriGuard (2603.10749):** AttriGuard's causal attribution approach is the most direct competitor — both verify at the execution level, not the text level. A comparison would be illuminating. AttriGuard is stronger against adaptive attacks but more expensive (requires counterfactual re-execution).

## Connections to Our Archive

### Direct Connections
- **AttriGuard (2603.10749):** Both verify execution-level claims. AttriGuard uses counterfactual causal attribution; NabaOS uses receipt comparison. AttriGuard is more adversarially robust but 10-100× more expensive. **Complementary:** NabaOS for fast interactive checks, AttriGuard for high-stakes autonomous agent verification.
- **JRH/Judge Reliability Harness (2603.05399):** NabaOS verifies agent claims; JRH verifies evaluator reliability. Both address trust calibration. NabaOS's epistemic classification could be applied to evaluator outputs — classify evaluator judgments by their evidentiary basis.
- **Bias-Bounded Eval (2603.05485):** Both produce calibrated confidence signals rather than binary judgments. NabaOS does it for agent outputs; BB-Eval does it for evaluator scores.
- **IH-Challenge (2603.10521):** Instruction hierarchy prevents prompt injection that could cause tool fabrication. IH-Challenge trains models not to hallucinate when given conflicting instructions. NabaOS detects when they do anyway. **Defense in depth:** IH training (prevention) + NabaOS receipts (detection).
- **Privacy Control (2603.05520):** Receipts create an audit trail that could amplify information leakage in sequential pipelines. Privacy considerations for receipt storage and transmission.
- **Bureaucracy of Speed (2603.09875):** Operation-bounded credentials from BoS could be implemented AS tool receipts — each receipt = one operation credential consumed.
- **DPIP Common Ground (2603.05450):** Epistemic classification addresses part of the common ground problem — making explicit what the agent knows from direct observation vs inference.
- **AgenticCyOps (2603.09134):** NabaOS receipts implement AgenticCyOps P3 (verified execution) directly.

### MAS Security Cluster Placement
NabaOS fills the **"verification layer"** in our security cluster:
- Structural (AgenticCyOps, Layered Governance)
- Formal (Bureaucracy of Speed, Privacy Control)
- Stability (Chaotic Dynamics)
- Defense (HAE, AttriGuard)
- Testing (ConflictBench)
- Coordination (DPIP)
- **Verification (NabaOS)** ← NEW

## Actionable Takeaways for Our System

### 1. Implement receipt-based tool verification (HIGH PRIORITY)
Our agent system already has a runtime layer that dispatches tool calls. Adding HMAC-signed receipts is straightforward:
- Generate UUID + hash inputs/outputs + sign with runtime-only key
- Store receipt ledger per session
- After LLM response, compare claims against ledger
- **Immediate win:** Detect fabricated tool calls with 94.2% accuracy at <15ms

### 2. Add epistemic source tagging to delegation responses
When sub-agents (Coder, QA, Scout) report results to May, classify claims:
- Direct output (e.g., "test passed") → pratyakṣa
- Inference (e.g., "code looks correct") → anumāna
- External reference (e.g., "per documentation...") → śabda
- Negative result (e.g., "no bugs found") → abhāva
This helps May weight sub-agent reports appropriately.

### 3. Constitution-gated verification for different contexts
- Code generation: standard mode (warn on mismatches)
- Security-sensitive ops: paranoid mode (block on unresolved contradictions)
- Research/exploration: permissive mode (flag but don't block)

### 4. Cross-check protocol for Scout's web research
When Scout (me) reports findings from web scraping, apply NabaOS-style cross-checking:
- URL re-fetching to verify cited pages exist
- Computation replay for any quantitative claims
- Temporal consistency for dates and versions

### 5. Hybrid with AttriGuard for high-stakes verification
- Receipt-based (NabaOS): fast, cheap, deterministic. Use for all agent responses.
- Causal attribution (AttriGuard): expensive, adversarially robust. Use for security-critical tool invocations or when NabaOS flags suspicion.

### 6. Receipt chaining for multi-agent pipelines
Extend receipt concept: when May delegates to Coder, Coder's output receipt becomes input evidence for May's response. Chain of receipts = provenance trail through entire delegation pipeline. Connects to Bureaucracy of Speed's operation-bounded credentials.

## Quality Assessment

**Paper quality:** 7/10. Well-written, clear architecture, good experimental design with multilingual coverage. The Nyāya epistemology framing is elegant and substantive, not just decorative. However, single author, no code release, synthetic-only benchmark, and no adversarial evaluation limit confidence in real-world applicability.

**Novelty:** 8/10. The receipt concept is simple but the systematic execution-level verification framework + epistemic classification is genuinely new. No prior work combines HMAC receipts with pramāṇa-style claim classification.

**Applicability to our system:** 9/10. This is immediately implementable. The runtime receipt pattern requires zero ML training, zero external dependencies, and adds negligible latency. The biggest bang-for-buck verification technique in our entire archive.

**Deep-dive date:** 2026-03-12
**Deep-dive #:** 30
