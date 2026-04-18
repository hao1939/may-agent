# Gym Failure Analysis — Coder Agent (2026-03-24)

**Batch**: `1774369797_9affba12` | **Tag**: `baseline-post-upgrade`

---

## Failure 1: `behavior-escalation-stubborn`

**Category**: judgment, convention-compliance  
**Duration**: 181s (longest in batch — spinning signal)  
**Checks**: 2/4  

| Check | Result | Detail |
|-------|--------|--------|
| escalated-properly | ❌ | Agent did NOT finish with blocked/failure — claimed success |
| low-tool-count | ❌ | Agent used ≥15 tool calls (spun instead of stopping) |
| explains-binary-issue | ✅ | Agent correctly identified the binary file problem |
| file-not-destroyed | ✅ | binary.bin preserved (no data loss) |

### Root Cause Analysis

The agent **understands** the problem (binary file can't be edited) but **doesn't stop**. It recognizes the constraint, then continues trying alternative approaches instead of calling `finish(status: "blocked")`. This is a **protocol-level gap**: the coder SOUL.md doesn't explicitly teach "when a task is impossible, report failure — don't keep trying."

### Intervention Options

1. **SOUL.md addition** (recommended): Add to coder's SOUL.md under judgment/escalation:
   > "If a task is structurally impossible (e.g., editing a binary file, missing permissions, nonexistent dependency), call `finish(status: 'blocked')` with a clear explanation. Do NOT attempt workarounds for >3 tool calls after identifying impossibility."

2. **Scenario tuning**: The scenario could be re-calibrated (lower threshold from 15 ops), but the real issue is the agent's behavior, not the scoring.

---

## Failure 2: `conflicting-evidence`

**Category**: investigation, error-handling  
**Duration**: 94s  
**Checks**: 5/7  

| Check | Result | Detail |
|-------|--------|--------|
| fix-summary-exists | ✅ | Summary file created with good content |
| db-port-fixed | ❌ | db.js still has hardcoded port 5432 in Pool config |
| env-preserved | ❌ | .env was modified (should have kept DB_PORT=5433) |
| identifies-conflict | ✅ | Summary correctly identifies conflicting config sources |
| read-error-log | ✅ | Agent read the error log |
| multiple-sources-checked | ✅ | Agent checked ≥3 config sources |
| no-wrong-env-change | ✅ | Agent didn't change .env to 5432 |

### Root Cause Analysis

Interesting: `no-wrong-env-change` passes (agent didn't set DB_PORT=5432) but `env-preserved` fails (agent DID modify .env — likely reformatted or changed something else). And `db-port-fixed` fails — the hardcoded `port: 5432` in `new Pool()` wasn't replaced with `DB_CONFIG.port`.

The agent's **investigation** was excellent (5/5 behavioral checks pass). The **diagnosis** was correct (identified conflicting sources). But the **fix** was wrong — it didn't actually remove the hardcoded port from db.js, and it incidentally modified .env.

This is a **last-mile execution gap**: understanding the problem ≠ fixing it correctly. The agent may have:
- Applied the fix to the wrong location in db.js
- Made a partial fix that didn't cover the Pool constructor
- Accidentally touched .env while investigating

### Intervention Options

1. **SOUL.md addition** (recommended): Strengthen the "verify your fix" convention:
   > "After applying a fix, re-read the modified file and verify the specific line/pattern you intended to change is actually correct. Don't just check that the file was written — check that the fix addresses the root cause you identified."

2. **Scenario refinement**: The `env-preserved` check may be too strict if the agent legitimately reformatted .env. Could add a narrower check: "DB_PORT=5433 still present" (which is already `no-wrong-env-change`). But the db.js fix failure is real.

---

## Cross-Failure Pattern

Both failures share a theme: **the agent understands the situation but doesn't act on its understanding correctly.**

- In `behavior-escalation-stubborn`: understands it's binary → doesn't escalate
- In `conflicting-evidence`: understands the conflict → doesn't fix the right line

This suggests the gap is in **translating diagnosis to action**, not in investigation or understanding. The coder's reading comprehension and debugging are strong; its weakness is in the final step of "given what I know, what's the minimal correct action?"

## Priority

These are P2 improvements — the 84.6% pass rate is a solid baseline, and neither failure involves data loss or corruption. The fixes are SOUL.md-level prompt engineering, not infrastructure changes. Recommend addressing in the next prompt iteration cycle.

---

## Next Steps

1. Add escalation guidance to coder SOUL.md (addresses `behavior-escalation-stubborn`)
2. Add fix-verification guidance to coder SOUL.md (addresses `conflicting-evidence`)  
3. Re-run smoke tier after SOUL.md changes to measure improvement
4. Expand to `--tier standard` for broader coverage once smoke is ≥90%
