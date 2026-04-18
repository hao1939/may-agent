# Design Review: Gym Benchmark Tracking (Gym Snapshots)

**To**: Hao / May
**From**: Bob (Architect)
**Date**: 2026-03-24
**Subject**: Feedback on `docs/design/gym-snapshots.md`

## Verdict: APPROVED WITH ARCHITECTURAL MODIFICATION

The design goals (trends, run identity, unification) are excellent. The schema additions are necessary. However, the **Identity Mechanism (Config Hash)** requires a structural change to be robust.

## 1. Critical Modification: Config Identity
The proposal suggests `gym-record.ts` computes `config_hash` by reading 3 specific files (`SOUL.md`, `common-sense.md`, `agent.json`).

**Risk**: This is fragile.
1. **Misses Skills**: If `agents/coder/skills/debug.md` changes, the agent behaves differently, but the 3-file hash remains the same.
2. **Misses Logic**: If `agent-loader.ts` changes how it assembles the prompt, the agent changes, but the hash doesn't.
3. **Duplication**: `gym-record` has to replicate `agent-loader`'s knowledge of what constitutes an agent.

**Architectural Fix**:
Move hash computation to **`gym-runner.ts`**.
- `gym-runner` loads the agent via `manager`.
- The agent (or manager) constructs the **Effective System Prompt**.
- Hash the **Effective System Prompt** string.
- Pass this hash in the result JSON to `gym-record`.

**Why**: The System Prompt is the ground truth of the agent's cognitive state. It implicitly includes SOUL, Skills, Tools, Constraints, and Conventions. Hashing the *result* of the load process guarantees that if *anything* injected into the context changes, the hash changes.

## 2. Storage Strategy
**Proposal**: Store snapshots as JSON blobs in SQLite (`gym_snapshots`).
**Verdict**: **ENDORSE**.
- Fits "Simple First". Avoids managing thousands of small files on disk.
- Atomic with the run record.
- **Suggestion**: If possible, store as `COMPRESSED BLOB` (gzip) to save space, but `TEXT` is acceptable for MVP (markdown compresses well).

## 3. Schema & Unification
**Verdict**: **ENDORSE**.
- Unifying `stats.db` and `may.db` is correct (Single Source of Truth).
- Columns (`batch_id`, `categories`, `tier`) are the right set for the "Ability Profile" view.

## 4. Next Steps
1. **Tech-Lead**: Implement `gym-runner` change first — expose `systemPromptHash` from the loaded agent.
2. **Tech-Lead**: Proceed with DB schema migration and unification.
