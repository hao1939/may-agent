# Skill: Root-Cause Diagnosis

**Purpose**: When facing a bug report, trace the actual error path from symptom to root cause before editing any code. Many bugs have misleading error messages, red-herring warnings, or multiple potential causes. The discipline is: diagnose FIRST, fix SECOND.

## The Rule

**Before editing ANY file to fix a bug, you MUST have a concrete hypothesis: "Line X in file Y does Z wrong because of W." If you can't state this, you haven't diagnosed yet.**

## How to Diagnose

### Step 1: Run the tests and read the ACTUAL failures
```
bash({ command: "node test.js" })
→ Read every line of output
→ Identify WHICH tests fail and WHAT values they expect vs. got
→ Ignore warnings that aren't on the failure path
```

### Step 2: Trace from failure to code
```
# The test says expected 10.50 but got 10 — this is a NUMERIC issue
# Search for the math that produces this value:
bash({ command: "grep -rn 'Math\\.' src/" })
bash({ command: "grep -rn 'toFixed\\|parseInt\\|Math.trunc\\|Math.floor\\|Math.round' src/" })
→ Find the function that transforms the value
→ Read that function completely
```

### Step 3: Confirm the root cause
```
# Before editing, verify your theory:
# "Math.trunc in line 15 drops decimals, causing 10.50 → 10"
# Check: does fixing THIS explain ALL test failures?
# If it only explains some failures, keep looking.
```

### Step 4: Fix ONLY the root cause
```
edit({ path: "src/calculator.js", oldText: "Math.trunc(total)", newText: "Math.round(total * 100) / 100" })
→ Minimal change — one line, one fix
→ Do NOT fix warnings, do NOT refactor, do NOT "improve" unrelated code
```

### Step 5: Verify ALL tests pass
```
bash({ command: "node test.js" })
→ ALL tests must pass
→ If some still fail, you haven't found the real root cause — go back to Step 2
```

## Red Herring Traps to Avoid

- **Warning messages**: A console warning about "invalid format" may be cosmetic — check if tests actually fail because of it
- **Multiple issues**: The codebase may have several imperfections. Fix only the one causing test failures
- **Obvious-looking bugs**: A function that looks wrong might work fine. Trust the tests, not your assumptions
- **Fixing the test output**: Never modify test files. The tests define correctness

## When This Applies

- Any bug report where the description mentions errors or symptoms
- Any scenario where console output contains warnings alongside test failures
- Especially when the error message points to a different location than the actual bug

## Anti-Pattern: The Red Herring Fix

```
❌ BAD: "I see 'Invalid discount format' warning → fix the discount validator"
   (But the tests fail on PRICE CALCULATIONS, not discount validation)

✅ GOOD: "Tests expect 10.50 but get 10 → trace to Math.trunc → fix the rounding"
   (Follow the test failures, ignore the warning)
```
