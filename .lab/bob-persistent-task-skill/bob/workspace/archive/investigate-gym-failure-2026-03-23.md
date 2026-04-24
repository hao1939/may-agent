# Brief: Fix Gym Identity Loading for Non-Standard Agents

## Problem
The current `gym-runner.ts` only copies the agent folder structure but does not explicitly ensure that `SOUL.md`, `DOMAIN.md`, and other identity files are correctly loaded if the agent relies on `agent-loader.ts` defaults.
More importantly, when running an agent like `coach` or `optimizer` in the gym, the runner sets `AGENTS_ROOT` to a temp directory (`gym-root/agents-lab`). If the scenario `environment` folder doesn't contain the full agent identity files (which it shouldn't, to avoid duplication), the agent might start with a blank or default identity if `agent-loader` fails to find them in the expected relative paths.

Coach reported "Total Failure" for non-coder agents in some scenarios (e.g. `exit-code-misread`), which might be due to them running without their proper instructions.

## Analysis of `gym-runner.ts`
- It copies `agents/` to `gym-root/agents-lab`.
- It sets `AGENTS_ROOT` to `gym-root/agents-lab`.
- It runs the agent with `--agent <name>`.
- The `may.ts` process uses `agent-loader.ts` to load the agent from `AGENTS_ROOT/<name>`.
- `agent-loader.ts` looks for `SOUL.md`, `DOMAIN.md` in `AGENTS_ROOT/<name>`.

**The Issue:**
If a scenario's `environment` folder is copied to `workDir`, and the agent runs in `workDir`, that's fine.
However, if the agent under test (e.g. "coach") depends on its `SOUL.md` being in `agents/coach/SOUL.md`, and the gym runner *copies* the real agents to `agents-lab`, it *should* work.

**But wait:**
Coach said: "exit-code-misread: 0/5 (total failure — non-coder agents, may need scenario redesign)".
If `exit-code-misread` is a scenario that expects the agent to *run a command and check the exit code*, but the agent is `coach` (who might not have `bash` in the same way, or might have different instructions), that's a behavior mismatch.

However, if the agent *fails to load* its identity, it behaves like a generic generic agent.

Let's verify if `exit-code-misread` uses a specific agent.
`test/gym/gym-runner.ts` defaults to `agent: "coder"`.
If Coach is running `exit-code-misread` with `agent="coach"`, we need to ensure `agents/coach` is correctly copied.

Current `gym-runner.ts` logic:
```typescript
      // Resolve agents root (with optional lab fork overlay)
      if (opts.labFork) {
        // ... copies agents/.lab/<fork> to agents-lab/<agentName>
      } else {
        agentsRoot = join(projectRoot, "agents");
      }
```
If `labFork` is NOT provided (standard run), `agentsRoot` points to the *real* `src/../agents`.
So `may.ts` loads the *real* `SOUL.md`.

**Hypothesis:** The "failure" might be that `coach` simply doesn't have the `bash` tool or the `coding` preset in its `agent.json`.
Let's check `agents/coach/agent.json`.

## Action
1. Check `agents/coach/agent.json`.
2. Check `agents/optimizer/agent.json`.
3. If they lack `coding` tools (bash), they cannot run scenarios that require bash.

This might be a "Right Agent for the Job" issue, not an Infra issue.

But wait, `gym-runner.ts` has a comment:
```typescript
      // ── Identity Injection ───────────────────────────────────────────
      // Ensure non-standard agents (e.g. optimizer, coach) have their
      // identity files (SOUL.md, DOMAIN.md, TOOLS.md, LESSONS.md)
      // available in the gym environment if they rely on them.
```
This comment suggests the author *intended* to do something but maybe didn't finish it?
The code block ends with `// currently environment is copied...`.

If `agentsRoot` points to the real `agents/` dir, then `agent-loader` finds the files.
The only risk is if the scenario `environment` *overwrites* them? No, `environment` goes to `workDir`. `agentsRoot` is separate.

**Conclusion:**
The infra seems correct for *loading* identity (it uses the real files).
The failure "exit-code-misread" for non-coder agents is likely because **Coach doesn't have `bash`**.
Coach has `read`, `write`, `edit`, `agents`. Does Coach have `bash`?

Let's verify Coach's tools.
