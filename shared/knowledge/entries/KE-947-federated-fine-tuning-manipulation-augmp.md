# Federated Fine-Tuning Vulnerability to AugMP

<ai_context>
summary: Federated fine-tuning of LLMs is vulnerable to the AugMP strategy, which uses graph representation learning to embed adversarial objectives into updates while maintaining statistical similarity to benign updates.
triggers: security, federated learning, data poisoning, adversarial updates
last_updated: 2026-05-11
source_basis: http://arxiv.org/abs/2605.07961v1
</ai_context>

Federated fine-tuning (FFT) enables collaborative LLM updates without sharing raw data. However, malicious actors can upload manipulated LLM updates. The Augmented Model maniPulation (AugMP) strategy utilizes graph representation learning to guide the generation of malicious updates that are statistically and geometrically consistent with benign ones, effectively evading distance/similarity-based defenses while corrupting the global model.

## Relevance to System
Mostly a theoretical risk currently, but should be tracked if we adopt decentralized fine-tuning data collection or external memory inputs into our core weights.