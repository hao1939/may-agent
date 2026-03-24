# Gym Benchmark Tracking — Phase 1 Implementation Plan

**Request**: req:742f0b94
**Design**: agents/shared/may-agent-docs/design/gym-snapshots.md
**Reviews**: Bob APPROVED w/ modification (config_hash from runner), Tech-lead APPROVED w/ phasing
**Status**: ✅ PHASE 1 COMPLETE — committed `0a9fad9` (2026-03-24)

## Phase 1 Scope: Schema + Recording Flow

### Step 1: Schema — Add columns to `gym_runs` and create `gym_snapshots` ✅ DONE
**File**: `src/lib/requests.ts`
- Add to `gym_runs` CREATE TABLE: `run_tag TEXT`, `config_hash TEXT`, `framework_sha TEXT`, `model TEXT`, `batch_id TEXT`, `categories TEXT`, `tags TEXT`, `tier TEXT`
- Add new table `gym_snapshots`:
  ```sql
  CREATE TABLE IF NOT EXISTS gym_snapshots (
    config_hash TEXT PRIMARY KEY,
    agent_name TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    files TEXT NOT NULL
  );
  ```
- Add index: `CREATE INDEX IF NOT EXISTS idx_gym_runs_batch ON gym_runs(batch_id);`
- Add index: `CREATE INDEX IF NOT EXISTS idx_gym_runs_config ON gym_runs(config_hash);`

### Step 2: Recording — Update `gym-record.ts` to write new columns ✅ DONE
**File**: `scripts/gym-record.ts`
- Accept new CLI flags: `--batch <id>`, `--tag <label>`
- Write new columns when inserting into `gym_runs`
- Accept categories/tags/tier/config_hash/model from runner result JSON
- On new `config_hash`: INSERT OR IGNORE into `gym_snapshots`
- Ensure writing to `may.db` (check current target)

### Step 3: Runner — Read scenario metadata + compute identity ✅ DONE  
**File**: `test/gym/gym-runner.ts`
- Read `scenario.json` fields: `categories`, `tags`, `tier`
- Include them in RunResult output
- Compute `config_hash` by hashing the effective system prompt (per Bob's review)
- Read `model` from agent config
- Read `framework_sha` from `git rev-parse --short HEAD`

### Step 4: Baseline script — Generate batch_id, forward args ✅ DONE
**File**: `scripts/gym-baseline.sh`
- Generate `batch_id` at start: `date +%s`_`$(openssl rand -hex 4)`
- Pass `--batch $batch_id` and `--tag` through to gym-record.ts
- Accept `--tag` CLI arg

## Not in Phase 1
- Web UI changes (Phase 2)
- Comparison view (Phase 3)
- Removing stats.db (after verification)
