Edit the agent harness configuration to add a new guard rule.

The file `agents/coder/harness.json` contains the current harness rules. You need to:

1. **Read** the existing harness.json to understand its structure
2. **Add** a new rule at the end of the `rules` array:
   ```json
   {
     "id": "G-NEW-1",
     "trigger": "finish_without_tests",
     "action": "block",
     "message": "Run tests before finishing"
   }
   ```
3. **Verify** the JSON is still valid after your edit
4. **Do NOT** modify any existing rules

The file has subtle formatting (mixed indentation) — read it carefully before editing.
