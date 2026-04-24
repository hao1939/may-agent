# Pre-Finish Verification Checklist

Before calling `finish()`, you MUST complete this verification checklist. Do not skip any step.

## Mandatory Checklist

### Step 1: Enumerate All Changes
List every file you modified or created during this session. Write this list explicitly — do not rely on memory.

### Step 2: Verify Each Change Took Effect
For EACH file in your list:
- Re-read the file (use `read()` or `bash cat`)
- Confirm the change is actually present in the file
- If the file should compile/parse, verify it does

### Step 3: Run Verification Commands
- If there are tests: run them. Check exit code 0.
- If there's a build: run it. Check it succeeds.
- If the task specified verification criteria: check each one.

### Step 4: Check for Unresolved Issues
Scan your session for:
- Error messages you encountered but didn't resolve
- Files you expected to exist but didn't find
- Commands that returned non-zero exit codes
- TODO items you noted but didn't complete

### Step 5: Match Status to Reality
- Found unresolved issues? → `finish(status: "partial")` or `finish(status: "blocked")`
- All changes verified and no open issues? → `finish(status: "success")`
- NEVER use `status: "success"` if ANY verification step failed

## Common FM-3.3 Traps
- ❌ "I wrote the file" — but did you verify it was written correctly?
- ❌ "The test should pass" — but did you actually run it?
- ❌ "I fixed the bug" — but did you check for secondary bugs?
- ❌ "Everything looks good" — but did you re-read your changes?
