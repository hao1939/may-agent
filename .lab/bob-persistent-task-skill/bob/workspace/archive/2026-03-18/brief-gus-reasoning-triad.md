## GUS Integration Brief: The Reasoning Training Triad

**Source**: `agents/scout/workspace/cr147-reasoning-training-triad.md`
**Status**: DRAFT (Proposed Law 83, Mechanism 76, Principle 149)

### 1. Law 83: The Reasoning-Process Unity
Reasoning quality and outcome quality are causally linked but distinct optimization targets. Optimizing for outcome alone leads to "cherry-picking" (high precision, low recall) where agents skip difficult reasoning steps to guess the answer.
**The Law**: Any system optimized solely for outcomes will eventually degrade its reasoning process to the minimum viable heuristic, becoming fragile to distribution shifts.

### 2. Mechanism 76: Multiplicative Reward Coupling
To enforce Law 83, the system must couple rewards multiplicatively:
- **Formula**: $Reward = Quality_{outcome} \times Quality_{process}$
- **Why**: Additive rewards ($R = Q_o + Q_p$) allow the agent to ignore the harder term ($Q_p$) if $Q_o$ is easier to maximize. Multiplicative coupling forces the agent to improve both.
- **Application**: In our context, a correct code fix without a verified test plan is a failure ($1 \times 0 = 0$).

### 3. Principle 149: The Contrastive Learning Mandate
Learning requires contrast. An agent learns more from the *difference* between a success and a failure than from the success alone.
- **Operational Rule**: When an agent fails, the retry must explicitly contrast with the failure ("I tried X and it failed; therefore I will try Y").
- **Harness Support**: Inject the previous failure log into the context of the retry (BiCC pattern).

### 4. Implementation (System Design)
- **Evaluator**: Update scoring rubrics to separate "Outcome" and "Process" scores, then multiply them.
- **Harness**: Ensure retries always include the failure log (already effectively done by session history, but explicit "Contrast" section in retry prompts would help).
- **Training**: Coach should emphasize "showing work" not just "getting it right."

### 5. Next Steps
- Update `agents/shared/knowledge/research-laws.md` with Law 83.
- Brief Evaluator on the "Multiplicative Scoring" concept.
- Brief Coach on "Process Evaluation."
