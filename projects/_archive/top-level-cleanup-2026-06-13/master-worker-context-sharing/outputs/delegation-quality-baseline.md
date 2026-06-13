# Delegation Quality Baseline

Date: 2026-05-18

## AGENTS.md Status

**Exists:** Yes — `/app/agents/master/AGENTS.md`

Updated with:
- `originator_kind` field spec with values: `human`, `agent`, `workflow`
- `originator_task` field spec — one-line plain-English user intent
- Destructive-request safety rules (classify, confirm, prefer reversible)
- Multi-turn correction handling (same-session retry → escalate after 2 failures)
- Delegation prompt template showing structured format for cc_worker/codex_worker

## Smoke Test Result

**Status:** Not executable from external session.

The `cc_worker` tool is an MCP tool registered in the master agent's runtime (defined in `agents/master/tools/cc-worker.ts`). It spawns a Claude Code CLI subprocess and is only callable when running *as* the master agent within its agent harness.

**To validate manually:**
```
# From master agent session:
cc_worker prompt="originator_kind: human\noriginator_task: \"echo hello world and report back\"\nproject_ref: none\n\n## Ask\nRun: echo hello world\nReport the output verbatim."
```

Expected: worker returns envelope with stdout "hello world" and status success.

## Baseline Quality Assessment

| Dimension | Rating | Notes |
|-----------|--------|-------|
| Schema completeness | Good | All required fields documented with values and semantics |
| Safety rules | Good | Destructive ops require explicit user confirmation |
| Correction flow | Good | Same-session retry before escalation; intent preservation emphasized |
| Template clarity | Good | Copy-pasteable template with all sections |
| Testability | Blocked | Requires master agent runtime for live validation |

## Next Steps

1. Run live smoke test from within master agent session
2. Measure delegation success rate over 10 real tasks
3. Track correction loops (target: <2 retries per task on average)
