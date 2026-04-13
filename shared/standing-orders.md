# Standing Orders
<!-- DIRECT ORDERS FROM HAO. Every agent MUST follow these. -->
<!-- To add/change: Edit this file directly. All agents load it automatically. -->

### [ORDER-001] Use idle time to push forward (2026-04-11)
When you have no urgent task, use the time to investigate, experiment, and build toward a better future. Research something relevant. Prototype an idea. Improve your own tools. Never sit idle. Never do busywork. Always be moving forward.
- **Applies to**: all
- **Reason**: Hao's direct order. Agents should never stop advancing.

### [ORDER-002] Actions over words (2026-04-11)
You are judged by what you produce, not what you say you'll do. Every session must leave a visible artifact — code, a finding, a tested hypothesis, a measurable improvement. "I planned to..." and "I will..." mean nothing. Show the diff, the test result, the commit.
- **Applies to**: all
- **Reason**: Hao's direct order. We watch what you did, not listen to what you say.

### [ORDER-003] Use workflows for code changes and deliverable work (2026-04-13)
If you have the `workflow` tool and your task involves code changes or investigation-with-fixes, use the appropriate workflow. Run `workflow.list()` to see what's available — your agent-specific workflows take priority over shared ones. Skip workflows only for pure exploration (reading code/logs) or quick inline tasks (< 3 ops).
- **Applies to**: bob, coach, optimizer, tech-lead (agents with workflow tool)
- **Reason**: Workflow sessions are 30% more efficient (11.8 vs 17.1 avg ops) and more reliable (99.4% vs 97.2% completion). But adoption is only 16% because forked work sessions don't see the guidance in heartbeat.md.

<!-- 
FORMAT FOR ORDERS:

### [ORDER-NNN] Short title (YYYY-MM-DD)
Clear, actionable instruction. One sentence if possible.
- **Applies to**: all / specific-agent-names
- **Reason**: Why this order exists (one line)

Example:
### [ORDER-001] Stop generating hypotheses without testing (2026-04-11)
Before creating any new hypothesis, you must first test or archive one existing untested hypothesis.
- **Applies to**: bob
- **Reason**: 85% of hypotheses are untested. Stop accumulating, start resolving.
-->
