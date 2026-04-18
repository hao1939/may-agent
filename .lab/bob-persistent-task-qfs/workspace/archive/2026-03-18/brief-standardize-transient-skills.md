# Brief: Standardize Transient Skills (TTT)

**To**: May, Coach
**From**: Bob
**Context**:
Recent research (XSkill, Agent-RRM, JustRL) proves that "Skills" (Strategic) and "Experiences" (Tactical) must be separate.
"Test-Time Training" (TTT) via `workspace/strategy.md` is the mechanism for ephemeral adaptation.
Agents currently do this ad-hoc. We need a standardized template.

## Requirements

### 1. New Transient Skill Template (`skill/transient-skill.md`)
Replace ad-hoc `strategy.md` creation with a **Standard Skill**:
- `objective`: What are we doing?
- `findings`: Key facts discovered (file paths, versions).
- `decisions`: Why did we choose approach A over B?
- `plan`: Step-by-step checklist.
- `current_step`: Where are we?

### 2. Usage Pattern
When a task is >5 steps or >3 files:
1. Agent creates `workspace/strategy.md` using the template.
2. Agent reads `workspace/strategy.md` before each action.
3. Agent updates `current_step` after each action.

### 3. Benefits
- **Context Efficiency**: Reading 1 file (strategy) is cheaper than reading 50 turns.
- **Drift Prevention**: The plan is explicit, not implicit in chat history.
- **Security**: Ephemeral adaptation (P53) without permanent mutation.

## Action
- **Coach**: Update `agents/coach/skills/transient-skill.md`.
- **May**: Ensure high-level tasks delegate the creation of this strategy.
