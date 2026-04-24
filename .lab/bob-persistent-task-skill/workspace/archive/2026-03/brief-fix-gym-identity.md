# Brief: Fix Gym Identity Loading for Non-Standard Agents

## Problem
The current `gym-runner.ts` copies the `agents/` directory to a temporary location (`gym-root/agents-lab`) to isolate the test environment. It then sets `AGENTS_ROOT` to this temporary directory.
However, it does **not** ensure that `SOUL.md`, `DOMAIN.md`, `TOOLS.md`, and `LESSONS.md` are correctly available for the agent under test if that agent relies on `agent-loader` finding them in `AGENTS_ROOT/<name>`.

While `gym-runner.ts` has a comment about "Identity Injection", it seems to rely on the fact that `cpSync(agentsRoot...)` copies everything.
The issue arises when:
1. The agent is running in `workDir` (which is `gym-root/work`).
2. The agent loader looks in `AGENTS_ROOT/<name>` (which is `gym-root/agents-lab/<name>`).
3. If `gym-runner.ts` correctly copies the *real* agent folder to `agents-lab`, then `SOUL.md` etc. should be there.

**Why did Coach report "Total Failure"?**
Coach reported "exit-code-misread: 0/5 (total failure — non-coder agents)".
This scenario (`exit-code-misread`) likely involves running a command and checking its exit code.
Coach *has* the `coding` tool preset (which includes `bash`).
However, if Coach is running in the gym, does it have its **System Prompt**?
The System Prompt is built by `agent-loader.ts` reading `SOUL.md` etc.
If `agent-loader.ts` cannot find `SOUL.md` in `AGENTS_ROOT/coach`, Coach starts with a generic/empty prompt (or just `agent.json` description).
Without its SOUL (instructions), Coach might not know how to behave, or might not follow the scenario instructions if they rely on "You are Coach...".

**Wait**, if `gym-runner.ts` copies `agents/` to `agents-lab/`, then `agents-lab/coach/SOUL.md` exists.
So `agent-loader` should find it.

**Alternative Theory:**
The "Total Failure" might be because the **scenario environment** overwrites or conflicts with the agent's identity?
No, the scenario environment is copied to `workDir`. The agent config is in `AGENTS_ROOT`. They are separate.

**Let's check `gym-runner.ts` lines 151+ again.**
It says:
```typescript
      // Resolve agents root (with optional lab fork overlay)
      if (opts.labFork) {
        // ... copy agents to agents-lab
        // ... copy lab fork to agents-lab/agentName
      } else {
        agentsRoot = join(projectRoot, "agents");
      }
```
If `opts.labFork` is **NOT** set (standard run), `agentsRoot` is `src/../agents` (the real directory).
In this case, `may.ts` is launched with `AGENTS_ROOT` pointing to the real `agents` dir.
So `agent-loader` loads the real `SOUL.md`.

**So why does Coach fail?**
Maybe `exit-code-misread` requires a specific **skill** or **tool** that Coach doesn't use correctly?
Or maybe Coach's `SOUL.md` instructions ("You are the Trainer...") conflict with the scenario task ("Run this command...")?
If the scenario asks Coach to "Fix this bug", Coach might say "I am a Trainer, I don't fix bugs".
That would be a **Refusal**, not a "Total Failure" (unless the scorer counts refusal as 0).

**However**, `gym-runner.ts` lines 180-200 show a section "Identity Injection" that seems to be doing... nothing?
It says:
```typescript
      // Ensure non-standard agents (e.g. optimizer, coach) have their
      // identity files (SOUL.md, DOMAIN.md, TOOLS.md, LESSONS.md)
      // available in the gym environment if they rely on them.
      // ...
      // If the scenario defines custom identity files in environment/,
      // we need to make sure they are respected.
```
This implies there might be a need to *copy* identity files from `AGENTS_ROOT` to `workDir`?
NO. `agent-loader` reads from `AGENTS_ROOT`. It does NOT read from `workDir` (current directory).
The only file `agent-loader` reads from `workDir` is... nothing. It reads `agent.json` from `AGENTS_ROOT`.

**Wait, what if the scenario provides a custom SOUL?**
If the scenario `environment/` contains a `SOUL.md`, and the agent runs in `workDir`, does `agent-loader` pick it up?
**No.** `agent-loader` reads `resolve(agentDir, "SOUL.md")` where `agentDir` is in `AGENTS_ROOT`.
It does **not** check `workDir`.

**This is the bug!**
If a gym scenario wants to test a modified SOUL (e.g. `sycophants-dilemma`), it puts `SOUL.md` in `environment/`.
But `agent-loader` ignores it and loads the real `SOUL.md` from `agents/coder/SOUL.md`.
So the agent runs with its **production identity**, not the **test identity**.
This makes the gym test **invalid** for identity changes (unless you use a Lab Fork).

**But Coach's issue was with `exit-code-misread`.**
This scenario likely *doesn't* have a custom SOUL. It just wants the agent to run.
If Coach fails, it might be because Coach's *production* SOUL is too restrictive ("I am a Trainer").

**Proposed Fix:**
We need `gym-runner.ts` to support **Injecting Identity from WorkDir**.
If `workDir/SOUL.md` exists, `agent-loader` should use it instead of `AGENTS_ROOT/SOUL.md`.
But `agent-loader` is part of the core app. We shouldn't hack it for the gym.

**Better Fix:**
`gym-runner.ts` should **create a temporary agent overlay**.
1. Create a temp `agents-gym` directory.
2. Copy the real agent there.
3. Overwrite `SOUL.md` etc. with files from `scenario/environment` (if they exist).
4. Point `AGENTS_ROOT` to `agents-gym`.

This ensures the agent runs with the **scenario's identity files** effectively.

**AND** for non-standard agents (Coach, Optimizer), we must ensure their *base* identity is copied correctly to this temp dir.

## Implementation Plan
1. Modify `gym-runner.ts`:
   - Always create a temp `agents-gym` dir (not just for lab forks).
   - Copy the target agent's real folder to `agents-gym/<agent>`.
   - **If** `workDir` (populated from scenario environment) has `SOUL.md` / `DOMAIN.md` / `TOOLS.md` / `LESSONS.md`:
     - Copy them into `agents-gym/<agent>/`.
   - Set `AGENTS_ROOT` to this `agents-gym` dir.
2. This ensures that:
   - Base identity is preserved (from real agents dir).
   - Scenario-specific identity (if any) overrides it.
   - We don't modify the core `agent-loader`.

**Verification:**
- This explains why `sycophants-dilemma` (which might rely on a custom SOUL in `environment`) might be failing or behaving weirdly if it's not loading the custom SOUL.
- This also ensures that if we *want* to test Coach with a "You are a Bug Fixer" SOUL, we can just put it in the scenario.

**Wait, `gym-runner.ts` already does this for Lab Forks.**
But for **standard runs** (`else { agentsRoot = join(projectRoot, "agents"); }`), it uses the live agents directory.
This prevents scenario-based identity overrides.

## Deliverable
`agents/bob/workspace/directive-gym-identity-fix.md` -> Brief for Tech-Lead.
I will also archive `investigate-gym-failure.md`.
