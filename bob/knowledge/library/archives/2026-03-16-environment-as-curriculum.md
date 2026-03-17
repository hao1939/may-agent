# Synthesis: The Environment-as-Curriculum Principle (Law 5 / Law 8)

**Source**: Scout CR#166 (OpenSWE), DD#330, DD#292, DD#327, DD#328
**Principle**: **Law 5 (Environment Quality Dominance)** and **Law 8 (Difficulty Calibration)**.

## The Core Insight
Traditional AI training optimizes **Model + Algorithm**. OpenSWE proves that **Environment Quality + Difficulty Calibration** is the dominant factor. A generic model (Qwen2.5-32B) trained on "Goldilocks" environments (1-2/4 success rate) outperforms domain-specialized models (SWE-Master-32B-RL).

## Mechanism: The Goldilocks Filter (Mechanism 96)
Learning efficiency is maximized when the gradient signal is non-zero but achievable.
- **0/4 Success**: Impossible task → Zero gradient (Flat loss landscape).
- **4/4 Success**: Trivial task → Zero gradient (Already mastered).
- **1-2/4 Success**: **The Goldilocks Zone** → Maximum gradient information per sample.

## Pattern: Environment Synthesis as Agent Role
Environment construction is no longer an "infra task" — it is a **First-Class Agent Role**. The "Test Analyst Agent" (OpenSWE) or "Diagnosis Agent" (Steve-Evolving) generates the learning signal for the "Solver Agent."

## Structural Implication: The Training Pipeline Inversion
Old: Fix the dataset, train the model.
New: **Fix the environment, filter by difficulty, train the model.**
The "Curriculum" is not a list of topics, but a **Distribution of Difficulty**.

## Proposed Updates

### 5. Environment Quality Dominance (Law 5) [imported]
**"The learning efficiency of an agent is determined primarily by the difficulty distribution of its training environments, not by its architecture."**
- **The Law**: Better environments beat better algorithms. A generic model on a calibrated curriculum outperforms a specialized model on a random one.
- **The Metric**: **Gradient Density** — how much information does each environment interaction yield?
- **The Fix**: Invest in **Environment Synthesis** (creating diverse, valid, difficult-but-possible tasks) over Model Architecture.

### 8. Difficulty Calibration (The Goldilocks Filter) (Law 8) [imported]
**"Learning only happens at the edge of competence."**
- **The Mechanism**: Filter training tasks to the **1-2/4 Success Rate** regime.
- **The Trap**: Training on "Easy" tasks (high success) yields confidence but no capability. Training on "Impossible" tasks yields despair (random policy).
- **The Heuristic**: If an agent succeeds >80%, the environment is too simple. If <20%, it is too hard. Aim for 40-60%.
