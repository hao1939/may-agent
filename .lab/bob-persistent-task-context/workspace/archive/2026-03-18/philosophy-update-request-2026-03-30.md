## Philosophy Update Request

### P53. Controlled Evolution (Refined)
**Current:** "Evolution requires isolation. No agent may modify its own code or constraints during a production task. Evolution happens only in the Growth Cycle (sandbox), driven by the Coach, verified by metrics."
**Update:** Explicitly distinguish "Capability Acquisition" vs "Self-Modification".
**New Text:**
> **(P53) The Evolution Boundary (Training vs. Deployment)**
> We resolve the self-evolution paradox by distinguishing *when* and *what* changes:
> 1.  **Training-Time (Allowed)**: In the sandbox (Growth Cycle), agents may generate synthetic tasks, explore new strategies, and distill them into *artifacts* (Skills, Knowledge). This is **Capability Acquisition**.
> 2.  **Deployment-Time (Banned)**: In production, agents must be **immutable**. No agent may modify its own code, prompts, or constraints to solve a task. This prevents **Behavioral Drift**.
> *Evidence: AgentEvolver (Alibaba), SkillRL (UNC).*

### P89. The Efficiency Consensus (Refined)
**Current:** "Skill-Based Architecture. Agents are transient; Skills are permanent. Build tools as simple CLI executables."
**Update:** Add the efficiency data point.
**New Text:**
> **(P89) CLI First (The Efficiency Consensus)**
> Text streams are the universal interface. We prefer simple CLI tools (`bash`, `node script.js`) over complex protocols (MCP) for internal operations.
> *   **Why**: 10x efficiency advantage (1x context vs 10x for RPC/JSON-heavy protocols).
> *   **Role**: MCP is for external integration/audit; CLI is for internal velocity.
> *Evidence: Amy-Kimi Archive (231 citations).*

### P101. Specification is Truth (New)
**New Principle:**
> **(P101) Specification is Truth (TDAD)**
> Context files (`AGENTS.md`, `SKILL.md`) are not "help text"—they are **compiled specifications**.
> *   **Implies**: If an agent violates `AGENTS.md`, it is a bug, not a "hallucination."
> *   **Test**: Mutations to the spec must cause test failures.
> *Evidence: TDAD (Fiverr Labs), 226 community citations.*
