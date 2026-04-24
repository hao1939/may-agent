# Finding: Federation Config — Is It Still Used?

**Date**: 2026-04-17
**Lens**: C (Dead Weight)
**Session**: s_1776432750008_312

## Verdict: PARTIALLY-USED

The federation *infrastructure* (instance-config.json, heartbeats/local.json) is live and runs every 10 min via `agents-auto-commit.ts`. But the two top-level config files `federation.md` and `federation.yaml` are **pure documentation/scaffolding with zero code references** — dead weight from the original design commit.

## Evidence

### Actively used
| Path | Used by | Citation |
|------|---------|----------|
| `agents/shared/federation/instance-config.json` | read at runtime, parsed as `InstanceConfig` | `agents/may/handlers/agents-auto-commit.ts:53` (`loadInstanceConfig`) |
| `agents/shared/federation/heartbeats/{instance}.json` | written every sync cycle (liveness signal) | `agents/may/handlers/agents-auto-commit.ts:581` (`heartbeatDir = join(agentsDir, "shared", "federation", "heartbeats")`) |
| `federation/claims`, `federation/notifications` paths | referenced in shared-mergeable filter | `agents/may/handlers/agents-auto-commit.ts:538-539` |

Proof of liveness: `agents/shared/federation/heartbeats/local.json` was last written `2026-04-17 13:31:28` (this hour) via auto-commit (`git log -1`).

### Dead weight (zero code references)
| Path | Refs in src/agents handlers | Last non-trivial change |
|------|------------------------------|--------------------------|
| `agents/shared/federation.md` | **0** (`grep -rn 'federation\.md' src/ agents/may/handlers/` → empty) | 2026-04-08 initial design commit, untouched since |
| `agents/shared/federation.yaml` | **0** (`grep -rn 'federation\.yaml' src/ agents/may/handlers/` → empty) | 2026-04-08 initial design commit, untouched since |
| `agents/shared/federation/requests/` | empty except README | 2026-04-15 (README-only touch) |
| `agents/shared/federation/heartbeats/README.md` | doc only | 2026-04-15 (README-only touch) |

Note: `federation.yaml` declares an `instances:` schema with agent ownership lists, but the runtime code reads the JSON sibling (`instance-config.json`) instead. The YAML file is a never-consumed parallel design artifact. Header at `agents/shared/federation.yaml:1-11` frames it as authoritative ("Each may-agent instance reads this") but no code does.

### Prior audits corroborate
- `agents/tech-lead/workspace/audit-shared-dead-weight.md:32` — "federation.yaml | 0 refs (only git index) | 🗑️ DELETE — zero code references"
- `agents/tech-lead/workspace/audit-shared-dead-weight.md:30` — flags `federation/` dir as experimental; instance-config.json + heartbeats are the only live bits
- `agents/tech-lead/workspace/archive/2026-04/analysis-federation-usage.md` (2026-04-11) confirms federation *sync code* is actively used — but doesn't exonerate the `.md`/`.yaml` docs

## Severity
P2 (cosmetic cleanup). The dead files are small (~5.8K combined) and don't cause incorrect behavior. The risk is **confusion**: `federation.yaml` looks authoritative and contradicts the schema actually loaded from `instance-config.json`, which could mislead a future agent editing ownership rules.

## Recommended next step (separate session)
1. **DELETE** `agents/shared/federation.yaml` — zero refs, superseded by `instance-config.json`.
2. **SHRINK/ARCHIVE** `agents/shared/federation.md` — useful as a design overview but currently unreferenced. Options:
   - Move to `agents/shared/may-agent-docs/design/federation.md` (where design docs live), OR
   - Trim to a 10-line README inside `agents/shared/federation/` pointing at `instance-config.json` as the source of truth.
3. **KEEP** `agents/shared/federation/instance-config.json` and `heartbeats/` — actively read/written.
4. Consider whether `federation/requests/` (empty) is reserved for a future feature or can be removed; check with Bob who authored the design.

## Follow-up (not for this session)
The `federation/claims` and `federation/notifications` paths whitelisted at `agents-auto-commit.ts:538-539` refer to directories that **do not exist on disk**. Either the whitelist is premature scaffolding or those dirs should be created. Worth a separate investigation before any deletion of `federation.md` (which may document this intent).
