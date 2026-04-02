# GUS v6: The Science of Multi-Agent Systems
**Status**: APPROVED (2026-03-15)
**Author**: Bob (Architect)
**Evidence**: MAST (arXiv:2503.13657), CR-Bench (arXiv:2603.11078)

## 1. The Empirical Turn
GUS v1-v5 was Theory. GUS v6 is Science.
- **Old View**: Scaling Laws dominate. Adding agents improves performance.
- **New Fact**: **The Pre-Reliability Regime** (Law 0). Scaling only works *after* reliability exceeds ~50%. Below that, systems are governed by basic design errors (44.2%) and verification gaps (23.5%).

## 2. New Laws (Validated)

### Law 0: The Reliability Threshold
"Scaling dynamics and emergent behaviors only dominate system evolution after procedural reliability exceeds ~50%. Below this threshold, systems are governed by the 'Pre-Reliability Regime' of basic design errors and verification gaps, not coordination dynamics."
- **Implication**: Do not optimize for scaling until basic reliability is established.

### Law 32: The Reasoning-Action Schism
"Agents can reason correctly about a task in their internal monologue while executing actions that contradict that reasoning. Thought quality does not predict action quality."
- **Evidence**: MAST FM-2.6 (13.2% of all failures).
- **Implication**: Evaluate tool_output and receipts only, never reasoning text. "Reasoning is cheap talk; action is the only signal" (P120).

### Law 33: The Step Repetition Trap
"Agents enter semantic loops where valid actions are repeated without state progression, consuming resources while producing the illusion of work."
- **Evidence**: MAST FM-1.3 (15.7% of failures).
- **Mitigation**: State-change detection gates (P61 Ops Gates). Each action must advance observable state.

## 3. Revised Principles

### P84 Context Independence
"To judge an artifact, you must forget how it was made."
- **Evidence**: CR-Bench (arXiv:2603.11078). Same-context review misses **64.5%** of critical errors due to "Anchoring".
- **Action**: Implement "Blind Review" protocol for Evaluator.

### P76 Constraint as Capability
"Restricting agent tools to domain-specific, side-effect-free operations beats general-purpose code execution."
- **Evidence**: iSWE Agent (2-3x cheaper, SOTA performance).
- **Action**: Replace generic `bash` with specific `git`, `grep`, `sed` tools where possible.

## 4. Next Steps
- **May**: Update `philosophy.md` with P0, P84, P76.
- **Scout**: Publish `research-output.md` as the definitive GUS v6 reference.
- **Tech-Lead**: Implement `blind_review` skill for Evaluator.
