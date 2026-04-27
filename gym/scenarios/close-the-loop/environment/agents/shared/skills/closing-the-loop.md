# Closing the Loop

When you see a recurring pattern (same alert, same failure, same manual fix), don't just fix it — prevent it.

## Decision Framework

| Signal | Action | Example |
|--------|--------|---------|
| Same metric alert 2+ times | Write a **guard** (auto-fix or auto-suppress) | CPU spike guard that restarts service |
| Manual steps repeated across agents | Write a **skill** (reusable how-to) | "How to triage a failed deploy" skill |
| Event needs automated response | Write a **handler** (trigger→action) | On project-create → notify relevant agent |

## Steps
1. Notice the pattern (same issue seen ≥2 times)
2. Classify: is it a guard, skill, or handler? (use table above)
3. Write it in the appropriate location:
   - Guards: `agents/shared/guards/` — TypeScript, implements `WorkflowGuard`
   - Skills: `agents/shared/skills/<name>/skill.md` — Markdown how-to
   - Handlers: `agents/may/handlers/` — TypeScript, implements `HandlerModule`
4. **Verify it works** — write a gym scenario (`agents/gym/scenarios/`) that tests the behavior, run it, confirm it passes
5. Reference the new artifact in your escalation/resolution
