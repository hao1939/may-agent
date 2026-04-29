# Skill: Adversarial Hypothesis Template

**Trigger**: When proposing a new hypothesis (creating an h-exp-*.md file)

## Template

After writing the standard hypothesis sections (Claim, Evidence FOR, Evidence AGAINST, Falsification Test, Prediction), you MUST complete these adversarial sections before finalizing:

### Devil's Advocate (Required)
Write 3 specific reasons this hypothesis is WRONG. Not vague doubts — concrete mechanisms by which the claim fails.

### Strongest Counter-Evidence (Required)
Cite the single strongest piece of evidence against this hypothesis from our knowledge base, experiments, or papers. If you can't find any, that's a red flag (untestable or unfalsifiable).

### Pre-Mortem (Required)
Complete this sentence: "When the experiment refutes this hypothesis, the most likely reason will be: ___"

### Survive Gate (Required)
After completing the above three sections, answer: **Is this hypothesis still worth testing?**
- If YES: State why the claim survives despite the counter-evidence. Proceed.
- If NO: Archive immediately. Do not waste an experiment slot.

## Rationale

EXP-268 baseline shows 43% survival rate (3/7 tested hypotheses confirmed). ~57% of experiment cycles are spent on hypotheses that get refuted. This template forces structured self-adversarial reasoning before committing experiment resources. Per DD#905, single-model debate can achieve multi-agent debate quality when structurally required.

## Success Metric

Track hypothesis survival rate for next 10 hypotheses generated with this template. Target: ≥60% survival (vs 43% baseline).
