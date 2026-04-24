# Design Review: Tech Lead Agent (`tech-lead`)
**Source**: `agents/bob/workspace/dev-leader-design.md`

## 1. Assessment
The proposed Tech Lead agent fills a critical gap in our hierarchy: the "Middle Manager" who translates high-level intent (May) into concrete file operations (Coder).

### Alignment with Philosophy
- **P21 Parallel Execution**: Tech Lead enables May to fire-and-forget a large feature while continuing other work.
- **P20 Short Chains**: Tech Lead → Coder is a short, verified chain.
- **P15 Agent as Feature Unit**: Correctly identifies "Decomposition" as a distinct capability requiring a distinct agent context.

## 2. Strengths
- **Write Restriction**: Forcing the Tech Lead to use `workflow` or `subagents` instead of writing code directly is a brilliant constraint. It forces the agent to *think* and *plan*, not just act as a slower Coder.
- **Planning Loop**: The `implementation-plan.md` artifact provides visibility into the agent's reasoning state, making it recoverable if it crashes.
- **Clear Handoff**: The "one chunk, one commit" rule prevents the "mega-commit" problem where 50 files change at once.

## 3. Weaknesses & Risks
1.  **Loop Budget**: The 5-cycle limit is good, but what happens if the plan has 6 items?
    *   *Fix*: The agent should detect "Plan > Budget" and ask May for more turns or split the plan.
2.  **Context Loss**: If Tech Lead runs as an ephemeral session, where does `implementation-plan.md` go when it exits?
    *   *Fix*: The workspace is persistent (`agents/tech-lead/workspace`). The *file* survives, but the *memory* of where we are in the plan is lost if the session dies. The agent must read the plan on startup to resume.
3.  **Zombie Plans**: If a task fails or is cancelled, the `implementation-plan.md` remains.
    *   *Fix*: Tech Lead should archive old plans (mv to `archive/`) before starting a new one.

## 4. Recommendations
1.  **Persistence**: Make `tech-lead` a **persistent agent** (or at least enable `autoClose: false` for long features). The state of a multi-turn feature implementation is valuable.
2.  **Protocol**: Define a specific `TaskResult` format for Tech Lead.
    ```json
    {
      "status": "partial",
      "completed": ["step1", "step2"],
      "blocked_by": "step3 failed: API timeout"
    }
    ```
3.  **Tools**: Ensure Tech Lead has `workflow` permissions in `agent.json`.

## 5. Verdict
**APPROVED WITH MODIFICATIONS**.
- **Change 1**: Tech Lead should check for existing `implementation-plan.md` on startup. If found, ask: "Resume previous plan or archive and start new?"
- **Change 2**: Explicitly grant `workflow` tool access in `agent.json`.

---

## Next Steps
1.  **Create Agent**: `agents/tech-lead/agent.json` (Clone generic config, restrict tools).
2.  **Knowledge**: `agents/tech-lead/knowledge/domain.md` (Scope, breakdown strategies).
3.  **Workflow**: `agents/tech-lead/knowledge/tools.md` (Standard tool docs).
