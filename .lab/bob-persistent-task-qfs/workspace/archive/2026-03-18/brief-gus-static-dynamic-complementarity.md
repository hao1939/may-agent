# Design Brief: The Static-Dynamic Complementarity (Law 95)

**Status**: Proposal
**Source**: Scout CR#153 (Bio-Inspired Dynamics), DD#315-318 (NeuroLoRA, GER-Steer, SpectralGuard)
**Target**: GUS v6 Integration

## 1. The Discovery
Scout's synthesis of bio-inspired dynamic architectures (NeuroLoRA, GER-Steer) reveals a fundamental design principle: **Separation of Structure and Control**.
*   **NeuroLoRA**: A lightweight (0.14% params) dynamic gating mechanism over a *frozen* backbone matches full fine-tuning performance. Crucially, making the frozen projection trainable *degrades* performance (-3.4 points).
*   **GER-Steer**: Evolutionary search over steering vectors at inference time outperforms training-based alignment methods.
*   **SpectralGuard**: Memory collapse attacks are detectable via spectral signatures of the hidden states.

## 2. The Law
### Law 95: The Static-Dynamic Complementarity
Robust intelligent systems require a **frozen structural core** modulated by a **dynamic control layer**.
*   **The Core (Static)**: Provides stability, generalization, and base capabilities. Must be immutable to prevent catastrophic forgetting and drift.
*   **The Control (Dynamic)**: Provides context-awareness and adaptation. Must be lightweight and ephemeral.
*   **The Failure Mode**: Attempting to make the core dynamic (end-to-end training) increases plasticity but destroys stability. Attempting to make the control static (hard-coded rules) destroys adaptability.

## 3. The Mechanisms
### Mechanism 78: Context-Aware Gating
The optimal control mechanism is **gating** (modulating the flow of information) rather than **rewriting** (changing the processing logic).
*   *Application*: Agent prompts should use "conditional inclusion" of instructions (dynamic context) rather than rewriting the core system prompt.

### Mechanism 79: Inference-Time Alignment
Alignment is more effective when applied as a **steering force** during execution (test-time compute) rather than a **constraint** baked into the weights (training-time compute).
*   *Application*: Our "Ops Gates" and "Evaluator Critics" act as inference-time steering vectors. We should lean into this — catch and correct, don't just try to prompt-engineer perfection.

## 4. System Implications
1.  **Reinforce P53 (Immutable Core)**: This provides the quantitative proof for P53. The Reasoning Core *must* be frozen not just for security, but for performance.
2.  **Shift to Steering**: Instead of trying to create the "perfect agent" that never fails, we should focus on the "Steering Layer" (Evaluator/Coach) that dynamically corrects trajectory.
3.  **Memory Defense**: We should investigate if we can detect "Memory Collapse" (context window exhaustion/confusion) by monitoring the "spectral signature" of agent outputs (e.g., diversity of token probabilities).

## 5. Next Steps
1.  Add Law 95, Mechanism 78, Mechanism 79 to `philosophy.md` (via May).
2.  Brief Tech-Lead: Our architecture of "Fixed Agents + Dynamic Context" is scientifically sound. Resist the urge to "fine-tune" agents for every task.
