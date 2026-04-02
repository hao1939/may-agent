# DD#464: ALARA for Agents — Least-Privilege Context Engineering Through Declarative CAT Data Layer

**Paper:** arXiv:2603.20380
**Authors:** Agostino, D'Souza (NPC Worldwide)
**Published:** 2026-03-20
**Rating:** ★★★★★ CRITICAL
**Gap Match:** Gap 1 (Trust Calibration) — structural privilege enforcement; validates GUS Law 3 (Least Authority)

---

## Executive Summary

Applies the **ALARA principle** from radiation safety ("As Low As Reasonably Achievable") to agent context engineering. Introduces a declarative **Context-Agent-Tool (CAT) data layer** where tool access constraints are enforced **structurally** (schema-level) rather than interpretively (prose-level). Key insight: **modifying an agent's tool list produces a guaranteed behavioral change, not a suggestion**. Evaluated across 22 locally-hosted models (0.6B-35B) on 115 tasks (~2,500 executions).

## Core Design

### The CAT Data Layer

Three interrelated file types forming a declarative agent harness:

1. **Context files** — Team-level scoping, designate orchestrators, shared resources
2. **NPC files** — Individual agent definitions with model config + Jinx (tool) list
3. **Jinxes** (Jinja Execution templates) — YAML tool definitions forming a DAG of composable capabilities

### Critical Architectural Principle

> **Tools not present in an agent's Jinx list do not exist in its schema and cannot be invoked regardless of prompt content.**

This is structural enforcement, not interpretive compliance. No amount of prompt injection or attention drift can invoke what was never provided.

### Why Prose-Based Constraints Fail

Three converging evidence streams:
1. **Lost in the Middle** (Liu et al.): LLM performance degrades when instructions appear in middle of context — exactly where accumulated conversation pushes behavioral specs
2. **MAST taxonomy**: 44% of multi-agent failures are specification/design failures, not model capability
3. **Security**: Over-privileged tool access is the structural enabler of prompt injection attacks

## Key Empirical Findings

### Benchmark Results (22 models × 115 tasks × ~2,500 executions)

1. **Between-family variance > within-family variance** at every parameter count
   - Tool-use is a distinct trained capability
   - Models trained for tool use achieve at 4B what untrained models can't reach at 27B

2. **Tool call volume predicts performance** (r ≈ 0.7, p < 10⁻³)
   - Stronger predictor than task duration (r ≈ 0.3) or attempt count (r ≈ 0.5)
   - Higher-scoring models make more tool calls, not more retries

3. **~80% of successes on first attempt**
   - Retry value varies 10× across categories (web search +20pp, delegation +3pp)
   - Retries help only when model has sufficient baseline capability

4. **Delegation is hardest for every model**
   - Lowest retry gain suggests accumulated context from failures degrades performance
   - "Restart with clean context" beats "retry with error feedback" for delegation

5. **MMLU ↔ Agency correlation r ≈ 0.8** but with significant outliers
   - Outliers identify models whose training transfers disproportionately well/poorly to tool use

### Model Family Rankings (selected)
| Model | Params | Score |
|-------|--------|-------|
| Qwen3.5-35b | 35B | 101/115 (88%) |
| Qwen3-30b | 30B | 93/115 (81%) |
| GLM-4.7-flash | 9B | 92/115 (80%) |
| Qwen3.5-9b | 9B | 90/115 (78%) |
| GPT-OSS-20b | 20B | 84/115 (73%) |
| Qwen3-4b | 4B | 84/115 (73%) |
| Frontier cloud models | — | >90% |

## Theoretical Foundation

### ALARA ↔ Least Privilege Mapping

| Radiation Safety | Agent Security |
|-----------------|---------------|
| Exposure | Tool catalog size / context window usage |
| ALARA optimization | Minimize tools to role requirement |
| Shielding | Schema-level enforcement |
| Monitoring | Trace-level auditing |

### Contextuality Argument

The paper makes a deep theoretical point: **meaning-production in LLMs is contextual in the formal sense** (generated in act of interpretation, not retrieved from pre-existing associations). This means prose-based behavioral constraints have fundamental information-theoretic limits — you cannot guarantee intended behavior through prose regardless of scale. Only structural enforcement at the schema level provides guarantees.

### Tool Catalog Phase Transition

Tool invocation accuracy degrades from ~95% → ~25% as catalog grows from 1 → 8 tools. This is a **structural phase transition** in capability, not a gradual degradation. ALARA/least-privilege directly addresses this.

## Connection to GUS Architecture

### Direct Validation
- **GUS Law 3 (Least Authority)**: CAT layer is a concrete implementation. ALARA = Least Authority with formal optimization framework.
- **GUS Law 4 (Auditability)**: File-on-disk specification enables version control, diff, review
- **GUS Mechanism M4 (Trust Bounds)**: Jinx list = trust boundary. Structural enforcement > interpretive compliance.

### Proposed Extensions
- **Law 40 (Structural Privilege Enforcement)**: Agent capabilities shall be enforced at schema level, not instruction level. No tool access shall depend on model interpretation of natural language constraints.
- **Mechanism M40 (Declarative Harness)**: All agent harness specifications (tool access, delegation rights, context scope) shall be expressed in declarative, versionable files with structural enforcement.
- **Prediction P102**: As tool catalog size increases beyond phase-transition threshold (~8 tools), agent reliability will degrade regardless of model capability. ALARA-compliant systems with scoped catalogs will outperform larger-catalog systems.

### Critical Connection to DD#463 (Selection Bottleneck)

The ALARA paper and Selection Bottleneck paper are **deeply complementary**:
- DD#463: Generator diversity + selector quality → output quality
- DD#464: Generator capability depends on tool catalog scoping → least privilege
- **Combined insight**: The optimal multi-agent pipeline has diverse, ALARA-scoped generators with a strong selector

The Selection Bottleneck's "weak-model paradox" (adding Haiku improves performance) maps directly onto ALARA's finding that 4B models with proper tool scoping outperform 27B models without it. **Structural design > raw capability**.

## Synthesis with Prior Deep-Dives

| DD | Connection |
|----|-----------|
| DD#463 (Selection Bottleneck) | ALARA scoping + strong selection = optimal pipeline |
| DD#458 (TrustFlow) | CAT layer provides the structural enforcement TrustFlow's trust annotations need |
| DD#449 (AgentTrek) | Environment-grounded tool use overlaps with Jinx composability |
| DD#429 (Provenance Paradox) | Structural enforcement eliminates provenance manipulation — can't misattribute tools you can't access |

## Critical Assessment

### Strengths
1. First rigorous application of radiation safety principles to agent design
2. Schema-level enforcement is provably stronger than interpretive compliance
3. Comprehensive benchmark: 22 models, 115 tasks, 2,530 executions
4. Open-source framework + benchmark (npcsh)
5. Practical filesystem-based design easily adoptable

### Limitations
1. **Local models only** in benchmark — frontier model evaluation mentioned but not detailed
2. **No adversarial testing** — prompt injection resistance claimed but not red-teamed
3. **Single-instance evaluation** — no evaluation of multi-team coordination
4. **Delegation worst category** — framework's multi-agent coordination may need more work
5. **Contextuality argument** strong but philosophical — some may view it as unfalsifiable

## Bottom Line

**ALARA for Agents provides the missing enforcement layer for multi-agent governance.** The key insight — that structural schema-level enforcement is fundamentally more reliable than interpretive prose-level instructions — is both theoretically grounded and empirically validated. The CAT data layer is a practical, implementable architecture that directly operationalizes GUS Law 3 (Least Authority). This is the most important safety/governance contribution of the week.

---

*Scout DD#464 | Session 170 | 2026-03-24*
