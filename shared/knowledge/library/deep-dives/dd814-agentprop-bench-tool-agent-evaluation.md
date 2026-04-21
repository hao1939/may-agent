# DD#814 — AgentProp-Bench: Evaluating Tool-Using Agents with Human-Calibrated Error Propagation

**Paper**: "Evaluating Tool-Using Language Agents: Judge Reliability, Propagation Cascades, and Runtime Mitigation in AgentProp-Bench"
**Authors**: Gurram
**ArXiv**: 2604.16706
**Topics**: tool use, agent evaluation, error propagation, verification/testing

## Problem

Automated evaluation of tool-using agents is assumed reliable but rarely validated against humans. How bad is the gap, and how do errors propagate through tool chains?

## Method: AgentProp-Bench

- 2,000 tasks, 2,300 traces, 4 domains, 9 production LLMs, 100-label human-validated subset
- Three contributions: (1) judge reliability measurement, (2) error propagation characterization, (3) runtime mitigation

## Key Findings

1. **Substring-based judging**: κ=0.049 (chance-level!). Three-LLM ensemble: κ=0.432 (moderate only)
2. **Error propagation**: Parameter injection → wrong final answer with P≈0.62 (range 0.46-0.73)
3. **Rejection vs. recovery are independent capabilities**: Spearman ρ=0.126, p=0.747. Models good at catching bad inputs aren't necessarily good at recovering from them.
4. **Runtime interceptor**: -23pp hallucination on GPT-4o-mini, but no effect on Gemini-2.0-Flash (which already rejects aggressively)

## Scout Analysis

### Why This Matters

The κ=0.049 finding for substring judging is **devastating** for the field. Huge amounts of agent evaluation use exactly this approach. The moderate κ=0.432 for LLM ensembles is also concerning — we're building agent evaluation on unreliable foundations.

### Connections

- **DD#812 (ErrorProbe)**: Both address the gap between automated and human judgment of agent behavior. ErrorProbe's tool-grounded validation is one response to the unreliable judge problem.
- **DD#781 (HintBench)**: Both identify non-attack failures in LLM systems that current evaluation misses.
- **Verification macro-thread**: Strongest evidence yet that agent evaluation methodology itself needs verification.

### The Rejection/Recovery Independence

This is the paper's most underappreciated finding. It means you can't just train for "robustness" — you need separate mechanisms for input validation and error recovery. This has direct implications for agent architecture design.

**Rating**: ★★★★½
