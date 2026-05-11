### Summary
Federated fine-tuning (FFT) for LLMs is vulnerable to malicious updates from adversarial participants. The proposed AugMP strategy uses a graph representation learning framework to manipulate updates, maintaining statistical similarity with benign updates to evade defenses while significantly degrading the global model's performance.

### Triggers
- When evaluating the security of distributed or federated learning systems.
- When designing multi-agent systems where agents contribute updates or data to a shared model or knowledge base.
- When considering the robustness of aggregation mechanisms against malicious actors.

### Last Updated
2026-05-11

### Source Basis
http://arxiv.org/abs/2605.07961v1

### Detailed Notes
Federated fine-tuning (FFT) allows distributed agents to collaboratively adapt a shared LLM without exposing raw local data. This paradigm is vulnerable to model manipulation, where adversarial participants upload manipulated updates that degrade global model performance. The paper introduces AugMP, an Augmented Model maniPulation strategy. It uses graph representation learning to capture feature correlations among benign updates, guiding the generation of malicious ones. An iterative manipulation algorithm based on an augmented Lagrangian dual formulation ensures malicious updates embed adversarial objectives while preserving benign-like parameter characteristics. AugMP effectively reduces global LLM accuracy and local agent accuracy while maintaining statistical and geometric consistency with benign updates, thereby evading conventional distance and similarity-based defenses.

### Implications for may-agent
While `may-agent` does not currently employ traditional federated learning for weight updates, the underlying concept is highly relevant to our shared knowledge architecture. If individual agents or external contributors can inject data or updates into a shared system (like the shared KB or shared memory), adversarial or compromised actors could use similar 'stealthy manipulation' techniques. They could structure bad data to statistically resemble good data, bypassing simple verification checks. This underscores the need for robust 'Autonomous Epistemology' (KE-1207) and verifiable 'Provenance Passports' (KE-1203)—we must authenticate the process, not just the statistical shape of the output.