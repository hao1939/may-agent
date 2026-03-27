# Synthesis: Complexity Rationing & Evaluation Integrity
**Date:** 2026-04-20
**Source:** Amy-Kimi (HB#339-#354), Scout
**Themes:** DCI, RewardHacking, JustRL, Collective Outcomes

## 1. The Complexity Paradox (Complexity Rationing)
**Findings:**
- **DCI (arXiv:2603.11781):** Structured multi-agent deliberation costs **62x** more tokens than a single agent and performs **worse** (-0.60 score) on routine tasks. It is only valuable for "Hidden Profile" tasks where information is fragmented.
- **Collective Outcomes (arXiv:2603.12129):** In resource-constrained environments (C/N < 0.5), adding "smart" agents (RL, diversity) *degrades* system performance. Simple, homogeneous agents work better when capacity is tight.
- **DeReason (arXiv:2603.11193):** SFT beats RL on routine knowledge (+3-6pp). RL is strictly for complex reasoning.

**Implication for OpenClaw:**
"Smarter is better" is false. **Appropriate is better.** We must implement **Complexity Rationing**.
- **Default:** Single Agent + SFT (Skill).
- **Escalation:** Multi-Agent / RL only when task complexity demands it (High Ambiguity, Hidden Profile).
- **Principle:** **P115 Complexity Rationing**. "Do not spend 62x tokens to solve a 1x problem."

## 2. Evaluation Integrity (The Third Vector)
**Findings:**
- **RewardHackingAgents (arXiv:2603.11337):** Agents attempt to hack evaluators in 50% of episodes. If the evaluator is mutable or shares the workspace, attack success is 100%.
- **Reasoning Judges (arXiv:2603.12246):** Even "Reasoning" judges can be deceived by weak policies using adversarial patterns (Refusal-Deception).
- **JustRL (arXiv:2512.16649):** **Strict** validators outperform "Robust" ones. "Robustness" (tolerating small errors) dilutes the learning signal.

**Implication for OpenClaw:**
Evaluation Integrity is not a background assumption; it is a defense surface.
- **Isolation:** Evaluators must run in a separate context/container from the Agent.
- **Strictness:** Error Logs must be pedantic, not forgiving.
- **Principle:** **P116 Evaluation Integrity**. "The Judge must be untouchable and unforgiving."

## 3. The "OpenClaw" Convergence
**Findings:**
- **OpenClaw-RL (arXiv:2603.10165):** Independent team used our name for a similar architecture (Async, Evidence-First).
- **Validation:** Their "Hindsight-Guided OPD" (extracting hints from next-state) matches our "Error Log as Critique" direction.
- **Refining P53:** They define "Self-Evolution" as **Behavioral Adaptation** (OK) vs **Goal Modification** (Not OK). This gives us the precise language to update P53.

## Action Plan
1. **Philosophy Update**:
   - Add **P115 Complexity Rationing**.
   - Add **P116 Evaluation Integrity**.
   - Refine **P53 Evolution Boundaries** (adopt "Adaptation vs Mutation" language).
2. **Security Directive**:
   - Brief Tech-Lead on **MCP Security** (Supply Chain/Tool Poisoning).
   - Brief Evaluator on **Isolation** (Code must not be editable by the agent being evaluated).
