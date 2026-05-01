# DD#552: AgentProp-Bench — Tool-Use Evaluation Reliability & Error Propagation

**Paper**: arXiv:2604.16706  
**Authors**: Bhaskar Gurram  
**Venue**: Under review, Information Processing & Management  
**Rating**: ★★★★★ CRITICAL  
**Date Covered**: 2026-04-21  
**Code**: https://github.com/bhaskargurram-ai/agenthallu-bench  

## Why This Matters

This paper demolishes the assumption that automated evaluation of tool-using agents is reliable. Substring-based judging achieves **κ=0.049** agreement with humans — literally chance level. Even a three-LLM ensemble only reaches κ=0.432 (moderate). If you're evaluating tool-using agents with automated judges, your results are likely meaningless.

## Key Findings

### 1. Judge Reliability is Abysmal
- **Substring matching** (the most common eval): κ=0.049 (chance)
- **Three-LLM ensemble**: κ=0.432 (moderate) with conservative bias
- Implication: Most published agent benchmarks using automated judges have unreliable results

### 2. Error Propagation is Severe
- A parameter-level injection propagates to wrong final answer with **probability ~0.62** (range 0.46-0.73)
- This means a single bad tool parameter corrupts the final output more often than not

### 3. Rejection ≠ Recovery (Independent Capabilities!)
- **Rejection**: Catching bad parameters before execution
- **Recovery**: Correcting after accepting bad parameters
- Spearman ρ=0.126, p=0.747 — **completely independent**
- A model good at catching errors is NOT necessarily good at recovering from them
- Gemini-2.0-Flash: aggressive rejection makes runtime interceptors unnecessary
- GPT-4o-mini: benefits from runtime interceptor (−23pp hallucination)

### 4. Model-Specific Defense Profiles
- Runtime interceptors help some models but not others
- Defense strategies must be **model-aware**, not universal

## Benchmark Design: 2,000 Tasks, 2,300 Traces

- 4 domains, 9 production LLMs
- 100-label human-validated subset (the gold standard)
- All traces released — rare transparency

## Connection to Our Architecture

| Finding | Implication for Our System |
|---|---|
| κ=0.049 for substring eval | Our automated quality checks may be unreliable — need execution-based verification |
| Rejection ≠ Recovery | Need separate monitoring for "did we catch errors?" vs "did we recover from missed errors?" |
| P(propagation) = 0.62 | Tool call parameter validation is critical — majority of errors cascade |
| Model-specific defense profiles | Can't use one-size-fits-all guardrails across different LLM backends |

## Connection to Prior Work

- **DD#551 (ErrorProbe)**: ErrorProbe's execution-based verification directly addresses the κ=0.049 problem
- **DD#543 (Schema-First Tool APIs)**: Schema reduces interface misuse but not semantic misuse — AgentProp-Bench quantifies the propagation cost of semantic errors
- **CR#293 (Read:Edit Ratio)**: Read:Edit ratio is a behavioral signal that doesn't suffer from the judge reliability problem — it's measured, not judged
- **DD#528 (SEVerA)**: Formal output contracts bypass the unreliable judge problem entirely

## Actionable Takeaways

1. **Stop trusting automated judges** for tool-use evaluation without human validation
2. **Separate rejection monitoring from recovery monitoring** — they're independent capabilities
3. **Validate tool parameters before execution** — 62% propagation rate means most bad params corrupt outputs
4. **Model-aware defense** — test runtime mitigations per-model, not universally

## Predictions

- **P325**: Within 12 months, major agent benchmarks will require human-validated subsets as a credibility standard
- **P326**: Execution-based evaluation (run the output, check the result) will replace LLM-as-judge for tool-use tasks

## Recommendations

- **R64 (Evaluator)**: Audit all automated eval pipelines for judge reliability — measure κ against human annotations on a sample
- **R65 (Tech-lead)**: Implement parameter-level validation on tool calls — intercept before execution, not after
- **R66 (Bob)**: Design separate rejection and recovery metrics for agent monitoring dashboards
