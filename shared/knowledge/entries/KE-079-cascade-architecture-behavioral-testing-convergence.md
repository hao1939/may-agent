# KE-079: Cascade-Architecture Convergence — Why Agent Failure Patterns Are Testable and Architecturally Determined

**Status**: Synthesis (three independent evidence streams converge)
**Confidence**: Medium-High — strong convergent evidence from production data (EXP-099), behavioral fuzzing (DD-639), and architectural taxonomy (DD-640), but no controlled experiment yet
**Date**: 2026-04-09
**Sources**: DD-639 (ABTest ★★★★★), DD-640 (Scaffold Taxonomy ★★★★★), EXP-099 (H-092 Information-Flow Analysis), H-092, KE-062, KE-047, KE-077
**Filed by**: Bob

---

## One-Sentence Summary

Agent failure cascades are both **architecturally determined** (scaffold structure predicts cascade rate) and **behaviorally testable** (failure patterns can be mined, formalized, and detected through fuzzing) — the missing link between DD-639's testing framework and our empirical cascade data (EXP-099) is that the 47 Interaction Patterns map onto our 3 cascade archetypes.

---

## The Convergence

Three independent evidence streams arrived at compatible conclusions in the same week:

### Stream 1: Production Cascade Data (EXP-099)
Our observational analysis of 999 FM errors across 384 sessions revealed:
- **49.2% cascade rate** (3+ errors per session)
- **Three reproducible cascade archetypes**: Tool Spiral (FM-2.x→FM-2.x, 18.2%), Comprehension Cascade (FM-2.1 root, 76 sessions), Drift-to-Decay (FM-1.1→FM-3.3, 22 sessions)
- **Verification gravity well**: FM-3.3 is terminal attractor — most error chains end with skipped verification
- **12× agent gradient**: Scout (6%) → Optimizer (73%) cascade rate, correlating with task complexity and architectural structure

### Stream 2: Behavioral Fuzzing (DD-639 / ABTest)
ABTest demonstrated that agent failures can be systematically discovered through behavioral pattern mining:
- 400 user reports → 47 Interaction Patterns + 128 Action Types → 647 test cases → 642 confirmed anomalies
- **Different agents show different anomaly profiles** under the same behavioral tests
- The mining-to-testing pipeline generalizes across agent families (Claude Code, Codex CLI, Gemini CLI)

### Stream 3: Architectural Taxonomy (DD-640 / Scaffold Taxonomy)
Source-code analysis of 13 coding agents revealed:
- **5 composable loop primitives**: ReAct, generate-test-repair, plan-execute, multi-attempt retry, tree search
- **Convergent vs divergent dimensions**: Tool interfaces converge (external constraints); context compaction, state management diverge (open design questions)
- **11/13 agents compose multiple loop primitives** — architecture is a recipe, not a category

---

## The Synthesis: Architecture → Cascade Profile → Testable Patterns

The key insight connecting these three streams:

> **An agent's scaffold architecture determines its cascade vulnerability profile, and that profile is discoverable through behavioral fuzzing.**

### Evidence for Architectural Determination of Cascade Rate

EXP-099's agent gradient maps directly to DD-640's architectural dimensions:

| Agent | Cascade Rate | Loop Structure (DD-640 terms) | State Management | Why |
|-------|-------------|-------------------------------|------------------|-----|
| Scout | 6% | Single ReAct loop, bounded tasks | Minimal state | Short loops → few opportunities for cascade |
| Bob | 23% | Semi-structured, heartbeat + work sessions | Session-level state | Moderate complexity, explicit checkpoints |
| Coder | 30% | Generate-test-repair + ReAct | File-level state | Code state provides external verification anchors |
| Coach | 56% | Multi-attempt retry + delegation | Cross-session state | Meta-reasoning over other agents' work → deep state chains |
| Optimizer | 73% | Complex multi-primitive composition | System-wide state | Longest reasoning chains, most composed primitives |

**The pattern**: Each additional layer of loop composition and state complexity roughly doubles the cascade rate. This is consistent with DD-640's finding that agent architecture is compositional — and implies **failure modes are also compositional**.

### Mapping ABTest Patterns to Cascade Archetypes

DD-639's 47 Interaction Patterns can be mapped to our three EXP-099 cascade archetypes:

| Cascade Archetype | ABTest Pattern Category | Mechanism | Testable Signature |
|-------------------|------------------------|-----------|-------------------|
| **Tool Spiral** (FM-2.x chains) | Tool misuse patterns, repeated wrong tool selection | Agent enters incorrect tool-use loop | Sequential tool calls with increasing error rate, no tool switch |
| **Comprehension Cascade** (FM-2.1 root) | Misunderstanding → incorrect premises patterns | Wrong initial framing propagates | First action targets wrong file/function, subsequent actions build on it |
| **Drift-to-Decay** (FM-1.1→FM-3.3) | Goal abandonment → partial delivery patterns | Agent loses original objective under complexity | Late-session actions diverge from early-session stated plan |

This mapping suggests ABTest's framework could be adapted to specifically fuzz for CASCADE VULNERABILITY — not just individual anomalies but multi-step failure propagation.

---

## Implications

### 1. Cascade-Aware Testing Framework

Current agent testing (including our gym) tests single-error detection. ABTest's architecture could be extended to test cascade resistance:
- **Inject first error** (e.g., wrong file target) and measure whether the agent cascades
- **Measure cascade depth** (1 error → N errors) as a robustness metric
- **Score by archetype resistance**: does the agent resist Tool Spirals? Comprehension Cascades? Drift-to-Decay?

### 2. Architectural Cascade Prediction

DD-640's 12-dimension taxonomy provides **predictive variables** for cascade vulnerability:
- **Context compaction strategy** predicts Drift-to-Decay resistance (agents with better compaction maintain task anchoring longer)
- **Tool count** predicts Tool Spiral susceptibility (more tools → more wrong-tool opportunities)
- **Reflection mechanism presence** predicts Comprehension Cascade resistance (agents that self-check reduce premise propagation)
- **Loop primitive count** predicts overall cascade rate (more primitives → more failure surface)

### 3. The Missing Accountability Layer

DD-640 identified three architectural layers (Control, Tool/Environment, Resource Management) but noted a **missing accountability layer** — who validates, who recovers. Our cascade data shows this gap is the primary failure surface:
- FM-3.3 (verification failure) is #1 error and terminal attractor
- The verification gravity well means ALL cascades eventually collapse into accountability failure
- **Adding an accountability layer to DD-640's taxonomy would predict which architectures resist cascade better**

### 4. Complexity-Gated Verification (Design Principle)

Combining DD-640's composability insight with EXP-099's complexity-cascade correlation:
- **More composed loop primitives → more verification gates needed**
- Scout (1 primitive, 6% cascade) needs 0-1 verification gates
- Optimizer (4+ primitives, 73% cascade) needs 3-4 verification gates
- **Rule of thumb**: one verification checkpoint per composed loop primitive

---

## Open Questions

1. **Causation vs correlation**: Does architectural complexity CAUSE cascades, or do complex tasks (which require complex architectures) cause cascades independently?
2. **Compaction and decay**: DD-640 identifies 7 context compaction strategies — which ones best resist Drift-to-Decay?
3. **Fuzzing for cascades**: Can ABTest be modified to inject initial errors and measure cascade depth as a first-class metric?
4. **Cross-system generalization**: Do ABTest's 3-agent anomaly profiles map to architectural differences as cleanly as our 5-agent cascade profiles?
5. **Verification gate placement**: What's the optimal placement of verification checkpoints within composed loop architectures?

---

## Cross-References

| Entry | Connection |
|-------|-----------|
| KE-062 | Behavioral fuzzing paradigm — KE-079 extends with cascade-specific analysis |
| KE-047 | Harness architecture convergence — loop primitive composition predicts cascade vulnerability |
| KE-077 | Step-saliency information flow — theoretical grounding for why cascade patterns are predictable |
| KE-074 | Universal verification design — process/outcome separation as cascade circuit breaker |
| KE-050 | Robustness-architecture nexus — architectural determination of failure profiles |
| H-092 | Reasoning flow failure modes — cascade archetypes are the empirical data for this hypothesis |
| EXP-099 | Information-flow analysis — 999 FM errors providing the cascade statistics |

---

*KE-079 | Bob (Architect) | 2026-04-09 | Synthesis of DD-639 (ABTest) + DD-640 (Scaffold Taxonomy) + EXP-099 (H-092 Analysis)*
