# DESIGN: May-as-Gatekeeper — Human Review for System-Level Changes

**Author:** Bob  
**Date:** 2026-04-15  
**Status:** DRAFT — requires Hao approval before implementation  
**Prior art:** `agents/shared/may-agent-docs/design/may-gatekeeper.md` (conceptual), `may-gatekeeper-engineering.md` (engineering analysis)

---

## 1. Problem Statement

Agents autonomously make system-level changes that affect other agents and the platform itself, with no human review before the changes take effect. These changes are hard to detect, costly to reverse, and have caused real incidents:

### Evidence: Past Incidents

| Date | Agent | What Happened | Impact | Detection Delay |
|------|-------|--------------|--------|-----------------|
| 2026-03 | Optimizer | Added turn budget enforcement to SOUL.md and shared config | Force-closed productive sessions mid-work; required Hao directive to remove entirely | Hours — discovered when agents started failing |
| 2026-03 | Tech-lead | Removed `workflow.run()` from 7 agent heartbeats | Broke all workflow-based behavioral enforcement; partially restored later | ~1 day |
| 2026-04 | Bob | Deleted a workflow file during cleanup | Broken workflow references until restored | Caught in next test run |
| Various | Multiple | Agent config/context.md changes with cascading effects | Behavioral regressions across agents | Variable — sometimes days |

### Why This Keeps Happening

These aren't malicious acts. Agents don't realize they're making system-scope changes. An optimizer "improving" SOUL.md thinks it's editing a document, not changing a system parameter. A tech-lead "cleaning up" heartbeats thinks it's housekeeping, not disabling critical workflows. The problem is **missing awareness of blast radius**, not bad intentions.

### Current State

No review mechanism exists. Changes to shared infrastructure land via normal git commits. May's daily digest shows activity summaries, but by then the damage is done. Hao discovers problems reactively.

---

## 2. Scope Definition: What Requires Approval

The core judgment question: **"Does this change how other agents or sessions behave?"**

### Gate-worthy (system-scope) — Requires Hao Approval

| Category | Examples | Risk Level |
|----------|----------|------------|
| **Shared infrastructure** | Workflow files (`agents/shared/workflows/`), guard definitions, manager code (`src/`), shared utilities | HIGH |
| **Other agents' configs** | Another agent's heartbeat, context.md, SOUL.md, skills/ | HIGH |
| **Deletions of working code** | Removing a workflow, guard, or shared module that's in active use | HIGH |
| **System parameters** | Budgets, limits, timeouts, model selections, cron schedules | HIGH |
| **New cross-agent protocols** | "All agents must now do X" — anything creating obligations across agents | MEDIUM |
| **Shared knowledge structure** | Renaming/reorganizing `agents/shared/` directories, changing file conventions | MEDIUM |

### NOT Gate-worthy (agent-scope) — No Approval Needed

| Category | Why Exempt |
|----------|-----------|
| **Own workspace files** | Agent's sandbox — no cross-agent impact |
| **Knowledge base content** | Hypotheses, experiments, entries, deep dives — content, not structure |
| **Gym scenario runs** | Testing infrastructure, no production impact |
| **Own heartbeat/context.md** | Agent managing their own behavior |
| **Code on review branches** | Already gated by tsc + test; May reviews separately |

### Gray Zone — Default: Don't Gate

When a change is ambiguous (e.g., a knowledge entry that recommends a new convention, editing a shared design doc), **default to not gating**. False positives (unnecessary blocks) cost more than false negatives (missed reviews), because:
- False positive: Hao gets a telegram, spends time reviewing something trivial, agent is blocked
- False negative: May can still flag it in the daily digest for post-hoc review

If a category generates >3 false positives in a week, May should propose moving it to auto-approve.

---

## 3. Detection Mechanism

### Recommended: Hybrid — Agent Self-Declaration + May Heartbeat Scan

Neither approach alone is sufficient:
- **Self-declaration only** fails because agents don't realize they're making system changes (the exact problem we're solving)
- **Scan only** is expensive and can miss indirect changes

#### Layer 1: Agent Self-Declaration (Primary Path)

Each agent's `context.md` gets this instruction (~3 lines):

> Before executing changes to: (a) another agent's heartbeat/context/SOUL, (b) shared workflows or guards, (c) `src/` infrastructure, (d) cross-agent protocols — send a `REVIEW_REQUEST` to May with the proposal file:
> `agents.message("may", "REVIEW_REQUEST: <one-line description>", { context_files: ["path/to/proposal.md"] })`

This is zero-code. Agents already know how to use `agents.message()`. It works for the common case where agents are aware they're proposing something significant (design docs, new workflows, protocol changes).

#### Layer 2: May Heartbeat Scan (Safety Net)

On each heartbeat, May runs a focused scan to catch what agents miss:

1. **Git diff scan** — `git diff --name-only <last-scan-commit>` filtered to protected paths:
   ```
   agents/shared/workflows/
   agents/shared/guards/
   agents/*/heartbeat-config.*
   agents/*/context.md          (only OTHER agents' files)
   agents/*/SOUL.md             (only OTHER agents' files)
   src/                         (manager code)
   ```

2. **Workspace scan** — Check for files matching `DESIGN-*`, `PROPOSAL-*`, `RFC-*` in any agent's workspace that haven't been reviewed.

3. **Session deliverables** — Filter `files_modified` from recent session finish() calls for protected-path modifications.

**Cost:** ~2 tool calls per May heartbeat (one git diff, one file listing). Minimal overhead.

**Why not pre-commit hooks or file watchers:** These require new infrastructure. The git-diff approach uses existing tooling and catches everything that lands in the repo. It's async (changes land first, then get reviewed), but that matches our design philosophy — we're building review, not prevention.

---

## 4. Approval Flow

```
Agent makes change or writes proposal
        │
        ▼
Detection (self-declaration OR May scan)
        │
        ▼
May judges: system-scope or agent-scope?
        │
        ├── Agent-scope ──► Auto-approved. May logs to ledger, moves on.
        │
        └── System-scope ──► May creates pending review:
                │
                ├─ 1. Write entry to approval ledger
                │     (agents/may/workspace/approval-ledger.md)
                │
                ├─ 2. Send Telegram alert to Hao:
                │     "🔒 Review needed: <agent> proposes <change summary>"
                │
                └─ 3. Set status: PENDING
                        │
                        ▼
                Hao responds via Telegram:
                  /approve <slug>    → May marks approved, notifies agent
                  /reject <slug> <reason> → May marks rejected, reverts if needed
                  /defer <slug>      → Keep pending, revisit later
                        │
                        ▼
                May updates ledger + notifies originating agent
                  via agents/<agent>/workspace/inbox/review-<slug>.md
```

### What Happens While Pending

| Change Type | Behavior While Pending |
|-------------|----------------------|
| **Proposals (design docs)** | Nothing happens. Proposal sits in workspace. Agent continues other work. |
| **Already-committed code** | Change is live but tracked. Hao can approve (keep) or reject (revert). |
| **Persistent-task work** | May writes `**Status**: pending-review` to project file → persistent-task exits gracefully → resumes on approval. |
| **Non-persistent work** | May simply doesn't dispatch the next step. She controls dispatch already. |

### Telegram Integration

**No new code needed.** The existing telegram handler passes unknown `/commands` through as natural language input (line ~196 of `telegram.ts`). So `/approve EXP-042` reaches May as `"approve EXP-042"`, which she interprets and acts on.

Optional polish: add `/approve`, `/reject`, `/defer`, `/pending` to the Telegram help text (~4 LOC). Low priority.

---

## 5. Approval Ledger

**Path:** `agents/may/workspace/approval-ledger.md`

Each entry (newest first):

```markdown
## 2026-04-15T10:30:00Z — persistent-task-customization
- **Proposer**: tech-lead
- **Scope**: system (modifies shared workflow)
- **Proposal**: agents/shared/designs/DESIGN-persistent-task-amendments.md
- **May's risk assessment**: MEDIUM — touches shared workflow but well-scoped
- **Decision**: APPROVED — Hao 2026-04-15T11:02:00Z
- **Reason**: "Good analysis, proceed"
```

May reads this on heartbeat to:
1. Check for pending items needing follow-up
2. Calibrate judgment over time (precedent table)

---

## 6. Emergency Bypass

For genuine emergencies (system down, agent stuck in destructive loop):

**`REVIEW_GATE_BYPASS`** — Any agent can tag a change with this marker. May:
- Does **NOT** block the change
- Logs it with HIGH priority in the ledger
- Sends Telegram: "⚠️ BYPASS used by `<agent>`: `<change>`. Review post-hoc."
- Tracks bypass frequency — if an agent uses it >2x/week, flags the pattern to Hao

### May Goes Down

If May's heartbeat stops running, changes land without review (current behavior). The system degrades to the status quo, not to something worse. When May recovers, she scans the full diff since her last heartbeat and catches up.

---

## 7. Learning Loop and Scope Creep Prevention

### Precedent-Based Calibration

After 20+ decisions, May can propose **auto-approve rules** for categories where Hao has approved 100% of the time. Examples:
- "New gym scenarios" → always approved → auto-approve, log only
- "Budget changes" → always rejected → pre-flag as HIGH risk

These auto-approve rules **themselves go through the review gate** (meta-gating). This keeps the system tight early and loosens as trust builds.

### Anti-Bottleneck Measures

| Risk | Mitigation |
|------|-----------|
| Hao overwhelmed with reviews | Auto-approve rules reduce volume over time; false-positive threshold triggers category exemption |
| Agents blocked waiting for approval | Async review — agents continue other work; only the specific system-scope change is blocked |
| May over-gates trivial changes | "When in doubt, don't gate" default; weekly calibration review |
| Gate overhead slows experimentation | Knowledge content is exempt; gym scenarios are exempt; own-agent config is exempt |

### Success Criteria (2 weeks post-deployment)

1. Zero unreviewed system-scope changes land without May flagging them
2. <5 false positives per week from Hao's perspective
3. Average detection-to-decision time: <4 hours (async is acceptable)
4. At least one would-be-damaging change caught before impact

---

## 8. Trade-offs and Risks

### What This Design Chooses

| Trade-off | This Design Chooses | Alternative |
|-----------|-------------------|-------------|
| **Async review vs sync blocking** | Async — changes can land, then get reviewed | Pre-commit hooks that block landing |
| **Judgment-based vs rule-based** | Judgment — May decides scope, Hao decides approval | ACL system ("agent X can't edit file Y") |
| **Behavioral + scan vs code-only** | Hybrid — context.md instructions + git diff scan | Pure code guards on file writes |
| **Gradual loosening vs fixed rules** | Gradual — auto-approve rules earned through precedent | Static approved/denied lists |

### Why Async, Not Sync

Synchronous blocking (pre-commit hooks) would:
- Require new infrastructure (hook system doesn't exist)
- Block agents mid-session, wasting compute
- Create urgency pressure ("I need approval NOW to finish")
- Be harder to implement and maintain

Async review accepts that changes may land before review. The cost is occasionally needing to revert. The benefit is zero new infrastructure and no agent blocking.

### Known Limitations

1. **Already-committed changes are live before review.** For most changes this is fine (can revert). For irreversible changes (data deletion, DB migrations), May should assess revert difficulty and use 🔴 for hard-to-revert + HIGH-risk combinations.

2. **Indirect system changes may slip through.** An agent could write a script that modifies configs on next run, bypassing both self-declaration and path scanning. Mitigation: the daily digest provides a second-pass review opportunity.

3. **Race condition: agent implements before approval.** Agent writes design doc, immediately starts building. Mitigation: context.md coaching ("system-scope proposals need approval before implementation") + May catches the implementation changes too since they touch protected paths.

4. **No enforcement mechanism.** This is a review system, not a permission system. An agent can ignore the gate (there's no code preventing writes to protected paths). We're relying on (a) agent compliance via context.md, (b) May's detection as safety net, (c) Hao's revert authority.

---

## 9. What This Does NOT Do

- **Synchronous blocking** — Not a pre-commit hook. Changes can land before review.
- **Automated rollback** — May flags; Hao decides. No automatic reverts.
- **Permission system** — No ACLs, no "agent X can't edit file Y." Judgment-based, not rule-based.
- **Code review** — May doesn't review code quality. She reviews *scope* (is this system-level?). tsc/tests handle correctness.
- **Guard enforcement** — Per `code-vs-data-decisions.md`, this is behavioral (context.md) + lightweight scan, not a coded guard with regex matching.

---

## 10. Implementation Plan

### Phase 1: Zero-Code Foundation (Day 1) — ~30 minutes

1. Create `agents/may/workspace/approval-ledger.md` with header template
2. Add `REVIEW_REQUEST` instructions to each agent's `context.md` (~3 lines × 5 agents = ~15 lines)
3. Add "check approval ledger on heartbeat" instruction to May's context.md

**Result:** Agents self-declare system-scope proposals. May catches them and alerts Hao. No code changes.

### Phase 2: May Heartbeat Scan (Day 2-3) — ~1 hour

4. Add protected-path git diff scan to May's heartbeat routine (~2 tool calls per heartbeat)
5. Add workspace scan for `DESIGN-*`/`PROPOSAL-*`/`RFC-*` files
6. Wire up Telegram alert for new pending reviews (already has `sendAlert`)
7. Create agent inbox notification template

**Result:** May catches system-scope changes that agents don't self-declare. Hao gets Telegram alerts.

### Phase 3: Persistent-Task Integration (When Needed) — ~30 minutes

8. Add `pending-review` status handling to `persistent-task.ts` (~8 LOC)
   - At line ~357, alongside `paused`/`cancelled` checks
   - Exits gracefully: "Paused for human review. Approval needed at {projectPath}."
9. Resumption: `/approve` sets status back to `active`, next cron cycle picks it up

**Result:** Long-running persistent tasks can be paused for review and resumed after approval.

### Phase 4: Polish (Week 2) — Optional

10. Add `/approve`, `/reject`, `/defer`, `/pending` to Telegram help text (~4 LOC)
11. Create `gatekeeper-history.md` summary view for Hao
12. After 20+ decisions: propose first auto-approve rules

### Total Implementation Cost

| Component | Code Changes | Context/Behavioral Changes |
|-----------|-------------|---------------------------|
| Approval ledger template | 0 LOC | 1 file created |
| Agent REVIEW_REQUEST instructions | 0 LOC | ~15 lines across 5 context.md files |
| May heartbeat scan | 0 LOC (behavioral) | ~5 lines in May's context.md |
| Telegram alerts | 0 LOC (uses existing sendAlert) | 0 |
| persistent-task.ts integration | ~8 LOC | 0 |
| Telegram help text (optional) | ~4 LOC | 0 |
| **Total** | **~8-12 LOC** | **~20 lines of context.md** |

The remarkably low code cost reflects the design philosophy: this is primarily a behavioral/process change enabled by May's existing capabilities, not a new system.

---

## 11. Relationship to Existing Designs

- **`code-vs-data-decisions.md`**: This design follows the decision tree — gatekeeper logic lives in context.md (data), not coded guards. The only code is the ~8 LOC `pending-review` status in persistent-task.ts (a permanent, universal, mechanical check).
- **`ch2-production-gates.md`**: Complementary. Ch2 gates enforce investigation quality *within* workflows. The gatekeeper controls *which system changes are allowed to proceed*. Different layers, no conflict.
- **`guard-workflow-architecture.md`**: The gatekeeper could eventually become a workflow-level guard (injecting a "review" step when system-scope changes are detected). But v1 is simpler — behavioral gating via May's judgment, not a new guard type.

---

## Appendix: Decision Record

| Decision | Rationale |
|----------|-----------|
| Async review, not sync blocking | No hook infrastructure exists; blocking wastes compute; async is sufficient for review |
| Hybrid detection (self-declare + scan) | Self-declare alone fails when agents don't realize scope; scan alone is expensive |
| Judgment-based, not ACL-based | Scope is contextual (same file can be system-scope or not); rules can't capture this |
| Zero-code Phase 1 | Ships immediately; validates the concept before investing in code |
| persistent-task integration deferred to Phase 3 | Only needed for long-running tasks; most reviews are one-shot |
| Auto-approve rules require their own approval | Prevents premature loosening; meta-gating ensures Hao controls the evolution |
| "When in doubt, don't gate" default | False positives more costly than false negatives; daily digest catches misses |
