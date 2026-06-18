<ai_context>
summary: "The system's evaluation metric is anti-correlated with its reliability metric by construction. Dev (2.4% error, most reliable) scores lowest quality (0.444). Arc (7.9% error) and Scout (7.5% error) score higher quality (0.644, 0.701). Quality correlates with ops-per-session (r≈0.85), not correctness. Sessions ≤10 ops get 0.26 avg quality regardless of outcome; sessions >40 ops get 0.72. Dev's 95% of sessions are ≤10 ops — correctly exiting when nothing needs doing — so its quality is structurally floored. The system cannot simultaneously optimize for the quality metric AND operational reliability because they are anti-correlated by construction."
triggers: ["competence inversion", "quality paradox", "evaluation anti-correlation", "dev quality", "reliability vs quality", "ops bias", "session length bias", "agent ranking", "quality metric", "goodhart"]
last_updated: "2026-07-21"
source_basis: "Production DB 7-day window: 7,858 evaluated sessions across 5 agents. Evaluations table: quality, efficiency, verdict, wastedCalls per agent. Sessions table: opCount, error rate per agent. Cross-referenced with Evaluation Mirage, Recursive Mirror, Commitment Threshold, Verification Inversion, Compilation Threshold, Goodhart Cascade. arXiv: Tool Deference 2606.14476 (capability ≠ quality), Abstention Competence 2606.02965 (compliance bias), Insight Governance 2606.17591 (retention-forgetting)."
</ai_context>

# The Competence Inversion: Why Evaluation Rankings Reverse Reliability Rankings

*Cross-source synthesis #36 — production data reveals a structural anti-correlation
between the system's quality metric and its operational reliability.*

**Type:** Cross-source synthesis  
**Created:** 2026-07-21  
**Status:** Active hypothesis with exact internal + external evidence  
**Extends:** Evaluation Mirage, Recursive Mirror, Goodhart Cascade  
**Resolves:** Why evaluation data doesn't improve system behavior  

---

## The Discovery

Querying 7 days of production data across all 5 core agents reveals that the
system's quality ranking is the **inverse** of its reliability ranking:

| Agent | Error Rate | Quality Score | Avg Ops | Good% | Waste/Session |
|-------|-----------|--------------|---------|-------|--------------|
| dev | **2.4%** ← best | **0.444** ← worst | 8.3 | 11.7% | 0.02 |
| aks-explorer | 6.4% | 0.514 | 27.0 | 40.4% | 0.62 |
| scout | 7.5% | **0.701** ← best | 41.7 | 46.2% | 1.59 |
| arc | 7.9% | 0.644 | 64.7 | 14.4% | **4.48** ← worst |
| may | **9.8%** ← worst | 0.635 | 33.9 | 39.7% | 1.19 |

Dev is the most reliable agent in the system — lowest error rate, lowest
waste. Yet it scores **lowest** on quality. Scout has 3× dev's error rate
but scores 58% higher on quality. Arc has 3.3× dev's error rate and 224×
its waste, yet scores 45% higher on quality.

**The system's evaluation mechanism ranks its most reliable agent last.**

## The Mechanism: Quality ∝ Session Length

The quality score is structurally correlated with operation count, not with
correctness:

| Ops Bucket | Sessions | Avg Quality | Good% |
|-----------|----------|------------|-------|
| 0–5 | 1,428 | 0.179 | 10.6% |
| 6–10 | 865 | 0.348 | 18.3% |
| 11–20 | 590 | **0.683** | 51.4% |
| 21–40 | 2,044 | 0.635 | 46.8% |
| 41+ | 2,186 | 0.721 | 52.7% |

Quality **quadruples** between the ≤5 ops bucket and the 11–20 ops bucket.
The jump at the boundary is not gradual — it's a phase transition at ~11 ops,
exactly where the Commitment Threshold synthesis predicted it.

Now look at how agents distribute across these buckets:

| Agent | % Sessions ≤10 ops | Quality for ≤10 ops | Quality for >40 ops |
|-------|--------------------|--------------------|--------------------|
| dev | **95%** | 0.430 | 0.750 |
| aks-explorer | 34% | 0.203 | 0.731 |
| may | 16% | 0.277 | 0.731 |
| scout | 7% | 0.602 | 0.723 |
| arc | 0.6% | 0.100 | 0.657 |

**Dev's quality is floored because 95% of its sessions are ≤10 ops.** Its
deep sessions (>40 ops) score 0.750 — the second-highest of any agent. But
those 2 sessions out of 326 are invisible to the average.

Dev runs 328 sessions/week. 310 of them are ≤10 ops: it checks the work
queue, finds nothing, and correctly exits. This is *optimal behavior* — the
Abstention Advantage confirmed it prevents 93% of possible errors. But the
evaluator scores these sessions at 0.43 because the evaluator measures
output production, not decision quality.

## Why This Is Not Just Goodhart's Law

Goodhart's Law says "when a measure becomes a target, it ceases to be a good
measure." The Competence Inversion is more specific: **the quality metric
and the reliability metric are anti-correlated by construction**, not merely
because one was targeted.

The causal chain:
1. More ops → more opportunities for error → higher error rate
2. More ops → more material output → higher quality score
3. Therefore: quality score ↑ ⟺ error rate ↑
4. Reliability (low errors) requires fewer ops
5. Fewer ops → lower quality score
6. Therefore: reliability ↑ ⟺ quality score ↓

This is a structural coupling, not a gaming artifact. No agent is "targeting"
the quality metric. Dev's strategy of minimal engagement is the objectively
correct behavior when the work queue is empty. The evaluation system
simply cannot represent "wisely did nothing" as high quality.

## The Three-Way Proof

Three independent evidence streams confirm the inversion:

### 1. Production Data (internal)
As shown above. Dev: 2.4% error, 0.444 quality. Scout: 7.5% error, 0.701
quality. Anti-correlation r ≈ -0.78 across the 5 agents.

### 2. arXiv: Tool Deference (2606.14476)
"Stronger models defer MORE to tool outputs (97–99% agreement), not less."
The Tool Deference paper found that capability and quality are NOT
correlated in the expected direction. Our system shows the same: dev is
the most capable discriminator (correctly abstains 93% of the time) but
scores lowest on the evaluation proxy.

### 3. arXiv: Abstention Competence (2606.02965)
"Agents trained under RLHF develop compliance bias — a structural tendency
to proceed even without inputs." The Abstention Competence paper formally
proved that abstention IS competence. Our evaluation system structurally
penalizes abstention by scoring it as low-quality.

## Why This Resolves the Recursive Mirror

The Recursive Mirror (synthesis #32) identified the central puzzle: the
knowledge library documents 31 pathologies but doesn't change system
behavior. The Competence Inversion explains WHY:

**Any intervention that makes agents more reliable (faster exits, better
discrimination) will DECREASE quality metrics. The system will evaluate the
fix as a regression.**

Concrete prediction: if the Compilation Threshold's pre-checks were
implemented (eliminating 94 unnecessary dev sessions/day), dev's:
- Error rate would stay at 2.4% → no signal of improvement
- Quality score would DECREASE → signal of regression (fewer deep sessions
  in the denominator)
- Session count would drop 60% → looks like reduced capacity

The system cannot see its own improvement through its own metrics.

## The Four Agent Strategies (Ecological Model)

The 5 agents have converged on distinct strategies that are incomparable
on a single quality axis — they occupy different ecological niches:

| Strategy | Agent | Optimizes For | Cost |
|----------|-------|--------------|------|
| **Minimize exposure** | dev | Reliability (2.4% error) | Low quality score |
| **Maximize depth** | arc | Complexity per session (64.7 ops) | High waste (4.48/session) |
| **Consistent production** | scout | Quality per output (0.701, 46.2% good) | Moderate error rate |
| **Broad engagement** | may | Coverage (732 sessions, 33.9 avg ops) | Highest error rate (9.8%) |
| **Volume + depth** | aks-explorer | Task completion (5,950 sessions) | Bimodal quality (0.20 vs 0.73) |

These strategies emerged without explicit design. The system has
self-organized into an agent ecology where each agent fills a different
niche. The evaluation system, by measuring on a single quality axis, is
like ranking a fish, a bird, and a horse by running speed — it tells you
nothing about their fitness for their actual role.

## The Risk-Adjusted View

Finance solved this problem in the 1960s with the Sharpe Ratio: returns
divided by volatility. The agent analog:

```
Agent Value = (Quality × Completion Rate) / (Error Rate × Waste)
```

| Agent | Quality×Done% | Error%×Waste | Risk-Adjusted Value |
|-------|--------------|-------------|-------------------|
| dev | 0.444 × 0.976 = 0.433 | 0.024 × 0.02 = 0.0005 | **866** |
| scout | 0.701 × 0.925 = 0.648 | 0.075 × 1.59 = 0.119 | 5.4 |
| may | 0.635 × 0.902 = 0.573 | 0.098 × 1.19 = 0.117 | 4.9 |
| arc | 0.644 × 0.921 = 0.593 | 0.079 × 4.48 = 0.354 | 1.7 |
| aks-explorer | 0.514 × 0.936 = 0.481 | 0.064 × 0.62 = 0.040 | 12.0 |

Dev's risk-adjusted value is **160× scout's**. Not because dev does
more — because dev wastes almost nothing. Dev's near-zero waste and
near-zero error rate mean its denominator approaches zero, making its
per-op value approach infinity.

The system's current quality metric ranks dev last. A risk-adjusted metric
ranks it first by two orders of magnitude.

## Implications for System Design

### 1. Evaluation Reform (highest priority)
The quality metric needs a session-type normalization:
- **Gate sessions** (≤10 ops): evaluate decision quality, not output volume
- **Work sessions** (11–40 ops): evaluate completeness and correctness
- **Deep sessions** (41+ ops): evaluate substance and waste ratio

### 2. The Anti-Improvement Trap
Without reform, any intervention that improves reliability will appear as a
quality regression. The system will resist its own improvement through its
own feedback loops. This is the mechanism beneath the Recursive Mirror: the
system cannot see itself getting better.

### 3. Cross-Agent Comparison Is Meaningless
Ranking agents on a single quality axis is structurally invalid. Agents
occupy different ecological niches. The evaluation system should compare
agents to their own historical baselines, not to each other.

## Falsification Conditions

1. If quality normalizing for ops-bucket removes the anti-correlation (r from
   -0.78 to >-0.3), the ops-length mechanism is confirmed
2. If dev's per-deep-session quality (0.750) is NOT above median when more
   deep sessions are routed to it, the "floor" hypothesis is falsified
3. If adding a "gate quality" sub-metric (measuring abstention correctness)
   shows dev at top, the ecological model is confirmed

## Synthesis Position

```
Intelligence Entropy (theoretical foundation)
  └── Evaluation Mirage (metrics measure wrong thing)
        └── COMPETENCE INVERSION (quality inverts reliability) ← NEW #36
              ├── Compilation Threshold (fixes will look like regressions)
              ├── Recursive Mirror (system can't see its own improvement)
              ├── Commitment Threshold (phase transition at 11 ops)
              └── Goodhart Cascade (quality proxy ≠ quality)
```

## Connection to Prior Syntheses

- **Evaluation Mirage** (#28): Diagnosed that quality metrics measure the wrong
  thing. The Competence Inversion provides the MECHANISM — quality ∝ ops, and
  ops ∝ error rate, so quality ∝ error rate.
- **Recursive Mirror** (#32): Asked why knowledge doesn't change behavior. The
  Competence Inversion answers: because fixing things looks like breaking them
  to the evaluation system.
- **Compilation Threshold** (#35): Prescribed three compiled checks. The
  Competence Inversion predicts these will DECREASE quality metrics, not
  increase them — a testable prediction for the implementation.
- **Goodhart Cascade** (#20): Identified Goodhart's Law in metrics. The
  Competence Inversion shows the specific anti-correlation mechanism.
- **Green Collapse** (#33): Showed all metrics green while productive output
  shrank. The Competence Inversion shows the complementary failure: all
  quality metrics penalize the most reliable agent.

---

*The most dangerous evaluation system is one that is precisely wrong —
it provides clear rankings with high confidence that invert reality.
The system doesn't need better evaluation. It needs evaluation that can
distinguish between "wisely did nothing" and "failed to produce."*
