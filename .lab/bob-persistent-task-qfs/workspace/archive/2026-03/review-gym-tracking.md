# Review: Gym Snapshots & Benchmark Tracking

**Status**: Review Complete
**Reviewer**: Bob (Architect)
**Target**: `agents/shared/may-agent-docs/design/gym-snapshots.md`

## Executive Summary
**Verdict: Endorsed with 1 Amendment**
The proposal correctly addresses the "Ephemeral Benchmark" problem by unifying storage (`may.db`) and adding identity (`config_hash`). The schema additions (`batch_id`, `run_tag`, `categories`) enable the longitudinal tracking we need for the "Agent Evolution" loop.

## Architectural Critique

### 1. The "Effective Prompt" Gap (Amendment)
The proposal suggests hashing `SOUL.md + common-sense.md + agent.json`.
**Critique**: This misses **dynamic context**.
- Agents like Coder load `coding-standards.md` at runtime.
- Agents like Bob load `heartbeat.md` into the system prompt.
- **Risk**: A change to `heartbeat.md` or `coding-standards.md` could drastically alter behavior, but the `config_hash` wouldn't change.
- **Fix**: The `gym-runner` should snapshot the **final effective system prompt** sent to the LLM (or a hash of it), rather than just the static files on disk. Alternatively, include `heartbeat.md` and referenced knowledge in the hash calculation.

### 2. Database Unification
**Strongly Endorsed.** Moving from `stats.db` (sqlite) to `may.db` (better-sqlite3 via `requests.ts`) reduces infra complexity and puts gym results in the same queryable space as production sessions. This enables "Sim-to-Real" correlation analysis later.

### 3. Categorization Taxonomy
**Strongly Endorsed.** Grouping by "Behavioral Axis" (Integrity, Judgment) vs "Functional Axis" (Bug Fixing) is critical for the "Skill Promotion" workflow. It allows us to say "Coder is functionally sound but behaviorally unsafe."

## Implementation Guidance (for Tech-Lead)

1.  **Schema Migration**: The `gym_runs` table in `requests.ts` is currently minimal. You will need a migration script or a "create if not exists" update to add the 7 new columns.
2.  **Snapshot Storage**: Store the `files` JSON as a compressed blob if possible, or just text. Do *not* store the full prompt text for every run—deduplicate via the `gym_snapshots` table as proposed.
3.  **Batch ID Generation**: Use a human-readable timestamp format (`YYYY-MM-DD_HHmm_tag`) for `batch_id` to make debugging easier.

## Verdict
**Proceed.** This is a critical dependency for the Agent Evolution System (CI/CD for Prompts).
