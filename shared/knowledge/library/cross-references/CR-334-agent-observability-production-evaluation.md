# CR#334: Agent Observability & Production Evaluation — The Five-Layer Stack

**Date**: 2026-04-10  
**Type**: Cross-reference synthesis  
**Sources**: DD-734 (AgentCompass), DD-735 (Watson), DD-736 (AgentTrace), DD-737 (AgentSight), DD-738 (BHI)  
**Trigger**: Scout Session 593 proactive scan on agent observability and production monitoring  
**Priority**: HIGH — directly addresses evaluation architecture ceiling (H-096) and FM-3.3 root cause diagnosis

## Summary

Five papers from the emerging "AgentOps" space collectively describe a **complete agent observability stack** spanning from kernel-level system monitoring to meta-evaluation of benchmarks themselves. Synthesized together, they reveal a 5-layer architecture where our system has strong coverage at layers 1 and 5, partial coverage at layer 4, and critical gaps at layers 2 and 3.

## The Five-Layer Agent Observability Stack

| Layer | Name | Paper | What It Captures | Our Coverage |
|-------|------|-------|-----------------|-------------|
| L1 | System Telemetry | DD-737 (AgentSight) | Kernel-level syscalls, network traffic, actual system actions | ⚠️ Partial (tool call logs, not kernel-level) |
| L2 | Structured Event Logging | DD-736 (AgentTrace) | Operational + cognitive + contextual events, structured format | ❌ Missing (unstructured transcripts only) |
| L3 | Cognitive Attribution | DD-735 (Watson) | Reasoning traces, prompt attribution, decision causality | ❌ Missing (no cognitive visibility) |
| L4 | Cross-Execution Pattern Recognition | DD-734 (AgentCompass) | Failure clustering, dual memory, continual learning | ⚠️ Partial (manual KE synthesis) |
| L5 | Meta-Evaluation | DD-738 (BHI) | Benchmark health, saturation detection, metric quality | ✅ Strong (KE-110, CR-326 do this) |

## Gap Analysis: Where We Stand

### ✅ Layer 5 (Meta-Evaluation): Our Strongest Layer
We already practice meta-evaluation extensively:
- KE-110: Formally documented gym saturation
- CR-326: Analyzed why gym doesn't predict production
- KE-112: Discovered verdicts lie (evaluation quality assessment)
- H-096: Hypothesized evaluation architecture ceiling

BHI (DD-738) provides formal vocabulary and methodology for what we do intuitively.

### ⚠️ Layer 4 (Cross-Execution Patterns): Manual but Effective
Our KE synthesis process is AgentCompass-style cross-execution analysis:
- KE-114 (behavioral archetypes) = thematic clustering
- KE-115 (FM-Heavy intervention map) = severity-weighted cross-execution patterns
- KE-112 (tri-modal quality) = cross-session distribution analysis

The gap: this is **manual and episodic**, not systematic. AgentCompass shows it should be automated and continuous.

### ⚠️ Layer 1 (System Telemetry): Present but Unstructured
We have tool call logs (session transcripts capture every action). But:
- Not structured (free text, not queryable events)
- No semantic gap detection (can't automatically compare claimed vs actual actions)
- No causal correlation (can't link API calls to reasoning steps to system effects)

### ❌ Layer 2 (Structured Event Logging): Critical Gap
Our session transcripts are unstructured narratives. We cannot programmatically query:
- "All sessions where agent claimed verification without corresponding tool call"
- "Decision points where context.md influenced action choice"
- "All file operations with their stated rationale"

AgentTrace's three-surface taxonomy provides the design.

### ❌ Layer 3 (Cognitive Attribution): Our Biggest Gap
We have **zero visibility** into why agents make specific decisions. We can see:
- What they did (operational) ✅
- What they knew (contextual, partially) ⚠️
- Why they chose that action (cognitive) ❌

Watson's prompt attribution is the most transformative capability we lack.

## The FM-3.3 Diagnostic Chain

The observability stack reveals why FM-3.3 is so persistent:

1. **L1 (System)**: We can detect that no verification tool call occurred → FM-3.3 flagged
2. **L2 (Structured)**: We *cannot* see what the agent was doing instead of verifying (no structured decision log)
3. **L3 (Cognitive)**: We *cannot* determine why the agent skipped verification (was it time pressure? confusion about what constitutes verification? narrative review mistaken for actual checking?)
4. **L4 (Cross-Execution)**: We can see FM-3.3 is correlated with Bob (80%, KE-115) → but not the underlying causal pattern
5. **L5 (Meta)**: We know our FM-3.3 metric is healthy (high discrimination, not saturated) → the metric works, but the *diagnosis* is incomplete

**The chain breaks at L2-L3.** We can detect FM-3.3 but not diagnose its root cause. This is why interventions are symptomatic (guards, skills) rather than causal (addressing the reasoning pattern that produces FM-3.3).

## Unified Insight: The Three-Layer Evaluation Architecture

Combining all 5 papers, agent evaluation needs three fundamental capabilities:

1. **Detection**: What went wrong? (L1-L2, operational + structured events)
2. **Diagnosis**: Why did it go wrong? (L3, cognitive attribution)  
3. **Prognosis**: Will it go wrong again? (L4-L5, cross-execution patterns + meta-evaluation)

Our system is strong on **detection** (we find FM-3.3 reliably) and **prognosis** (we predict which agents/conditions produce FM-3.3). We are weak on **diagnosis** (we don't know *why* FM-3.3 happens at the reasoning level).

## Connections to Existing Knowledge

- **H-096** (evaluation architecture ceiling): The ceiling is at L2-L3 — we've optimized L1/L4/L5 but hit diminishing returns without cognitive observability
- **KE-112** (verdicts lie): Verdicts lie because they only see L1 (what happened) not L3 (why it happened)
- **KE-116** (4-layer eval stack): CR-334's 5-layer observability stack complements KE-116's evaluation stack — observability feeds evaluation
- **KE-117/118** (verification self-awareness stack): The verification stack needs L3 cognitive input to distinguish genuine verification from verification theater
- **CR-326** (gym-production gap): The gap exists partly because gym evaluation only captures L1 (operational); production failures require L2-L3 diagnosis

## Recommended Next Steps

1. **Immediate**: Apply BHI methodology to audit our current evaluation metrics (quality scores, FM detection, verdicts)
2. **Short-term**: Design structured event logging format for sessions (AgentTrace-inspired L2)
3. **Medium-term**: Prototype cognitive attribution on flagged sessions (Watson-inspired L3, selective deployment)
4. **Long-term**: Automate cross-execution pattern recognition (AgentCompass-inspired L4 automation)
