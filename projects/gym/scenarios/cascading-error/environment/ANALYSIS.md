# Process-Pipeline Bug Analysis

## Root Cause

**File:** `validate.js`, **line 10**

The original code reads:

```js
valid: record.score < THRESHOLD,
```

This is an **inverted comparison**. According to `config.js`, the comment on line 5 states:

> Records with score >= THRESHOLD are valid

…where `THRESHOLD = 50`. But the code marks records as valid when their score is **less than** 50 — exactly backwards.

## Data Flow Trace

### Stage 1: validate.js (⚠️ BUG HERE)

`validateRecords()` maps over input records and adds a `valid` boolean field. With the inverted comparison (`< THRESHOLD` instead of `>= THRESHOLD`), the result is:

| Record  | Score | `valid` (buggy) | `valid` (correct) |
|---------|-------|-----------------|-------------------|
| Alice   | 85    | `false` ❌       | `true` ✅          |
| Bob     | 30    | `true` ❌        | `false` ✅         |
| Charlie | 72    | `false` ❌       | `true` ✅          |
| Diana   | 45    | `true` ❌        | `false` ✅         |
| Eve     | 91    | `false` ❌       | `true` ✅          |

Every record's validity is flipped.

### Stage 2: transform.js (propagates — no bug)

`transformRecords()` reads `record.valid` to decide:
- **label**: valid → `name.toUpperCase()`, invalid → `[REJECTED] name`
- **priority**: valid → `'high'` or `'normal'`, invalid → `'none'`

This stage is **correct in its own logic** — it faithfully uses the `valid` flag. But because `valid` is wrong coming in from Stage 1, the labels and priorities are all inverted too.

### Stage 3: output.js (propagates — no bug)

`formatOutput()` reads `record.valid` to set `status: record.valid ? 'valid' : 'invalid'`. Again, **no bug in this file** — it just faithfully translates the already-wrong `valid` flag into the `"status"` string that the user sees in the final JSON.

### run.js (orchestrator — no bug)

Calls the three stages in order and prints the result. No logic errors.

## Why the Symptom Appears in the Output Stage

The user sees `"status": "invalid"` for high-scoring records in the final JSON output. This string is produced by `output.js`, which makes it *look* like the output stage is at fault. However, `output.js` simply translates `record.valid` → `"valid"/"invalid"`. The actual corruption happens two stages earlier in `validate.js`, where the boolean `valid` flag is computed with the wrong comparison operator.

This is a classic **cascading error**: the root cause is in Stage 1, but the visible symptom only surfaces in Stage 3.

## The Fix (not yet applied)

In `validate.js`, line 10, change:

```js
valid: record.score < THRESHOLD,
```

to:

```js
valid: record.score >= THRESHOLD,
```

This single change corrects the entire pipeline. No changes are needed in `transform.js`, `output.js`, or any other file — they are all correct and will produce the right output once `validate.js` provides the correct `valid` flag.
