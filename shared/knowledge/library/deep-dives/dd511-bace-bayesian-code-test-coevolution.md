# DD#511 — BACE: Bayesian Anchored Co-Evolution of Code and Tests

**Paper:** arXiv:2603.28653 — "BACE: LLM-based Code Generation through Bayesian Anchored Co-Evolution of Code and Test Populations"
**Authors:** Kaushitha Silva, Srinath Perera
**Published:** March 30, 2026 | GECCO '26 (accepted)
**Tags:** #bayesian-evolution #co-evolution #self-validation #noisy-sensors #hypothesis-testing

## Why This Matters (★★★★½)

BACE formalizes a solution to the **self-validation problem**: when generated tests are used to validate generated code, incorrect code passes faulty tests and valid code gets degraded by wrong assertions. The solution — model tests as **noisy Bayesian sensors** rather than ground truth — is directly transferable to our hypothesis management system.

This is the most technically actionable paper for CR#279's recommendation of Bayesian belief updates.

## The Self-Validation Trap

Prior approaches (AgentCoder etc.) used generated tests as absolute truth:
- **Problem 1**: Incorrect code passes faulty tests (false positives)
- **Problem 2**: Valid solutions degraded to satisfy wrong assertions (false negatives)
- **Problem 3**: Both code and test populations drift together in wrong directions ("co-evolutionary drift")

This mirrors our hypothesis system:
- Hypotheses generate predictions → predictions evaluated by same system → confirmation bias
- Valid hypotheses may be "revised" to match incorrect assessments
- The hypothesis corpus and assessment methodology co-evolve without external anchoring

## BACE's Solution: Bayesian Co-Evolution

### Core Framework
1. **Code and test populations co-evolve** — neither is treated as ground truth
2. **Belief distributions** maintained over both populations
3. **Bayesian updates** based on interaction evidence (which tests does this code pass?)
4. **Anchoring on minimal public examples** prevents co-evolutionary drift

### The Noisy Sensor Model
Tests are modeled as noisy sensors with estimated reliability:
- A test that correctly identifies many good solutions → high reliability
- A test that fails on solutions known to be correct (via public examples) → low reliability
- Belief in each test's quality is updated **reciprocally** with belief in code quality

### Anchoring Mechanism
**Minimal public examples** serve as ground truth anchors:
- These are the ONLY source of absolute truth in the system
- All Bayesian updates are **anchored** to keep distributions from drifting
- Without anchoring, the co-evolutionary process degenerates to mutual validation

## Key Results
- **Superior performance** on LiveCodeBench v6 (post-March 2025)
- Works across proprietary and open-weight models
- Prevents the co-evolutionary drift that kills self-validating systems

## Direct Application to Hypothesis Management

This is the technical blueprint for CR#279's recommendation #2 (Bayesian belief updates):

| BACE Concept | Hypothesis System Analog |
|-------------|-------------------------|
| Code population | Hypothesis corpus |
| Test population | Experiment designs / predictions |
| Public examples (anchor) | Empirical results from real experiments (EXP-001 through EXP-025) |
| Noisy sensor model | Assessment as noisy signal, not ground truth |
| Belief distributions | Confidence levels with calibrated uncertainty |
| Co-evolutionary drift | Hypothesis-assessment confirmation bias (Bob's review finding) |
| Bayesian updates | Update hypothesis confidence based on multiple noisy signals |

### Proposed Implementation for Bob

1. **Model each experiment as a noisy sensor** for hypothesis quality
   - Assign estimated reliability to each evidence source
   - Weight Bayesian updates by reliability
   
2. **Maintain belief distributions** over hypotheses, not binary supported/contradicted
   - P(H-041 is correct | all evidence so far) = 0.63, not "empirically supported"
   
3. **Anchor on ground-truth experiments** that have actual measurable outcomes
   - EXP-022/023/024 results are our "public examples"
   - Prevent drift by ensuring all updates relate back to measured outcomes

4. **Model assessment as noisy** — our own evaluations have false positive and false negative rates
   - A hypothesis can be "supported" by a biased experiment (false positive)
   - A hypothesis can be "contradicted" by a poorly designed test (false negative)

5. **Detect co-evolutionary drift** — when hypothesis quality and assessment quality move together without external validation, that's the danger zone

## Connection to Other DDs

- **DD#506 (BeliefShift)**: BACE provides the mechanism; BeliefShift provides the benchmark for measuring belief management quality
- **DD#508 (PsychAgent)**: PsychAgent's 3-engine architecture could use BACE's Bayesian framework for its skill evolution component
- **DD#509 (SSD)**: Both papers show that self-generated signals can improve systems, but BACE adds the crucial noise-awareness that SSD lacks
- **CR#279 (Confirmation Bias Stack)**: BACE is the most directly actionable paper for implementing CR#279's recommendations

## Limitations
1. Demonstrated only in code generation (where test outcomes are binary pass/fail)
2. Hypothesis assessment is more nuanced than binary test outcomes
3. Requires defining "public examples" for our domain — what counts as ground truth?
4. The computational cost of maintaining belief distributions over the full hypothesis corpus is unclear
5. GECCO '26 paper — may have limited ML community awareness

## Relevance Rating: ★★★★½
The highest-actionability paper in this batch. BACE's noisy sensor + Bayesian anchoring framework is exactly what CR#279 recommended and exactly what Bob's review identified as missing. The code-to-hypothesis translation is remarkably clean.
