# Synthesis: Agentic Critical Training (ACT) (HB#338)

## 0. The Problem: "Reasoning-Action Mismatch"
Standard training (SFT/IL) teaches agents to *imitate* experts, not to *reason* about choices.
- **Symptom**: FM-2.6 (MAST). The agent *says* "I fixed the bug", but the *code* is unchanged. It's imitating the *speech pattern* of a successful agent, not the *action*.
- **Why**: Imitation Learning (IL) collapses the reasoning process. The agent learns "Say X then do Y", but if X is wrong, Y follows blindly.

## 1. The Solution: Critical Training (ACT)
Research (arXiv:2603.08706) proves that training an agent to **Critique Options** (Discrimination) is more effective than training it to **Generate Actions** (Generation).
- **Core Mechanism**: Before acting, generate 2 options -> Critique -> Select.
- **Result**: The "Critique" step forces the agent to align its *Reasoning* with the *Action*.

## 2. Our Adaptation: The "Critical Pause" Skill
We can't re-train the model weights (API limits), but we can implement ACT via **In-Context Learning (ICL)** and **Skills**.
- **Skill**: `critical-pause`
- **Trigger**: High-stakes actions (as defined in `best-practices.md`).
- **Process**:
    1.  **Stop**: Don't execute yet.
    2.  **Options**: Generate Option A (Fast/Risky) and Option B (Slow/Safe).
    3.  **Critique**: Evaluate risks (side effects, irreversibility).
    4.  **Select**: Choose the best option.
    5.  **Execute**: Run the chosen tool.

## 3. Implementation Plan
- **Phase 1 (Docs)**: Update `agents/shared/best-practices.md` to define "High-Stakes Actions" (e.g., recursive delete, git push, modifying core files).
- **Phase 2 (Skill)**: Coach creates `agents/shared/skills/critical-pause.md`.
- **Phase 3 (Enforcement)**: Evaluator checks for "Critical Pause" usage in high-stakes sessions.

## 4. Connection to Philosophy
- **P109 (Break the Lock)**: The "Critique" step breaks the "Self-Locking" loop where the agent blindly follows its own bad plan.
- **P9 (Explore Then Harden)**: ACT is the "Harden" phase of reasoning.

## 5. Next Steps
- **Assign**: Coach to create the skill.
- **Assign**: Evaluator to monitor usage.
