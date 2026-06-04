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

### [ORDER-003] Use workflows for structured work (2026-04-13, updated 2026-05-20)
Workflows are for **structured bounded work** — heartbeats, reusable procedures, and task-level recipes. These are handled automatically:
- **Projects** → project handler dispatches tasks or owner agent sessions
- **Heartbeats** → per-agent heartbeat workflow (launched by cron)
- **Code changes** → `workflow.run("implement-and-verify", ...)` (shared workhorse) or `workflow.run("verified-coder", ...)` (tech-lead variant)

**Dispatching work to other agents:** Use `agents.fork()` — it's fire-and-forget, doesn't block you. The session is tracked in the DB. Don't wrap dispatch in a blocking workflow — `agents.fork()` is the dispatch primitive.

- **Applies to**: all agents
- **Reason**: Fork is the correct dispatch mechanism. Workflows are for process structure, not dispatch tracking.

### [ORDER-008] May dispatch rules (2026-04-15, updated 2026-04-22)
When Hao asks May to dispatch work, May must start it immediately using `agents.fork()`. Never use `message()` for human-initiated work — it queues and waits up to 30 minutes.
- **Applies to**: may
- **Reason**: Human requests should not wait.

### [ORDER-004] No turn budgets or op limits in heartbeats (2026-04-15)
Do NOT add turn budgets, op budgets, hard caps, or "budget: N ops" language to heartbeats or session prompts. The cost-limit-guard (1000 calls) is an emergency brake for infinite loops — it is NOT a turn budget. For session cost control, use persistent tasks + owner review.
- **Applies to**: all
- **Reason**: Hard caps force-close productive sessions. Agents repeatedly re-added budget language because they see real waste — but the fix is owner review, not caps. If you see runaway sessions, report them to May.

### [ORDER-009] Guard system changes require review (2026-04-15)
Adding, removing, or modifying guards in `agents/shared/guards/` (loaded by `agents/shared/guards/loader.ts`) affects every session. These changes must be reviewed by May (gatekeeper) before merging. The review-branch QA process should flag guard changes for May's attention.
- **Applies to**: all
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
- **Applies to**: all
- **Reason**: 85% of hypotheses are untested. Stop accumulating, start resolving.
-->

### [ORDER-014] Re-judge projects when a plan completes (2026-05-02, updated 2026-05-20)
When a project plan appears complete, judge it against the goal, current signals, evidence, and next useful action. If concrete autonomous work remains, re-plan and continue. Use `waiting`, `blocked`, or `closed` only when there is a real stop condition: an external precondition, an unresolved dependency, or explicit human/May closure.
- **Applies to**: all project owners and orchestrator roles
- **Reason**: checked-off milestones are evidence, not the goal. Projects should keep moving while useful work remains, and stop only for a clear reason.

### [ORDER-010] All src/ code changes require Hao's approval before merge (2026-04-19)
Do NOT merge review branches to main. Do NOT use batch-merge.sh or review-merge.sh. Do NOT use REVIEW_GATE_BYPASS. Create review branches, commit your code there, and wait for Hao to merge. The review-auto-merge cron handler is disabled. Only Hao merges to main.
- **Applies to**: all
- **Reason**: Code changes were being auto-merged without human review. Multiple broken imports, missing files, and unreviewed changes landed on main.
