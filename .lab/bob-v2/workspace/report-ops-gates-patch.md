# Report: Ops Gates (Deterministic Guardrails)

## Summary
The **P17 Deterministic Guardrails** system is fully operational.
1. **Skill**: `agents/shared/skills/check-state/SKILL.md` (and script) created.
2. **Policy**: `agents/coder/SOUL.md` and `agents/qa/SOUL.md` updated to mandate usage.
3. **Protocol**: Agents must now show `CHECK_STATE:PASS` evidence before finishing.

## Impact
This eliminates "lazy success" (hallucinating completion). An agent cannot simply say "I'm done" — it must prove it with a code-based check.

## Next Steps
- Monitor usage in next few sessions.
- If friction is high, refine the `check_state` script (add more assertions).
