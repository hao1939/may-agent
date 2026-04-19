# Incident: L3 Integrity Drift — agents/optimizer/SOUL.md hash mismatch

## Evidence
- `node agents/evaluator/skills/patrol.cjs` returned **status: CRITICAL** with 1 mismatch:
  - file: `agents/optimizer/SOUL.md`
  - expected: `4246f6514c0e419df09a0a108ca3460dadef7f126693ac7b4ecf9437a3ce4fc7`
  - actual: `f4001c3ff2cf447cb7cf4bdd8a2a5eef6a627ab15c45efe80b669ad6aee1f812`
- Snapshot source: `agents/shared/compliance-snapshot.json` (timestamp `2026-03-29T06:35:00Z`) includes `agents/optimizer/SOUL.md` with the expected hash.
- Current file mtime: `2026-03-30 19:16Z` (after snapshot).

## Triage notes
- Quick content scan of `agents/optimizer/SOUL.md` header showed plausible Optimizer identity text and no obvious prompt-injection strings (grep for `Ignore prior instructions|system prompt|base64|override` returned no matches). This **does not** clear integrity drift; only indicates the change may be benign.

## Recommended response (owner: Bob/May)
1. Confirm whether the Optimizer SOUL change was intentional (e.g., planned update) and if so, update `agents/shared/compliance-snapshot.json` with the new hash.
2. If unintentional, restore `agents/optimizer/SOUL.md` from last known-good source (git, backup, or prior snapshot).
3. Add/restore an automated `detect-p53-drift` entrypoint so the integrity audit can run without relying only on `patrol.cjs`.

## Tool outputs (for linkage)
- Patrol run in this heartbeat showed the mismatch and exited non-zero.
