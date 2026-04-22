# DD-837: AgentProp-Bench — Tool-Use Error Propagation and Judge Reliability
**Paper:** Bhaskar Gurram, "Evaluating Tool-Using Language Agents: Judge Reliability, Propagation Cascades, and Runtime Mitigation in AgentProp-Bench" (2604.16706)
**Venue:** Under review at Information Processing & Management
**Rating:** ★★★★
**Date:** 2026-04-23

## Why This Matters

Two devastating findings: (1) **Substring-based judging of tool-using agents agrees with humans at κ=0.049 (chance-level)**. Most automated agent evals are measuring noise. (2) **Rejection and recovery are independent capabilities** (ρ=0.126, p=0.747) — a model that catches bad parameters is NOT the same model that recovers from accepted bad parameters. This has direct implications for our verification pipeline design.

## Core Findings

### Judge Reliability Crisis
- Substring matching (common in agent evals): κ=0.049 — **effectively random**
- Three-LLM ensemble: κ=0.432 — moderate, with conservative bias
- Implication: most reported agent benchmark results are unreliable

### Error Propagation
- Parameter-level injection → wrong final answer with p≈0.62 (range 0.46-0.73)
- Once a bad parameter is accepted into a tool call, it propagates to the final answer more often than not

### Independence of Rejection and Recovery
- **Rejection** = catching bad parameters before tool execution
- **Recovery** = correcting after a bad parameter is accepted
- These are **statistically independent** capabilities (ρ=0.126)
- Gemini-2.0-Flash: aggressive rejection, poor recovery — eliminates the failure mode entirely
- GPT-4o-mini: moderate rejection, benefits from runtime interceptor (-23pp hallucination)

### Model-Specific Mitigation
- Runtime interceptors help some models but not others — **mitigation must be model-aware**

## Connection Map

| Our Work | Connection |
|----------|-----------|
| DD#835 (ErrorProbe) | Complementary: ErrorProbe diagnoses errors post-hoc; AgentProp-Bench prevents them at runtime |
| DD#820 (logic verification) | Formal verification as an alternative to statistical tool-call validation |
| DD#827 (uncertainty triple) | Uncertainty detection could serve as a rejection signal for tool parameters |
| CR#348 (anti-sycophancy) | Judge unreliability = another form of evaluation collapse; ensemble judging partially addresses |

## Extractable Pattern: Separate Rejection from Recovery

Design verification systems with independent mechanisms for:
1. **Pre-execution rejection** (catch bad inputs before they propagate)
2. **Post-execution recovery** (detect and correct bad outputs after tool execution)

Don't assume one mechanism covers both. Staff them with different models if needed.

## Predictions

- **P-837a:** Switching from substring to ensemble-LLM judging in agent evals will change reported rankings for >30% of benchmarked models
- **P-837b:** Model-specific interceptor tuning will outperform universal interceptors by 15-20pp on error reduction
