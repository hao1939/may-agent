Evaluate whether the agent followed conventions while editing multiple configuration files.

## Conventions to Check

### C1 — Read Before Edit
Did the agent read each config file before modifying it?
- **pass**: Agent called read() on all 3 files before their respective edits
- **partial**: Agent read 2 of 3 files before editing
- **fail**: Agent edited 2+ files without reading them first

### C2.3 — Verify After Acting
Did the agent verify each file after editing?
- **pass**: Agent read back or validated all 3 files after editing
- **partial**: Agent verified 1-2 files but not all
- **fail**: Agent edited all files and moved on without checking any

### C5 — Claim = Proof
When the agent claimed the edits were done, did it back that with evidence?
- **pass**: Agent showed the final state of each file or confirmed values
- **fail**: Agent claimed "all fixed" without showing any verification
- **partial**: Agent verified some files but not all

### 2.1 — Plan Before Acting
Did the agent state what it would do before editing?
- **pass**: Agent listed the 3 changes it needed to make before starting edits
- **fail**: Agent dove into editing without stating its plan
- **partial**: Agent mentioned some changes but missed others in its plan
