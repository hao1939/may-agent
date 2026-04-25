# QA Heartbeat — Unreviewed Findings

## Context
- Repo root `/app` is **not a git repository** (no `.git`), so `git log`/diff-based verification cannot be performed from this environment.
- Pending event asks to verify gym scenario **EXP-220 (enoent-file-search)** exists and is properly set up.

## Findings
### 1) EXP-220 scenario not found (IMPORTANT)
- Searched for scenario directory names matching `EXP-220*` under `agents/gym/scenarios`.
- No matches found.

**Evidence**
- `find agents/gym/scenarios -maxdepth 2 -type d -iname '*EXP-220*' -print` → (no output)

**Impact**
- If EXP-220 is expected to exist, it appears missing/misnamed/untracked in this environment.

**Suggested next steps**
- Confirm expected naming convention (e.g., `enoent-file-search` without EXP ID prefix, or stored elsewhere).
- If it should exist, locate where it was written (check other directories) or re-add it.

### 2) Verification workflow blocked by missing git metadata (IMPORTANT)
- `git log --oneline -10` fails with “not a git repository”.

**Evidence**
- `git log --oneline -10` → fatal: not a git repository

**Impact**
- Cannot proactively scan recent commits/diffs in this environment.

**Suggested next steps**
- Ensure `/app` is mounted with `.git`, or provide a path to the git checkout.
