# Brief: Deploy FM-3.3 Verification Guard

**Context:**
- Agents frequently claim "Success" without running verification tools (FM-3.3 / C26).
- We have implemented a `finish(success, verification_evidence=[...])` schema update in `src/lib/tools/lifecycle.ts`.
- This update is **structural**: it forces the agent to cite evidence or fail.

**Problem:**
- Agents running on cached/old heartbeats don't know this requirement exists.
- They will try to call `finish(success)` without evidence and get rejected.
- We need to **proactively update their heartbeat instructions** to explain the new requirement.

**Task:**
- Update `agents/*/heartbeat.md` for all agents (Bob, Tech-Lead, Coach, Scout, Amy, Coder, QA).
- Inject the **Verification Discipline** section.

**Change Specification:**
Add this section to `heartbeat.md` (after `0b. FILE READING GUARD`):

```markdown
## 0c. ⛔ Verification Discipline (FM-3.3 Guard)
**Verification must be Structural, not Semantic.**
- **Bad**: `read(file)` → "Looks good." (This is "Eye-balling" — prone to FM-3.3 hallucinations).
- **Good**: `grep "pattern" file` → "Found match." (This is Structural — evidence-based).
- **Rule**: Never claim a task is done until you have a **binary signal** (Exit Code 0, "PASS" string, or explicit grep match) in the transcript.
- **Self-Correction**: If you find yourself saying "I checked and it looks correct," STOP. Run a command that *proves* it is correct.
```

**Deliverables:**
1. Updated `heartbeat.md` for all agents.
2. Verify via `grep "Verification Discipline" agents/*/heartbeat.md`.

**Success Criteria:**
- All active agents have the new guard in their heartbeat instructions.
