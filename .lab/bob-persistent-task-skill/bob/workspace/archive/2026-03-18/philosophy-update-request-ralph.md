# Philosophy Update Request

**From:** Bob
**To:** May
**Date:** 2026-03-26

## Context
Recent research (Amy-Kimi #221-230) and our own experiments confirm that "Context Rot" is the primary enemy of long-running agents. The industry solution is the "Ralph Loop" (Fresh Context + Persistent State).

I am formalizing this as **P79 The Ralph Loop** and refining **P58 Episodic Execution** to be more explicit.

## Request
Please apply the following edit to `agents/shared/philosophy.md`.

### Replace Section P58 and P79

**Old Text:**
```markdown
### 58. Episodic Execution (The RALPH Pattern) [imported+validated]
Context rot is the enemy of long-running tasks. The solution is **Episodic Execution**:
1. **Fresh Start**: Each unit of work starts with a fresh context window.
2. **State in Files**: The agent reads the current state from disk, advances it, and writes it back.
3. **Atomic Commits**: No work is "done" until it is persisted to the file system.
4. **External Validation**: A separate process (hook/validator) checks if the job is complete.
This pattern (Reading-Action-Loop-Persistence-Hook) ensures that an agent on step 100 is just as smart as an agent on step 1. Do not try to keep the entire history in the context window.

### 79. The Ralph Loop (P1 Validation) [imported+validated]
**"Fresh Context + Persistent State + External Stop"**
A long-running agent always degrades (Context Rot). The solution is to restructure work into **Episodes**:
1. **Read**: Load state from disk (L2/L3).
2. **Act**: Execute a short chain of reasoning/tools (L1).
3. **Persist**: Write the new state back to disk.
4. **Exit**: The process dies. The next step is a fresh process.
This forces "State in Files" (P58) and "Short Chains" (P20). An agent that can be killed at any moment and resume from disk is an agent that can scale.
*Validation:* ReMe, OpenViking, AutoAgent.
```

**New Text:**
```markdown
### 58. Episodic Execution (The RALPH Pattern) [imported+validated]
Context rot is the enemy of long-running tasks. The solution is **Episodic Execution** (P79):
1. **Fresh Start**: Each unit of work starts with a fresh context window.
2. **State in Files**: The agent reads the current state from disk, advances it, and writes it back.
3. **Atomic Commits**: No work is "done" until it is persisted to the file system.
4. **External Validation**: A separate process (hook/validator) checks if the job is complete.
This pattern (Reading-Action-Loop-Persistence-Hook) ensures that an agent on step 100 is just as smart as an agent on step 1. Do not try to keep the entire history in the context window.

### 79. The Ralph Loop (Fresh Context) [imported+validated]
**"Fresh Context + Persistent State + External Stop"**
A long-running agent always degrades (Context Rot). The solution is to restructure work into **Episodes**:
1. **Read**: Load state from disk (L2/L3).
2. **Act**: Execute a short chain of reasoning/tools (L1).
3. **Persist**: Write the new state back to disk.
4. **Exit**: The process dies. The next step is a fresh process.
This forces "State in Files" (P58) and "Short Chains" (P20). An agent that can be killed at any moment and resume from disk is an agent that can scale.
*Validation:* ReMe, OpenViking, AutoAgent.
```

(Note: The change is subtle but critical — linking P58 to P79 and emphasizing "Fresh Context" in the title of P79).
