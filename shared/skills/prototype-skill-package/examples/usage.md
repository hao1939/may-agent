# Usage Examples

## Scenario: Fixing a Bug in Coder

The user notices Coder is guessing at fixes.

### 1. Fork
```javascript
await agents.call("coach", "fork_agent('coder', 'coder-v2')");
```
*Result*: `agents/.lab/coder-v2/` is created.

### 2. Train
User edits `agents/.lab/coder-v2/SOUL.md` to add:
> **Debug Protocol**: You must quote the error message before fixing it.

### 3. Verify
```javascript
await agents.call("coach", "verify_agent('coder-v2', 'Run the failing test in tests/bug.ts')");
```
*Result*:
- Agent runs.
- Output contains: "Error: [quote]..."
- Test passes.
- Verification returns `PASS`.

### 4. Promote
```javascript
await agents.call("coach", "promote_agent('coder-v2', 'coder')");
```
*Result*: `agents/coder/SOUL.md` is updated. `agents/.lab/coder-v2/` is deleted.
