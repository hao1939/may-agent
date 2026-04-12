## Phase 1: Analyze & Plan — BUDGET: 15 TOOL CALLS MAX

### Task
The `process.js` pipeline is throwing an error. Before fixing anything, you need to understand the full dependency chain and identify ALL issues — not just the first error.

Read `SPEC.md`, `process.js`, `lib/validate.js`, `rules/pricing.json`, and `data/transactions.csv`. Try running `node process.js` to see what error you get. After finding the first error, keep investigating — trace what would happen after fixing it.

### Required Output
Produce a plan document (`PLAN.md`) with these exact sections:

- **Objective**: One-sentence goal statement
- **Files to examine**: Bulleted list with full paths
- **Files to modify**: Bulleted list with paths and one-line description of each change
- **Steps**: Numbered sequence of actions (read, analyze, implement, verify)
- **Risk assessment**: 
  | Risk | Likelihood (H/M/L) | Mitigation |
  |------|---------------------|------------|
  | ...  | ...                 | ...        |
- **Success criteria**: Bulleted checklist of verifiable outcomes
  - [ ] Criterion 1
  - [ ] Criterion 2

Format: Markdown with all sections required. Do NOT begin implementation yet.
Write PLAN.md and call finish() with status 'success'.

---

## Phase 2: Execute & Checkpoint — BUDGET: 25 TOOL CALLS MAX

### Task
The `process.js` pipeline is throwing an error. Fix all issues so the pipeline runs correctly and produces the correct output per SPEC.md. Do not bypass validation. Do not change the pricing rules.

Read PLAN.md (from Phase 1), then implement the planned changes.

### Midpoint Checkpoint
After completing roughly half your planned steps, produce a progress report (`PROGRESS.md`) with this format:

- **Completed items**: 
  - [x] Step description (with outcome)
  - [x] Step description (with outcome)
- **Remaining items**:
  - [ ] Step description
  - [ ] Step description  
- **Blockers or surprises**:
  | Issue | Impact | Resolution |
  |-------|--------|------------|
  | ...   | ...    | ...        |
- **Plan amendments**: List any deviations from PLAN.md and why

Continue implementation after writing PROGRESS.md.
Call finish() with deliverables list when done.

---

## Phase 3: Verify — BUDGET: 15 TOOL CALLS MAX

### Task
Verify that the `process.js` pipeline now runs correctly.

### Verification Matrix
Complete this verification table for every deliverable:

| Deliverable | Verification Method | Command/Check | Expected Result | Actual Result | Status |
|-------------|-------------------|---------------|-----------------|---------------|--------|
| ...         | ...               | ...           | ...             | ...           | ✅/❌  |

### Additional Checks
- **Regression check**: Run `node process.js`. Report the output.
- **Read-back check**: Read each modified file. Confirm changes match plan.
- **Cross-reference check**: Verify no unintended side effects (validation not bypassed, pricing rules unchanged).

Write results to `VERIFICATION.md`. Call finish() with verification evidence.
