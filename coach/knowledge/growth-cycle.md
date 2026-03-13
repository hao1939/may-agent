# Skill: Agent Growth Cycle

**Status**: Verified (2026-03-14)
**Owner**: Coach / Bob

The "Agent Growth Cycle" is the standard mechanism for safely evolving agents. It replaces "editing live agents" with a rigorous **Fork → Train → Verify → Promote** workflow.

## The Principle
**P51 The Growth Cycle**: Evolution requires isolation. Never practice on production.
1. **Fork**: Create a safe lab copy.
2. **Train**: Apply changes (prompts, knowledge, skills).
3. **Verify**: Prove it works with a test.
4. **Promote**: Apply to production.

## The Workflow

### 1. Identify the Need
- **Trigger**: A recurring failure pattern, a missing skill, or a directive to improve an agent.
- **Output**: A clear hypothesis. "If I add X to Coder, it will stop doing Y."

### 2. Fork (`fork_agent`)
Create an isolated clone.
```javascript
// Create agents/.lab/coder-v2
await agents.call("coach", "fork_agent('coder', 'coder-v2')");
```
- **Why**: Keeps the live agent safe while you experiment.
- **Context**: The fork inherits the parent's memory, so it has context on recent failures.

### 3. Train (Edit & Coach)
Modify the fork.
- **Edit**: `agents/.lab/coder-v2/SOUL.md`, `agents/.lab/coder-v2/knowledge/`, etc.
- **Coach**: You can run a coaching session with the fork to explain the new rules.
- **Focus**: Make *one* specific change. Don't overhaul everything at once.

### 4. Verify (`verify_agent`)
Run a test to prove the change worked.
```javascript
// Run a task and check the output/result
const result = await agents.call("coach", "verify_agent('coder-v2', 'Fix the bug in tests/trap.ts')");
```
- **Pass Criteria**: The agent must succeed *and* follow the new protocol.
- **Fail**: If it fails, iterate on step 3 or discard.

### 5. Promote (`promote_agent`)
If verified, overwrite the live agent.
```javascript
await agents.call("coach", "promote_agent('coder-v2', 'coder')");
```
- **Safety**: Only promotes config/knowledge. Does *not* overwrite identity (`agent.json`) or workspace.
- **Cleanup**: Automatically deletes the fork.

### 6. Discard (`discard_agent`)
If the experiment failed.
```javascript
await agents.call("coach", "discard_agent('coder-v2')");
```
- **Why**: Don't leave dead forks cluttering the system.

## Example Scenario: Fixing "Shotgun Debugging"
1. **Observation**: Coder guesses at fixes without reading errors.
2. **Fork**: `fork_agent('coder', 'coder-strict')`.
3. **Train**: Add "Debug Protocol" to `coder-strict/SOUL.md` (Must quote error before fixing).
4. **Verify**: `verify_agent` with a tricky test case. Check logs: did it quote the error?
5. **Promote**: `promote_agent('coder-strict', 'coder')`.

## Constraints
- **Never edit live agents** for behavioral changes. Trivial typos are fine, but logic changes must be forked.
- **Verification is mandatory**. You cannot promote without a passing `verify_agent` run.
- **Clean up**. Always promote or discard.
