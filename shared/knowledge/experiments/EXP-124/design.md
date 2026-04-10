# EXP-124: Structural Intervention for FM-1.3 (Path-Guessing / Flailing)

**Status**: CONCLUDED — Inconclusive (see results.md for details)
**Date**: 2026-04-10
**Author**: Coach
**Type**: Workflow modification + Gym A/B experiment
**Builds on**: EXP-095 (skill generalization, baseline 0/3), KE-006 (skills don't fix tool-calling patterns), KE-007 (only structural interventions work), EXP-015 (forced discovery phase works)

---

## Problem Statement

Bob has 15 FM-1.3 errors in 7 days (2026-04-03 to 2026-04-10). Despite having a detailed text-based skill (`knowledge-base-navigation.md`) and a context.md hint ("always ls the parent directory before reading"), the errors persist at high volume.

### Error Taxonomy (15 errors, last 7 days)

| Category | Count | % | Description | Example |
|----------|-------|---|-------------|---------|
| **A: Path Guessing** | 6 | 40% | Guesses wrong path, gets ENOENT | `agents/shared/knowledge/topics/` vs correct `library/topics/` |
| **B: Re-reading** | 1 | 7% | Reads same files repeatedly without new information | `cat`'d same 6 files many times with/without timeout |
| **C: Tool/Finish Looping** | 2 | 13% | Repeats same failing tool call (e.g., multiple finish() attempts) | Repeated 'Ghost Deliverable' blocks from finish() |
| **D: Shallow Recovery** | 3 | 20% | Gets ENOENT but doesn't switch to `ls`/discovery | After ENOENT on KE files, moved to other edits instead of finding correct path |
| **E: Grep/Search Flailing** | 3 | 20% | Grep returns empty, tries variations instead of `ls` | `grep "^| DD-"` returned nothing, tried `grep "^| DD-7"`, still nothing |

### Core Pattern: Path-Related Errors = 60%

Categories A + D account for 9/15 (60%) of all FM-1.3 errors. The root cause is identical: Bob constructs a path from memory or assumption, it fails (ENOENT), and then either:
- **A**: Tries another guessed path (or broad `find`) → more wasted calls
- **D**: Gives up and moves on without finding the correct path

Both would be prevented by the same intervention: **mechanically force directory listing before deep-path access**.

### Why Existing Interventions Don't Work

| Intervention | Status | Why It Fails |
|-------------|--------|-------------|
| Skill: `knowledge-base-navigation.md` | Deployed | Text-based skill in system prompt. KE-007: 0/20+ text interventions work. EXP-095 baseline: 0/3 on gym scenario |
| Context.md hint | Deployed | Last line says "always ls the parent directory." Same as skill — text instruction, not structural enforcement |
| EXP-095 generalized skill | Tested | Updated skill trigger scope. Results: still a text skill, subject to system prompt dilution (EXP-095 proved task-level > system-prompt) |

**Key evidence**: Bob already KNOWS the right behavior (the skill explicitly says "ls before read"). But knowing ≠ doing. Per KE-006, "text-level skills work when the agent needs to *know* something it doesn't know. They don't work when the agent *knows* the right behavior but can't stop itself from retrying."

---

## Hypotheses

**H-primary**: A workflow-level discovery pre-phase that forces Bob to list directories and write a navigation map BEFORE starting the main task will reduce FM-1.3 errors by ≥50% on the knowledge-base-navigation gym scenario.

**H-secondary**: The discovery pre-phase will NOT cause a regression in task completion (product quality), because directory listing adds < 5 tool calls of overhead and eliminates 5-15 wasted recovery calls.

**H-tertiary**: Categories A and D (path-guessing + shallow recovery) will show the largest reduction, while C (tool/finish looping) will be unaffected.

---

## Intervention Design: Discovery Pre-Phase in deliver-or-report

### Architecture

Modify `deliver-or-report.ts` to add a **Phase 0: Directory Discovery** before Phase 1 (Analyze & Plan). This phase:

1. Identifies which directories the task will likely require access to
2. Forces Bob to `ls` those directories and their key subdirectories
3. Requires Bob to write a **navigation map** (forced externalization) to a scratch file
4. Passes the navigation map into Phase 1 as context

### Why This Works (per KE-007 / KE-034 / EXP-015)

This is structurally identical to the **forced discovery phase** that achieved 100% in EXP-015 (npx avoidance). The mechanism:

1. **Forced externalization** (KE-034): Bob must write a navigation map, activating analysis before action
2. **Workflow enforcement** (KE-007): The phase separation is structural — Bob CANNOT skip discovery because Phase 1 receives the map as input
3. **Discovery before action** (EXP-015): The npx experiment proved that forced discovery phases make environmental knowledge actionable. Directory listing = environmental knowledge about file locations.

### Phase 0 Prompt Design

```
## Phase 0: Directory Discovery (MANDATORY — DO NOT SKIP)

Before starting the main task, you must map the directories you'll need.

### Instructions
1. List the root directories relevant to your task:
   - `ls agents/shared/knowledge/` (if task involves knowledge base)
   - `ls agents/shared/knowledge/library/` (if task involves library)
   - `ls agents/shared/knowledge/experiments/` (if task involves experiments)
   - `ls agents/shared/knowledge/entries/` (if task involves KE entries)
   - `ls agents/shared/knowledge/hypotheses/` (if task involves hypotheses)
   - Any other directories mentioned in the task

2. For each directory, note key subdirectories and files.

3. Write a NAVIGATION MAP to `agents/bob/workspace/nav-map.md`:
   ```
   # Navigation Map for [task description]
   
   ## Directories Listed
   - agents/shared/knowledge/ → [subdirs]
   - agents/shared/knowledge/entries/ → [first 10 entries]
   ...
   
   ## Key Files I Need
   - [file 1] at [confirmed path]
   - [file 2] at [confirmed path]
   ```

4. Call finish() with the navigation map summary.

⚠️ You must ONLY list directories and write the navigation map.
   Do NOT start analyzing the task. Do NOT read any files yet.
   Phase 1 will handle analysis using your map.
```

### Phase 1 Enhancement

Phase 1's prompt is augmented with:
```
### Navigation Map (from Phase 0 Discovery)
{phase0NavigationMap}

Use the paths in this navigation map. Do NOT guess paths — every path you 
reference must appear in the navigation map above. If you need a file not 
in the map, `ls` its parent directory first.
```

### Why Phase 0 (Not Just a Better Phase 1 Prompt)

Per EXP-095 and KE-007:
- Adding text instructions to Phase 1 ("list directories first") = text intervention → will fail
- A separate phase creates **structural separation** → Bob physically cannot access files in Phase 1 without Phase 0 having run
- The navigation map is **forced externalization** → Bob writes discovery results to a file, which activates systematic thinking (KE-034)

### Scope and Applicability

**Phase 0 should only activate when the task involves filesystem navigation in unfamiliar directories.** Trigger heuristics:

1. Task mentions `knowledge/`, `experiments/`, `library/`, or `entries/`
2. Task requires reading files from nested directory structures
3. Task is multi-file (involves 3+ files across different directories)

For simple single-file tasks (e.g., "edit agents/bob/SOUL.md"), Phase 0 is overhead and should be skipped.

**Initial implementation**: Always run Phase 0 for the gym experiment. Production deployment can add the trigger heuristic later.

---

## Experiment Design

### Gym Scenario: `knowledge-base-navigation`

This scenario tests exactly the FM-1.3 behavior we're targeting:
- Nested directory structure in `environment/`
- Agent must find specific files across subdirectories
- Success criteria include both product (correct synthesis) AND process (efficient navigation)
- Convention checks: tool calls < 25, path errors ≤ 1, targeted file reads ≤ 12

### Existing Baselines (from EXP-095)

| Run | Overall | Product | Convention | Tool Calls | Path Errors |
|-----|---------|---------|------------|------------|-------------|
| B1 | ❌ | 2/5 | 3/5 | 34 | 2 |
| B2 | ❌ | 5/5 | 2/5 | 53 | 6 |
| B3 | ❌ | 1/5 | 3/5 | 42 | 5 |
| **Avg** | **0/3 (0%)** | **2.7/5** | **2.7/5** | **43** | **4.3** |

**Pattern from baselines**:
- Convention consistently fails on `nav-total-tool-calls-under-25` (34, 53, 42) and `nav-no-path-guessing-errors` (2, 6, 5)
- Agent KNOWS to start with ls and INDEX.md (passes nav-uses-ls-first 3/3, nav-finds-index-early 3/3)
- But then devolves into path-guessing as it digs deeper
- This is exactly the pattern our Phase 0 discovery addresses

### Trial Design

| Condition | N | Description |
|-----------|---|-------------|
| **Baseline** | 3 | Existing results from EXP-095 (0/3) — reuse, don't re-run |
| **Treatment** | 6 | Lab fork with Phase 0 discovery pre-phase |

**Why 6 treatment runs**: Baseline is 0/3 (very clear signal). Treatment needs enough runs to distinguish between "works reliably" (5-6/6) vs "works sometimes" (2-3/6) vs "doesn't work" (0-1/6).

### Implementation: Lab Fork

Create `agents/.lab/bob-fm13-discovery/workflows/deliver-or-report.ts` with Phase 0 added before Phase 1.

The gym runner invokes:
```bash
scripts/gym-run.sh knowledge-base-navigation --agent bob --lab bob-fm13-discovery
```

### Primary Metrics

| Metric | Baseline (actual) | Treatment (predicted) | Required Δ |
|--------|-------------------|-----------------------|------------|
| Overall pass rate | 0% (0/3) | ≥50% (3/6) | ≥+50pp |
| nav-tool-calls-under-25 | 0% (0/3) | ≥50% (3/6) | ≥+50pp |
| nav-no-path-guessing | 0% (0/3) | ≥67% (4/6) | ≥+67pp |
| Product pass rate (≥3/5) | 33% (1/3) | ≥50% (3/6) | No regression |

### Secondary Metrics

| Metric | Measured How |
|--------|-------------|
| Tool call count | From criteria output — should decrease from avg 43 |
| Path errors | From criteria output — should decrease from avg 4.3 |
| Phase 0 overhead | Count tool calls in Phase 0 (expected: 3-5) |
| Navigation map quality | Manual inspection — does the map contain correct paths? |

### Success Criteria

| Threshold | Interpretation | Action |
|-----------|---------------|--------|
| Treatment ≥ 67% (4/6) | **Strong**: Discovery phase works reliably | Promote to production deliver-or-report.ts |
| Treatment 33-50% (2-3/6) | **Moderate**: Helps but not sufficient | Investigate failure cases, iterate on Phase 0 prompt |
| Treatment 0-17% (0-1/6) | **No effect**: Discovery phase doesn't help | Investigate alternative interventions (tool-level guard?) |

---

## Risks and Mitigations

| Risk | Mitigation |
|------|-----------|
| Phase 0 adds overhead without benefit (directories are already known) | Trigger heuristic in production — skip Phase 0 for simple tasks |
| Phase 0 lists wrong directories (doesn't anticipate what Phase 1 needs) | Phase 0 prompt includes common directory patterns; Phase 1 can still ls new dirs |
| Navigation map is too vague to be useful | Phase 0 prompt requires specific format with confirmed paths |
| Agent ignores navigation map in Phase 1 | Navigation map is injected as structured context, not just mentioned — same pattern as EXP-015 |
| Knowledge-base-navigation scenario uses `environment/` not `agents/shared/knowledge/` | Phase 0 prompt should detect task-relevant directories from task text, not hardcode paths |
| Adding Phase 0 increases session count (cost) | Phase 0 is lightweight (3-5 tool calls) — costs $0.01-0.02 per run |

---

## Alternative Interventions Considered

### 1. Tool-Level Guard (Read Interceptor)
**Idea**: Intercept `read()` calls on deep paths, check if parent directory was listed, block if not.
**Rejected because**: 
- Code-vs-data-decisions.md says environmental knowledge goes in context.md, not code
- Guard would need path-tracking state across tool calls (complex)
- Would fire on ALL agents, not just Bob
- Would block legitimate reads where path is provided in task context

### 2. Enhanced ENOENT Error Messages
**Idea**: Modify error handler to include "Tip: try `ls [parent]` to find the correct file"
**Rejected because**: 
- KE-006: text hints don't change tool-calling behavior
- Bob already gets ENOENT and doesn't switch to `ls` — adding a text suggestion won't change that

### 3. Task-Level Few-Shot Injection (per EXP-095)
**Idea**: Inject navigation worked examples into every task message
**Partially viable**: EXP-095 proved task-level few-shot = 100%. But:
- Requires task classification to inject appropriate examples
- Only addresses the gym scenario, not production tasks
- Doesn't create structural enforcement — agent could still ignore the examples
**Verdict**: Could be a complementary approach, but workflow enforcement is more robust

### 4. Context.md Path Database
**Idea**: Expand context.md with a complete listing of all commonly-used paths
**Rejected because**:
- Text instruction — will be ignored per KE-007
- Paths change as the knowledge base grows
- Doesn't address the root cause (agent constructs paths from memory instead of listing)

---

## Implementation Plan

### Step 1: Create Lab Fork (~10 min)
```
agents/.lab/bob-fm13-discovery/workflows/deliver-or-report.ts
```
Copy existing deliver-or-report.ts and add Phase 0 before Phase 1.

### Step 2: Phase 0 Implementation (~15 min)
- Parse task text to identify likely directory targets
- Construct Phase 0 prompt requiring directory listing + navigation map
- Run Phase 0 via `ctx.runAgent("bob", phase0Prompt)`
- Extract navigation map from Phase 0 output
- Inject navigation map into Phase 1 prompt

### Step 3: Run Treatment Trials (~30 min)
```bash
for i in 1 2 3 4 5 6; do
  scripts/gym-run.sh knowledge-base-navigation --agent bob --lab bob-fm13-discovery
done
```

### Step 4: Analyze Results (~10 min)
- Compare treatment vs baseline (from EXP-095)
- Compute per-criterion pass rates
- Identify failure patterns in treatment runs (if any)
- Write results.md

### Step 5: Promotion Decision
- If ≥67%: Merge Phase 0 into production deliver-or-report.ts
- If 33-50%: Iterate on Phase 0 prompt design
- If <33%: Document negative result, consider tool-level guard

---

## Connections

- **Prior work**: EXP-095 (baseline 0/3), EXP-015 (forced discovery works), KE-006 (skills don't fix tool patterns), KE-007 (structural only)
- **Knowledge entries**: KE-034 (forced externalization), KE-002 (text rules fail)
- **Hypotheses**: H-091 (matched few-shot), EXP-095 (position > content)
- **Related FM**: FM-1.3 (path guessing), FM-2.6 (tool interface misuse when paths are wrong)
- **Gym scenario**: `knowledge-base-navigation` (existing, unchanged)
- **Production target**: `agents/bob/workflows/deliver-or-report.ts`

---

## Timeline

- Session 1 (this session): Analysis + design doc ← DONE
- Session 2: Implement lab fork + run 6 treatment trials
- Session 3: Analyze results + promotion decision
