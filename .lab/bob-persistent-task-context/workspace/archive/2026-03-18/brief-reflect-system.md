# Reflect System (Proactive Improvement)

**Status**: Draft
**Owner**: Bob
**Target**: Coach

## Context
Hao (User) frequently has to correct the system (e.g., "Don't use /home/", "Verify your edits"). These corrections are valuable training signals, but currently, they are:
1. Applied locally (to the current session).
2. Sometimes recorded in `LESSONS.md` (if the agent remembers).
3. Often forgotten by the *system* as a whole.

We need a **Reflect System** that proactively mines these interactions to improve the team.

## Problem
- **Reactive**: We wait for the user to complain.
- **Local**: A lesson learned by Coder isn't automatically propagated to Scout.
- **Ephemeral**: Corrections in chat vanish when the session ends.

## Solution: `cron:reflect`
A periodic job for **Coach** that analyzes recent human interactions and turns them into structural improvements.

### Mechanism
1. **Source**: `.state/human-inputs.jsonl` (contains all raw user messages).
2. **Filter**: Identify messages that contain **Corrections**, **Negatives**, or **Directives** (e.g., "Stop", "Wrong", "Don't", "Change").
3. **Analysis**:
   - Why did the user have to say this?
   - Was it a **Skill Gap**? (Agent didn't know how).
   - Was it a **Context Gap**? (Agent didn't know fact X).
   - Was it a **Process Failure**? (Agent skipped a step).
4. **Action Generation**:
   - If Skill Gap → Task: "Create/Update Skill X".
   - If Context Gap → Task: "Update DOMAIN.md / SOUL.md".
   - If Process Failure → Task: "Add constraint to SOUL.md".

### The Prompt (Brief)
Create `agents/coach/workspace/reflect-prompt.md` that defines this procedure for the Coach agent.

```markdown
# Reflection Protocol
1. Read `.state/human-inputs.jsonl`.
2. Find the last 5 human messages.
3. For each message that is a CORRECTION:
   - Quote the correction.
   - Diagnose the root cause (using "5 Whys").
   - Propose a CONCRETE structural fix (file edit, new skill, prompt change).
   - Create a TODO in `agents/coach/workspace/todo.md` to execute the fix.
```

## Deliverables
1. **`agents/coach/workspace/reflect-prompt.md`**: The instruction file.
2. **`cron.json` update**: Add `cron:reflect` job for Coach (every 6h).
3. **`agents/coach/handlers/reflect.ts`**: The handler (or use generic `run-agent-task`).

## Success Criteria
- **Reduction in Repeats**: The user never has to give the same correction twice.
- **Proactive Growth**: The system improves *between* user sessions.
