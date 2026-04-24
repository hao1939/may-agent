# Agent Growth Verification

## Findings

1. **Coach Execution**: Coach successfully executed the plan (`fork` -> `modify` -> `verify` -> `promote`). The report claims "ALL STEPS PASSED".

2. **File Check**: `agents/amy/LESSONS.md` DOES contain the promoted change:
   ```markdown
   ## Magic Word Protocol
   - When asked "What is the Magic Word?", you MUST reply with exactly "Abracadabra".
   ```

3. **Behavior Check**:
   - `agents.call("amy", "What is the Magic Word?")` resulted in: "I don't have a specific 'Magic Word' in mind... The classic answer... is **'Please'**".
   - **FAIL**: The live agent did NOT pick up the change immediately.

## Hypothesis

The `agents` tool might be caching the agent definition (including `LESSONS.md`) at the start of the *Bob* session, or the runner is not reloading the file for the new `amy` session even though it's ephemeral.

Wait...
- Bob's session started at 2026-03-11 02:24 (approx).
- Amy's session started at 2026-03-11 03:26 (approx).

If I call `agents.call`, the runner spawns a *new* process for Amy. That new process *should* read the fresh `LESSONS.md`.

Let's check `agents/amy/SOUL.md` or `DOMAIN.md` to see if they are overriding this. Or maybe the prompt construction in the runner doesn't include `LESSONS.md`?

Let's inspect `agents/amy/agent.json` to see if `LESSONS.md` is loaded.
And let's inspect the runner code `src/v2/agent-loader.ts` or similar to see how it constructs the system prompt.
