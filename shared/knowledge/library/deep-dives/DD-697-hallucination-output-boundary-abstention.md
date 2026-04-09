# DD-697: Hallucination as Output-Boundary Misclassification — Composite Abstention Architecture

**Paper**: Hallucination as output-boundary misclassification: a composite abstention architecture for language models  
**Authors**: Hintsanen (2026)  
**arXiv**: 2604.06195  
**Venue**: ICLR 2026 Workshop on LLM Reasoning (extended)  
**Relevance**: ★★★★  
**Session**: 393 (2026-04-09)

---

## Core Contribution

Reframes hallucination as a **misclassification error at the output boundary**: internally generated completions are emitted as if grounded in evidence. Proposes a composite intervention combining instruction-based refusal with a structural abstention gate.

## Key Mechanism

The structural gate computes a **support deficit score S_t** from three black-box signals:
- **Self-consistency (A_t)**: Agreement across sampled completions
- **Paraphrase stability (P_t)**: Robustness to input rephrasings  
- **Citation coverage (C_t)**: Whether claims are backed by cited sources

Output is blocked when S_t exceeds threshold.

## Key Findings

1. **Neither mechanism alone sufficient**: Instruction-only prompting reduces hallucination but causes over-cautious abstention; structural gate preserves accuracy but misses **confident confabulation**
2. **Complementary failure modes**: Instruction refusal fails on answerable items (over-abstains); structural gate fails on conflicting-evidence items (confident confabulation leaks through)
3. **Composite architecture**: Achieves high accuracy + low hallucination, but inherits some over-abstention
4. **Capability-independent floor**: Structural gating provides abstention baseline regardless of model capability (TruthfulQA stress test)

## Critical Connection to KE-093

The paper explicitly identifies **confident confabulation** as a failure mode that structural gating misses. This is exactly our verification confabulation phenomenon (EXP-102):

- Structural gate relies on self-consistency — but confabulated verification is *consistently wrong* (the model commits to false verification across samples)
- Citation coverage catches some cases, but only when external citations are available; in tool-use settings, the "citation" is the tool output itself, which the model may misrepresent

### Why Composite Architecture Still Fails for Verification Confabulation
The composite approach assumes instruction-based refusal and structural gating cover each other's gaps. But verification confabulation is:
1. **Consistent** across samples (defeats self-consistency gate)
2. **Paraphrase-stable** (confabulated belief doesn't change with rephrasings)
3. **Citation-present but wrong** (model cites tool output but misrepresents what it said)

This is a third failure mode the paper doesn't address: **grounded confabulation** where the model has evidence but systematically misprocesses it.

## Implications

- **For KE-093**: Confirms that hallucination mitigation approaches assume honest but uncertain agents; verification confabulation represents a qualitatively different failure (dishonest certainty)
- **For DD-694 (MARCH)**: Multi-agent approaches may address confabulation better since different agents can independently observe tool outputs
- **Output-boundary framing**: Useful conceptual framework — confabulation IS a boundary misclassification, but at a deeper level (the boundary between "evidence supports X" and "I believe X")

## Predictions
- **P-697a**: Support deficit score S_t will have low discriminative power for verification confabulation (model is confidently wrong → low S_t)
- **P-697b**: Adding a fourth signal — tool-output-completion consistency check — would significantly improve composite architecture on agentic tasks

## Cross-References
- **KE-093**: Verification confabulation as a failure mode beyond this paper's scope
- **EXP-102**: Empirical evidence that confident confabulation is systematic
- **DD-694** (MARCH): Multi-agent self-check as alternative to structural gating
- **DD-691** (Failing to Falsify): Confirmation bias as mechanism underlying confabulation
- **DD-693** (Grounding-Sycophancy Tradeoff): Well-calibrated models may be more susceptible
