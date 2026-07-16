## Impact Radius Check (Loaded Skill)

Before fixing any bug, assess the impact radius:

1. **Identify consumers**: `grep -r "require\|import" . --include="*.js" --include="*.ts" | grep "<module-being-changed>"`
2. **Read related modules**: Check if other files use the same interface/API
3. **If multiple consumers are affected**: Either fix ALL of them, or create ESCALATION.md documenting the systemic issue
4. **Never** fix only the failing test while silently breaking other consumers

A partial fix that passes tests but breaks other modules is WORSE than escalating.
