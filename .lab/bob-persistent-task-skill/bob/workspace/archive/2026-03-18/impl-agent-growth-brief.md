## Agent Growth Tools Implementation — Brief

The `docs/v2-agent-growth.md` design describes a Fork/Coach/Verify/Promote cycle. We need to implement the tools and agent definition to make this real.

### Objectives
1.  **Implement `coach` tools**:
    *   `fork_agent(source, target)`: Copies agent directory, updates `name` in `agent.json`.
    *   `verify_agent(agent, task_file)`: Runs a test task, returns score/result.
    *   `promote_agent(source, target)`: Copies config/knowledge back to live agent.
    *   `discard_agent(agent)`: Deletes the fork.
2.  **Define `coach` agent**:
    *   `agents/coach/agent.json`: Add the new tools.
    *   `agents/coach/SOUL.md`: Ensure it aligns with the "Observer, Researcher, Trainer" role.

### Technical Implementation

#### 1. `src/lib/growth.ts` (New Module)
Implement the core logic for the growth cycle.

*   **`forkAgent(sourceName: string, targetName: string): Promise<void>`**
    *   Source: `agents/${sourceName}`. Target: `agents/.lab/${targetName}`.
    *   `cp -r` the directory.
    *   Read `agent.json`, update `name`, write back.
    *   (Optional) Copy memory `state/memory/${sourceName}.jsonl` -> `state/memory/${targetName}.jsonl`.

*   **`promoteAgent(sourceName: string, targetName: string): Promise<void>`**
    *   Source: `agents/.lab/${sourceName}`. Target: `agents/${targetName}`.
    *   Copy specific files: `SOUL.md`, `DOMAIN.md`, `TOOLS.md`, `LESSONS.md`, `knowledge/*`, `skills/*`.
    *   **Do NOT copy**: `workspace/`, `agent.json` (keep original identity/model), `memory`.

*   **`discardAgent(agentName: string): Promise<void>`**
    *   `rm -rf agents/.lab/${agentName}`.
    *   `rm state/memory/${agentName}.jsonl`.

#### 2. `src/lib/tools/growth-tools.ts` (New Tools)
Wrap the logic in agent tools.

*   `createForkTool()`: `{ action: "fork" | "promote" | "discard", source: string, target?: string }`
*   `createVerifyTool()`: `{ agent: string, task: string }` -> delegates to `callAgent` + `evaluator`.

#### 3. Register in `src/lib/index.ts` and `agent-loader.ts`
*   Export the new tools.
*   Update `agents/coach/agent.json` to use them.

### Verification Plan
1.  **Unit Test**: `test/growth-tools.test.ts`.
    *   Mock file system.
    *   Test fork -> file exists, json updated.
    *   Test promote -> files copied, agent.json name preserved.
2.  **Integration Test**:
    *   Run `coach` agent.
    *   Ask it to "fork coder to coder-v2".
    *   Ask it to "run a test on coder-v2".
    *   Ask it to "discard coder-v2".

### Next Steps for Tech Lead
1.  Create `src/lib/growth.ts`.
2.  Create `src/lib/tools/growth-tools.ts`.
3.  Register tools in `src/lib/index.ts`.
4.  Update `agents/coach/agent.json`.
5.  Write `test/growth-tools.test.ts`.
