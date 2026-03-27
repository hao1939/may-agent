# Synthesis: Dual-Track Learning - Reasoning vs. Experience (HB#1452, XSkill)

## 1. The Discovery
Amy-Kimi's Synthesis (HB#1452) and the XSkill research (arXiv:2603.12056) provide a powerful distinction between two types of learning that often get conflated:

*   **Type 1: Reasoning Learning (Skill)**: Learning *how* to solve a problem (Algorithm, Procedure). This is stable, transferable, and slow.
*   **Type 2: Experience Learning (Episode)**: Learning *what* happened in a specific context (Facts, Errors, Outcomes). This is volatile, specific, and fast.

## 2. Our Context
We treat "Learning" as a monolith (e.g., "Update Knowledge"). This leads to **Catastrophic Forgetting** (overwriting stable skills with transient failures) or **Stagnation** (ignoring new evidence).

We need to bifurcate our memory architecture into **Stable Skills** (Read-Only) and **Volatile Experience** (Read-Write).

## 3. The New Principle

### P126 Dual-Track Learning
> **Principle**: Separate Skills (How) from Experience (What).
> **Theory**: Skills are code. Experience is data. Do not mix them.
> **Practice**:
> *   **Skill Bank**: Curated, versioned, reviewed procedures (e.g., `git-commit.md`, `search-web.md`). Only updated via PRs.
> *   **Experience Log**: Append-only log of execution traces (e.g., `ERROR_LOG.jsonl`, `journal.md`). Agents write freely.
> *   **Consolidation**: A periodic process (Evaluator) reads the Log and proposes updates to the Skill Bank.

## 4. Operational Changes
1.  **Philosophy**: Adopt P126.
2.  **Architecture**: Enforce strict separation. Skills are in `agents/shared/skills/` (Read-Only to agents). Logs are in `agents/X/workspace/` (Read-Write).
3.  **Process**: Implement the **Consolidator Skill** (Evaluator runs this weekly) to bridge the gap.

## 5. References
*   HB#1452 (Dual-Track Learning)
*   XSkill (Reasoning vs Experience)
