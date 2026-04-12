## Phase 1: Analyze & Plan — BUDGET: 15 TOOL CALLS MAX

### Task
Implement tiered tax rates in the pricing engine. The engine currently uses a flat 8% tax rate. New schedule: $0–$50 → 5%, $50.01–$200 → 8%, over $200 → 10%. Rates are based on PRE-discount subtotal. Tax amounts rounded to 2 decimal places. The pricing engine is used by invoice.js, discount.js, and formatter.js. Both test suites (test-pricing.js and test-integration.js) must pass with zero failures.

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
Implement tiered tax rates in the pricing engine. The engine currently uses a flat 8% tax rate. New schedule: $0–$50 → 5%, $50.01–$200 → 8%, over $200 → 10%. Rates are based on PRE-discount subtotal. Tax amounts rounded to 2 decimal places. Ensure all consumer modules (invoice.js, discount.js, formatter.js) work correctly. The existing module API (calculateTotal, getTax, validateItems) must be preserved.

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
Verify the tiered tax rate implementation is correct and all tests pass.

### Verification Matrix
Complete this verification table for every deliverable:

| Deliverable | Verification Method | Command/Check | Expected Result | Actual Result | Status |
|-------------|-------------------|---------------|-----------------|---------------|--------|
| ...         | ...               | ...           | ...             | ...           | ✅/❌  |

### Additional Checks
- **Regression check**: Run `node test-pricing.js` and `node test-integration.js`. Report: `X/Y tests pass`
- **Read-back check**: Read each modified file. Confirm changes match plan.
- **Cross-reference check**: Verify no unintended side effects in dependent files (invoice.js, discount.js, formatter.js).

Write results to `VERIFICATION.md`. Call finish() with verification evidence.
