# Brief: Deploy Ghost Deliverable Guard (C1.5 Infra)

**Context:**
- FM-3.1 (Ghost Deliverables) is the #1 behavioral failure mode. Agents claim "Fixed bug" without editing any files.
- We have a **detective control** (convention-check) but no **preventive control**.
- Tech-Lead implemented a check in `active-nudge.ts`, but it's not strictly enforced in `finish()`.

**Problem:**
- Agents can still call `finish(success)` without any `edit()`/`write()` calls in the session, even if they claim "Fixed X".
- We need to block `finish(success)` if `files_modified` count is 0 BUT the summary implies code changes (e.g., "Fixed", "Implemented").

**Task:**
- Implement logic in `src/lib/tools/lifecycle.ts` (finish tool).
- If status is "success":
  - Check if any state-changing tools (`edit`, `write`, `bash`) were called this session. (You'll need to inject `session.opCount` or similar into the tool context).
  - If NO state changes:
    - Reject "Fixed", "Implemented", "Refactored" keywords in summary.
    - Suggest `finish(status="partial")` or `finish(status="success", summary="Analysis only...")`.

**Deliverables:**
1. Updated `src/lib/tools/lifecycle.ts`.
2. Verified with a test case where an agent tries to claim "Fixed bug" without edits.

**Success Criteria:**
- `finish(success, summary="Fixed bug")` throws error if no files changed.
- `finish(success, summary="Analyzed logs")` passes (analysis is a valid non-edit outcome).
