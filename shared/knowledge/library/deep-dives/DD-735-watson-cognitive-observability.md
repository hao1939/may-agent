# DD#735: Watson — Cognitive Observability for LLM Agent Reasoning via Prompt Attribution

**Paper**: "Watson: A Cognitive Observability Framework for the Reasoning of LLM-Powered Agents"  
**Authors**: Rombaut, Masoumzadeh, Vasilevski, Lin, Hassan  
**Source**: arXiv:2411.03455 (Nov 2024, rev Sep 2025)  
**Rating**: ★★★★ EXCELLENT  
**Date**: 2026-04-10  
**Scout**: Session 593 (CR#334 Agent Observability & Production Evaluation)

---

## Core Finding

**Cognitive observability — recovering the implicit reasoning behind agent decisions — is possible without altering agent behavior.** Watson retroactively infers reasoning traces using prompt attribution, enabling post-hoc analysis of *why* an agent made a specific decision, not just *what* it did. Evaluated on MMLU + AutoCodeRover/OpenHands on SWE-bench-lite.

## Key Mechanism: Prompt Attribution

### The Problem
Agents produce actions but not explanations. Chain-of-thought is unreliable (confabulated reasoning, rationalization). Asking agents to explain themselves alters their behavior. We need a non-intrusive way to understand agent reasoning.

### Watson's Approach
1. **Prompt Attribution**: For each agent decision, identify which parts of the input context most influenced the output
2. **Reasoning Recovery**: Reconstruct the implicit reasoning chain from attribution patterns
3. **Actionable Insights**: Surface specific reasoning steps that caused failures
4. **Targeted Intervention**: Fix the reasoning pattern, not just the output

### Key Results
- Successfully surfaces actionable reasoning insights from agent executions
- Supports targeted interventions (fix the cause, not the symptom)
- Non-intrusive: no modification to agent behavior during execution
- Complements AgentCompass (DD-734): cross-execution (AgentCompass) + within-execution (Watson) = full coverage

## Relevance to Our System

### The Evaluator's Fundamental Limitation
Our evaluator produces "session passed/failed" + quality score + failure mode labels. Watson shows the next level: **"failure at step N was caused by reasoning pattern X."** This is exactly what we lack for FM-3.3 diagnosis.

Example: When our evaluator flags FM-3.3 (verification confabulation), it knows the agent claimed verification without evidence. But it cannot tell us:
- Did the agent *intend* to verify and forget?
- Did the agent mistake narrative review for verification?
- Did time pressure cause the agent to skip verification?
- Did the agent's reasoning about what constitutes "verification" drift?

Watson's prompt attribution could answer these questions by identifying which context elements (task description, prior turn, system prompt, time pressure signals) dominated the decision to skip verification.

### Cognitive Observability as Missing Layer
AgentTrace (DD-736) taxonomizes three observability surfaces: operational, cognitive, contextual. Our system has:
- **Operational** ✅: Session transcripts capture every tool call and response
- **Contextual** ✅: context.md, heartbeat.md capture agent state and knowledge
- **Cognitive** ❌: We cannot see *why* the agent chose action A over action B

Watson fills the cognitive gap. Without it, our evaluation is permanently limited to behavioral observation — we can see what happened, but not the reasoning that caused it.

### From Symptom Treatment to Root Cause
Our intervention history shows repeated symptom treatment:
- FM-3.3 → add verification guard (KE-113: recovery, not prevention)
- FM-2.1 → add scope guard
- FM-3.3 recurrence → add more guards

Watson suggests an alternative: if we could identify the *reasoning pattern* that leads to FM-3.3, we could intervene at the cognitive level (prompt structure, context arrangement) rather than the behavioral level (guards, skills).

### Connections
- **KE-112**: "Verdicts lie" — Watson explains *why* they lie: evaluation lacks cognitive visibility
- **H-096**: Evaluation ceiling — cognitive observability is a necessary component to break through
- **KE-116**: 4-layer eval stack — Watson fills the "cognitive surface" gap in our architecture
- **DD-734**: AgentCompass provides cross-execution patterns; Watson provides within-execution reasoning attribution — complementary
- **KE-106/113**: Guards work by recovery, not prevention — Watson could enable prevention by targeting reasoning patterns

## Predictions

- **P-735a**: Adding prompt attribution to our evaluation would reveal distinct reasoning subtypes within FM-3.3 (at least 3 causal patterns)
- **P-735b**: Cognitive observability would show that most FM-3.3 is not "forgetting to verify" but "believing narrative review IS verification" — a classification error, not an omission
- **P-735c**: The cost of prompt attribution is high (~2-3× per evaluation) but the diagnostic value justifies selective deployment on flagged sessions
