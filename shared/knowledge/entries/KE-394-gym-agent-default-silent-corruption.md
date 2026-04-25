# KE-394: Gym Runner Defaults to Unregistered Agent — Silent Data Corruption

**Source**: EXP-178 (discovered 2026-08-15)
**Confidence**: HIGH (observed directly — 120 runs invalidated)
**Concepts**: gym, experimentation, data-quality

## Finding

The gym runner (`run-gym.sh`) defaults to `--agent coder` if no agent is specified. If the target agent isn't registered in the gym system, runs execute in **stub mode** — producing synthetic results that look real but contain no actual agent behavior. This silently corrupted all 120 EXP-178 runs before discovery.

## Implication

Any gym experiment that doesn't explicitly pass `--agent <registered-agent>` produces meaningless data. The stub mode output format is identical to real runs, making detection difficult without inspecting session logs.

## Prescription

1. Always pass `--agent <name>` explicitly when running gym trials
2. Verify first run output contains real agent tool calls before bulk execution
3. Registered agents as of 2026-08: `amy`, `tech-lead` (check `agents/gym/` for current list)
