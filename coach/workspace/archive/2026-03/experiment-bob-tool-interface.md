# Experiment: Bob Tool-Interface Protocol Skill

**Date**: 2026-03-26
**Experiment ID**: exp-bob-tool-interface-001
**Agent**: bob
**Error Pattern**: FM-2.6 (TOOL_INTERFACE_MISUSE) + FM-3.3 (VERIFICATION_FAILURE)
**Method Applied**: New skill `tool-interface-protocol` (Method #24 variant — skill injection)
**Session**: s_1774494918426_356

## Diagnosis

From bob's ERROR_LOG.jsonl (5 FM-2.6 + 5 FM-3.3 entries from 2026-03-17):
- **FM-2.6**: Bob runs `checkpoint` and `finish` as bash commands instead of native tool calls. Results in exit code 127 ("command not found"), wastes 2-5 tool calls per occurrence.
- **FM-3.3**: Bob claims deliverables in `finish()` without reading them back to verify they exist.

## Intervention

### Fork created
- **Path**: `agents/.lab/bob-tool-interface-skill/`
- **Changes from production bob**:
  1. New skill file: `skills/tool-interface-protocol/SKILL.md` (147 lines)
  2. SOUL.md line 44: Added skill reference `- **tool-interface-protocol**: checkpoint, finish, agents are TOOL calls, never bash commands`

### Skill design
The skill follows the standard SKILL.md format with:
- **When to Apply**: Triggers on checkpoint/finish/agents usage
- **Steps**: 4-step protocol (recognize, use correct syntax, never bash, verify deliverables)
- **Assertions**: 3 testable assertions
- **Anti-Patterns**: 2 documented anti-patterns with costs and fixes

## Testing Status

**BLOCKED**: No bob-specific gym scenarios exist. The gym is designed for coder-type agents (bug-fixing, reading-comprehension scenarios). Bob is an architect agent whose work involves designing, briefing, and coordinating.

### Options for validation
1. **Create a bob-type gym scenario**: Design a scenario where an architect agent must save progress and signal completion — would directly test FM-2.6/FM-3.3
2. **Manual integration test**: Deploy the fork to production bob and monitor ERROR_LOG.jsonl for 24h
3. **Proxy test via coder scenarios**: Run the skill-augmented SOUL.md through coder scenarios (imperfect — coder doesn't encounter FM-2.6 the same way)

## Recommendation

Option 1 (create bob-type scenario) is the proper approach. The scenario should:
- Present a multi-step architectural task
- Require checkpointing progress mid-way
- Require finishing with specific deliverables
- Score: did the agent use native tool calls (not bash)? Did it verify deliverables?
