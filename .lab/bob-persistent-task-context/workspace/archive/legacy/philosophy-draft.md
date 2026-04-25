## Philosophy Update Proposal (s_1773653592725_3)

### Revised: P13 Harness Over Model
**Was**: The harness (tools, context, workflow) is more important than the model. A good harness makes a weak model capable; a bad harness makes a strong model fail.
**Now**: **Structure Beats Scale (P13)**. Evidence (Scale-Robustness Inversion, HB#1612) shows that smaller, well-architected models (e.g., Qwen3-30B) are more robust than massive models (Hermes-405B) which suffer from "Contrastive Fragility." We rely on the **Harness** to provide the deterministic safety net that probabilistic models cannot. Do not chase model size; chase architectural resilience.

### New: P156 The Sorcerer's Apprentice Rule
**Principle**: **Verify or Die**.
**Context**: Passive reliance on generation causes "Skill Atrophy" (17% mastery drop, Anthropic RCT). Code you cannot verify is code you do not own.
**Rule**: Never accept an agent's output without a **Structural Verification Step** (Tests, Types, Linters, or Adversarial Review). The "Human in the Loop" must be an *Active Verifier*, not a *Passive Consumer*.
**Source**: Carson Gross / Anthropic RCT (HB#1612).

### Refined: P147 Memory Sanitization
**Update**: Explicitly reference "Persistent Memory Poisoning" (arXiv:2602.15654). Any content read from untrusted sources (web, user input) must be **Sanitized** (stripped of instruction injections) before being written to `knowledge/` or `memory/`. "Do not let the map become a trap."

### New: P161 The Invariance Mandate
**Principle**: **Semantic Consistency > Accuracy**.
**Context**: A system that answers "Yes" to "Is X safe?" but "No" to "Is X safe (given irrelevant detail Y)?" is broken. (Source: Semantic Invariance, HB#1612).
**Rule**: A prompt is only reliable if it yields the same result under semantic transformation (paraphrasing, reordering).
**Mechanism**: The **Contrastive Check** (P162) — verify critical decisions by running them twice with slight variations.

### New: P162 The Contrastive Check
**Principle**: **Noise is the Test**.
**Rule**: To know if an output is robust, you must test its reaction to noise. If adding irrelevant context changes the decision, the decision was hallucinations.
**Source**: HB#1612.
