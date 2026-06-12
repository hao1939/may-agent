<ai_context>
Guard READ_DEDUP triggers surged 124% (199→446/24h) on 2026-06-13, driven by aks-explorer repeatedly re-reading replay files during task sessions (328/446 = 74%). This tightened guard-count threshold headroom from ~8% to ~3% (2,428/2,500). Not a quality crisis — the rereads are a workflow pattern where aks-explorer needs to reference the same replay file multiple times during a single implementation session.
Triggers: guard, READ_DEDUP, aks-explorer, replay, threshold, headroom, guard.triggered-count-24h
Related metrics: guard.triggered-count-24h, guard.warned-count-24h
</ai_context>

# KE-1867: Guard READ_DEDUP Surge — aks-explorer Replay Re-reads

**Status**: active
**Discovered**: 2026-06-13
**Agent**: arc (heartbeat coherence audit)
**Scope**: guard composition, threshold headroom
**Related**: KE-1564 (composition shift), KE-1567 (rebound), guards.md

## Observation

Guard trigger volume reached 2,428/24h vs 2,500 threshold (~3% headroom).

The primary driver is a 124% surge in READ_DEDUP triggers (199 → 446),
which is now the #2 signal by volume (18.4%), overtaking SESSION_BASH_CAT.

## Root Cause

aks-explorer is responsible for 328 of 446 READ_DEDUP triggers (74%).
The top re-read targets are replay files:
- `replays/kms-v2-private-cluster-pr*.ts` — 33 triggers
- `replays/kms-v2-public-cluster-pub*.ts` — 19 triggers
- `replays/deployment-safeguards-adm*.ts` — 14 triggers
- Task tree/model files (`tree.json`, `model.json`) — 11-10 each

These are legitimate work patterns: aks-explorer references the same
replay file multiple times during a single task implementation session.
The read-dedup-guard fires a warning each time after the 2nd read,
generating noise rather than catching pathology.

## Risk

If this pattern persists, guard-count will breach the 2,500 threshold
within 24-48 hours, creating a false alert. The 3% headroom leaves
almost no room for normal load variation.

## Options

1. **Threshold raise** — increase from 2,500 to ~3,000 (accommodates
   ~20% surge). Risk: masks genuine deterioration.
2. **Guard calibration** — increase read-dedup-guard's per-file count
   threshold from 2 to 3 or 4 for aks-explorer (or for replay files).
   More targeted.
3. **Accept and monitor** — if the surge is transient (aks-explorer
   in heavy replay-writing phase), it may self-resolve.

## Action Taken

Updated guards.md composition snapshot with current data. Filed this KE
for visibility. No threshold change yet — monitoring for next 24h to
determine if the surge is transient or structural.
