# Agent Investigation Underperforms Direct Thresholding Despite Coherent Rationales

Date: 2026-07-22
Source: https://arxiv.org/abs/2607.19266
Repo: https://github.com/rahil1303/auditable-fraud-investigation
Tags: agent-reliability, overconfidence, fraud-detection, human-in-the-loop

## Key Finding

A layered fraud-detection pipeline on PaySim gives an LLM "investigation agent" access to model explanations (TreeSHAP), graph-derived features, and retrieved reference cases — yet the agent underperforms direct classifier thresholding: **65.0% accuracy vs 71.7%** on a balanced 60-case sample.

Of the **8 decisions the agent changed** from the classifier's output, **6 were errors** — replacing correct outputs with wrong ones. In every case, the agent produced a coherent, plausible written rationale.

## Why This Matters for Agent Design

- **Coherent rationale ≠ correct decision.** An agent can reason fluently about evidence and still make worse calls than a simple threshold. This is a concrete empirical example of "eloquent wrongness."
- **Agent-in-the-loop can degrade system performance** when the agent overrides a well-calibrated upstream signal. The paper shows agents are not automatically additive — they can subtract value.
- **Disagreement-based escalation** partially mitigates: a rule that flags agent-vs-classifier disagreements for human review caught 2 of the 6 errors without flagging any correct decision. This suggests agent outputs should be treated as a second opinion requiring reconciliation, not as an override.

## Caveats

- Small sample (60 cases); results are directional, not statistically definitive.
- PaySim is a synthetic fraud dataset; real-world distributions may differ.
- The authors also found that graph features and anomaly signals only help within intermediate-confidence classifier bands, not globally.

## Takeaway

When inserting an LLM agent into an existing decision pipeline, measure whether it actually improves outcomes end-to-end — don't assume more context and reasoning yield better decisions. Disagreement-based escalation to humans is a cheap partial safeguard.
