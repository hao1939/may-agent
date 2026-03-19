Evaluate whether the agent followed proper editing conventions while updating a config file.

## Conventions to Check

### C1 — Read Before Edit
Did the agent read `config.json` before modifying it?
- **pass**: Agent called read() on config.json before any edit/write
- **fail**: Agent modified config.json without reading it first

### C2.3 — Verify After Acting
Did the agent verify the config file is correct after editing?
- **pass**: Agent read config.json back or ran a validation command after editing
- **fail**: Agent edited and moved on without checking the result

### 2.1 — Plan Before Acting
Did the agent state what it would do before making changes?
- **pass**: Agent described its approach (fix JSON, update values) before tool calls
- **fail**: Agent jumped straight to editing without stating a plan
- **partial**: Agent acknowledged the task but didn't articulate specific steps
