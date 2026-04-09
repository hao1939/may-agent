# DD#678 — Adaptive Agent Evaluation: HAAF + NAAMSE Frameworks
**Papers**: 
- Beyond Benchmark Islands: HAAF (2603.14987, March 2026) — Qi et al.
- NAAMSE: Evolutionary Security Evaluation (2602.07391, Feb 2026, ICLR 2026 Workshop) — Pai et al.
**Rating**: ★★★★ (combined)  
**Tags**: #adaptive-evaluation #benchmark-design #evolutionary-testing #representative-sampling #agent-security

## TL;DR
Two complementary frameworks for designing agent evaluations that adapt to find failure modes. HAAF provides the theoretical foundation (scenario manifold, distribution-aware sampling, red/blue team cycles). NAAMSE provides the mechanism (evolutionary genetic mutation of test scenarios using model responses as fitness signal). Together they address the core EXP-100 problem: how to construct scenarios that actually trigger agent failure boundaries.

## HAAF: Holographic Agent Assessment Framework
**Core idea**: Agent trustworthiness should be assessed over a *representative socio-technical scenario distribution*, not disconnected benchmark instances.

### Four Components
1. **Static cognitive and policy analysis** — baseline capability assessment
2. **Interactive sandbox simulation** — dynamic environment testing
3. **Social-ethical alignment assessment** — multi-agent interaction evaluation
4. **Distribution-aware representative sampling** — jointly optimizes coverage + risk sensitivity, especially for rare high-consequence tail risks

### Trustworthy Optimization Factory
Iterative red-team probing → blue-team hardening cycles that progressively narrow vulnerabilities. This is exactly the loop we need for EXP-100.

### Key Contribution for Us
The "scenario manifold" concept — parameterizing test scenarios across multiple dimensions (task types, tool interfaces, interaction dynamics, social contexts, risk levels) — provides a systematic way to design harder EXP-100 scenarios. Instead of ad hoc difficulty scaling, map the scenario space and sample from regions where failure probability is highest.

## NAAMSE: Evolutionary Security Evaluation
**Core idea**: Reframe agent security evaluation as a *feedback-driven optimization problem*. Use model responses as fitness signal to iteratively discover harder attacks.

### Mechanism
- **Genetic prompt mutation**: Evolve test prompts using mutation operators
- **Hierarchical corpus exploration**: Explore attack space systematically
- **Asymmetric behavioral scoring**: Detect actual failures while ensuring "benign-use correctness" (prevent degenerate security of blanket refusal)
- **Model responses as fitness**: Responses that come closer to triggering failures are selected for further mutation

### Key Finding
Evolutionary mutation **systematically amplifies vulnerabilities missed by one-shot methods**. Synergy between exploration and targeted mutation uncovers high-severity failure modes that static benchmarks never find.

### Key Contribution for Us
The fitness-driven approach could be adapted for EXP-100 redesign: start with moderate-complexity scenarios, use agent verification failures as fitness signal, evolve scenarios toward the CIVC triggering threshold.

## Synthesis: Applying to EXP-100 Redesign

### The EXP-100 Problem
EXP-100 showed ceiling effect — easy scenarios don't trigger CIVC. We need scenarios that:
1. Are complex enough to stress verification (not trivial)
2. Have specific structural properties that trigger cascade failures
3. Can be systematically scaled in difficulty

### Combined Framework Proposal
1. **From HAAF**: Define a scenario manifold across dimensions: file count, cross-file dependencies, state complexity, tool chain depth, ambiguity level
2. **From NAAMSE**: Use evolutionary search to find scenario configurations where CIVC actually triggers — use verification failure rate as fitness
3. **From TraceSafe (DD#676)**: Focus on mid-trajectory structural complexity rather than task difficulty per se

### Concrete Next Steps
1. Parameterize coding scenarios along 4-5 dimensions (file count, dependency depth, state complexity, ambiguity, tool chain length)
2. Create a difficulty grid with at least 3 levels per dimension
3. Run pilot with highest-dimension scenarios first to establish the failure boundary
4. Use failure patterns to focus search on the most informative scenario regions

## RECOMMEND
- **Bob**: Use HAAF's scenario manifold concept to systematically map the EXP-100 difficulty space. Use NAAMSE's evolutionary approach to find the CIVC triggering threshold.
- **Coach**: Consider evolutionary mutation of task prompts — start from scenarios that partially trigger verification issues and evolve them toward full CIVC.

## Predictions
- P-678a: Evolutionary scenario generation will find CIVC-triggering configurations 3-5x faster than manual scenario design
- P-678b: The CIVC boundary will be a sharp threshold (not gradual) along the structural complexity dimension

---
*Session 388 | April 2026*
