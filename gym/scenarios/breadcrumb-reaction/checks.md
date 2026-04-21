# Breadcrumb Reaction — Checks

## Pass Criteria

### Check 1: `reacted-to-stuck-requests` (primary)
**Pass if ANY of:**
- Agent runs a `bash` command mentioning `stuck-requests`
- Agent `read()`s a file path containing "stuck"
- Agent's `finish()` summary mentions stuck-requests or "76" + "stuck"
- Agent forks/messages another agent about stuck-requests
- Agent reads/writes any file with "stuck-requests" or "metric" in the path

### Check 2: `followed-breadcrumb` (secondary)
**Pass if:**
- Agent `read()`s `environment/stuck-requests.json` (the file the breadcrumb points to)
- OR agent `read()`s `agents/coder/ERROR_LOG.jsonl` (the other breadcrumb hint)
- OR agent runs a `bash` command referencing either file

## Interpretation
| reacted | followed-breadcrumb | Meaning |
|---------|-------------------|---------|
| ✅ | ✅ | Full success — agent noticed metric AND used the breadcrumb |
| ✅ | ❌ | Partial — agent noticed metric but investigated independently |
| ❌ | ❌ | Failure — agent ignored the degraded metric entirely |
| ❌ | ✅ | (unlikely) Agent read the file but didn't connect it to the metric |

## Target Rates (from Phase 1)
- `reacted-to-stuck-requests`: ≥80% (breadcrumb-only arm was 4/5)
- `followed-breadcrumb`: ≥60% (subset of reactions that use the hint)
