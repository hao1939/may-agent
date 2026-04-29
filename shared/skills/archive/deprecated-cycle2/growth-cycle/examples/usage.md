# Usage Examples

## Scenario: Fixing "Shotgun Debugging" in Coder

The user notices Coder guesses at fixes without reading errors.

### 1. Fork
```javascript
await agents.call("coach", "fork_agent('coder', 'coder-strict')");
```
*Result*: `agents/.lab/coder-strict/` is created with a full copy.

### 2. Train
Edit `agents/.lab/coder-strict/SOUL.md` to add:
> **Debug Protocol**: You must quote the error message before fixing it.

### 3. Verify
```javascript
await agents.call("coach", "verify_agent('coder-strict', 'Run the failing test in tests/bug.ts')");
```
*Result*:
- Agent runs the task.
- Output contains: "Error: [quoted error]..."
- Test passes.
- Verification returns PASS.

### 4. Promote
```javascript
await agents.call("coach", "promote_agent('coder-strict', 'coder')");
```
*Result*: `agents/coder/SOUL.md` is updated. Fork is deleted.

## Scenario: Failed Experiment (Discard Path)

### 1. Fork
```javascript
await agents.call("coach", "fork_agent('evaluator', 'evaluator-v2')");
```

### 2. Train
Modify scoring weights in the fork.

### 3. Verify — FAILS
```javascript
await agents.call("coach", "verify_agent('evaluator-v2', 'Score session X')");
```
*Result*: Agent produces incorrect scores. Verification fails.

### 4. Discard
```javascript
await agents.call("coach", "discard_agent('evaluator-v2')");
```
*Result*: Fork deleted. Original evaluator untouched.
