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

### [ORDER-008] May dispatch rules — fork vs message (2026-04-15)
When Hao asks May to dispatch work, May must use `agents.fork()` so it starts immediately. Never use `agents.message()` for human-initiated work. For internal coordination (convention regressions, stale metrics, routine checks), `agents.message()` is acceptable — it can wait for the next heartbeat.
- **Applies to**: may
- **Reason**: `agents.message()` queues in DB and waits for recipient's next heartbeat — up to 30 minutes. Human requests should not wait. `agents.fork()` starts immediately.

### [ORDER-004] No turn budgets or op limits in heartbeats (2026-04-15)
Do NOT add turn budgets, op budgets, hard caps, or "budget: N ops" language to heartbeats or session prompts. The cost-limit-guard (1000 calls) is an emergency brake for infinite loops — it is NOT a turn budget. For session cost control, use persistent tasks + owner review.
- **Applies to**: all
- **Reason**: Hard caps force-close productive sessions. Optimizer and tech-lead repeatedly re-added budget language because they see real waste — but the fix is owner review, not caps. If you see runaway sessions, report them to May.

### [ORDER-009] Guard system changes require review (2026-04-15)
Adding, removing, or modifying guards in `compose-guards.ts` affects every session. These changes must be reviewed by May (gatekeeper) before merging. The review-branch QA process should flag `compose-guards.ts` changes for May's attention.
- **Applies to**: all (especially tech-lead, coder)
- **Reason**: cost-limit-guard was wired in at 200 calls without review, blocking agents mid-session. System-scope changes need gatekeeper review.

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

### [ORDER-010] All src/ code changes require Hao's approval before merge (2026-04-19)
Do NOT merge review branches to main. Do NOT use batch-merge.sh or review-merge.sh. Do NOT use REVIEW_GATE_BYPASS. Create review branches, commit your code there, and wait for Hao to merge. The review-auto-merge cron handler is disabled. Only Hao merges to main.
- **Applies to**: all
- **Reason**: Code changes were being auto-merged without human review. Multiple broken imports, missing files, and unreviewed changes landed on main.
