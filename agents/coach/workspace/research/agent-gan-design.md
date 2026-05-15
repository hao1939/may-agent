# IT-76: Agent GAN — Adversarial Co-Improvement Design

**Status**: Draft  
**Date**: 2026-05-02  
**Author**: coach  
**Origin**: Hao's question "How could 2 agents GAN?" (2026-04-11)

## Concept

In a GAN (Generative Adversarial Network), a generator and discriminator improve each other through competition. We adapt this to agents:

- **Generator agent**: Produces work artifacts (code, analysis, designs)
- **Discriminator agent**: Evaluates, attacks, finds flaws in the generator's output
- Both improve: generator learns to produce harder-to-critique work; discriminator learns to find subtler flaws

## Why This Matters

Current system has a one-directional quality signal: evaluator scores sessions post-hoc. The agent never gets adversarial pressure *during* work. A GAN loop creates continuous improvement pressure without human intervention.

## Concrete Pairings

### Pairing 1: Coder ↔ QA (Most Natural)
- **Generator**: Coder writes code fixes
- **Discriminator**: QA reviews code, writes tests that expose edge cases
- **Loop**: Coder submits PR → QA tries to break it with adversarial tests → Coder must fix failures → QA escalates difficulty
- **Measurement**: Track rounds-to-acceptance over time (should decrease as coder improves)
- **Already partially exists**: QA reviews coder PRs. Missing: adversarial test generation, explicit round tracking

### Pairing 2: Bob ↔ Scout (Knowledge Quality)
- **Generator**: Bob writes knowledge entries / hypotheses
- **Discriminator**: Scout fact-checks, finds counter-evidence, challenges reasoning
- **Loop**: Bob publishes KE → Scout tries to find contradicting evidence or logical flaws → Bob must address or refute → Scout verifies resolution
- **Measurement**: Challenge success rate (how often Scout finds real flaws), KE revision count
- **Value**: Drives knowledge quality up without human review bottleneck

### Pairing 3: Coach ↔ Optimizer (Meta-Improvement)
- **Generator**: Coach designs interventions/experiments
- **Discriminator**: Optimizer evaluates whether the intervention actually improves metrics, finds confounds
- **Loop**: Coach proposes intervention → Optimizer predicts whether it'll work (based on past patterns) → Coach runs experiment → Optimizer scores prediction accuracy
- **Measurement**: Optimizer prediction accuracy, coach intervention success rate
- **Value**: Forces coach to design better experiments; forces optimizer to build better mental models

## Architecture Options

### Option A: Synchronous Round-Robin (Simple)
```
1. Generator produces artifact → saves to shared workspace
2. Discriminator reads artifact → produces critique → saves critique
3. Generator reads critique → revises artifact → saves revision
4. Repeat until convergence or round limit
```
- **Pro**: Simple, uses existing fork/notify infrastructure
- **Con**: Slow (each round = 1 session), expensive

### Option B: Workflow-Mediated (Structured)
```
workflow "adversarial-review":
  step 1: fork generator with task
  step 2: fork discriminator with generator's output
  step 3: fork generator with critique
  step 4: evaluate improvement delta
```
- **Pro**: Tracked, reproducible, can be gym-tested
- **Con**: Needs workflow infrastructure improvements (blocked on tech-lead)

### Option C: Gym Scenario Generation (Scalable)
- Discriminator agent *designs gym scenarios* intended to fail the generator
- Generator runs scenarios, results feed back to discriminator
- Discriminator adapts scenarios based on what the generator handles
- **Pro**: Scales via gym, generates training data
- **Con**: Complex, needs scenario authoring capability in agents

## Recommended First Experiment: EXP-190

**Pairing**: Coder ↔ QA (Pairing 1)  
**Architecture**: Option A (synchronous, 3 rounds max)  
**Scenario**: Pick a real coder PR. QA writes 3 adversarial tests designed to break it. Coder must fix. Measure:
1. How many adversarial tests actually find real bugs (discriminator quality)
2. How many rounds to fix all issues (generator adaptability)
3. Final code quality vs baseline (no adversarial review)

**Controls**:
- Baseline: Coder PR with standard QA review (current process)
- Treatment: Coder PR with adversarial QA (3-round GAN loop)

**Hypothesis**: Adversarial review catches 2x more edge cases than standard review, at cost of 2-3x more sessions.

**Gym test first**: Create a scenario where coder writes a fix, QA generates adversarial tests, measure delta. If this shows signal in gym, propose production pilot.

## Open Questions

1. **Convergence**: How do we know when to stop the loop? (proposal: 3-round cap, or when discriminator finds 0 new issues)
2. **Cost**: Each round = 1 agent session. Is the quality gain worth 3x cost? Need to measure.
3. **Incentive alignment**: Discriminator could be lazy (approve everything). Need quality metric on discriminator's critiques too.
4. **Scope creep**: Discriminator might critique style, not substance. Need clear criteria for what counts as a "real flaw".

## Connection to Existing Work

- **EXP-108** (Adversarial Self-Review): Tested self-review within a single agent. Hit ceiling — agent catches its own mistakes already. GAN adds *external* adversarial pressure.
- **Cross-reference skill**: Bob already reads Scout's findings. GAN formalizes this into a competitive loop.
- **Gym scenarios**: Option C would make agents scenario authors, creating a self-sustaining improvement cycle.

## Next Steps

1. ~~Design~~ ✅ (this document)
2. Create gym scenario for Pairing 1 (Coder ↔ QA adversarial review)
3. Run baseline: standard coder fix without adversarial QA
4. Run treatment: 3-round adversarial loop
5. Compare quality metrics
