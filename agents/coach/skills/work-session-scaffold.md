# Skill: Work Session Scaffold

**Purpose**: Prevent the three failure modes that tank coach work-session quality: (1) task-spec mismatch — doing something different from what was asked, (2) runaway ops — 80+ ops without checkpointing, getting interrupted with nothing saved, (3) claiming success without verifying deliverables exist.

**Evidence**: Coach JS quality bimodal — heartbeats avg 0.81, but work sessions include 0.18 (FM-2.6 + FM-3.3), 0.25 (op exhaustion), 0.30 (task mismatch). All failures share the same root: diving into execution without extracting the concrete deliverable first.

---

## When to Apply

Apply at the START of any session tagged `[WORK SESSION]` or any session with a multi-step objective (experiment runs, analysis, scenario design, regression checks).

Do NOT apply to heartbeats, cron jobs, or single-question dispatches — those have their own structure.

---

## Phase 0: EXTRACT (1-2 ops, before anything else)

Read the task prompt. Write down THREE things before doing any work:

```
TASK EXTRACT:
1. DELIVERABLE: [exact file path or artifact expected]
2. METHOD: [the specific command/tool/approach required]
3. DONE-WHEN: [how to verify the deliverable is correct]
```

**Rules:**
- If the task says "run via gym-batch.sh" → METHOD must use gym-batch.sh, not gym-run.sh in a loop
- If the task says "output to workspace/X.md" → DELIVERABLE = workspace/X.md
- If the task says "run N trials" → DONE-WHEN = N results in database
- If any of the three are unclear, STOP and re-read the task. Do not guess.

**Why this matters**: FM-2.6 (task-spec mismatch) caused quality 0.18 in EXP-164 — the task required `gym-batch.sh` with specific args, the agent used wrong syntax and claimed success anyway.

---

## Phase 1: PLAN (1-3 ops)

Write a numbered plan of AT MOST 3 steps. Each step must be:
- A single concrete action (not "investigate and analyze")
- Achievable in under 15 ops
- Producing a verifiable output

```
PLAN:
Step 1: [action] → produces [output]
Step 2: [action] → produces [output]  
Step 3: [action] → produces [output]
```

If the work genuinely needs more than 3 steps, split into phases and plan to checkpoint after step 3.

**Anti-pattern**: "Step 1: Understand the problem. Step 2: Do the work. Step 3: Write results." This is not a plan — it's three vague gestures. Each step must name the specific tool call or command.

---

## Phase 2: EXECUTE (budget-aware)

Execute each step. After completing each step, confirm the output exists before moving to the next.

### Op Budget Checkpoints

| After op # | Action |
|------------|--------|
| 15 | Quick check: Am I on track? Is step 1 done? |
| 30 | **MANDATORY CHECKPOINT**: Save progress via `checkpoint()`. What's done, what remains. |
| 45 | Assess: Can I finish in 15 more ops? If not → finish with `partial` status. |
| 60 | **HARD STOP**: Call `finish(status='partial')` with what you have. Do not continue. |

### Command Verification (prevents FM-2.6)

Before running any command that takes >30 seconds:
1. Check the command's `--help` or usage if you haven't used it this session
2. Do a dry run or smoke test with 1 trial before running the full batch
3. Verify the command succeeded (exit code 0, expected output) before moving on

**Anti-pattern**: Running `gym-batch.sh` with wrong argument syntax, getting an error, then trying 3 variations. Instead: read the help text ONCE, construct the correct command, run it ONCE.

---

## Phase 3: VERIFY DELIVERABLE (1-3 ops, mandatory before finish)

Before calling `finish()`, verify EVERY deliverable from Phase 0:

```
DELIVERABLE CHECK:
- [ ] File exists: read(path) succeeds
- [ ] Content matches: file contains what was promised
- [ ] Task-spec match: deliverable satisfies the original DONE-WHEN criteria
```

**Rules:**
- If deliverable is a file → `read()` it and confirm content
- If deliverable is "N trials run" → query the database to confirm N results
- If deliverable is "analysis written" → read the analysis file, confirm it has data (not just headers)
- If ANY check fails → status is `partial` or `failure`, not `success`

**Why this matters**: FM-3.3 (verification failure) — claiming success while bash output shows errors. The evaluator catches this and scores 0.18.

---

## Phase 4: FINISH (match status to reality)

| Reality | Status | Required fields |
|---------|--------|----------------|
| All deliverables verified | `success` | verification_evidence citing specific read/bash outputs |
| Some deliverables done, some not | `partial` | next_steps describing what remains |
| Blocked on external dependency | `blocked` | blockers with specific context |
| Nothing produced, errors throughout | `failure` | blockers explaining what went wrong |

**Never claim `success` if:**
- A bash command exited with non-zero and you didn't recover
- You didn't read back the file you claim to have written
- The task asked for N items and you produced fewer than N

---

## Worked Example: Running an Experiment Batch

**Task**: "Run EXP-164 baseline + treatment, 10 trials each, 4 arms. Output results to workspace/exp-164-results.md"

### Phase 0: EXTRACT
```
TASK EXTRACT:
1. DELIVERABLE: agents/coach/workspace/exp-164-results.md
2. METHOD: gym-batch.sh with --scenarios and --trials 10
3. DONE-WHEN: 40 gym_runs in database (4 arms × 10), results file with pass rates
```

### Phase 1: PLAN
```
PLAN:
Step 1: Check gym-batch.sh --help for correct syntax → correct command template
Step 2: Run 4 batch commands (one per arm, 10 trials each) → 40 gym_runs in DB
Step 3: Query DB for results, write workspace/exp-164-results.md → results file
```

### Phase 2: EXECUTE
- Op 1: `bash scripts/gym-batch.sh --help` → learn syntax
- Op 2: Run arm 1... Op 3: verify arm 1 complete (10 results in DB)
- Op 4: Run arm 2... etc.
- Op 30: **CHECKPOINT** — 3 arms done, 30 results recorded, 1 arm remaining

### Phase 3: VERIFY
- `read("agents/coach/workspace/exp-164-results.md")` → confirms file has data tables
- DB query: 40 rows in gym_runs with matching batch_id → confirmed

### Phase 4: FINISH
- Status: `success`
- verification_evidence: ["Step N: read(workspace/exp-164-results.md) shows pass rate table", "Step M: DB query confirms 40 gym_runs"]

---

## Anti-Patterns This Scaffold Prevents

| Anti-Pattern | What Happens | Scaffold Prevention |
|-------------|-------------|-------------------|
| **Dive-and-drift** | Start executing immediately, lose track of objective | Phase 0 extracts concrete deliverable before any work |
| **Wrong-tool stubbornness** | Use wrong command syntax, retry 5 times | Phase 2 command verification: check --help first |
| **Runaway investigation** | 80 ops of analysis, interrupted with nothing saved | Phase 2 op budget: checkpoint at 30, hard stop at 60 |
| **Premature success** | Claim done without reading back the file | Phase 3 mandatory verification before finish() |
| **Status inflation** | Call success when deliverable is missing | Phase 4 status rules: unverified = partial, not success |
