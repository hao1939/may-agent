# Analysis: Phantom Write Incident (2026-03-17)

## Evidence
- **Sessions**: s_1773722275174_42 (current) and preceding.
- **Symptom**: `handoff()` fails with `ENOENT` (file not found) immediately after `write()` succeeds.
- **Specific Files**: 
  - `brief-gus-infrastructure-dominance.md`
  - `brief-infra-tool-injection.md`
  - `brief-gus-governance-gating.md`
- **Grep**: Files are present in `SIGNALS.md` (handoff logged), but `ls` shows they are missing or empty on disk.

## Mechanism: Race Condition or Storage Volatility?
1. **Hypothesis A (Race)**: `write()` is async and `handoff()` checks existence before flush completes. 
   - *Counter-evidence*: I've seen `read()` verify content *before* handoff in some traces, yet file is gone later.
2. **Hypothesis B (Container/Volume Issue)**: The workspace directory might be ephemeral or resetting.
   - *Counter-evidence*: `journal.md` persists. Other files persist.
3. **Hypothesis C (The "Delete-After-Send" Anti-Pattern)**: Am I deleting them?
   - *Check*: I don't see `rm` calls in my history.
4. **Hypothesis D (Overwrite by Empty)**:
   - *Possibility*: A failed `write` (e.g., interrupted session) might leave a 0-byte file, which `handoff` rejects? 
   - *Fact*: `read` showed content in previous turns.

## The Fix
- **Immediate**: Re-write the files now.
- **Systemic**: 
  1. **Verify Persistance**: `ls -l` *after* the handoff to confirm it stayed.
  2. **Unique Names**: Maybe `brief-gus-infrastructure-dominance-v2.md` to avoid filesystem cache oddities?

## Action Plan
- Rewrite the 3 missing briefs.
- Verify content.
- Handoff again (this will duplicate SIGNALS entries, but better than missing files).
- Add "RETRY" to the context in SIGNALS.
