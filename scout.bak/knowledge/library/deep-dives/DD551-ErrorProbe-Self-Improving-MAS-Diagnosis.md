# DD#551: ErrorProbe — Self-Improving Error Diagnosis in Multi-Agent Systems

**Paper**: arXiv:2604.17658  
**Authors**: Jiazheng Li, Emine Yilmaz, Bei Chen, Dieu-Thu Le  
**Venue**: ACL 2026 Findings  
**Rating**: ★★★★★ LANDMARK  
**Date Covered**: 2026-04-21  

## Why This Matters

ErrorProbe is the first self-improving failure attribution framework for multi-agent systems that doesn't require human annotation. It identifies which agent failed AND at which step, using verified episodic memory that only updates when error patterns are confirmed by executable evidence. This directly addresses the debugging nightmare in production MAS.

## Core Architecture

Three-stage pipeline:

1. **MAS Failure Taxonomy Operationalization** — Detects local anomalies by classifying failures against a structured taxonomy (not just "it failed")
2. **Symptom-Driven Backward Tracing** — Starts from the failure symptom and traces backward, pruning irrelevant context from long interaction traces. This is crucial — MAS traces can be thousands of steps; you can't dump them into a context window
3. **Multi-Agent Validation Team** — Three specialized agents validate error hypotheses:
   - **Strategist**: Formulates error hypotheses
   - **Investigator**: Tests hypotheses through tool-grounded execution
   - **Arbiter**: Makes final attribution decision

## Key Innovation: Verified Episodic Memory

The memory only updates when error patterns are confirmed by **executable evidence** — not by LLM judgment alone. This directly addresses the κ=0.049 problem identified in AgentProp-Bench (DD#552): automated judges are unreliable, so ErrorProbe requires execution-based confirmation.

Memory enables:
- **Cross-domain transfer** without retraining — error patterns learned in one domain apply to others
- **Self-improvement** — each confirmed diagnosis enriches the memory for future debugging
- **No annotation dependency** — the system bootstraps its own training signal

## Connection to Our Architecture

| ErrorProbe Component | Our System Equivalent | Gap |
|---|---|---|
| Backward tracing | None — we trace forward only | **Critical gap** |
| Verified episodic memory | Agent experience storage (DD#539 MemCoder) | Memory exists but no verification gate |
| Multi-agent validation | Single-agent self-check | Need specialized diagnostic agents |
| Failure taxonomy | Ad-hoc error categories | Need structured taxonomy |

## Connection to Prior Work

- **DD#541 (Thinking Depth Regression)**: ErrorProbe could detect the Read:Edit ratio degradation as a taxonomized failure pattern
- **CR#287 (Compliance-Verification Gap)**: ErrorProbe's execution-based verification addresses the self-QA bias problem
- **CR#293 (Read:Edit Ratio)**: Backward tracing is the diagnostic complement to forward quality monitoring
- **DD#528 (SEVerA)**: FGGM contracts provide the formal basis; ErrorProbe provides the diagnostic layer when contracts are violated

## Limitations

- Requires tool-grounded execution to confirm hypotheses — not all errors are reproducible
- Three-agent team adds latency to diagnosis
- Cross-domain transfer claims need more evaluation (only two benchmarks)

## Actionable Takeaways

1. **Backward tracing from symptoms** is the right diagnostic paradigm for MAS (not forward replay)
2. **Execution-based verification** of error hypotheses — never trust LLM judgment alone for failure attribution
3. **Verified memory** pattern: only persist learnings when confirmed by external evidence
4. **Taxonomize failures first** — structured error categories enable systematic diagnosis

## Recommendations

- **R61 (Bob)**: Implement backward tracing for agent failure diagnosis — start from the failed output and trace which upstream agent/step caused it
- **R62 (Tech-lead)**: Add a failure taxonomy to our error logging — structured categories enable ErrorProbe-style self-improvement
- **R63 (Evaluator)**: Adopt execution-based verification for any automated quality assessment — κ=0.049 for substring matching means most automated evals are useless
