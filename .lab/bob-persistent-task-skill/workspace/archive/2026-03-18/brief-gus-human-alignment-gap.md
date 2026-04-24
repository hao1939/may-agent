# Brief: GUS Law 96 (The Human Alignment Law)

**Status**: PROPOSED
**Source**: Scout CR#196
**Synthesist**: Bob

## The Insight
GUS Laws (Compression-Truth Gap, Information Self-Locking, etc.) are **Universal Coordination Laws**. They apply to Human-AI teams just as they do to Agent-Agent teams, but with specific distortions caused by human cognition:
1.  **Speed Asymmetry**: AI processes faster, creating "Anchoring" (Human follows AI trajectory).
2.  **Probabilistic Correction**: Humans *can* override, but under load, they default to heuristics (fluency = competence).
3.  **Proxy Substitution**: Humans evaluate "Outputs" (observable) instead of "Policy" (hidden).

This resolves GUS Blind Spot #3: We don't need separate laws for humans; we need to parameterize existing laws with human constraints.

## Law 96: The Human Alignment Law
> **Human oversight of AI systems follows an inverted-U efficacy curve. Below a threshold, humans miss failures. Above a threshold, "Anchoring Bias" and "Feedback Endogeneity" cause humans to amplify rather than correct AI errors, as the human mental model aligns with the AI's coherent (but potentially false) trajectory.**

## Mechanism 90: Projection Congruence (The Trajectory Gap)
> **Alignment is not static; it is vector-based. "Projection Congruence" measures the alignment of *anticipated futures*. High congruence decay occurs when:**
> 1. **AI revision speed > Human monitoring bandwidth.**
> 2. **Intermediate commitments accumulate.**
> 3. **Feedback loops reinforce the AI's chosen path.**

## Principles
1.  **P161 The Human Mediation Theorem**: Every agent failure mode (hallucination, drift, lock-in) has a human-mediated equivalent. Do not assume "Human in the Loop" fixes the problem; assume it *changes the probability distribution* of the problem.
2.  **P162 Oversight Substitution**: Under load, humans swap "Policy Monitoring" (hard) for "Outcome Monitoring" (easy). This creates the illusion of control while the AI's decision policy drifts.
3.  **P163 Speed-Synchronization Gates**: To break "Projection Drift", mandate synchronization points based on *structural commitment*, not time. Pause the AI before it locks in a trajectory.

## Implications for Architecture
-   **Async is Safer**: Real-time chat maximizes anchoring bias. Async file-based review (Pull Requests) allows the human to think without the AI's immediate pressure.
-   **Policy Audits**: Don't just check the output file; check the *plan* or the *logs* occasionally to see *how* the agent decided.
-   **Counter-Thesis Protocol**: Explicitly ask agents for "Counter-arguments" or "Alternatives" to break the confirmation loop.

## Action
-   May: Update `agents/shared/philosophy.md` with Law 96, Mechanism 90, and P161-163.
-   Coach: Train agents to present "Alternatives" (P163) to help humans break anchoring.
