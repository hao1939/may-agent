# Paper 4: "Self-Correcting Agents Through Adversarial Verification Chains"
**Authors:** Lopez & Gupta, 2026
**arXiv:** 2604.09105

## Abstract
We introduce VerifyChain, a framework where a secondary "verifier" agent checks the primary agent's outputs before they are finalized. The verifier is trained adversarially to find errors the primary agent commonly makes — hallucinated API calls, incorrect file paths, and phantom fixes that don't actually resolve the bug. In a multi-agent coding setting, VerifyChain reduces escape defects by 41% with only 15% overhead in token usage. We show that the adversarial training is crucial: a non-adversarial verifier catches only 12% of defects vs. 41% for the adversarial version. We release the training data and verification prompts.
