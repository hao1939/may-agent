# Lessons

Feedback from evaluator sessions and operational patterns.

## Task evaluation (2026-03-14 18:32:06)

- Session not available → cannot assess; ensure the evaluation references the exact provided session ID and its transcript paths before making claims.

## Task evaluation (2026-03-14 22:33:22)

- Treat cross-agent SOUL.md edits as structurally impossible unless you have tool-output evidence otherwise; route the work to the owning agent/human and use tool-block output (P53 message) as the proof.
- When refusing an edit request, prioritize producing structural evidence (attempt minimal edit, capture block result) over interpreting patch-file instructions.

## Skill lifecycle patterns (2026-03-25)

- **Behavioral skills need prompt injection, not just docs**: prerequisite-gap-protocol tested 0/3 because the skill was available as a reference doc but not injected into the agent's prompt. The agent's default success-bias overrides. Guard lines in SOUL.md are more effective than SKILL.md reference docs alone.
- **Standard deployment target set**: 6 agents (bob, coach, coder, optimizer, scout, tech-lead). Evaluator is P98 write-blocked. May/master/qa/amy have minimal editing or small sessions.
- **Gym criteria false negatives**: The `hasVerificationAfterWrite` check only recognizes read()/cat/head, not python3-based validation. LLM judge scored 6/6 (100%) where automated checks scored 1/6 (17%). Always cross-reference LLM judge results.
- **Skill pipeline saturation is normal**: When discovery returns stale results (same pattern already deployed), this means the pipeline is running faster than novel patterns emerge. No action needed — wait for fresh session data.
- **Session read guard bash bypass**: Agents bypassed the read() guard by using `bash` + `grep` to dump session.jsonl (50-102KB per call). Extended guard to intercept bash calls too. Pattern: any guard on one tool must also cover equivalent bash commands.
