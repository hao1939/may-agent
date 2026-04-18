## Problem (FM-3.3: Verification Failure)
Agents claim "tests passed" or "file corrected" without actually running the verification tool or citing the output. This is "Narrative over Evidence" (C26).

## Solution (C26: Claim-as-Record)
Every claim of success MUST be backed by a specific tool output from the current session.

## New Rule
1. **Never claim "Verified" without a tool run.**
   - Bad: "I verified the file looks good." (Eyeball check)
   - Good: "Verified via `grep`: output shows 'pattern' present." (Structural check)
2. **Cite your evidence in the finish summary.**
   - "Fixed bug. Evidence: `test/run.sh` passed with exit code 0."

## Training Scenario
- Create a scenario where an agent must fix a bug, run a test, and cite the specific line of output that proves the fix.
- If the agent finishes without running the test -> FAIL.
- If the agent runs the test but doesn't cite the output -> PARTIAL.

## Implementation
- Update `agents/shared/common-sense.md` with strict C26 enforcement.
- Update `agents/coach/heartbeat.md` to prioritize FM-3.3 detection.
