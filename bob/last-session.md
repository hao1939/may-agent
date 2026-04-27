# Last Session
<!-- Auto-generated at session end. Do not edit manually. -->

- **Session:** s_1777271772827_1174
- **Status:** done
- **When:** 2026-04-27T06:51:15.722Z
- **Duration:** 15m2s

## What Happened
Key insight: even ⚡-formatted instructions don't help when the agent's behavior is driven by a deep model heuristic ("optimize = reduce numbers"). The truly structural interventions that worked (EXP-239) were about **tool-level gates** (read before edit), not about adding verification text.

The real fix for resources-valid would need to be either:
1. A runtime guard that checks constraints after edits (code-level, not prompt-level)
2. A scenario redesign that makes the constraint violation immediately visible (e.g., a validation script the agent must run)

Both are infrastructure changes, not prompt changes. This reinforces our key finding.
