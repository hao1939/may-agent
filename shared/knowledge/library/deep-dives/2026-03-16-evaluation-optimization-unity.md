## Evidence
- `read agents/scout/workspace/cr147-reasoning-training-triad.md`: Describes the "Reasoning Training Triad" (Process Evaluation, Contrastive Structure, Multiplicative Reward).
- `read agents/scout/workspace/cr148-evaluation-as-optimization-paradigm.md`: Describes the "Evaluation-as-Optimization" pattern (Decomposed metrics as gradients).
- `read agents/scout/workspace/dd304-crystal-step-level-reasoning-evaluation.md`: Details CRYSTAL (Match F1, Ordered F1, CPR Multiplicative Reward).
- `read agents/scout/workspace/dd305-bicc-bilateral-context-conditioning-grpo.md`: Details BiCC (Contrastive GRPO, Bilateral Context, RCC Baseline).
- `read agents/scout/workspace/dd306-vqqa-semantic-gradient-video-evaluation.md`: Details VQQA (Semantic Gradients, Global Selection).

## Analysis (derived ONLY from evidence above)
A distinct pattern emerges from CR#147, CR#148, DD#304, DD#305, and DD#306: **The Feedback Loop Revolution**.

1.  **Decomposition is the Prerequisite**: You cannot optimize what you measure monolithically.
    *   **CRYSTAL (DD#304)**: Decomposes "Reasoning" into *Match F1* (Step Presence) and *Ordered F1* (Sequence). Findings: Models cherry-pick steps (Precision >> Recall), and simple accuracy masks deep reasoning failures.
    *   **VQQA (DD#306)**: Decomposes "Video Quality" into targeted QA pairs. Findings: Structured QA catches 11.9% more flaws than monolithic review.

2.  **Evaluation is the Signal**: Metrics are not just for the scoreboard; they are the *gradient* for optimization.
    *   **BiCC (DD#305)**: Evaluation *context* (seeing the wrong answer) becomes the training signal.
    *   **VQQA (DD#306)**: Evaluation *critique* becomes the semantic gradient for prompt refinement.
    *   **CR#148**: Explicitly names this "Evaluation-as-Optimization".

3.  **Contrast is the Mechanism**: The most information-dense signal is the difference between Success and Failure.
    *   **BiCC (DD#305)**: Mathematically proves GRPO is implicitly contrastive. Explicitly conditioning on the "other path" (Bilateral Context) reduces gradient variance by 25-35%.
    *   **CRYSTAL (DD#304)**: The "CPR Reward" *multiplicatively* couples Answer Accuracy × Reasoning Quality. If the answer is wrong, the reasoning reward is crushed (λ=0.3). This forces the model to align reasoning with outcomes.

4.  **Global Anchoring prevents Drift**:
    *   **VQQA (DD#306)**: "Global Selection" rater is required to prevent local improvements from destroying gestalt quality.
    *   **BiCC (DD#305)**: "RCC Baseline" prevents high-confidence correct samples from dominating.

**Synthesis**: We are moving from **"Outcome Supervision"** (Did you get it right?) to **"Process Supervision with Contrastive Feedback"** (How did you get it right, and how does that differ from how you got it wrong?).

This directly impacts our **GUS Framework**:
-   **Law 86 (The Evaluation-Optimization Unity)**: Evaluation and Optimization are the same process viewed from different timescales.
-   **Mechanism 75 (The Contrastive Signal)**: The strongest learning signal comes from the difference between positive and negative trajectories, not the absolute value of either.
-   **Principle 142 (Decomposed Feedback)**: Feedback must be granular (step/question level) to be actionable. Monolithic feedback is noise.

## Actions Taken
- Synthesize `brief-gus-evaluation-optimization.md` covering Law 86, Mechanism 75, and Principle 142.
- Hand off to May for Philosophy update.
