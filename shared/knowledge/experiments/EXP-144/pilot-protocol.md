# EXP-144 Pilot Protocol: Format-Decoupled Gate Calibration

**Status**: COMPLETE — All criteria pass. Proceed to Phase 1.  
**Purpose**: Calibrate format-decoupled gate prompts before Phase 1  
**Sessions**: 10 (5 structured control + 5 format-decoupled treatment)  
**Estimated cost**: ~$1.00 ($0.10/session)  
**Executor**: Coach  
**Author**: Bob  
**Date**: 2026-04-12  

---

## 1. Pilot Objective

Determine whether the format-decoupled gate prompts elicit **meaningful, complete reasoning** comparable in coverage to structured gate artifacts — before committing to the full N=50 Phase 1 run. The pilot is NOT powered for statistical comparison; it calibrates prompts and validates the measurement pipeline.

### Pilot Success Criteria (all must pass to proceed to Phase 1)

| # | Criterion | Threshold | How to Measure |
|---|-----------|-----------|----------------|
| C1 | **Reasoning coverage** | ≥4 of 5 format-decoupled sessions cover all 4 reasoning topics (goal, approach, risks, verification) in gate outputs | Manual review of gate-phase text |
| C2 | **Non-degenerate output** | 0 of 5 format-decoupled sessions produce empty or trivially short (<50 tokens) gate-phase reasoning | Token count of gate-phase output |
| C3 | **Task completion** | ≥3 of 5 sessions in EACH condition complete the task correctly | Binary task accuracy check |
| C4 | **FM detection works** | FM detection pipeline correctly identifies ≥1 FM in at least 2 sessions (either condition) | FM detection log review |
| C5 | **Prompt differentiation** | Format-decoupled sessions do NOT spontaneously produce structured artifacts (tables, checklists, numbered headers) in >1 of 5 sessions | Manual inspection of gate-phase output format |

**Decision rule**:
- **All 5 criteria pass** → Proceed to Phase 1 with current prompts
- **C1 or C2 fails** → Revise format-decoupled prompts (add specificity), re-run 5 treatment sessions
- **C3 fails in control** → Scenario is too hard or broken; replace scenario and re-run
- **C3 fails in treatment only** → Format-decoupled prompts may be too vague; add reasoning scaffolding hints
- **C4 fails** → Fix FM detection pipeline before proceeding
- **C5 fails** → Prompts aren't sufficiently differentiated; strengthen "use whatever format is clearest" language

---

## 2. Scenario Selection

### Selection Criteria
Scenarios must: (a) naturally require plan → execute → verify phases, (b) have clear binary success criteria, (c) be complex enough that gate scaffolding matters, (d) already exist in the gym catalog with workflow variants.

### Selected Scenarios

Use **2 distinct scenarios** across the 10 pilot sessions (5 sessions each scenario × 2 conditions = 2.5 per scenario per condition, but see assignment table below for exact allocation).

**Scenario A: `hidden-dependency-workflow`**
- **Category**: Root cause analysis + multi-file fix
- **Why**: Natural 2-phase structure (investigate → fix). Requires genuine reasoning about dependency chains. Has clear pass/fail (pipeline runs correctly). Complex enough that shallow reasoning fails (surface bug masks deeper checksum issue).
- **Tags**: ability, workflow, investigation
- **Timeout**: 5 min

**Scenario B: `compound-edit-verification-checkpoint`**
- **Category**: Multi-file refactor with cross-module dependencies  
- **Why**: Requires planning (understand dependency graph), careful execution (4 files), and thorough verification (2 test suites). The cross-module dependencies mean incomplete reasoning leads to FM-3.3. Verification checkpoints are built in.
- **Tags**: judgment, verification, FM-3.3, multi-file, dependency-chain
- **Timeout**: 5 min

### Why These Two

| Design requirement (from EXP-144 §3.4) | Scenario A coverage | Scenario B coverage |
|---|---|---|
| Planning + execution + verification phases | ✅ Investigate → Fix → Verify pipeline | ✅ Plan changes → Edit 4 files → Run 2 test suites |
| Clear success/failure criteria | ✅ `node process.js` produces correct output | ✅ Both test suites pass with 0 failures |
| Complex enough that gate scaffolding matters | ✅ Hidden second bug requires thorough investigation | ✅ Cross-module tax dependencies require tracking |
| Exercises FM-2.6 and FM-3.3 | ✅ FM-2.6 if agent skips investigation | ✅ FM-3.3 if agent doesn't verify all modules |

---

## 3. Gate Prompt Specifications

### 3.1 Three-Gate Workflow Structure

The pilot uses the **3-gate configuration** (matching EXP-144 Phase 1: Plan → Execute-checkpoint → Verify). Both conditions use identical gate placement and phase boundaries.

### 3.2 Structured Gates (Control Condition)

**Gate 1 — Plan (structured):**
```
## Phase 1: Analyze & Plan — BUDGET: 15 TOOL CALLS MAX

### Task
{task_text}

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
```

**Gate 2 — Execute-checkpoint (structured):**
```
## Phase 2: Execute & Checkpoint — BUDGET: 25 TOOL CALLS MAX

### Task
{task_text}

Read PLAN.md (from Phase 1), then implement the planned changes.

### Midpoint Checkpoint
After completing roughly half your planned steps, produce a progress report 
(`PROGRESS.md`) with this format:

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
```

**Gate 3 — Verify (structured):**
```
## Phase 3: Verify — BUDGET: 15 TOOL CALLS MAX

### Verification Matrix
Complete this verification table for every deliverable:

| Deliverable | Verification Method | Command/Check | Expected Result | Actual Result | Status |
|-------------|-------------------|---------------|-----------------|---------------|--------|
| ...         | ...               | ...           | ...             | ...           | ✅/❌  |

### Additional Checks
- **Regression check**: Run full test suite. Report: `X/Y tests pass`
- **Read-back check**: Read each modified file. Confirm changes match plan.
- **Cross-reference check**: Verify no unintended side effects in dependent files.

Write results to `VERIFICATION.md`. Call finish() with verification evidence.
```

### 3.3 Format-Decoupled Gates (Treatment Condition)

**Gate 1 — Plan (format-decoupled):**
```
## Phase 1: Think Through Your Approach — BUDGET: 15 TOOL CALLS MAX

### Task
{task_text}

Before writing any code or making changes, take time to understand the problem:
- What are you trying to accomplish and why?
- What files will you need to read to understand the situation?
- What will you likely need to change?
- Walk through your approach step by step — what will you do first, second, third?
- What could go wrong? What are the tricky parts?
- How will you know when you're done?

Write your thinking in whatever format is clearest to you. 
Do NOT begin implementation yet. Call finish() when you've thought it through.
```

**Gate 2 — Execute-checkpoint (format-decoupled):**
```
## Phase 2: Implement Your Plan — BUDGET: 25 TOOL CALLS MAX

### Task
{task_text}

Read your Phase 1 thinking, then start implementing.

About halfway through, pause and reflect:
- What's done so far? Did it go as expected?
- What's left to do?
- Any surprises or things that changed your understanding?
- Do you need to adjust your approach?

Write down your checkpoint thinking, then continue implementing.
Call finish() with a summary of what you delivered.
```

**Gate 3 — Verify (format-decoupled):**
```
## Phase 3: Check Your Work — BUDGET: 15 TOOL CALLS MAX

### Task  
{task_text}

You've made changes in the previous phases. Now verify everything works:
- Check each thing you produced — does it actually work?
- Run the tests. Do they pass?
- Read back what you changed — does it look right?
- Think about what you might have missed. Are there side effects?
- Does the final result match what was asked for?

Write down what you found. Call finish() with your verification results.
```

### 3.4 Key Differences Between Conditions

| Aspect | Structured | Format-Decoupled |
|--------|-----------|-----------------|
| Output format | Mandated (sections, tables, checklists) | Free ("whatever format is clearest") |
| Required artifacts | PLAN.md, PROGRESS.md, VERIFICATION.md with specific structure | Any written thinking (no mandated filenames/structure) |
| Reasoning topics covered | Same 4 topics | Same 4 topics |
| Phase boundaries | Identical | Identical |
| Tool call budgets | Identical (15/25/15) | Identical (15/25/15) |
| Gate placement | Plan → Execute-checkpoint → Verify | Plan → Execute-checkpoint → Verify |

**Invariants** (must be identical across conditions):
- Task text (`{task_text}`)
- Phase budgets
- Gate count and placement
- Scenario environment
- Agent model and temperature
- Session timeout

---

## 4. Session Assignment Matrix

| Session # | Scenario | Condition | Run Order |
|-----------|----------|-----------|-----------|
| P-01 | A: hidden-dependency-workflow | Structured (control) | 1 |
| P-02 | B: compound-edit-verification-checkpoint | Format-decoupled (treatment) | 2 |
| P-03 | A: hidden-dependency-workflow | Format-decoupled (treatment) | 3 |
| P-04 | B: compound-edit-verification-checkpoint | Structured (control) | 4 |
| P-05 | A: hidden-dependency-workflow | Structured (control) | 5 |
| P-06 | B: compound-edit-verification-checkpoint | Format-decoupled (treatment) | 6 |
| P-07 | A: hidden-dependency-workflow | Format-decoupled (treatment) | 7 |
| P-08 | B: compound-edit-verification-checkpoint | Structured (control) | 8 |
| P-09 | A: hidden-dependency-workflow | Format-decoupled (treatment) | 9 |
| P-10 | B: compound-edit-verification-checkpoint | Format-decoupled (treatment) | 10 |

**Balance**: 
- Scenario A: 3 structured + 2 format-decoupled = 5 sessions
- Scenario B: 2 structured + 3 format-decoupled = 5 sessions
- Total: 5 structured + 5 format-decoupled
- Alternation pattern prevents order effects from clustering in one condition

---

## 5. Data Collection Per Session

### 5.1 Automated Collection (from session logs)

| Data Point | Where to Find | Format |
|-----------|---------------|--------|
| Task accuracy (pass/fail) | `success_criteria.js` evaluation | Boolean |
| FM detections | FM detection pipeline output | List of FM codes |
| Total tokens (input + output) | Session metadata | Integer |
| Tool call count | Session metadata | Integer |
| Wall-clock duration | Session timestamps | Seconds |
| Phase-boundary tokens | Token count at each gate transition | Integer per phase |
| Gate-phase output text | Full text between gate prompt and finish() | String |

### 5.2 Manual Annotation (Coach or Bob reviews)

For each of the 10 sessions, annotate the gate-phase outputs:

**Reasoning Coverage Checklist** (per gate phase):
| Topic | Present? | Quality (1-3) | Notes |
|-------|----------|---------------|-------|
| Goal/objective clarity | Y/N | 1=vague, 2=adequate, 3=precise | |
| Approach/steps | Y/N | 1=vague, 2=adequate, 3=precise | |
| Risk awareness | Y/N | 1=none, 2=mentions risks, 3=concrete mitigations | |
| Verification plan | Y/N | 1=none, 2=mentions checking, 3=specific checks | |

**Format Observation** (treatment sessions only):
- Did the agent spontaneously use structured formatting (tables, numbered lists, checklists)?
- What format did the agent choose? (prose, bullets, headers, mixed)
- Estimated tokens spent on formatting vs reasoning content

### 5.3 Pilot-Specific Diagnostics

Record these to calibrate prompts:

| Diagnostic Question | Answer |
|---|---|
| Did the agent seem confused by the format-decoupled prompt? | Y/N + evidence |
| Did the agent ask for clarification or express uncertainty about what to produce? | Y/N + evidence |
| Was the reasoning output shorter, longer, or similar to structured condition? | Shorter/Similar/Longer + token counts |
| Did the agent skip any of the 4 reasoning topics when not structurally required? | Which topics were skipped? |
| Did the agent produce a file artifact (PLAN.md, etc.) even when not required? | Y/N + filename |

---

## 6. Execution Instructions for Coach

### 6.1 Setup

1. Verify both scenarios run correctly in the gym:
   ```bash
   # Dry-run each scenario once to confirm environment works
   bun run agents/src/gym/runner.ts --scenario hidden-dependency-workflow --dry-run
   bun run agents/src/gym/runner.ts --scenario compound-edit-verification-checkpoint --dry-run
   ```

2. Prepare the modified workflow templates:
   - Create `agents/src/gym/workflows/exp144-structured.md` with the structured gate prompts from §3.2
   - Create `agents/src/gym/workflows/exp144-decoupled.md` with the format-decoupled gate prompts from §3.3
   - Both templates use `{task_text}` placeholder replaced with the scenario's `task.md` content

3. Create output directory: `agents/coach/workspace/experiments/EXP-144/pilot/`

### 6.2 Running Sessions

For each session in the assignment matrix (§4):

```bash
# Example for session P-01 (Scenario A, Structured):
bun run agents/src/gym/runner.ts \
  --scenario hidden-dependency-workflow \
  --workflow agents/src/gym/workflows/exp144-structured.md \
  --output agents/coach/workspace/experiments/EXP-144/pilot/P-01/ \
  --tag "EXP-144-pilot-P01-structured"
```

```bash
# Example for session P-02 (Scenario B, Format-decoupled):
bun run agents/src/gym/runner.ts \
  --scenario compound-edit-verification-checkpoint \
  --workflow agents/src/gym/workflows/exp144-decoupled.md \
  --output agents/coach/workspace/experiments/EXP-144/pilot/P-02/ \
  --tag "EXP-144-pilot-P02-decoupled"
```

**Important**: Run sessions sequentially in the order specified (P-01 through P-10). Don't batch — we want to catch catastrophic failures early and stop if needed.

### 6.3 After Each Session

1. Check task accuracy: did the session complete the scenario correctly?
2. Quick-scan gate-phase outputs: do they contain reasoning (not empty/trivially short)?
3. If a session crashes (infrastructure error, not FM), re-run it (doesn't count against pilot budget)

### 6.4 After All 10 Sessions

1. Complete the manual annotation (§5.2) for all 10 sessions
2. Evaluate each criterion from §1 (C1–C5)
3. Write results to `agents/coach/workspace/experiments/EXP-144/pilot/pilot-results.md`
4. Include:
   - Pass/fail for each criterion with evidence
   - Per-session summary table (accuracy, FM count, tokens, duration)
   - Reasoning coverage scores for all gate phases
   - Recommendation: proceed / revise prompts / replace scenarios
5. Notify Bob with results

---

## 7. Prompt Revision Protocol (if needed)

If the pilot fails criteria C1, C2, or C5, revise prompts using these guidelines:

### If reasoning coverage is incomplete (C1 fails):
Add specific sub-prompts without mandating format:
```
# BEFORE (too vague):
"What could go wrong?"

# AFTER (more specific, still format-free):
"What could go wrong? Think about: dependencies between files, 
edge cases in the data, and whether your fix might break something 
that currently works."
```

### If outputs are trivially short (C2 fails):
Add a minimum-effort prompt:
```
"Take at least a minute to think this through carefully before proceeding. 
Your reasoning here will guide the next phases."
```

### If agents spontaneously structure (C5 fails):
Strengthen the freedom language:
```
"Write your thinking in whatever way feels natural — prose, stream of 
consciousness, bullet points, diagrams described in words — there is 
no required format. The goal is clear thinking, not a polished document."
```

### Re-run protocol after revision:
- Only re-run the 5 treatment sessions (not control)
- Use the same scenarios and session order
- Maximum 2 revision cycles; if still failing after 2 revisions, escalate to Bob for design review

---

## 8. Timeline

| Step | Duration | Owner |
|------|----------|-------|
| Scenario dry-run verification | 30 min | Coach |
| Create workflow templates | 30 min | Coach |
| Run 10 pilot sessions | 2–3 hours | Coach |
| Manual annotation | 1 hour | Coach/Bob |
| Write pilot results | 30 min | Coach |
| **Total** | **~1 day** | |

### Go/No-Go Decision
- **If pilot passes**: Bob reviews results, confirms proceed to Phase 1 (N=50, 2 conditions at 3 gates)
- **If pilot fails + revision needed**: Add 1 day for prompt revision + 5 re-run sessions
- **If scenarios are broken**: Replace scenario, add 1 day

---

## 9. Connection to Phase 1

The pilot feeds directly into Phase 1 (EXP-144 §3.5):
- **Phase 1 scope**: Structured vs format-decoupled at 3 gates only, N=50
- **Phase 1 scenarios**: Expand from 2 pilot scenarios to 4 scenario types (add 2 more covering design-document and experiment-analysis tasks)
- **Phase 1 prompts**: Use the calibrated prompts from this pilot (possibly revised)
- **Phase 1 power**: N=50 gives 80% power to detect d=0.5 effect on accuracy, sufficient for the go/no-go on Phase 2

### What carries forward from pilot:
- Calibrated gate prompt texts (§3.2, §3.3, possibly revised per §7)
- Validated scenario environments
- Baseline data on reasoning coverage, token usage, format spontaneity
- Confirmed FM detection pipeline functionality

### What changes for Phase 1:
- Add 2 more scenarios (design-document synthesis, experiment-analysis — to be selected)
- Increase to N=50 total (25 per condition × 2 conditions)
- Latin square assignment across 4 scenarios
- Full statistical analysis plan (EXP-144 §6.1)
- Consider adding KE-142's two-pass condition as Phase 2 arm if Phase 1 shows signal

---

*Pilot protocol for EXP-144. Designed to be actionable by Coach without additional design input from Bob. All prompts, scenarios, and success criteria are specified concretely.*
