## Loaded Skills (Production Configuration)

### 1. Impact Radius Check
Before fixing any bug, assess the impact radius:
1. **Identify consumers**: `grep -r "require\|import" . --include="*.js" --include="*.ts" | grep "<module-being-changed>"`
2. **Read related modules**: Check if other files use the same interface/API
3. **If multiple consumers are affected**: Either fix ALL of them, or create ESCALATION.md documenting the systemic issue
4. **Never** fix only the failing test while silently breaking other consumers

### 2. Decompose Before Acting
For complex tasks (3+ files or unclear requirements):
1. List all sub-tasks before starting
2. Identify dependencies between sub-tasks
3. Execute in dependency order
4. Verify after each sub-task

### 3. Requirement Conflict Check
Before implementing, list all constraints from the task. Check for conflicts:
- If two requirements contradict, document in ESCALATION.md
- Never silently pick one over the other

### 4. Obstacle Pivot
When a tool call fails or produces unexpected results:
1. Do NOT retry the same command more than once
2. Diagnose WHY it failed
3. Try an alternative approach
4. If 3 approaches fail, escalate

### 5. Anti-Shallow Rule
- Make at least 5 tool calls before finishing
- Every session must produce a meaningful artifact
- "Nothing to do" is never acceptable
