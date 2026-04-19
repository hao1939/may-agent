# Heartbeat Workflow Wiring — Milestone 4

**Goal**: Route agent heartbeats through the shared `heartbeat` workflow to increase workflow coverage from 31% to ~80%.

**Status**: Registry updated ✓. Agent heartbeat.md updates need May/tech-lead to apply.

## 1. Registry Update ✅

Added `heartbeat` to `agents/shared/workflows/REGISTRY.md` shared workflows table.

## 2. Cron.json Update ✅

Added `"workflow": "heartbeat"` to May's heartbeat entry in `agents/may/cron.json`.

## 3. Heartbeat.md Updates — NEEDS APPLY

The optimizer cannot edit other agents' heartbeat.md files (write guard). Below are the exact edits needed for 4 agents. **Request May or tech-lead to apply these.**

### 3a. agents/may/heartbeat.md

**Insert after line 1** (after `# May Heartbeat`), before `You're waking up`:

```markdown
> **Workflow**: `heartbeat` (check-health → review-requests → dispatch-work → update-context)
> This heartbeat follows the shared `heartbeat` workflow structure. Map your steps accordingly:
> - **check-health** = System snapshot + metrics check (below)
> - **review-requests** = Board read + pending tasks + triage failures
> - **dispatch-work** = Board edit + fork work + improvement queue
> - **update-context** = Commit + finish
```

### 3b. agents/coach/heartbeat.md

**Insert after line 1** (after `# Coach Heartbeat — Dispatcher Mode`), before `You're waking up`:

```markdown
> **Workflow**: `heartbeat` (check-health → review-requests → dispatch-work → update-context)
> This heartbeat follows the shared `heartbeat` workflow structure. Map your steps accordingly:
> - **check-health** = Step 1 OBSERVE (snapshot + experiments + todo)
> - **review-requests** = Step 2 DECIDE (priority ladder)
> - **dispatch-work** = Step 3 ACT (workflow.run for substantive work)
> - **update-context** = Step 4 EXIT (finish + commit)
```

### 3c. agents/qa/heartbeat.md

**Insert after line 1** (after `# QA Heartbeat`), before `You're waking up`:

```markdown
> **Workflow**: `heartbeat` (check-health → review-requests → dispatch-work → update-context)
> This heartbeat follows the shared `heartbeat` workflow structure. Map your steps accordingly:
> - **check-health** = Check system state
> - **review-requests** = Pending Reviews (step 1)
> - **dispatch-work** = Proactive Scan (step 2) + journal update (step 3)
> - **update-context** = EXIT (step 4, finish)
```

### 3d. agents/optimizer/heartbeat.md

**Insert after line 1** (after `# Optimizer Heartbeat — Dispatcher Mode`), before `You're waking up`:

```markdown
> **Workflow**: `heartbeat` (check-health → review-requests → dispatch-work → update-context)
> This heartbeat follows the shared `heartbeat` workflow structure. Map your steps accordingly:
> - **check-health** = Step 1 OBSERVE (snapshot + todo + metrics)
> - **review-requests** = Step 2 DECIDE (priority ladder)
> - **dispatch-work** = Step 3 ACT (fork substantive work)
> - **update-context** = Step 4 CLOSE (commit + finish)
```

## 4. Additional Cron.json Updates Needed

For coach, qa, optimizer, bob, scout, tech-lead heartbeats in `agents/may/cron.json`, add `"workflow": "heartbeat"` field to each heartbeat entry. Same pattern as the May entry already updated.

Entries to update (search by name):
- `heartbeat-bob` 
- `heartbeat-optimizer`
- `heartbeat-coach`
- `heartbeat-scout`
- `heartbeat-tech-lead`
- `heartbeat-qa`

## Coverage Impact

With heartbeat workflow wired to all 7 agents running every 30min:
- Heartbeat sessions = ~77% of all sessions (from freestyle patterns analysis)
- Current workflow coverage = 31%
- Projected coverage with heartbeat workflow = 31% + (77% × ~0.65 adoption) ≈ **81%**
