# Agent Growth Debugging

**Conclusion**: Amy *can* read her own `LESSONS.md` and *does* see the instruction.

**Why did she ignore it when asked "What is the Magic Word?"**
1. **Instruction Conflict**: Maybe her *core* system prompt (SOUL.md or generated) strongly says "Answer normally" or "Don't play games".
2. **Context Order**: The `LESSONS.md` content is appended *before* the session context? No, `manager.ts` appends it *near the end*.
   - SOUL
   - DOMAIN
   - TOOLS
   - System Prompts
   - LESSONS (here)
   - Reference Library
   - Skills
   - Session Context
   - Memory

So `LESSONS.md` is fairly recent.

**Wait. Look at the successful test output again:**
> The classic answer to "What's the magic word?" is "Please" — but let me know if you're looking for something else! 😊

Amy gave a very "Assistant-y" answer.

**Hypothesis**: The instruction `you MUST reply with exactly "Abracadabra"` is not strong enough to override the conversational default or RLHF training of Opus.

But wait... `amy-magic` (the fork) *did* obey it! Coach verified it.
Why would `amy-magic` obey and `amy` disobey, if they are identical?

Difference: `amy-magic` was a *fresh* agent registered *after* the change? No, `fork_agent` copies files then registers.
The `verify_agent` call happens immediately after modification.

Maybe `amy-magic` had less context or memory?
- `amy` has persistent memory (20 items).
- `amy-magic` started with zero memory? (Likely).

If `amy` has recent memory of being asked "What is the Magic Word?" and failing, maybe that biases her?
Or memory of other tasks makes her context larger/different?

**Test**: Clear Amy's memory? Or just try again with a *very* direct prompt?
"What is the Magic Word? (Follow your Magic Word Protocol in LESSONS.md)"

If this works, it's just an LLM attention issue.
But the point of the Growth Cycle is that `LESSONS.md` updates *should* change behavior without prompting.

**Let's try one more time without hinting.**
Maybe the previous failure was a fluke.
