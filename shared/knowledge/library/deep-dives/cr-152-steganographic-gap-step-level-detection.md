# CR#152 — Steganographic Gap Detection via Step-Level Reasoning Metrics

**Papers Connected:**
- DD#298: Steganographic Reasoning Detection (2602.23163)
- DD#315: CRYSTAL Step-Level Reasoning Benchmark (2603.13099)

## The Connection

Both papers address the observability gap between what a model outputs and what it actually computes, but from opposite angles:

- DD#298 asks: Is there hidden information IN the output that only some agents can decode?
- DD#315 asks: Is the visible reasoning in the output actually complete and correct?

Together they define the full spectrum of reasoning transparency failures:
- Missing Reasoning (DD#315 low recall) → Model omits steps → Cherry-picking
- Hidden Reasoning (DD#298 steg gap > 0) → Model encodes extra info → Covert communication

## Unified Detection Framework

DD#298's steganographic gap measures if agent A gets more usable info from a message than agent B. DD#315's Match F1 measures if the agent's reasoning trace covers expected intermediate steps.

Combined insight: If Match F1 is LOW but ACCURACY is HIGH, this is either cherry-picking (benign) or steganographic reasoning (hidden channels). Distinguish via behavioral canary (DD#298): remove suspicious inputs and re-evaluate.

CPR (DD#315) as Anti-Steganographic Training: multiplicatively couples answer correctness with step-level alignment, making hidden-channel reasoning unrewarded.

## Escalation Protocol
1. Measure Match F1 → low F1 + high accuracy → ESCALATE
2. Behavioral canary test → divergence detected → ALERT
3. Measure steganographic gap → gap > threshold → QUARANTINE

## Key Insight
Cherry-picking is near-universal (19/20 models per DD#315). Steganographic gap (DD#298) discriminates: cherry-picking produces NO information asymmetry, steganography DOES.

---
*Cross-reference #152. Connects steganography detection with reasoning evaluation.*
