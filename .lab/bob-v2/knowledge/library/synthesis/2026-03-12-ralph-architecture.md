# Design: The RALPH Architecture Pattern

## Context
Research from Amy-Kimi (XHS/shing19) and our own experiments with `focus-task-driver` point to a robust pattern for long-running agent tasks: the **RALPH Loop** (Read-Act-Loop-Persistence-Hook).

## The Core Concept
A "RALPH" is a stateless loop that:
1. **Reads** current state from the filesystem (Ground Truth).
2. **Acts** via an ephemeral agent session (Fresh Context).
3. **Persists** changes to the filesystem immediately (Atomic Commits).
4. **Hooks** into an external validator to decide if done (Definition of Done).

Crucially, **memory is in the file system, not the context window.** The agent is "born" fresh every iteration, reads the current state, advances it, and dies. This prevents context rot and hallucination spirals.

## Alignment with Our System
We *already* use this pattern in places, but haven't formalized it:
- **Cron Jobs**: `focus-task-driver` is a RALPH loop. It wakes up, reads `focus-tasks.md`, does one unit of work, and exits.
- **Heartbeat**: A classic RALPH loop.
- **Philosophy**: P11 (File System as Memory) and P26 (Evolution over State) are RALPH principles.

## The Gap
We lack a standardized way to invoke this pattern. Agents currently "just loop" or use long-running sessions, which accumulate context rot. We need to formalize the **"Task Loop"** as a primitive.

## Design Recommendation: The `Loop` Capability
Introduce a standard `agents.loop()` or `Job` abstraction that formalizes RALPH.

### 1. The Structure
Instead of one long `chat` session, a task becomes a `job` session that spawns multiple child sessions.
```typescript
// Conceptual
async function runLoop(taskFile: string, validator: (content: string) => boolean) {
  while (true) {
    const state = read(taskFile);
    if (validator(state)) break;
    
    // Spawn fresh agent
    await agents.call("worker", `Read ${taskFile}. Advance the state by one step.`);
    
    // External validation / "Steering"
    const quality = await agents.call("evaluator", `Check if ${taskFile} improved.`);
    if (quality === "REGRESSED") revert();
  }
}
```

### 2. Application: "Episodic Memory" for Agents
Agents currently try to remember everything in one session.
**Shift**:
- **Long tasks** → Break into episodes.
- **Episode 1**: Setup. Output: `workspace/state.md`.
- **Episode 2**: Execution. Input: `workspace/state.md`. Output: `workspace/state.md` (updated).
- **Episode 3**: Cleanup.

### 3. Immediate Action
We don't need a new framework. We need to **teach agents this pattern**.
1. **Update `philosophy.md`**: Formalize "Context Freshness" and "Episodic Execution".
2. **Update `focus-task-driver`**: Ensure it strictly adheres to RALPH (read fresh every time, no memory carried over).
3. **Skill Definition**: Create a `long-running-task` skill that explicitly implements this loop using `agents.call`.

## Value
- **Reliability**: Fresh context = lower hallucination.
- **Resilience**: Crash in iteration 5 doesn't kill the whole job; just retry iteration 5.
- **Cost**: No re-reading 50k tokens of history for a simple edit.

## Next Steps
1. Add **"P58: Episodic Execution"** to `philosophy.md`.
2. Create `agents/shared/skills/long-running-task/SKILL.md` template.
