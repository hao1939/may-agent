# Trace Inversion: Detecting When LLMs Answer the Wrong Question

**Source**: arXiv:2604.02230 (April 2, 2026)  
**Title**: Answering the Wrong Question: Reasoning Trace Inversion for Abstention in LLMs  
**Authors**: Abinitha Gourabathina, Inkit Padhi, Manish Nagireddy, Subhajit Chaudhury, Prasanna Sattigeri (IBM Research)

## Core Problem

Reasoning models show impressive performance on complex tasks but have **worse abstention abilities** than non-reasoning models. When they fail to abstain appropriately, they often hallucinate — but these hallucinations can be reinterpreted as answering the **wrong question** rather than answering incorrectly.

## Query Misalignment Framework

The paper proposes a new way to understand LLM failures:
- Traditional view: Model answers the question incorrectly
- New view: Model answers a *different* question than what was asked

This shift enables a new class of abstention methods called **Trace Inversion**.

## Trace Inversion Method

Three-step process:

1. **Generate reasoning trace**: Let the model produce its chain-of-thought
2. **Reconstruct query**: Based *only* on the trace, determine what question the model appears to be answering
3. **Compare**: Low similarity between original query and reconstructed query → flag for abstention

## Key Results

- Tested on 4 frontier LLMs across 9 abstention QA datasets
- Beats competitive baselines in **33 out of 36 settings**
- Works specifically well with reasoning models that produce explicit traces

## Why This Matters for Our System

**Agent Reliability Layer**:
- Our L4 reasoning layer could implement trace inversion as a hallucination detector
- Before finalizing an answer, compare: "Did I actually answer what was asked?"
- This could trigger abstention or escalation when query misalignment detected

**Self-Correction Loop**:
- Agent generates response → reconstructs implied query → compares to original
- If mismatch > threshold → retry with clarified understanding
- Prevents "confident but wrong" failures

**Evaluation Method**:
- Trace inversion could evaluate our own Agent outputs
- Reference-free quality assessment without ground truth

## Implementation Sketch

```
Original Query → Agent → Reasoning Trace → Reconstruct Implied Query
                                                    ↓
                                              Similarity Score
                                                    ↓
                            High Similarity ←─────┼─────→ Low Similarity
                                  ↓                        ↓
                           Output Answer            Abstain / Retry
```

## Related Work

- Complements uncertainty-based methods (like ASK paper arXiv:2604.02226)
- Different approach: uses trace analysis vs. statistical uncertainty
- Could combine both for robust abstention

## Source

- arXiv: https://arxiv.org/abs/2604.02230
- PDF: https://arxiv.org/pdf/2604.02230

---
*Archived: 2026-04-03 | HB-0114*
