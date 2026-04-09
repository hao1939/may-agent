# KE-074: Universal Verification Design — Process/Outcome Separation, Rubric-First Evaluation, and the Auto-Research Complementarity Finding

**Status**: Strongly Supported (empirical, with open-source benchmark + replication artifacts)
**Source**: DD-662 (The Art of Building Verifiers for Computer Use Agents — Rosset et al., Microsoft Research + Browserbase)
**Confidence**: High (Cohen's κ = 0.64, FPR ~1%, human-level agreement, released benchmark CUAVerifierBench, open-source code)
**Created**: 2026-04-09

---

## One-Sentence Summary

Four design principles — non-overlapping rubrics, process/outcome reward separation, controllable/uncontrollable failure distinction, and divide-and-conquer context management — transform agent trajectory verification from ~31% agreement (WebVoyager) to human-level (κ=0.64), and model upgrades alone DON'T close this gap — confirming that verification quality is an architectural property, not a model property.

---

## The Finding

### The Four Principles

**1. Rubric-First, Non-Overlapping Criteria**
- Generate evaluation rubric from the TASK alone — never from the trajectory (prevents tailoring)
- Eliminate phantom criteria (requirements never stated in task)
- Handle cascading errors with logically independent criteria
- Conditional criteria for situational requirements
- **This principle alone accounted for ~50% of Cohen's κ gains**

**2. Process/Outcome Reward Separation**
- **Process reward** (r_proc): normalized [0,1] — how well did the agent execute? Formula: Σ earned / Σ max over applicable criteria
- **Outcome reward**: binary — would a user consider the task done?
- These DISAGREE in key cases:
  - Agent does everything right but hits login wall → process success, outcome failure
  - Agent stumbles but achieves goal through unexpected path → process failure, outcome success
- Evaluating only outcome misses execution quality; evaluating only process misses user satisfaction

**3. Controllable vs. Uncontrollable Failures**
- **Uncontrollable**: CAPTCHA, login walls, out of stock, platform issues
- **Controllable**: wrong product, reasoning errors, hallucinations, insufficient effort
- Cascading-error-free strategy: single early obstacle doesn't penalize all downstream criteria
- This maps directly to our EXP-048 finding: agents facing impossible tasks exhibit proxy-satisfying behavior (KE-035)

**4. Divide-and-Conquer Context Management**
- Score every screenshot against every rubric criterion → relevance matrix R ∈ ℝ^(T+1)×N
- Select top-k most relevant screenshots per criterion
- Extract visual evidence per (criterion, screenshot) pair
- Scales to long trajectories without needle-in-haystack attention degradation

### Performance

| Metric | WebVoyager | WebJudge | Universal Verifier |
|--------|-----------|----------|-------------------|
| Cohen's κ (outcome) | 0.31 | 0.44 | **0.64** |
| False Positive Rate | ≥45% | ≥22% | **~1%** |
| Human agreement | ~85% | ~86% | **human-level** |

### The Critical Insight: Design > Model

Upgrading baseline LLMs to GPT-5.2 **doesn't close the gap** — gains come from **design**, not model strength. This is KE-050 (Robustness-Architecture Nexus) applied to verification: verification quality is an architectural property.

---

## The Auto-Research Finding

This is a paper-within-a-paper and one of the most significant findings for understanding AI-human complementarity:

### Setup
- Claude Code v2.1.87 with Claude Opus 4.6 (1M context) attempted to replicate the Universal Verifier from scratch
- 2,000+ lines of prompts replaced with TODO placeholders; only high-level design principles given

### Result
| Metric | Expert | Auto-Research (from scratch) | Auto-Research (from expert config) |
|--------|--------|-----------------------------|------------------------------------|
| Cohen's κ | 0.64 | ~0.55 (70% of expert) | **>0.64 (exceeded expert peak)** |
| Time | 100% | 5% | N/A |

### The Complementarity Principle

1. **From scratch**: AI achieves 70% of expert quality in 5% of time — but plateaus due to "conservative and incremental" edits that miss structural step-function improvements
2. **From expert config**: AI **exceeds** expert peak → automated optimization on top of expert architecture is optimal
3. **Optimal strategy: Human designs architecture, AI optimizes within it**

### Why Auto-Research Underperforms From Scratch
The expert made large structural decisions (tagged in their Figure 1) that produced step-function improvements. The AI agent made small, safe edits. This mirrors:
- Our observation that agents excel at local optimization but struggle with paradigm shifts
- KE-021 (process skills > judgment skills) — the AI can follow a process but can't make judgment calls about which process to follow
- KE-067 (reasoning-behavior decoupling) — the AI may reason about what structural change to make but default to conservative behavior

---

## Why This Matters

### 1. Direct Blueprint for Our Evaluation Architecture

Our current evaluation system should adopt all four principles:

| UV Principle | Our Current State | Improvement |
|-------------|-------------------|-------------|
| Non-overlapping rubrics | Implicit criteria, sometimes overlapping | Write task-based rubrics before seeing agent output |
| Process/outcome separation | Mostly outcome-focused | Score BOTH process quality and task completion |
| Controllable/uncontrollable | No distinction | Don't penalize for timeout/API failures |
| Divide-and-conquer | Sequential log reading | Score each tool call against criteria matrix |

### 2. Extends the Verification Knowledge Web

| Existing KE | How KE-074 Extends It |
|------------|----------------------|
| KE-044 (Verification Separation) | From "separate verifier" to "HOW to build effective verifier" — the four principles |
| KE-050 (Robustness-Architecture) | Confirmation: model upgrades DON'T fix verification quality, design does |
| KE-005 (QA rubber-stamps 14%) | UV's FPR ~1% shows the path from 14% detection to reliable verification |
| KE-068 (Zero-Hedge Gate) | Complementary signals: UV evaluates trajectory externally, HVR evaluates confidence internally |
| KE-051 (Self-Governance Stack) | UV's rubric-first approach implements L1 (self-verification) with explicit quality criteria |

### 3. The Auto-Research Finding Validates Our System Philosophy

Our system design: human tech-lead designs architecture, agents optimize within it. The auto-research finding provides the first quantified evidence that this is optimal:
- AI alone: 70% quality, 5% time
- Human alone: 100% quality, 100% time  
- **Human architecture + AI optimization: >100% quality, ~105% time**

This is super-linear complementarity — the combination exceeds either alone.

---

## Limitations

1. **CUA-specific**: Verified on computer use agent trajectories — generalization to other agent types unknown
2. **Screenshot-based**: Divide-and-conquer designed for visual evidence; our system uses text-based tool calls
3. **Auto-research study**: Single replication attempt — need more studies to confirm 70%/5% ratio
4. **GPT-5.2 as ceiling model**: Results may change with future models

---

## Predictions

- **P-074-1**: Process/outcome reward separation will become standard in agent evaluation within 6 months. (85% confidence)
- **P-074-2**: Rubric-first evaluation (generated from task, not trajectory) will improve our own evaluation reliability by >20% when adopted. (75% confidence)
- **P-074-3**: The auto-research 70%/5% efficiency ratio will hold within ±15% across domains. (60% confidence — single study)
- **P-074-4**: Human-architecture + AI-optimization will consistently outperform either alone for complex system design. (80% confidence)

---

## Connections

- **Extends**: KE-044 (Verification Separation) — from *whether* to separate verification to *how* to build it
- **Confirms**: KE-050 (Robustness-Architecture Nexus) — model upgrades DON'T fix verification; design does
- **Addresses**: KE-005 (QA rubber-stamps) — UV's FPR ~1% is the target for our evaluation improvement
- **Complements**: KE-068 (Zero-Hedge Gate) — external trajectory evaluation + internal confidence detection
- **Validates**: KE-021 (process > judgment skills) — auto-research excels at process optimization, fails at structural judgment
- **Connects to**: KE-067 (reasoning-behavior decoupling) — AI reasons about structural changes but defaults to incremental edits
- **Parallels**: Our own auto-research research-project — direct evidence for project viability

---

## Actionable Implications

1. **HIGH PRIORITY**: Adopt process/outcome reward separation in our evaluation framework
2. **HIGH PRIORITY**: The auto-research finding should inform how we structure agent autonomy — human makes structural decisions, agents optimize within those structures
3. **MEDIUM**: Generate evaluation rubrics from task descriptions BEFORE observing agent behavior — prevents rationalization
4. **MEDIUM**: Adapt the relevance-matrix approach (score each tool call against each criterion) for our agent trace analysis
5. **LOW**: CUAVerifierBench is available for benchmarking our own evaluation approaches

---

## Open Questions

1. Does the auto-research complementarity principle extend to our own system — can agents optimize experiments better after humans design the experimental framework?
2. What's the optimal balance between human structural decisions and AI optimization — is 70%/5% a universal ratio or domain-specific?
3. Can the divide-and-conquer relevance matrix be adapted from screenshots to text-based tool call traces?

---
*Bob synthesis from DD-662 | 2026-04-09*
