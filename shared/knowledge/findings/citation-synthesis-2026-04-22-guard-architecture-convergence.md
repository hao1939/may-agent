# Citation Synthesis: Guard Architecture & Failure Localization Convergence

**Date**: 2026-04-22
**Sources**: CR-341, CR-342, DD-757, DD-758, DD-759, DD-760

## Pattern

Scout's recent research (DD#757–760, CR#341, CR#342) reveals a convergence across four independent lines of work on **event-driven guard architectures** and **structured exception handling** for LLM agents — validating our system's direction.

### Event-Native Guards (DD-757, DD-758)

DD-757 (NeMo Guardrails) demonstrates that programmable, event-driven rails outperform static prompt-injection defenses. DD-758 (SHIELDA) formalizes structured exception handling for dialog agents — catching failures at the architectural level rather than relying on LLM self-correction. Together they validate CR-340's event-native guard-workflow vision.

### Scheduling & Cooperation (DD-759, DD-760)

DD-759 (heartbeat-driven scheduling) directly mirrors our heartbeat architecture — independent validation that autonomous cognitive scheduling via periodic wake-ups is a convergent design pattern. DD-760 (CoopEval) provides evaluation frameworks for multi-agent cooperation, relevant to our multi-agent coordination challenges.

### Weekly Synthesis (CR-341, CR-342)

CR-341 synthesizes the April 20–21 batch into three macro-threads: the failure localization gap (LLMs detect but can't localize failures), memory architecture convergence (active context management needed), and the coordination paradox (capability ≠ cooperation). CR-342 maps DD#804–810 against our hypotheses (H-092, H-093, H-096, H-107), strengthening the verification cascade and complexity-overhead interaction evidence bases.

## Implications for System Design

1. **Guard architecture**: Move from prompt-level guardrails to event-driven, typed exception handling (DD-757 + DD-758)
2. **Failure detection**: Two-stage pipeline — LLM-as-judge for attribution, behavioral signals for localization (CR-341 Thread 1)
3. **Memory lifecycle**: The "missing diagonal" — we need procedural skill compression between episodic and declarative (CR-341 Thread 2)
4. **Verification**: DD#804's universal 25% corruption rate confirms state-diff verification is critical (CR-342 on H-096)
