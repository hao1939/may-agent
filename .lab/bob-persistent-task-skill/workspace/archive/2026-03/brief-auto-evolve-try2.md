# Brief: Auto-Evolve Experiment (Try 2)

**Goal**: Test if the "Auto-Evolve" workflow can fix Coder's behavior.
**Concept**: Coach generates 5 variations of `agents/_archetypes/coder/SOUL.md`. Tech-Lead runs them through `gym` (smoke tier). We pick the winner.

## The Experiment

We will target **Coder**.
Baseline: `agents/_archetypes/coder/SOUL.md`.
Target: Improve pass rate on "smoke" scenarios (currently ~10/13).

### Step 1: Generate Variations (Coach)
Coach will read `agents/_archetypes/coder/SOUL.md` and generate 5 variations.
Each variation should attempt to improve **one specific area** (e.g., verification rigor, error handling, evidence citation).
Save to: `agents/coach/workspace/auto-evolve/variations/v01.md` ... `v05.md`.

### Step 2: Run the Gauntlet (Tech-Lead)
Tech-Lead will write and run a script `agents/tech-lead/workspace/run-variations.sh`:
1. Save current `agents/_archetypes/coder/SOUL.md` to `.bak`.
2. For each variation `v*.md`:
   - Overwrite `agents/_archetypes/coder/SOUL.md` with variation.
   - Run `agents/gym/run-suite.sh --agent coder --tier smoke`.
   - Record pass rate to `agents/tech-lead/workspace/variation-results.md`.
3. Restore `.bak`.

### Step 3: Analyze & Apply (Coach)
Coach reads `variation-results.md`.
- If a variation beats the baseline: Adopt it (Edit `agents/_archetypes/coder/SOUL.md`).
- If none beat it: Discard.

## Actions

### 1. Coach
**Task**: Generate 5 variations of `agents/_archetypes/coder/SOUL.md`.
**Focus**:
- v01: Add "Always verify with grep" rule.
- v02: Add "Explain hypothesis before acting" methodology.
- v03: Add "Read file before edit" constraint (redundant but emphatic).
- v04: Simplify "Role Boundaries" to be more direct.
- v05: Add "Post-Fix Audit" checklist.
**Output**: `agents/coach/workspace/auto-evolve/variations/*.md`.

### 2. Tech-Lead
**Task**: Run the variations against gym smoke tier.
**Script**:
```bash
#!/bin/bash
BASE="agents/_archetypes/coder/SOUL.md"
cp "$BASE" "$BASE.bak"
echo "| Variation | Pass Rate |" > variation-results.md
echo "|---|---|" >> variation-results.md

for v in agents/coach/workspace/auto-evolve/variations/*.md; do
  cp "$v" "$BASE"
  # Run gym, extract "X/Y passed" string. Simplified for brief.
  RESULT=$(scripts/gym-baseline.sh --tier smoke --agent coder | grep "Passed:" | tail -1)
  echo "| $(basename $v) | $RESULT |" >> variation-results.md
done
cp "$BASE.bak" "$BASE"
```

## Success Criteria
- 5 variations generated.
- Results table populated.
- Decision made: Promote or Revert.
