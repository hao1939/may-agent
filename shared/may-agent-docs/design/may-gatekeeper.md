# DESIGN: May-as-Gatekeeper

**Author:** Bob (design), per Hao directive  
**Status:** DRAFT  
**Date:** 2026-04-15

---

## Problem

Agents autonomously make system-level changes without human approval. Past incidents:

- Optimizer added turn budgets to SOUL.md, breaking agent behavior
- Tech-lead removed `workflow.run`, blocking all workflow usage
- Bob deleted a workflow file during cleanup
- Agent configs went missing from git after heartbeat rewrites

These changes affect how *other* agents and sessions behave. No one reviews them before they land. Hao finds out after the damage. We need an async gate: May catches system-scope proposals, holds them for Hao's approval, and only then lets work proceed.

---

## 1. The Judgment Question

**Core question:** "Does this change how other agents or sessions behave?"

### Gate-worthy (system-scope)

| Category | Examples |
|----------|----------|
| **Shared infrastructure** | Workflow files, guard definitions, manager code, shared utilities |
| **Other agents' configs** | Another agent's heartbeat, context.md, SOUL.md, skills/ |
| **Deletions of working code** | Removing a workflow, guard, or shared module that's in active use |
| **System parameters** | Budgets, limits, timeouts, model selections, cron schedules |
| **New protocols/conventions** | "All agents must now do X" — anything that creates obligations across agents |
| **Shared knowledge structure** | Renaming/reorganizing agents/shared/ directories, changing file conventions |

### NOT gate-worthy (agent-scope)

| Category | Why exempt |
|----------|-----------|
| **Own workspace files** | Agent's workspace is their sandbox — no cross-agent impact |
| **Knowledge base content** | Hypotheses, experiments, entries, deep dives — content, not structure |
| **Gym scenario runs** | Testing infrastructure, no production impact |
| **Own heartbeat/context.md** | Agent managing their own behavior |
| **Code on review branches** | Already gated by tsc + test; May reviews separately |
| **Emergency hotfixes** | Tagged `REVIEW_GATE_BYPASS` — logged but not blocked (see §6) |

### Gray zone

Some changes are ambiguous:
- Adding a knowledge entry that *recommends* a new convention (content, but normative)
- Editing a shared design doc (document, not code)
- Adding a new gym scenario that other agents will run

**Default rule:** When in doubt, don't gate. False positives (unnecessary blocks) cost more than false negatives (missed reviews). May can always flag something in the daily digest without blocking it.

---

## 2. Discovery Mechanism

**Recommendation: Option (b) — May polls on heartbeat + watches file paths.**

Why not the others:
- **(a) Voluntary tagging** — Agents forget. The incidents above weren't malicious; agents didn't realize they were making system changes. Voluntary tagging fails exactly when it's most needed.
- **(c) Guard events on file paths** — Requires new guard infrastructure for file-system monitoring. We don't have this.
- **(d) Combination** — Complexity for marginal benefit at this stage.

### How it works

On each heartbeat, May:

1. **Scans recent git diffs** (since last heartbeat) for changes to protected paths:
   ```
   agents/shared/workflows/
   agents/shared/guards/
   agents/*/heartbeat-config.*
   agents/*/context.md  (only OTHER agents)
   agents/*/SOUL.md     (only OTHER agents)
   src/                 (manager code)
   ```

2. **Reads agent workspace files** for design docs proposing system changes. Markers: filenames containing `DESIGN-`, `PROPOSAL-`, or `RFC-` in any agent's `workspace/` directory.

3. **Checks finish() deliverables** from recent sessions — the session digest already captures files_modified. May filters for protected-path modifications.

### Why this is sufficient

May already monitors agent activity on heartbeat. This adds a focused scan (one `git diff` + one file listing) rather than a new system. The cost is ~2 tool calls per May heartbeat.

---

## 3. The Approval Flow

```
Agent makes change or writes proposal
        │
        ▼
May heartbeat detects it (git diff / workspace scan)
        │
        ▼
May judges: system-scope or agent-scope?
        │
        ├─ Agent-scope ──► Auto-approved. May logs it, moves on.
        │
        └─ System-scope ──► May creates a pending-review item:
                            │
                            ▼
                    1. Write to agents/may/workspace/pending-reviews/
                       (one file per review: YYYY-MM-DD-<slug>.md)
                    2. Send telegram alert to Hao:
                       "🔒 Review needed: <agent> proposes <change summary>"
                       Include: what changed, why it's system-scope, link/path
                    3. Set status: PENDING_REVIEW
                            │
                            ▼
                    Hao responds via telegram:
                    /approve <slug>  — May marks approved, notifies agent
                    /reject <slug> <reason>  — May marks rejected, notifies agent, 
                                               reverts if already committed
                    /defer <slug>   — Keep pending, revisit later
                            │
                            ▼
                    May updates the review file with decision + timestamp
```

### What happens while pending

- **Proposals (design docs):** Nothing changes. The proposal sits in workspace. Agent can continue other work. When approved, agent proceeds to implementation.
- **Already-committed changes:** May creates a revert branch or flags the commit. The change is live but tracked. Hao can approve (keep) or reject (revert).
- **In-progress work sessions:** May does NOT interrupt running sessions. She catches changes after they land. This is async review, not synchronous blocking.

### Agent notification

When Hao decides, May updates the review file and — on her next heartbeat — writes a note to the originating agent's workspace: `agents/<agent>/workspace/inbox/review-<slug>.md` with the decision and any feedback.

---

## 4. Review File Format

One file per review in `agents/may/workspace/pending-reviews/YYYY-MM-DD-<slug>.md`:

Fields: Agent, Detected (timestamp), Status (`PENDING_REVIEW | APPROVED | REJECTED | DEFERRED`), Decision by (Hao + timestamp), What changed (files + intent), Why system-scope (category from §1), May's risk assessment (`LOW | MEDIUM | HIGH` + rationale).

---

## 5. Learning Loop

### Approval history file

`agents/may/workspace/gatekeeper-history.md` — append-only log:

```markdown
| Date | Agent | Change | Category | May's Risk | Decision | Notes |
|------|-------|--------|----------|------------|----------|-------|
| 2026-04-15 | optimizer | Added turn budget to shared config | System parameters | HIGH | REJECTED | "Don't add budgets" |
| 2026-04-15 | tech-lead | New workflow: evidence-gate | Shared infrastructure | LOW | APPROVED | — |
```

May reads this file on heartbeat. Over time it builds a precedent table:
- "Hao always approves new workflows" → May can auto-approve with a lower-confidence alert
- "Hao always rejects budget changes" → May can pre-flag these as HIGH risk

### Calibration

After 20+ decisions, May can propose **auto-approve rules** for categories where Hao has approved 100% of the time. These rules themselves go through the review gate (meta-gating). This keeps the system tight early and loosens as trust is established.

---

## 6. Edge Cases and Failure Modes

### REVIEW_GATE_BYPASS

For genuine emergencies (system down, agent stuck in loop), any agent can tag a change with `REVIEW_GATE_BYPASS`. May:
- Does NOT block the change
- Logs it with HIGH priority
- Sends telegram: "⚠️ BYPASS used by <agent>: <change>. Review post-hoc."
- Tracks bypass frequency — if an agent uses it >2x/week, flag that pattern to Hao

### May goes down

If May's heartbeat stops running, changes land without review (current behavior). This is acceptable — the system degrades to the status quo, not to something worse. When May recovers, she scans the full diff since her last heartbeat and catches up.

### False negatives (May misses a system change)

Likely causes:
- Change to a path not in the protected list
- Agent makes a system change through an indirect mechanism (e.g., writing a script that modifies configs on next run)

Mitigation: Hao can add paths to the protected list. The daily digest already shows all agent activity, so Hao has a second chance to catch things.

### False positives (May gates something trivial)

Cost: Hao gets a telegram message, spends 10 seconds approving. Acceptable if rare. If a category generates >3 false positives, May should propose moving it to auto-approve.

### Race condition: agent continues work assuming approval

Agent writes a design doc, then immediately starts implementing. May catches the design doc but the implementation is already underway.

Mitigation: This is a human-process issue, not a system issue. Agents should be coached (via context.md) that system-scope proposals need approval before implementation. But the gatekeeper catches the implementation too — if the code changes touch protected paths, those get a second review.

### Revert complexity

Some changes are hard to revert (database migrations, deleted data). May should assess revert difficulty in her risk assessment. HIGH-risk + hard-to-revert = telegram with 🔴 not 🔒.

---

## 7. What This Does NOT Do

- **Synchronous blocking:** This is not a pre-commit hook. Changes can land before review. The value is in catching + reviewing, not preventing.
- **Automated rollback:** May flags; Hao decides. No automatic reverts.
- **Permission system:** No ACLs, no "agent X can't edit file Y." The gate is judgment-based, not rule-based.
- **Code review:** May doesn't review code quality. She reviews *scope* — is this change system-level? tsc/tests handle correctness.

---

## 8. Implementation Sequence

1. **Add protected-path scan to May's heartbeat** — `git diff` since last heartbeat, filter for protected paths. (~30 min)
2. **Create `pending-reviews/` directory** and the review file template. (~10 min)
3. **Add telegram alert** for new pending reviews. (Already have `sendAlert`; wire it up. ~20 min)
4. **Add `/approve`, `/reject`, `/defer` telegram commands.** (~1 hour — needs telegram handler changes)
5. **Add agent inbox notification** on decision. (~30 min)
6. **Add gatekeeper-history.md** and history-append logic. (~20 min)
7. **Add `REVIEW_GATE_BYPASS` handling.** (~15 min)
8. **Coach agents** via context.md: "System-scope proposals need approval before implementation." (~5 min)

Total estimate: ~3 hours of implementation work, mostly in May's heartbeat and telegram handler.

---

## 9. Success Criteria

After 2 weeks:
- Zero unreviewed system-scope changes land without May flagging them
- Hao sees <5 false positives per week
- Average time from detection to Hao's decision: <4 hours (async is fine)
- At least one incident that would have caused damage is caught pre-impact
