# Diagnosis: Bob use-persistent-task Failure

## Error Pattern
- **FM Code**: Tool-choice/procedural (knowledge visibility)
- **Description**: Bob knows about persistent-task (documented in TOOLS.md) but doesn't invoke it when resuming projects. 8% pass rate across 144 runs.
- **Root Cause**: Instruction buried in TOOLS.md — not visible at decision time.

## Target Agent
`bob`

## Selected Method
**context.md fact injection** (Rank #1 in evidence hierarchy, 100% proven for environmental knowledge)

## Why This Method
1. Evidence hierarchy ranks context.md facts #1 (100% effectiveness for environmental knowledge)
2. Decision framework: "Could a context.md fact handle this? → Use context.md"
3. This is a knowledge-visibility problem, not judgment — perfect fit for context.md
4. Prior experiments used unknown methods and all failed; context.md not yet tried
5. NOT a judgment/restraint problem (no need for workflow enforcement #15)

## Gym Scenarios
- Primary: `use-persistent-task`
- Variants: `use-persistent-task-B`, `use-persistent-task-RUN`, `use-persistent-task-TOP`

## Specific Change
Add to `agents/bob/context.md` in the `[SESSION START]` section:
```
- **Project resumption**: When you see an active project (existing task.md, prior work), use `workflow.run('persistent-task', ...)` to resume it. Don't start fresh.
```

## Baseline & Target
- Baseline: 8% (144 runs)
- Target: >50% pass rate
