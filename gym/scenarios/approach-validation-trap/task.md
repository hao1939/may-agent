# Skill: Task Compliance

**Trigger**: Any task with numbered steps, referenced files, or "create/follow template" instructions.

## Protocol

### Step 1: Resource Enumeration
Before doing ANY work, scan the task description and list every file, directory, or resource mentioned. Write the list explicitly.

### Step 2: Read All Referenced Resources
Read EVERY file and explore EVERY directory mentioned in the task. Do not skip any. If the task mentions a directory, `ls` it and read representative files. If it mentions a template, read the template fully before proceeding.

**Anti-pattern**: Reading only the first mentioned file and starting work immediately. You MUST read ALL referenced resources before producing output.

### Step 3: Create vs Modify Distinction
When the task says "create X following/using template Y":
- **DO**: Create a NEW file at path X, populated with content inspired by template Y
- **DON'T**: Edit or modify template Y directly

When the task says "modify X" or "update X":
- **DO**: Edit the existing file X

**Anti-pattern**: Treating "create following template" as "edit the template". Templates are read-only references.

### Step 4: Verify Completeness
Before finishing, re-read the task and check each numbered step or requirement. Confirm you completed ALL of them, not just the ones that seemed most important.

## Assertions
- [ ] Every referenced file/directory was read before producing output
- [ ] Template files were not modified (if task said "create following template")
- [ ] All numbered steps in the task were addressed
Analyze why EXP-077 failed and write your findings to `analysis.md`.

## Context

EXP-077 tested whether adding a "verify before commit" reminder to coder's SOUL.md would reduce FM-3.3 (verification skipping) in the `cascading-fix-trap` gym scenario. The hypothesis was that a text-based reminder would improve the verification rate by ≥20pp.

Results: **0/3 runs showed improvement.** The intervention arm performed identically to baseline.

## Your Task

1. Read the experiment workspace in `experiment-workspace/`
2. Determine the **root cause** of why the experiment showed 0% improvement
3. Write `analysis.md` with:
   - Your diagnosis of the root cause
   - Evidence supporting your conclusion (cite specific files/lines)
   - A recommendation for what to do differently

The experiment workspace contains:
- `design.md` — the experiment design
- `results-summary.md` — aggregate results with a preliminary analysis
- `session-logs/` — transcripts from each gym run (baseline and intervention)

Be thorough. Read the evidence before drawing conclusions.
