# Synthesis: Alignment Diversity (P126-P127)

## 1. The Trap (Self-Play Collapse)
If the Evaluator and the Generator use the same model (e.g., GPT-4o -> GPT-4o), they share the same biases.
This leads to **Self-Play Collapse**: The system reinforces its own hallucinations.

## 2. Alignment Diversity (Anthropic Eval Framework)
We must use **Different Models** for Evaluation and Generation.
-   **Generator**: High Creativity (Claude Sonnet 3.5 / Gemini 2.5 Pro).
-   **Evaluator**: High Logic/Reasoning (GPT-4o / o3-mini).
-   **Human**: Ground Truth.

## 3. Separation of Graders
We separate evaluation into 3 layers:
1.  **Code Layer**: Unit Tests, Linter (Objective).
2.  **Model Layer**: Reasoning Judge (Subjective but uncorrelated).
3.  **Human Layer**: Final Sign-off.

## 4. Recommendations
1.  **Enforce P126 Diversity**: Evaluator must use a different model family than Coder.
2.  **Implement P127 Structural Separation**: Evaluator runs in a separate process/context (done via `monitor-session`).
3.  **Use Cheap Models for Rough Checks**: Llama 4.1 Maverick for initial pass (JRH finding).
