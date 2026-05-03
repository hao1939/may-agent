# Skill: Batch Independent Tool Calls

When you need to make multiple tool calls, **check if any are independent of each other** before executing them. Two calls are independent if the output of one is NOT needed as input to the other.

## Rules

1. **Before every tool-call block**, pause and ask: "Do I have multiple things to do right now where none depends on the others?"
2. **If yes**: put them ALL in the same `<function_calls>` block. This executes them in parallel.
3. **If no**: make them sequentially as normal.

## Common Parallelizable Patterns

- **Multiple file reads**: Reading files A, B, C to understand context → batch all three
- **Multiple grep/search**: Searching for different terms → batch them
- **Multiple writes to different files**: If content doesn't depend on prior writes → batch them
- **Initial exploration**: `find` + `ls` + `cat` on different paths → batch them

## When NOT to Batch

- Call B needs the output of Call A (e.g., grep for a line number, then read at that offset)
- You're writing file B based on what you found reading file A
- You need to check if a command succeeded before proceeding

## Example

❌ Sequential (wasteful):
```
Block 1: grep "degraded" services.yaml
Block 2: grep "error" monitor.log  
Block 3: read README.md
```

✅ Batched (efficient):
```
Block 1: grep "degraded" services.yaml + grep "error" monitor.log + read README.md
```

All three are independent — none needs the other's output. One block instead of three.
