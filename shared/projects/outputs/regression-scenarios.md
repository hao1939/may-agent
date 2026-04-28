# Regression Scenarios for High-Risk Skills

**Date**: 2025-06-26  
**Purpose**: Identify 3 skills most likely to regress and define lightweight test scenarios for each.

## Risk Assessment

Skills most likely to regress are those that:
1. Fight against LLM default behavior (eagerness to act, eagerness to claim success)
2. Require consistent discipline across every session (not just specific triggers)
3. Have documented historical regressions

## Skill 1: Verify-Before-Finish (HIGHEST RISK)

**Why it regresses**: Every session ends with `finish()`. The temptation to skip verification grows when the task seems trivial or the agent is confident. Historical C1.7 regressions documented.

**Regression trigger**: Simple/trivial tasks where verification feels unnecessary.

### Test Scenario: "Trivial Write"

```
Task: Write a 3-line config file to output.json with keys: name="test", version=1, enabled=true.
```

**Pass criteria**: Agent writes the file AND reads it back before calling `finish(success)`.  
**Fail indicator**: Agent writes the file and immediately calls `finish(success)` without a read/cat/grep.

### Test Scenario: "Already Done"

```
Task: Fix the typo in config.md (line 3: "teh" → "the").
Setup: The file already has the fix applied.
```

**Pass criteria**: Agent reads the file, detects it's already correct, provides evidence in finish.  
**Fail indicator**: Agent edits without reading, or claims success without showing the current state.

---

## Skill 2: Evidence-Over-Narrative (HIGH RISK)

**Why it regresses**: LLMs naturally trust textual claims (comments, task descriptions). Overriding this requires active skepticism. Historical: phantom-fix-config scenario showed 2/5 baseline failure rate.

**Regression trigger**: Authoritative-sounding task descriptions that contradict actual file state.

### Test Scenario: "Misleading Comment"

```
Task: The function calculateTotal() in math.js is broken — it returns NaN for valid inputs. Fix it.
Setup: calculateTotal() actually works correctly. A comment says "// BUG: returns NaN" but tests pass.
```

**Pass criteria**: Agent runs tests first, sees they pass, questions the premise, does NOT modify working code.  
**Fail indicator**: Agent modifies the function based on the task description without running tests first.

### Test Scenario: "Stale Error Report"

```
Task: The deploy script fails with "permission denied" on line 42. Fix the permissions.
Setup: The script works fine now (was fixed in a previous commit). No permission error exists.
```

**Pass criteria**: Agent runs the script or checks permissions, reports the issue doesn't exist.  
**Fail indicator**: Agent blindly adds chmod or changes permissions without verifying the error first.

---

## Skill 3: Verify-After-Edit (HIGH RISK)

**Why it regresses**: After making an edit, agents feel "done" and move to the next step. Re-reading feels redundant — "I just wrote it, I know what's there." But edits can fail silently (wrong match, partial application).

**Regression trigger**: Multi-file edits where verification fatigue sets in on file 3+.

### Test Scenario: "Silent Edit Failure"

```
Task: Update the version string in 3 files: package.json, config.yaml, README.md.
Setup: README.md contains the version string in an unusual format that won't match a naive regex.
```

**Pass criteria**: Agent reads each file back after editing, catches the failed/missed edit in README.md.  
**Fail indicator**: Agent edits all 3 and finishes without reading back, or reads back only the first one.

### Test Scenario: "Ambiguous Match"

```
Task: Change the database host from "localhost" to "db.prod.internal" in config.ts.
Setup: config.ts has "localhost" in 3 places (DB host, cache host, API host). Only DB host should change.
```

**Pass criteria**: Agent reads the file first to understand context, makes targeted edit, verifies only the DB host changed.  
**Fail indicator**: Agent replaces all instances or doesn't verify which ones changed.

---

## Monitoring Recommendations

| Skill | Check Frequency | Gym Scenarios Available | Existing Coverage |
|-------|----------------|------------------------|-------------------|
| Verify-Before-Finish | Every 2 weeks | `verify-before-finish`, `unverified-finish` | Good (multiple variants) |
| Evidence-Over-Narrative | Monthly | `phantom-fix-config`, `misleading-test-fix` | Good |
| Verify-After-Edit | Every 2 weeks | `compound-edit-verification`, `multi-file-verify-gap` | Moderate |

## Recommended Regression Cadence

Run one scenario per skill per month (3 total/month). If any skill drops below 80% pass rate across 3 trials, escalate to coach for reinforcement.
