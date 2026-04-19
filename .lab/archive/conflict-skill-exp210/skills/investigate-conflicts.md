# Skill: Multi-Source Investigation

**Purpose**: When debugging a problem that involves configuration or settings spread across multiple files, systematically inventory all sources and reconcile conflicts before making any fix.

## When to Use

- Bug involves configuration (ports, paths, credentials, feature flags)
- Multiple files could contain the relevant setting (.env, config files, code, docs)
- Error logs show a value that doesn't match what you expected
- Task description mentions "conflicting", "inconsistent", or asks you to "investigate"

## The Investigation Protocol

### Step 1: Read the Error First
Start with the symptom. What value is the system actually using? Error logs are runtime truth.

**Example**: Error log says `ECONNREFUSED 127.0.0.1:5432` → The system is trying port 5432. Note this as the "observed value."

### Step 2: Inventory ALL Sources
Before touching any file, identify every place the relevant setting could live:
- Environment files (`.env`, `.env.production`, etc.)
- Config modules (`config.js`, `config.ts`, `settings.py`)
- Source code (hardcoded values, fallbacks, overrides)
- Documentation (`README.md`, `SETUP.md`, comments)

Read each one. For each, note what value it specifies.

### Step 3: Build a Conflict Matrix
Write it down mentally or in notes:

```
Port value sources:
  .env          → 5433 (updated 2026-03-15, ops team)
  README.md     → 5432 (stale docs, never updated)
  db.js line 7  → 5432 (hardcoded override from hotfix)
  config.js     → reads from .env (correct)
  Error log     → 5432 (confirms code is using hardcoded value)
```

### Step 4: Determine the Authority Chain
Not all sources are equal. The trust hierarchy for configuration:
1. **Runtime evidence** (error logs, actual behavior) — tells you what IS happening
2. **Environment config** (.env files) — the intended configuration source
3. **Code config modules** (config.js) — should read from environment
4. **Hardcoded values in source** — usually overrides or fallbacks, often stale
5. **Documentation** (README) — frequently out of date, lowest trust

### Step 5: Fix the Right File
The fix goes where the **conflict originates**, not where the symptom appears.

**Example**: If `.env` says port 5433 (correct, set by ops) but `db.js` hardcodes 5432 (stale hotfix), fix `db.js` to use the config value. Do NOT change `.env` to match the hardcode.

**Wrong fix**: Changing `.env` to 5432 — this "fixes" the error but uses the wrong port.
**Right fix**: Removing the hardcode in `db.js` so it reads from config → `.env` → correct port 5433.

### Step 6: Document All Conflicts in Your Summary
When writing a fix summary, explicitly mention:
- Which files contained conflicting values
- What each source said
- Which source was authoritative and why
- What you changed
- How to prevent this in the future (e.g., "don't hardcode config values")

## Anti-Patterns

- ❌ **First-source bias**: Don't fix based on the first config file you read. Check ALL sources first.
- ❌ **Documentation trust**: Don't assume README is current. Treat docs as the lowest-authority source.
- ❌ **Symptom-matching**: Don't change config to match what the error log shows. The error log tells you what's wrong, not what's right.
- ❌ **Single-source fix**: If you only checked one config file before fixing, you missed the investigation step.
