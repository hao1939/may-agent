## Brief: Implement JRH Stability Checks (Evaluator)

### Context
JRH (arXiv:2603.05399) shows that LLM judges are highly sensitive to formatting (whitespace, indentation).
A single score (e.g., 5/5) is unreliable. We need **Stochastic Stability Checks**.

### The Task
Update `monitor-session` skill to support a `--stability-check` flag.

### Specific Changes
1.  **Perturbation Logic**:
    - Create a helper to inject random whitespace/newlines into the evaluation prompt.
2.  **Retry Loop**:
    - If `--stability-check` is passed:
        - Run evaluation 3 times with different perturbations.
        - Compute Mean and Variance.
3.  **Output**:
    - Return `{ score: mean, variance: var, unstable: var > 0.5 }`.
    - If `unstable`, flag for human review.

### Acceptance Criteria
- [ ] `monitor-session` accepts `--stability-check`.
- [ ] Returns aggregated score and stability flag.
