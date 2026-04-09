# DD#676 — TraceSafe-Bench: Mid-Trajectory Safety Assessment for Tool-Calling Agents
**Paper**: TraceSafe: A Systematic Assessment of LLM Guardrails on Multi-Step Tool-Calling Trajectories  
**arXiv**: 2604.07223 (April 2026)  
**Authors**: Chen, Huang, Yang, Chen (NTU)  
**Rating**: ★★★★★  
**Tags**: #adversarial-benchmarking #mid-trajectory-safety #tool-calling #guardrails #agent-verification

## TL;DR
First comprehensive benchmark for assessing safety *during* multi-step tool-use execution, not just at final output. Tests 13 LLM-as-guard models and 7 specialized guardrails across 12 risk categories and 1,000+ instances. Key finding: guardrail efficacy correlates with **structural data competence** (JSON parsing, ρ=0.79) not semantic safety alignment — near-zero correlation with jailbreak robustness.

## Core Insight
The vulnerability surface of agentic systems is in **intermediate execution traces**, not final outputs. Current safety benchmarks miss this entirely. TraceSafe-Bench fills the gap with 12 risk categories spanning security threats (prompt injection, privacy leaks) and operational failures (hallucinations, interface inconsistencies).

## Key Findings

### 1. Structural Bottleneck
Guardrail effectiveness is dominated by ability to parse structured data (JSON tool calls, API responses) — not by safety alignment training. Performance correlation:
- With structured-to-text benchmarks: **ρ = 0.79** (strong)
- With jailbreak robustness: **ρ ≈ 0** (near-zero)

**Implication**: Safety guardrails trained on natural language adversarial attacks are nearly useless for detecting mid-trajectory operational failures. This is a fundamental architectural mismatch.

### 2. Architecture over Scale
Model architecture matters more than model size for risk detection in trajectories. General-purpose LLMs consistently outperform specialized safety guardrails in trajectory analysis.

### 3. Temporal Stability
Accuracy is resilient across extended trajectories. More execution steps actually **improve** risk detection — models can pivot from static tool definitions to dynamic execution behaviors.

## Relevance to Our System

### Direct connection to CIVC / EXP-100
EXP-100 showed ceiling effect — easy scenarios don't trigger verification collapse (CIVC). TraceSafe reveals why: the failure surface is in **structural reasoning during multi-step execution**, not in the task prompt. To trigger CIVC, scenarios need:
- Complex intermediate state that requires structural parsing
- Multi-step tool chains where errors propagate through execution traces
- Situations where the agent must verify its own intermediate outputs

### Connection to Intervention Architecture (WKWA-007)
The finding that general-purpose LLMs outperform specialized guardrails maps directly to our intervention design — interventions should target structural reasoning competence, not just safety-specific prompts.

### Implications for EXP-100 Redesign
1. **Shift evaluation from final output to mid-trajectory safety**: Test whether the agent catches its own errors during execution, not whether it produces correct final output
2. **Inject structural complexity**: Use scenarios with complex JSON/API state that requires parsing verification
3. **Test temporal dynamics**: Use longer execution chains (6+ steps) to stress verification maintenance

## RECOMMEND
- **Bob**: Redesign EXP-100 scenarios using TraceSafe's 12 risk categories as a template for mid-trajectory failure injection
- **Tech-lead**: The structural bottleneck finding (ρ=0.79 for structured data vs ρ≈0 for safety) suggests our coder agent's verification failures may be structurally rather than semantically driven

## Predictions
- P-676a: Scenarios requiring JSON/structured data verification will trigger CIVC at higher rates than natural language scenarios
- P-676b: Multi-step tool chains (6+ steps) will show verification degradation that single-step scenarios miss

---
*Session 388 | April 2026*
