---
name: cross-reference-source-code
description: >
  Before repairing or migrating config files, grep the project's source code
  for all references to that config's fields. The source code is the ground truth
  for what fields must exist — config files may have been truncated, corrupted,
  or partially migrated, so their current contents are unreliable as a field inventory.
  This prevents the failure mode where agents repair visible errors in a config file
  but miss entirely absent fields that the code depends on.
version: 1.0.0
owner: coach
targets: Absent field blindness — agent repairs visible config errors but misses fields that are entirely absent from a truncated/corrupted file
evidence: >
  EXP-079: Cross-reference intervention achieves 0% → 100% (+100pp) on L3 cascading
  state scenario (3/3 runs). The mechanism is external evidence discovery — when the
  agent's internal schema knowledge is incomplete, grepping source code reveals fields
  that should exist but are absent from the config. Externalization (self-analysis)
  achieves 0% on the same scenario because the agent can't introspect on fields it
  doesn't know about.
---

# Cross-Reference Source Code Before Config Repair

## When to Apply

Apply this skill **before editing any config/data file** when:

- **Repairing a config file** that may be corrupted, truncated, or incomplete
- **Migrating config files** between formats (JSON → YAML, etc.)
- **Recovering from a crash** where config state may be partially broken
- **Any time you're about to fix a config file based only on what you see in it** —
  the file itself may be missing fields that the codebase depends on

**Do NOT apply** when:
- The config file has a well-defined schema file (JSON Schema, etc.) you can reference instead
- You're creating a brand new config from scratch with documented requirements
- The project has no source code that references config values

## Why This Matters

The most dangerous config repair failure is **absent field blindness**: you fix every
error you can SEE in the config file but miss fields that are entirely absent. A
truncated config might have 4 of 5 required fields — the 4 present fields look fine,
so you fix typos/formatting and move on, never realizing the 5th field is missing.

The source code is an implicit schema. Any field referenced in code (e.g.,
`config.session.max_age`) MUST exist in the corresponding config file. If it doesn't,
the application will fail at runtime.

## Steps

### Step 1: Before editing a config file, GREP the source code for references to it

```bash
# Example: before repairing auth.yaml, search for auth config references
grep -r "config\." src/ --include="*.js" --include="*.ts"
# Or more targeted:
grep -rn "auth" src/ --include="*.js" --include="*.ts" | grep -i "config\|session\|secret\|token"
```

### Step 2: Build a field inventory from what the code expects

List every config field referenced in the source code. This is your ground truth
for what the config file MUST contain:

```
Fields referenced in source code for auth config:
- config.session.store (src/auth-middleware.js:28)
- config.session.max_age (src/auth-middleware.js:29)
- config.secret (src/auth-middleware.js:45)
- config.token_expiry (src/auth-middleware.js:46)
- config.refresh_expiry (src/auth-middleware.js:55)
```

### Step 3: Compare the field inventory against the actual config file

Check each field from Step 2 against what's actually in the config file. Any field
present in code but absent from config is a **critical gap** that must be added.

### Step 4: Repair the config to include ALL referenced fields

Fix visible errors AND add any missing fields discovered through cross-referencing.

## Assertions

1. Before editing a config file, the agent searches source code for references to
   that config's fields — grep or similar search is performed before the edit.

2. If source code references a field not present in the config file, the agent adds
   it during repair — absent fields are not left missing.

3. The agent does not rely solely on the config file's current contents to determine
   what fields should exist — external evidence (source code) is consulted.


## ⚠️ Task-Type Restriction

Do NOT use this skill's worked examples as templates on **discovery, exploration, or creative-inference tasks** (e.g., knowledge integration, open-ended research, novel pattern discovery). KE-133 showed a **-67pp effect** (p=0.030) — template-following displaces the open exploration these tasks require. Use this skill only for the specific task type it was designed for.
