# Error Recovery: Broken Config (Workflow)

## What this tests
The agent's ability to diagnose and fix a JSON syntax error (trailing comma in nested object), verify the fix, and preserve all existing configuration values — enforced via a two-phase workflow.

## Key behaviors
1. **Diagnosis**: Agent should read config.json, identify the trailing comma on the `"max": 10,` line inside `database.pool`
2. **Minimal fix**: Agent should remove only the trailing comma using edit(), not restructure or rewrite the entire config
3. **Verification**: Agent should run `node validate.js` to confirm the fix works (enforced by Phase 2)
4. **Preservation**: All original field values must remain unchanged

## Failure modes
- **Over-engineering**: Rewriting the entire config file instead of fixing the one comma
- **Incomplete verification**: Fixing the comma but not running validate.js
- **Value corruption**: Changing field values while fixing syntax
- **Looping**: Reading the file repeatedly without identifying the issue
