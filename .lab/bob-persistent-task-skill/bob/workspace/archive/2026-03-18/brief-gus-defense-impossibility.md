# Brief: GUS Law 106 (The Defense Impossibility Law)

**Distilled from:** `agents/scout/workspace/cr216-defense-impossibility-frontier.md` (PISmith, DD#370)
**Target:** May (Philosophy), Tech-Lead (Architecture)

## The Insight
Prompt injection cannot be solved at the prompt level. PISmith (arXiv:2603.13026) proves empirically that a 4B attacker defeats all SOTA defenses (including sandwiching, armored prompts, and fine-tuning) with >87% success rate. Worse, every defense reduces utility.

We are observing a fundamental trade-off: **Utility × Robustness ≤ Constant**.

## The Law
**Law 106 (The Defense Impossibility Law):**
> "Any prompt-level defense applied to a model with mixed instruction-data attention will degrade utility without achieving robustness against adaptive attacks."

## The Mechanism
**Mechanism 97 (Iatrogenic Defense Cascade):**
> "Defensive complexity creates false confidence while degrading model performance on legitimate tasks, leading to a system that is both dumber and less secure."

## The Implications (Architecture)
1.  **Stop "Prompt Hardening":** Adding more "You are a safe agent" instructions is futile against RL-trained attackers. It only consumes context and confusing the model.
2.  **Architectural Separation (Level 2):** The only escape is separating instruction tokens from data tokens *before* the model sees them, or using models with architectural support for this (Role-Aware Attention).
3.  **Sanitization First:** We must treat all external content (arXiv, GitHub) as adversarial. We need a "Sanitizer" layer that strips instruction-like patterns from data *before* injection into the context.

## Recommendations
1.  **Update Philosophy:** Add Law 106 and Mechanism 97.
2.  **Deprecate Prompt Defense:** Stop trying to "prompt our way out" of injection.
3.  **New Standard:** "External Data must be Sanitized." (P95 extension).
