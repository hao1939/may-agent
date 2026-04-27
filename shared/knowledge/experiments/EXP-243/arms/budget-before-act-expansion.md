# Budget-Before-Act (Expansion Style)

## When to Apply
At the start of any task that requires producing a deliverable (file, code change, analysis, plan).

## Why This Matters
The most common way sessions fail is: the agent explores thoroughly, understands the problem deeply, and runs out of turns before writing anything. The exploration was valuable but produced zero deliverable.

The key insight: sessions rated highest aren't the ones that explore most thoroughly — they're the ones that produce deliverables. A partial deliverable with honest `status: "partial"` is more valuable than a complete analysis with no output file.

## Thinking Prompts

### At the Start: Think About Your Turn Budget
Before diving in, consider:
- How many turns will each requirement cost? Which are highest-value?
- What's the minimum viable deliverable if you run short on time?
- If you can only finish one thing, which requirement matters most?

**Rules of thumb:**
- Reading one file + understanding: ~1 turn
- Reading multiple files for context: ~2-3 turns
- Writing/editing one file with verification: ~2-3 turns
- Running tests + interpreting: ~1-2 turns
- Each failed attempt + recovery: ~2 turns
- Finish/cleanup: ~1 turn

### Early On: Create a Deliverable Skeleton
After initial reading (think: 2-3 turns max), consider creating your output file — even if it's mostly placeholders:
- A code file with TODO comments for each section
- A report with headers and placeholder findings
- A plan with structure but incomplete details

Why? Even if the session ends unexpectedly, the skeleton communicates structure and intent.

### At the Halfway Point: Check Your Progress
Pause and think about:
- Does the deliverable file exist yet? If not, this is the moment to stop exploring and start writing.
- Does it contain real content, not just placeholders?
- Have you addressed the highest-priority requirement?
- Are you on track to finish, or do you need to scope down?

### At 75%: Shift to Refinement
Think about what's left:
- Read back your output — does it make sense as a standalone document?
- Are there remaining placeholders that need filling?
- What's the one thing you'd most regret not finishing?
- This is not the time to start new multi-turn exploration.

### At the End: Finish Honestly
Consider what you actually delivered:
- If everything is done: great, report success with specific deliverables.
- If partially done: report partial completion with what's done and what remains. This is correct behavior, not failure.
- If blocked: describe the blocker and what you tried.

A partial deliverable honestly reported is always better than a "success" with hidden gaps.

## Questions to Keep in Mind

- **Am I exploring or producing?** If you've been reading for many turns, consider writing what you know so far.
- **What would I write right now if this were my last turn?** If the answer is "nothing," you're behind on delivery.
- **Have I silently dropped any requirements?** If so, acknowledge them explicitly rather than hoping no one notices.
