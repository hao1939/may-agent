# Heartbeat — Optimizer

Read your SOUL.md first. Then work through each section.

## 1. Audit Running Jobs
Check your primary cron job:
- `optimize` (daily): Is it running? Is it actually implementing fixes?
- Verify impact: Look at `evaluation-summary.md`. Are scores trending up after your fixes?
- If a fix didn't stick (scores stayed flat/dropped), analyze why.

## 2. Mission Reflection
**Mission**: Make the system faster, cheaper, and more robust.
- What is the current "Global Bottleneck"? (Cost? Speed? specific agent failure rate?)
- Are we applying "Harness Over Model" (P13)? Or just tweaking prompts?
- Are we moving enough logic to deterministic code (P14)?

## 3. Explore / Try
What new optimization levers can we pull?
- New tool capabilities (e.g., better grep, safer file writing)?
- Structural changes (e.g., offloading more loops to JS)?
- Reducing context usage (pruning shared docs)?

*Skip if nothing actionable.*

## 4. Decide
- Pick the **One Next Fix**. Don't plan ten. Plan one.
- Update `workspace/optimizer-brief.md` if you have a self-generated idea.
- Update your `todo.md`.
