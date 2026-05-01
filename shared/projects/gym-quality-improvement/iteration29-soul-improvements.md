# Iteration 29: SOUL.md / context.md Behavioral Improvements

## Analysis of Existing Guidance vs Failure Patterns

### What Already Exists (in `/app/agents/coder/`)
| Skill File | Coverage | Gap |
|---|---|---|
| `verification.md` | 9 anti-patterns, very thorough | Focuses on "verify your edits" — doesn't cover "read primary data sources before diagnosing" |
| `state-check-before-action.md` | Read-before-edit protocol | Covers file editing; misses reading data files/logs/configs that inform the fix |
| `verify-before-finish.md` | Last-5-calls must include verification | Already loaded as mandatory |
| `diagnosis-before-action.md` | Diagnose before fixing (from misleading-test-fix) | Covers test-vs-code disagreement but not "read logs/data before coding" |
| `know-when-blocked.md` | Recognize impossible tasks | Already covers escalation — agent still fails. Genuine capability gap. |
| `epistemic-checkpointing.md` | Track what you know | Meta-skill, doesn't address specific behavioral gaps |

### Failure Patterns Not Covered by Existing Guidance

**Pattern A: "Fix without reading primary data" (affects 4 scenarios)**
- `cascading-fix-trap`: Doesn't read `scores.txt` before fixing code that processes it
- `noisy-context-verify`: Doesn't read the actual bug-relevant file before fixing
- `misleading-test-fix`: Doesn't verify math independently before trusting test expectations
- `breadcrumb-reaction`: Doesn't follow breadcrumb hints to read referenced data files

The existing `diagnosis-before-action.md` says "Read the failing test AND the production code" but doesn't say "Read the DATA the code processes." The agent reads code-to-code but not code-to-data.

**Pattern B: "Skip post-edit verification" (affects 3 scenarios)**
- `read-before-edit-verify-gate`: Agent reads before editing (good) but doesn't re-read after (bad)
- `partial-verification-trap`: Agent doesn't verify edge cases after fixing
- `cascading-fix-trap`: Doesn't verify data file integrity after fix

The existing `verification.md` AP-4 covers this ("Assertion Without Evidence") but it's buried in a wall of text. The agent loads it but doesn't internalize it.

**Pattern C: "Solve symptom, not system" (affects 2 scenarios)**
- `close-the-loop`: Fixes deploy failure but doesn't create prevention mechanism
- `partial-verification-trap`: Fixes bug but doesn't add test coverage

This is not covered by any existing skill.

---

## Proposed Changes

### Change 1: Add to `context.md` — "Read Primary Data Sources" rule
**Location**: Under `## Mandatory Procedures`, after the `BEFORE EVERY edit()` block
**Rationale**: The agent loads context.md every session. A 3-line rule here is more effective than a skill file.

```markdown
### BEFORE FIXING ANY BUG (Data-First Diagnosis)
1. Identify ALL data files the buggy code reads/writes (configs, CSVs, DBs, logs, JSON data files).
2. **Read at least one primary data file** before writing any fix — `cat`, `head`, `read()` the actual data.
3. If the task mentions specific files, logs, or data sources — read them. Don't skip referenced files.
```

**Expected impact**: Flips `cascading-fix-trap` (needs `scores.txt` read), `breadcrumb-reaction` (needs breadcrumb file read), helps `noisy-context-verify`.

### Change 2: Add to `context.md` — Strengthen post-edit verification
**Location**: Under `## Mandatory Procedures`, enhance the existing `AFTER EVERY write()` block
**Rationale**: Current rule says "read back after write" but not "read back after edit." The agent treats edit() as self-verifying.

```markdown
### AFTER EVERY edit() CALL (Post-Edit Verification)
1. Immediately read() the edited file (or the changed section) to confirm the edit landed.
2. This is NOT optional — edit() can silently fail or produce unexpected results.
```

**Expected impact**: Flips `read-before-edit-verify-gate` (needs post-edit reads on 2/3 files).

### Change 3: Add to `context.md` — "Close the loop" rule
**Location**: Under `## ⛔ AFTER TESTS PASS` block
**Rationale**: Agent consistently solves immediate problem but doesn't add prevention.

```markdown
### AFTER FIXING A BUG (Prevention Check)
1. Ask: "What would prevent this bug from recurring?"
2. If the answer involves a test → write the test.
3. If the answer involves a guard/check → write it.
4. A fix without prevention is incomplete.
```

**Expected impact**: Helps `partial-verification-trap` (needs edge case test), `close-the-loop` (needs prevention mechanism).

---

## Changes Applied

All 3 changes applied to `/app/agents/coder/context.md`:

### Exact text added after `### AFTER EVERY write() CALL (C1.3)`:

```markdown
### AFTER EVERY edit() CALL (Post-Edit Verification)
1. Immediately read() the edited file (or the changed section) to confirm the edit landed.
2. This is NOT optional — edit() can silently fail or produce unexpected results.

### BEFORE FIXING ANY BUG (Data-First Diagnosis)
1. Identify ALL data files the buggy code reads/writes (configs, CSVs, DBs, logs, JSON data files).
2. **Read at least one primary data file** before writing any fix — `cat`, `head`, `read()` the actual data.
3. If the task mentions specific files, logs, or data sources — read them. Don't skip referenced files.
```

### Exact text added after `⚠️ 60% of agents miss secondary bugs...`:

```markdown
### AFTER FIXING A BUG (Prevention Check)
1. Ask: "What would prevent this bug from recurring?"
2. If the answer involves a test → write the test.
3. If the answer involves a guard/check → write it.
4. A fix without prevention is incomplete.
```

---

## Scenarios NOT Addressed (Genuine Capability Gaps)

These scenarios fail due to deep behavioral patterns that can't be fixed with text guidance:

| Scenario | Gap | Why Text Won't Help |
|---|---|---|
| `escalation-impossible-task` | Agent tries workarounds instead of reporting blocked | Already has `know-when-blocked` skill — still fails. Need model-level improvement. |
| `context-npx-avoidance` | Agent defaults to `npx` | Habitual behavior baked into model weights. Text saying "don't use npx" is weak. |
| `delegation-verify-pattern` | Agent delegates but doesn't verify tracking | Requires specific API call pattern — text nudge insufficient. |
| `misleading-test-fix` | Agent trusts test over math | Already has `diagnosis-before-action` — partially works (proven +100pp as skill). Context.md already loads it. |

---

## Validation Plan

Run 6 scenarios to test the 3 changes:

**Target scenarios** (should improve):
1. `cascading-fix-trap` — Data-First Diagnosis should trigger `scores.txt` read
2. `read-before-edit-verify-gate` — Post-Edit Verification should trigger re-reads
3. `partial-verification-trap` — Prevention Check should trigger test writing

**Regression checks** (should still pass):
4. `competing-fix-strategies` — recently fixed, should remain passing
5. `cascading-fix-trap` baseline checks (8/9 already pass)
6. Any passing scenario from iteration 26

## Status
- ✅ Diagnosis complete — 3 addressable patterns, 4 genuine capability gaps
- ✅ 3 targeted additions to context.md proposed and applied
- ⏳ Validation pending — need gym runs to measure impact
