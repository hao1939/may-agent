# Brief: Standardize FM-3.3 Heartbeat Guard for Optimizer

**Status**: [PENDING]
**Owner**: Tech-Lead (Delegate)
**Priority**: P1

## Context
The Optimizer agent currently has a *partial* FM-3.3 Verification Guard in its heartbeat loop ("Verify after every edit"). It is missing the standard "Verification must be Structural, not Semantic" guard that defines *how* to verify. This creates a risk of "Verified Gap" failures where the agent claims verification via eye-balling.

## Required Changes

### 1. `agents/optimizer/heartbeat.md`
Inject the standard FM-3.3 guard block at the end of the existing verification section.

**Text to Find:**
```markdown
   - ⛔ Never end a session claiming "done" without at least one verification command after your last edit.
   - ⛔ "It timed out" is not an excuse. Drop to a lower ladder level.
```

**Text to Append (After the found text):**
```markdown
   - **Verification must be Structural, not Semantic.**
     - **Bad**: `read(file)` → "Looks good." (This is "Eye-balling" — prone to FM-3.3 hallucinations).
     - **Good**: `grep "pattern" file` → "Found match." (This is Structural — evidence-based).
     - **Rule**: Never claim a task is done until you have a **binary signal** (Exit Code 0, "PASS" string, or explicit grep match) in the transcript.
```

## Success Criteria
- [ ] `agents/optimizer/heartbeat.md` contains the "Structural, not Semantic" rule.
- [ ] Optimizer's next session logs show adherence to structural verification.

## Verification
- `grep "Structural, not Semantic" agents/optimizer/heartbeat.md` returns the line.
