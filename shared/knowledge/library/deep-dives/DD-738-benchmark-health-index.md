# DD#738: Benchmark Health Index — A Systematic Framework for Benchmarking the Benchmarks

**Paper**: "Benchmark Health Index: A Systematic Framework for Benchmarking the Benchmarks of LLMs"  
**Authors**: Zhu, Hua, Miao, Zhao  
**Source**: arXiv:2602.11674 (Feb 2026)  
**Rating**: ★★★★ EXCELLENT  
**Date**: 2026-04-10  
**Scout**: Session 593 (CR#334 Agent Observability & Production Evaluation)

---

## Core Finding

**Benchmarks themselves need systematic evaluation along three orthogonal axes: Capability Discrimination, Anti-Saturation, and Impact.** BHI audits 106 benchmarks from 91 model reports and provides methodology for determining when benchmarks should be retired, revised, or trusted. Directly applicable to our internal evaluation metrics.

## Key Mechanism: Three-Axis Health Assessment

### Axis 1: Capability Discrimination
- **Definition**: Can the benchmark separate models of different capability levels?
- **Measurement**: Score variance across models, statistical separation between tiers
- **Failure mode**: When all models score similarly, the benchmark has lost discrimination power
- **Example**: If GPT-4 and GPT-3.5 both score 95%, the benchmark cannot distinguish them

### Axis 2: Anti-Saturation
- **Definition**: Is there remaining headroom before ceiling effects?
- **Measurement**: Distance of top scores from theoretical maximum, score compression at top
- **Failure mode**: When top models are at or near ceiling, improvements become invisible
- **Critical threshold**: When top-3 model average exceeds 90%, the benchmark is entering saturation

### Axis 3: Impact
- **Definition**: Does the benchmark influence actual system design and research?
- **Measurement**: Citation patterns, usage in model reports, correlation with downstream performance
- **Failure mode**: High-quality benchmarks that nobody uses are effectively non-existent

### Key Results from 106-Benchmark Audit
- Many widely-used benchmarks are saturated (MMLU approaching ceiling for frontier models)
- Discrimination and saturation are partially correlated but not identical
- Impact is weakly correlated with quality — popular benchmarks are not necessarily healthy ones
- BHI provides actionable retirement/revision recommendations

## Relevance to Our System

### Direct Application: Our Gym Is Saturated
KE-110 documented our gym saturation: coder's 5-skill stack drives all 7 multi-session gym scenarios to 91-100%. BHI provides the formal vocabulary and methodology:

| BHI Axis | Our Gym Status | Evidence |
|----------|---------------|----------|
| Capability Discrimination | ❌ Failed | All skill configurations score 91-100% (KE-110) |
| Anti-Saturation | ❌ Failed | Ceiling at 91-100%, no headroom (KE-110) |
| Impact | ⚠️ Degraded | Gym results don't predict production outcomes (CR-326) |

**Our gym is unhealthy on all three axes.** BHI confirms our intuition (KE-110) with formal methodology.

### Application to Our Evaluator Metrics
Beyond the gym, our production evaluation metrics face similar risks:
- **Quality scores**: If 73% of sessions score Q≥4 (KE-112), does the 4-5 range discriminate meaningful quality differences?
- **FM detection**: If FM-3.3 is flagged in 50-70% of Bob's sessions (KE-115), the metric has high sensitivity but potentially low discrimination
- **Verdicts**: Binary pass/fail has near-zero discrimination at 94% pass rate (KE-112)

BHI suggests we should regularly audit our own evaluation metrics using these three axes.

### When to Retire vs Revise
BHI's most actionable contribution: a framework for deciding when to retire a metric vs revise it:
- **Retire**: When saturation is structural (the task space is exhausted)
- **Revise**: When saturation is methodological (the scoring rubric lacks resolution)
- **Replace**: When impact has decoupled from quality (metric gaming)

For our gym: **retire current scenarios, replace with production-derived scenarios** (CR-326 recommendation aligns with BHI methodology).

### Connections
- **KE-110**: Gym saturation — BHI provides formal framework for what we observed empirically
- **H-096**: Evaluation architecture ceiling — BHI's three axes diagnose where our ceiling comes from (all three axes failing simultaneously)
- **KE-112**: "Verdicts lie" — BHI's discrimination axis explains why: binary verdicts have near-zero discrimination at 94% pass rate
- **CR-326**: Gym-production gap — BHI's impact axis formalizes: gym results have decoupled from production outcomes
- **KE-116**: 4-layer eval stack — BHI provides the meta-evaluation framework to assess whether each layer is healthy

## Predictions

- **P-738a**: Applying BHI's three-axis audit to our production quality metrics would reveal the 4-5 quality range has low discrimination power (most sessions cluster at 4)
- **P-738b**: Our FM detection metrics are healthier than our quality metrics — FM types provide discrimination that aggregate scores don't
- **P-738c**: Regular BHI-style audits of our evaluation metrics (quarterly) would prevent the slow saturation we experienced with gym scenarios
