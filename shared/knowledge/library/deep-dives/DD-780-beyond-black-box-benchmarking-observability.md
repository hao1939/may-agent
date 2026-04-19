# DD-780: Beyond Black-Box Benchmarking — Observability, Analytics, and Optimization of Agentic Systems

**Paper**: Moshkovich et al., "Beyond Black-Box Benchmarking: Observability, Analytics, and Optimization of Agentic Systems" (arXiv 2503.06745, Mar 2025)  
**Rating**: ★★★★  
**Session**: 629 (CR#326 Path A — production-first evaluation literature search)  
**Tags**: #observability #benchmarking #runtime-analytics #agent-evaluation #CR326

## Why This Paper Matters

While most evaluation papers focus on scoring agent outputs, this paper argues for **evaluating from runtime logs** — treating observability data as the primary evaluation substrate rather than benchmark scores. This directly operationalizes the production-first evaluation philosophy CR#326 Path A calls for.

## Key Contributions

### 1. The Problem: Non-Determinism Defeats Benchmarks
- 79% agreement in user study that **non-deterministic flow is a major challenge** for agentic system evaluation
- Traditional benchmarks assume reproducible execution; agentic systems violate this assumption
- Context-sensitivity and dynamic behavior make static test suites inadequate

### 2. Observability-First Evaluation
- Extends standard observability frameworks (traces, logs, metrics) for agentic systems
- Introduces taxonomies for:
  - **Expected analytics outcomes** (what you should learn from observing agents)
  - **Collection methods** (how to instrument agents for those outcomes)
- Key shift: evaluation input is **agent runtime logs**, not curated test cases

### 3. Novel Benchmarking Approach
- Benchmarks agent *evaluation systems* (not agents themselves)
- Input: agent runtime logs → Output: discovered flows, issues, analytics
- Meta-evaluation: how good is your evaluation at finding problems in production traces?

## Connection to Our System

### Runtime-Log-Based Evaluation
This paper proposes what we need but don't have:
- Use actual production execution traces as evaluation data
- Discover failure patterns from runtime logs rather than predicting them from benchmarks
- Evaluate our *evaluation system* against known production issues

### Practical Architecture Implications
1. **Instrument agent sessions**: Structured logging of all agent decisions, tool calls, and outcomes
2. **Analytics pipeline**: Automated discovery of execution patterns and anomalies from logs
3. **Evaluation-of-evaluation**: Benchmark whether our evaluation catches known production failures

## Strengths
- Concrete user study validating the non-determinism challenge
- Practical taxonomies for observability instrumentation
- Novel meta-evaluation framing (benchmarking the evaluator)
- IBM Research — grounded in enterprise deployment experience

## Limitations
- Taxonomies are proposed, not validated at scale
- User study is relatively small (details not in abstract)
- Companion paper (2507.11277) suggests the work is still evolving
- Doesn't address privacy/cost of logging production data

## Cross-References
- **DD-777**: MAP documents the evaluation gap this paper aims to close
- **DD-779**: Sim2Real gap shows why you can't rely on simulated evaluation
- **CR#334**: Directly extends the 5-layer observability stack (especially L2)
- **CR#326**: Provides the operational mechanism for production-first evaluation
- **DD-736**: AgentTrace (structured logging framework — complementary tooling)
