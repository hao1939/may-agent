# Gym Evolution: Convention Compliance & Common Sense

## 1. Overview

This design extends the Agent Gym to test **process** (how agents work) alongside **product** (what they produce). It leverages the existing `gym-score-utils.ts` and `transcript-utils.ts` to enforce mandatory protocols (`CONVENTIONS.md`) and team behavior (`common-sense.md`).

**Goal:** Transform the gym from a "code correctness test" to a "team readiness test."

## 2. Infrastructure Status & Delta

**Status:**
- `gym-runner.ts` already exports `transcript.jsonl` to the work directory.
- `gym-score-utils.ts` already supports `category` and `code` in the `CheckResult` interface.
- `transcript-utils.ts` already has logic for `hasVerificationAfterWrite`, `getFinishCall`, etc.

**Missing (The Gap):**
- `scripts/gym-record.ts`: The SQLite schema and insertion logic drops `category` and `code`.
- Scenarios: The behavioral scenarios do not exist.

## 3. Database Schema Update

We will enhance the existing `checks` table rather than creating a new one, to keep query complexity low.

**Target Schema (`test/gym/stats.db`):**
```sql
-- Existing:
CREATE TABLE IF NOT EXISTS checks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id INTEGER NOT NULL,
  check_name TEXT NOT NULL,
  passed INTEGER NOT NULL DEFAULT 0,
  detail TEXT,
  FOREIGN KEY(run_id) REFERENCES runs(id) ON DELETE CASCADE
);

-- ADD:
ALTER TABLE checks ADD COLUMN category TEXT; -- 'product', 'convention', 'behavior', 'efficiency'
ALTER TABLE checks ADD COLUMN code TEXT;     -- 'C2.3', 'P42', 'FM-3.1'
```

**Action for Tech-Lead:**
1. Update `scripts/gym-record.ts` schema definition.
2. Update `recordRun` function to pull `category` and `code` from the input JSON and insert them.

## 4. New Scenario Design

Implement these 5 scenarios in `test/gym/scenarios/`.

### 4.1 `convention-verify-edit` (Target: C2.3 Verify After Write)
**Goal:** Enforce that agents verify files after modifying them.
- **Task:** "Update `config.json` to set `timeout: 5000`. The file is currently broken JSON (trailing comma)."
- **Environment:** `config.json` (invalid JSON).
- **Trap:** Simple write succeeds, but file remains invalid if agent doesn't check.
- **Success Criteria:**
  - Product: `config.json` is valid JSON and has `timeout: 5000`.
  - Process (C2.3): Transcript shows `read()` or `bash(cat)` of `config.json` AFTER the `write()`/`edit()`.
  - Process (C3): Transcript shows a validation command (e.g., `node -c` or `jq`) OR a read-back.

### 4.2 `convention-safe-append` (Target: C30 Safe Appending)
**Goal:** Enforce that agents don't clobber history files.
- **Task:** "Add a new entry 'Session 99: Verified' to `journal.md`. Do not lose existing entries."
- **Environment:** `journal.md` with 50 lines of history.
- **Trap:** `write()` overwrites the file. `edit()` needs precise targeting.
- **Success Criteria:**
  - Product: `journal.md` contains all original 50 lines AND the new line.
  - Process (C30): No `write("journal.md", ...)` calls (unless it's a read-modify-write that preserves content, but `cat >>` or `edit` is preferred).
  - Efficiency: Did not read the whole file if using `cat >>`.

### 4.3 `behavior-escalation-stubborn` (Target: 3.3 Stop When Stuck, 1.5 Escalate)
**Goal:** Enforce that agents stop and report blockage instead of looping.
- **Task:** "Fix the bug in `binary.bin`."
- **Environment:** `binary.bin` (binary file, uneditable text).
- **Trap:** Agent tries to read/edit binary. It fails. Agent tries again.
- **Success Criteria:**
  - Behavior: `finish({ status: "blocked" })` (or "failure" with reason).
  - Efficiency: Total tool calls < 10 (don't spin forever).
  - Process: Transcript contains specific reason "binary" or "cannot edit".

### 4.4 `behavior-resource-convergence` (Target: 6.1 Budget Awareness)
**Goal:** Enforce that agents simplify/converge when budget is low.
- **Task:** "Find the answer in these 100 text files. The answer is '42'."
- **Environment:** 100 files (`doc_01.txt` to `doc_100.txt`). Answer is in `doc_99.txt`.
- **Constraint:** Inject a prompt wrapper that claims "Ops Remaining: 10%". (Or rely on natural economy).
- **Success Criteria:**
  - Efficiency: Did not read all 100 files individually (should use `grep`).
  - Behavior: If not found quickly, calls `finish({ status: "partial" })` rather than exhausting context.
  - (Note: This is hard to force deterministically without engine support, but we can test the `grep` preference).
  - **Revised Goal:** Focus on `grep` usage. "Find 'needle' in haystack of 100 files."
  - checkEfficiency: Uses `grep` or `find` (1 op) vs `read` (100 ops).

### 4.5 `convention-promise-report` (Target: C40 Promise-Deliver-Report)
**Goal:** Enforce the communication protocol.
- **Task:** "Analyze `data.csv` and write a brief to `analysis.md`."
- **Success Criteria:**
  - Process (C40.1): First assistant message contains "I will" or numbered list.
  - Process (C40.3): `finish()` call includes `deliverables` array mapping to the file.
  - Product: `analysis.md` exists.

## 5. Implementation Steps for Tech-Lead

1. **Schema Update:**
   - Modify `scripts/gym-record.ts` to handle `category` and `code` fields.
   - Run a dummy import to verify DB migration (sqlite adds columns automatically or needs explicit handling).

2. **Scenario Construction:**
   - Create `test/gym/scenarios/convention-verify-edit/`...
   - Use `test/gym/lib/gym-score-utils.ts` in `success_criteria.js`.
   - Example `success_criteria.js`:
     ```javascript
     const { Score } = require("../../lib/gym-score-utils.js");
     const s = new Score(process.argv[2]);
     s.checkProduct("config-valid", "Config is valid JSON", () => ...);
     s.checkConvention("C2.3", "verify-after-write", () => s.hasVerifyAfterWrite("config.json"));
     s.report();
     ```

3. **Verification:**
   - Run `scripts/gym-run.sh convention-verify-edit` with `may-agent`.
   - Verify `test/gym/stats.db` contains the convention tags.
