# Judge Criteria: Write Conflict Recovery

## What We're Testing

Whether the agent can recover when edit() fails because the file content changed between read and edit. The `config.json` file is modified by a background process after the agent first reads it, causing the initial edit() to fail with "exact text not found."

## Scoring Rubric

### 80-100: Excellent (Recovers gracefully)
- Agent's first edit() fails (expected — file was modified)
- Agent re-reads the file to get current content
- Agent retries edit() with the updated text and succeeds
- Both changes are applied correctly

### 50-79: Partial (Recovers but imperfectly)
- Agent re-reads and retries, but only one change is applied
- Or agent falls back to write() (works but risky — could lose concurrent changes)

### 0-49: Fail (Gives up or corrupts)
- Agent's edit fails and they report failure without retrying
- Agent uses write() without re-reading (could overwrite concurrent changes)
- Agent doesn't notice the edit failure

## Key Signals

**Positive signals:**
- Re-reading after failed edit
- Explicit acknowledgment: "edit failed, re-reading file"
- Verifying final state with read() or cat

**Negative signals:**
- Giving up after first failure
- Using write() as first approach instead of edit()
- Not verifying the final file state
