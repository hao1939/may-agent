# Open Problems — System Gaps

Unsolved problems identified during doc review (2026-04-20). Each is either tracked by an active project or needs one.

## 1. Session Continuity

**Problem**: Agents start fresh each session. For project work, journal.md provides context. But heartbeats, ad-hoc tasks, and non-project work have zero memory of what happened before. An agent might investigate a metric breach, find something, then next heartbeat starts from scratch.

**Prior work**: `session-digest.md` and `phase5-digest-context-injection.md` (archived) designed a digest system. The code was implemented in `src/lib/manager.ts` (`buildSessionContext`, 144 lines) — it computes digests, cross-agent context, active recall, session diffs, checkpoints, last-session summaries. But it's **dead code**: the result is computed then discarded. `promptText = task` ignores it. The injection was intentionally disabled when we moved to "user message = task only."

**What's needed**: NOT re-enabling brute-force injection. The context-learning project should design how agents learn from experience and retrieve relevant context when needed — by learning, not by dump. The dead code's data sources (digests, diffs, recall) are valuable inputs for the design. The dead code itself should be cleaned up (src/ change).

**Tracked by**: context-learning project (bob) — this is part of "agents learn from experience"

## 2. Metric Reaction

**Problem**: Metrics alert but no agent reacts. The plumbing works (alerts fire, DB records exist) but there's no mechanism to push alerts to agents as actionable tasks.

**Prior work**: `metrics-heartbeat-integration.md` (archived) designed heartbeat-based polling. Wrong mechanism — heartbeats are for autonomy, not alert processing.

**What's needed**: Event-driven metric reaction. Metric crosses threshold → auto-fork the responsible agent with a task: "Your metric X breached. Investigate and fix." The agent gets a task, not a hint.

**Tracked by**: metric-reactivity project (may)

## 3. Quality Injection (Few-shot / Context)

**Problem**: Agents make the same quality mistakes repeatedly. We have skills (text instructions) and guards (structural blocks) but no mechanism to show agents examples of good work.

**Prior work**: `fewshot-production-pipeline.md` (archived) proposed injecting few-shot examples. Never reviewed.

**What's needed**: A way to inject "here's how to do X well" at the right time. Could be:
- Few-shot examples in workflow step prompts
- Learned lessons retrieved by situation (context-learning project)
- Skills with worked examples, not just rules

**Tracked by**: context-learning project (bob) — overlaps with "agent learns from experience"

## 4. Guard Soft Guidance

**Problem**: Guards are binary — block or pass. No way to give agents soft guidance before they hit a guard. "You're about to violate X, consider Y."

**Prior work**: `content-first-guards.md` and variants (archived) proposed injecting guard context into prompts proactively. Never implemented.

**What's needed**: Unclear if this is worth building. Guards work. Escalation path exists (guard-escalation.md). Maybe this is a context-learning problem — if agents learn from past guard violations, they avoid them.

**Tracked by**: Not tracked. Low priority — monitor guard violation rate first.

## 5. General Circuit Breaker

**Problem**: Non-project agent sessions can run away — burning tokens without progress. persistent-task has stall detection (5 iter). But heartbeats and ad-hoc tasks have no timeout beyond the model's token limit.

**Prior work**: `auto-pause-recovery.md` (archived) proposed a circuit breaker.

**What's needed**: A general mechanism to detect and stop runaway sessions. Could be in the cron watchdog or a new handler.

**Tracked by**: Not tracked. Medium priority — check if the existing watchdog handler already covers this.

## 6. No Event Trigger for Workflows

**Problem**: No way to immediately trigger a workflow from outside the system. Currently: add comment → wait up to 5 minutes for cron → handler fires → workflow runs. This is poll-based, not event-based. Contradicts our "event-driven" principle.

**What's needed**: `may-agent --run-workflow persistent-task "project: X\nagent: Y"` CLI command that directly executes a workflow without LLM wrapper or cron delay. The socket protocol could also support this: `{"type":"run-workflow","name":"persistent-task","input":"..."}`.

**Tracked by**: Not tracked. src/ change needed.
