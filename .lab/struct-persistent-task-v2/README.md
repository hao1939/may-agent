# Lab Fork: struct-persistent-task-v2

## Hypothesis
Adding persistent-task workflow instructions to SOUL.md (top), skills/, and context.md will make the agent call `workflow.run("persistent-task", ...)` when given a resume-project task.

## Intervention
- **SOUL.md**: Added `## ⚠️ CRITICAL BEHAVIORAL RULE` at the very top, before Identity section
- **skills/persistent-task-workflow.md**: Skill file with TRIGGER/ACTION pattern, anti-pattern warning
- **context.md**: Reinforcement in persistent context ("ALWAYS use persistent-task workflow")

## Results
- **Baseline**: 0% (agent reads project file and does work inline)
- **struct-persistent-task-v2**: ~50% (2/4 direct runs passed)
- **STEP variant** (task-level instruction): 100%

## Analysis
The triple reinforcement (SOUL top + skill + context) improved from 0% to ~50%, but is unreliable. The model's natural instinct to "just do the work" when it sees a file path competes with the workflow instruction buried in a large system prompt.

The STEP variant succeeds at 100% because the task itself walks the agent through the workflow call step by step. This confirms that **task-level instructions dominate system-prompt instructions** for behavioral compliance.

### Key Insight
For workflow adoption behaviors, structural prompt changes alone are insufficient. The task itself needs to reference the workflow, or the context.md injection needs to be much more prominent (it appears as "What You Know" in the user message, which is more salient than system prompt content).

## Gym Batch Bug
Note: gym-batch.sh failed to capture results (all ERROR, empty results.jsonl) even though individual gym-run.sh calls succeeded. The batch's temp file redirect (`> "$tmpout"`) may not be capturing the subprocess output correctly. This is a separate infrastructure issue.
