# Compliance Check — Recent Sessions (last 5)
**Date:** 2026-03-14
**Checked sessions:**
- `s_1773502409880_151` (may, done)
- `s_1773502367226_150` (may, error)
- `s_1773502319998_148` (evaluator, done)
- `s_1773502296096_146` (evaluator, done)
- `s_1773502277177_143` (bob, done)

## P82 Compliance — `read_by` in SIGNALS / handoffs
**Result:** FAIL (0/5 sessions demonstrated usage)

### Evidence
- `s_1773502409880_151` (may): No `read_by:` usage. Handoff was via `agents.send` to tech-lead, but message did **not** include `read_by` metadata, nor did it update `agents/shared/SIGNALS.md`.
- `s_1773502277177_143` (bob): Ran `grep -r "read_by:" agents/shared/SIGNALS.md agents/*/workspace/journal.md` and got **no output** → indicates `read_by:` absent from both SIGNALS and journals at that time.
- No `read_by:` hits in the other 3 sessions (`s_...146`, `s_...148`, `s_...150`) based on transcript grep scan.

### Notes
- Some agents *refer to* P82/Explicit Acks conceptually, but do not perform the concrete protocol step (writing/acknowledging `read_by`). This is “policy known, not executed.”

## P114 Compliance — Experience Replay (grep ERROR_LOG / LESSONS before acting)
**Result:** FAIL (0/5 sessions demonstrated pre-action grep of ERROR_LOG or LESSONS)

### Evidence
- `s_1773502409880_151` (may): Did not grep `ERROR_LOG` or `LESSONS` prior to actions. (Actions were mostly health checks + redispatch; still no replay step observed.)
- `s_1773502277177_143` (bob): Grepped for `experience-replay` in journals and found **0 occurrences**. No evidence of replay being used as a pre-action step in this session.
- No `ERROR_LOG`/`LESSONS` grep usage observed in `s_...146`, `s_...148`, `s_...150` transcripts.

### Notes
- One session (`s_1773502409880_151`) contained an auto-inserted `<active_recall>` block in the user prompt, but the agent did not follow it with an explicit grep/read of an error log; this does **not** count as P114 compliance.

## Summary
- **P82**: Not operationalized in practice in these recent sessions; no `read_by` acknowledgments observed.
- **P114**: “Experience replay” / pre-action error-log recall not observed; even Bob’s explicit monitoring found 0 usage.
