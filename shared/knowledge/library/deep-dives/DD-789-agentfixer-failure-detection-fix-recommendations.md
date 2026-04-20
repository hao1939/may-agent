# DD-789: AgentFixer — From Failure Detection to Fix Recommendations ★★★★

**Paper**: "AgentFixer: From Failure Detection to Fix Recommendations in LLM Agentic Systems"
**Authors**: Hadar Mulian, Sergey Zeltyn, Ido Levy, Liane Galanti, Avi Yaeli, Segev Shlomov (IBM Research)
**arXiv**: 2603.29848 | **Submitted**: 2026-03-24
**Fills**: Post-EXP-101 gap — Systematic validation framework with 15 failure-detection tools

---

## Core Finding

A comprehensive validation framework with **15 failure-detection tools** covering input handling, prompt design, and output generation can systematically diagnose and repair reliability failures in agentic systems. Key insight: **parsing-related incidents account for 38% of task failures** — the single largest failure category. The framework integrates rule-based checks with LLM-as-a-judge assessments for structured incident detection, classification, and repair.

## Key Technical Contributions

### 1. Fifteen Validation Tools Across Six Dimensions
- **Input-Prompt Compliance** (3 tools): Schema, instruction, format validation
- **System Prompt Analysis** (4 tools): Contradiction detection, example misalignment, edge-case coverage, few-shot diversity
- **Output-Prompt Compliance** (3 tools): Schema, instruction, format checking
- **Token-Level Anomalies** (2 tools): Unusual tokens, repetition detection (rule-based)
- **Code-Specific Validation** (1 tool): Python AST parsing
- **Cross-Stage Consistency** (2 tools): Information consistency, reasoning-action mismatch

### 2. Hybrid Rule-Based + LLM-as-Judge Architecture
Three tools are lightweight rule-based (regex, fuzzy matching, AST parsing) for efficiency. Twelve use LLM-as-judge for semantic assessment. This hybrid approach balances:
- Deterministic reliability (rule-based catches structural violations)
- Semantic understanding (LLM-based catches reasoning failures)

### 3. Reasoning-Action Mismatch Detector
Particularly relevant: identifies discrepancies between stated reasoning and final actions, outputting both binary mismatch indicator and continuous severity score [0.0, 1.0]. This is a **behavioral signal** — not what the agent says about its confidence, but whether its actions align with its stated reasoning.

### 4. Production Impact
Applied to IBM CUGA on AppWorld and WebArena:
- Surfaced controller indexing errors, planner misalignments, schema non-compliance
- Guided prompt refinements that enabled mid-sized models (Llama 4, Mistral Medium) to achieve near-frontier accuracy
- Maintained first-place WebArena ranking while reducing model costs

## Relevance to EXP-101 and Our Architecture

AgentFixer operates at a **different level** than DD#784-787. Those papers detect failures from trajectory patterns. AgentFixer detects failures from **output structure and reasoning-action alignment** — a complementary signal channel.

### Key Insight for Our Work
The **Reasoning-Action Mismatch Detector** is directly relevant as a metric:
- Measures whether stated reasoning actually leads to the executed action
- This is a form of behavioral coherence — not linguistic confidence, but reasoning-action alignment
- Could achieve higher AUROC than HVR because it measures internal consistency rather than self-reported uncertainty

### Connection to DD#781 (Confidence Dichotomy)
AgentFixer's approach of tool-type-aware validation (different checks for different output types) aligns with DD#781's finding that calibration varies by tool type.

## Implications

### For EXP-102 Design
1. **Implement reasoning-action mismatch scoring** — measure whether Bob's stated plan matches his actual tool calls
2. **Track output format compliance over time** — degradation in format compliance may precede task failure
3. **Cross-stage consistency as signal** — does the information flow coherently from input through reasoning to output?

### For Production Monitoring
- Rule-based tools (token repetition, unusual tokens, AST validation) are zero-cost always-on monitors
- LLM-as-judge tools could run asynchronously for post-hoc quality assurance
- The 38% parsing failure finding suggests structural output monitoring has high ROI

### New Metric Candidates
- **Reasoning-Action Alignment Score** (RAAS): Does the agent's stated reasoning lead to its actual actions?
- **Output Format Degradation Index** (OFDI): Are outputs becoming less structured over the session?
- **Cross-Stage Information Loss** (CSIL): How much information is lost/corrupted between steps?

## Ratings

| Dimension | Score |
|-----------|-------|
| Novelty | ★★★½ — Validation frameworks exist; comprehensiveness is the contribution |
| Rigor | ★★★★ — Production deployment on AppWorld/WebArena with measurable impact |
| Relevance to us | ★★★★ — Reasoning-action mismatch detector directly applicable |
| Actionability | ★★★★½ — Rule-based tools immediately deployable; LLM-judge tools need adaptation |

**Overall: ★★★★**

## Cross-References
- **EXP-101**: Reasoning-action mismatch is a non-linguistic behavioral signal alternative to HVR
- **DD#785**: TrajAD — trajectory-level complement; AgentFixer operates at step output level
- **DD#787**: Silent Failures — AgentFixer's cross-stage consistency can catch some silent failures
- **DD#788**: AgenTracer — diagnosis complement; AgentFixer adds prescriptive fixes
- **DD#781**: Confidence Dichotomy — tool-type-aware validation alignment
- **CR#343**: Monitoring Turn — AgentFixer represents the validation/enforcement layer

---
*Scout DD-789 | 2026-04-26 | Post-EXP-101 Behavioral Failure Prediction — Comprehensive Validation Framework*
