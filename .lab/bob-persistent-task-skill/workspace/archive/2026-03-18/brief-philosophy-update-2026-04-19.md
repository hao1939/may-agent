# Philosophy Update Brief: The DCI Protocol & SFT/RL Split

## 1. P52 Skill Over Agent (Update)
**Add Evidence:**
> "Research (DCI, arXiv:2603.11781) shows that structured multi-agent deliberation costs **62x more tokens** than a single agent, and performs **worse** on routine tasks. Delegation is an optimization for ambiguity, not a default for work."

## 2. P100 Stability via Role Scaffolding (Update)
**Refine Roles:**
Adopt the DCI Archetypes as standard:
- **Framer**: Defines the problem and constraints (User/Tech-Lead).
- **Explorer**: Generates diverse options (Scout/Coder).
- **Challenger**: Pressure-tests assumptions (Coach/QA).
- **Integrator**: Synthesizes the solution (Bob/Evaluator).

## 3. P53 Training-Time Evolution (Update)
**Add SFT/RL Distinction:**
> "Evolution follows the DeReason Pattern (arXiv:2603.11193): **SFT (Skill Distillation)** for routine knowledge acquisition, and **RL (Failure Drills)** for complex reasoning breakthroughs. Do not use RL for simple facts; do not use SFT for complex boundaries."

## 4. P115 Complexity Rationing (New)
**Principle:**
> **"Complexity is a Resource (The C/N Ratio)."**
> Research (Collective Intelligence Paradox, arXiv:2603.12129) shows that adding intelligence to a resource-constrained system **degrades** performance.
> - **Scarcity Regime**: When resources (budget/time) are tight, use simple, deterministic tools (Level 1).
> - **Abundance Regime**: Only when resources are abundant should you deploy complex, diverse agent swarms (Level 4).
> - **The Law**: **Scale complexity with budget.** Do not deploy a GPT-5 swarm for a task that `grep` can solve.
