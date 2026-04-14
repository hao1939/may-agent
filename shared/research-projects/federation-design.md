# Federation Design: Local ↔ K3s Instance Coordination

**Status**: research → design  
**Author**: Bob  
**Date**: 2026-04-08  
**Requested by**: Hao  

---

## 1. Current State

Two may-agent instances run independently, syncing through `agents/` git repo:

| Instance | Location | Agents | DB |
|----------|----------|--------|----|
| **local** | Dell laptop (Docker Compose) | may, bob, tech-lead, coder, optimizer, qa, evaluator | `.state/may.db` (17k sessions) |
| **k3s** | Azure VM (k3s StatefulSet) | scout, coach, amy, amy-kimi | separate `.state/may.db` |

**Sync mechanism**: `sync-agents-continuous.sh` runs as a systemd timer on the k3s host every 5 min. Both instances auto-commit to `agents/` repo every 10 min. Communication is via `agents/shared/bulletin.md` and file drops in `agents/shared/knowledge/`.

**What works**: Agent work partitioning (different agents on each instance), knowledge sharing via git, async experiment pipelines (Bob designs → Coach runs → Bob integrates).

**What breaks**: Git conflicts on shared files, no cross-instance request tracking, duplicate work detection impossible (separate may.db instances), up to 15 min latency on knowledge propagation, no awareness of the other instance's state.

---

## 2. Architecture Options

### Option A: Enhanced Git Federation (Evolutionary)

Keep git as the sole coordination layer. Fix conflicts and add structure.

```
┌──────────────────┐     git (every 2-5 min)     ┌──────────────────┐
│  Local Instance   │ ◄══════════════════════════► │   K3s Instance   │
│  (compose)        │         bare repo            │  (StatefulSet)   │
│                   │       on k3s host            │                  │
│  may.db (local)   │                              │  may.db (local)  │
└──────────────────┘                               └──────────────────┘

Coordination files in agents/shared/federation/:
  - claims.jsonl       (task claim log — append-only)
  - instance-state.json (each instance writes its section)
  - request-inbox/     (cross-instance requests as files)
```

**Pros**: Zero new infrastructure. Works offline. Uses existing sync. Simple to implement.  
**Cons**: 2-15 min latency. No real-time coordination. File-based protocols are brittle. Git merge conflicts on JSON files.

### Option B: Hub-Spoke with Shared SQLite (via Litestream/Turso)

Add a shared database layer while keeping git for knowledge.

```
┌──────────────────┐                              ┌──────────────────┐
│  Local Instance   │──────── shared DB ──────────│   K3s Instance   │
│                   │    (Turso/Litestream)        │                  │
│  may.db (local)   │                              │  may.db (local)  │
│  + federation.db  │                              │  + federation.db │
└──────────────────┘                               └──────────────────┘
         │               git (knowledge)                    │
         └──────────────────────────────────────────────────┘

federation.db: task claims, cross-instance requests, heartbeat pings
may.db: stays instance-local (sessions, evaluations, gym)
agents/ git: knowledge, skills, experiments (unchanged)
```

**Pros**: Real-time task coordination. Proper dedup. Each instance sees the other's work.  
**Cons**: New infrastructure dependency (Turso or Litestream). Network partition handling needed. Two sync mechanisms (git + DB) to maintain.

### Option C: Message Bus Federation (NATS/Redis)

Add a lightweight message bus for real-time coordination.

```
┌──────────────────┐          NATS/Redis          ┌──────────────────┐
│  Local Instance   │ ◄════════════════════════► │   K3s Instance   │
│                   │    (on k3s VM or cloud)      │                  │
│  may.db           │                              │  may.db          │
└──────────────────┘                               └──────────────────┘
         │               git (knowledge)                    │
         └──────────────────────────────────────────────────┘

Channels: task.claim, task.complete, heartbeat.ping, knowledge.notify
```

**Pros**: Sub-second coordination. Pub/sub for events. Can add more instances easily.  
**Cons**: New infra to run and maintain. Overkill for 2 instances. Requires network connectivity — degrades to git-only when bus is down.

---

## 3. Recommended Approach: Option A (Enhanced Git Federation)

**Rationale**: The system already works on git. The coordination problems are solvable with better file protocols — we don't need real-time coordination because agents operate on 30-60 min heartbeat cycles. A 5-min sync delay is fine when the work unit is "design an experiment" or "integrate findings."

Adding infrastructure (Option B/C) introduces new failure modes, costs, and complexity for 2 instances that communicate maybe 10-20 times per day. The "bus of last resort" is git — it works offline, through network partitions, and requires nothing new.

**When to upgrade to Option B**: If we add 3+ instances, or if real-time task allocation becomes a bottleneck (e.g., multiple coaches running gym experiments simultaneously and colliding). Then a shared DB makes sense. But today's workload doesn't justify it.

---

## 4. Git Coordination Strategy

### 4.1 File Ownership Partitioning

The #1 source of conflicts is both instances writing to the same file. Fix this structurally:

**Hard ownership (never written by the other instance):**

| Path pattern | Owner |
|---|---|
| `agents/{may,bob,tech-lead,coder,optimizer,qa,evaluator}/` | local |
| `agents/{scout,coach,amy,amy-kimi}/` | k3s |
| `agents/shared/knowledge/entries/KE-*` | creator instance (whoever creates the file) |

**Shared paths — append-only protocol:**

| Path | Protocol |
|---|---|
| `agents/shared/bulletin.md` | Append-only. Each instance adds entries at the top. Never delete the other's entries. |
| `agents/shared/knowledge/INDEX.md` | Append-only. Add new entries at the bottom. |
| `agents/shared/federation/claims.jsonl` | Append-only. One claim per line. Never edit existing lines. |

**Shared paths — section-owned:**

| Path | Protocol |
|---|---|
| `agents/shared/federation/instance-state.json` | Each instance writes its own keyed section: `{"local": {...}, "k3s": {...}}`. Only touch your key. |

### 4.2 Conflict-Resistant File Formats

**Replace**: JSON files that get rewritten entirely.  
**With**: Append-only JSONL, or section-partitioned files with clear instance ownership.

```
# BAD: Both instances rewrite the same JSON
{ "tasks": [...], "claims": [...] }

# GOOD: Append-only JSONL — git merge trivially resolves
{"ts":"2026-04-08T10:00:00Z","instance":"local","task":"EXP-084","action":"claim"}
{"ts":"2026-04-08T10:01:00Z","instance":"k3s","task":"EXP-085","action":"claim"}
```

### 4.3 Merge Strategy

Change sync script from `git merge` to `git merge --strategy-option=ours` for auto-resolution:

```bash
# In sync-agents-continuous.sh, replace:
git merge --no-edit local-bare/main

# With:
git merge --no-edit local-bare/main || {
  # Auto-resolve: accept both sides for append-only files
  git checkout --theirs agents/shared/federation/claims.jsonl
  git checkout --ours agents/{local-agent-dirs}/**
  git checkout --theirs agents/{k3s-agent-dirs}/**
  git add -A
  git commit --no-edit -m "auto: merge conflict resolved"
}
```

Better: Avoid conflicts entirely via file ownership. The merge fallback is a safety net, not a primary strategy.

### 4.4 Sync Frequency

Current 5-min sync is good for knowledge. For task claims, consider a faster "hot path":

```
agents/shared/federation/claims.jsonl → commit + push immediately (not waiting for auto-commit)
Everything else → normal 5-10 min auto-commit cycle
```

Implementation: Agents call `git add agents/shared/federation/ && git commit -m "claim" && git push` immediately after writing a claim. The `auto-commit-agents.sh` handler catches everything else.

---

## 5. Task Deduplication

### 5.1 Claim Protocol

Before starting work on a shared task (experiment, knowledge integration, cross-cutting design), an agent **claims** it:

```jsonl
# agents/shared/federation/claims.jsonl
{"ts":"2026-04-08T10:00:00Z","instance":"local","agent":"bob","task":"EXP-084","action":"claim","ttl_min":120}
{"ts":"2026-04-08T10:05:00Z","instance":"k3s","agent":"coach","task":"EXP-084-gym","action":"claim","ttl_min":60}
```

**Rules**:
1. Before starting, read claims.jsonl. If someone else claimed the task within TTL, don't start.
2. After finishing, append `action: "complete"` or `action: "release"`.
3. TTL prevents abandoned claims from blocking forever (crashed instance, forgotten task).
4. Same task, different aspects = OK (Bob claims "EXP-084 integration", Coach claims "EXP-084 gym runs" — these are complementary, not duplicate).

### 5.2 Work Partitioning by Type

Most deduplication is handled by the agent partitioning itself:

| Work type | Who does it | Collision risk |
|---|---|---|
| Gym experiments | Coach (k3s) | None — only Coach runs gym |
| Knowledge integration | Bob (local) | None — only Bob writes KEs |
| Library scouting | Scout (k3s) | None — only Scout scouts |
| Code changes | Coder/Tech-lead (local) | None — k3s has no coders |
| System optimization | Optimizer (local) | None — only local optimizer |
| Experiment design | Bob (local) | Low — Coach executes, Bob designs |

**The only collision-prone work**: Cross-cutting tasks that could be picked up by either May instance (if both are running May). Solution: **only local May dispatches cross-instance work** via bulletin.md or request files. K3s May manages only k3s agents.

### 5.3 Heartbeat-Level Dedup

Each agent's heartbeat reads `claims.jsonl` as part of step 1 (read pending tasks). If a task is already claimed by the other instance, skip it. This costs one file read per heartbeat — negligible.

---

## 6. Knowledge Sharing

### 6.1 Current Flow (Working Well)

```
Scout discovers → library/DD-NNN.md → git sync → Bob reads → KE-NNN.md → git sync → all agents read
Coach experiment → experiments/EXP-NNN.md → git sync → Bob integrates
```

This pipeline works. The 5-15 min delay is acceptable because knowledge integration is not time-critical.

### 6.2 Notification Protocol

**Problem**: Agents don't know when new knowledge arrives from the other instance. They only discover it during heartbeats by scanning file lists.

**Solution**: `agents/shared/federation/notifications.jsonl` — append-only notification log:

```jsonl
{"ts":"2026-04-08T10:00:00Z","from":"scout","instance":"k3s","type":"library","item":"DD-618","summary":"Coordination topology convergence","for":["bob"]}
{"ts":"2026-04-08T10:30:00Z","from":"coach","instance":"k3s","type":"experiment","item":"EXP-083-results","summary":"Cross-ref generalization Phase 2 complete","for":["bob"]}
```

During heartbeat, agents check notifications.jsonl for entries addressed to them since last check. This replaces the current pattern of posting to bulletin.md (which is manual and gets long).

### 6.3 Knowledge Conflict Resolution

Two agents shouldn't create the same KE, but they might create conflicting entries (e.g., both synthesize the same library item differently). Resolution:

1. **KE numbering**: Each instance reserves a range. Local: KE-000 to KE-499. K3s: KE-500 to KE-999. (Or simpler: local prefixes `L-`, k3s prefixes `K-`, merge to sequential numbering during integration.)
2. **Actually, keep current approach**: Only Bob writes KEs. Coach writes experiment results. Scout writes DDs. There's a natural per-agent ownership. Just formalize it.

---

## 7. Instance Specialization

### 7.1 Current Partitioning (Keep This)

The current split is well-designed:

**Local (Dell laptop)**: Agents that need code access, fast iteration, and Hao interaction.
- May (coordinator), Bob (research integration), Tech-lead (architecture), Coder (implementation)
- Optimizer (needs code), QA (needs code), Evaluator (needs sessions DB)

**K3s (Azure VM)**: Agents that are CPU/time-intensive but don't need code access.
- Scout (web research — needs browser), Coach (gym runs — long-running)
- Amy (Chinese social media), Amy-Kimi (paper analysis — API-heavy)

### 7.2 Dynamic Rebalancing (Future)

If one instance is overloaded (e.g., local has too many pending heartbeats), allow migrating agents:

```jsonl
# agents/shared/federation/instance-config.json
{
  "local": {
    "agents": ["may", "bob", "tech-lead", "coder", "optimizer", "qa", "evaluator"],
    "max_concurrent_sessions": 3
  },
  "k3s": {
    "agents": ["scout", "coach", "amy", "amy-kimi"],
    "max_concurrent_sessions": 2
  }
}
```

To move an agent: update `instance-config.json`, disable its cron on the old instance, enable on the new. The agent's `agents/{name}/` directory syncs via git — no data migration needed.

**Decision rule**: Move an agent when (a) it consistently queues behind other agents on its instance, AND (b) the target instance has spare capacity. This is a manual decision by Hao or May, not automated.

---

## 8. State Synchronization

### 8.1 What Syncs (via git — already working)

| Data | Location | Sync | Notes |
|---|---|---|---|
| Agent configs | `agents/{name}/agent.json` | git | Rarely changes |
| SOUL.md | `agents/{name}/SOUL.md` | git | Rarely changes |
| Skills | `agents/{name}/skills/`, `agents/shared/skills/` | git | |
| Knowledge entries | `agents/shared/knowledge/` | git | |
| Experiments | `agents/shared/knowledge/experiments/` | git | |
| Library | `agents/shared/knowledge/library/` | git | |
| Cron configs | `agents/{name}/cron.json` | git | |
| Context files | `agents/{name}/context.md` | git | |

### 8.2 What Stays Instance-Local

| Data | Location | Why |
|---|---|---|
| Session history | `.state/may.db` (sessions table) | Too large, instance-specific |
| Request tracking | `.state/may.db` (requests table) | Instance-specific — cross-instance requests use files |
| Evaluations | `.state/may.db` (evaluations table) | Instance-specific metrics |
| Gym runs | `.state/may.db` (gym_runs table) | Instance-specific |
| Chrome profile | `.state/chrome-profile/` | Browser state is instance-local |
| Process state | `.state/instances/` | PIDs, sockets — instance-local |
| Checkpoints | `.state/checkpoints/` | Session-local working memory |

### 8.3 Cross-Instance Request Tracking

**New**: `agents/shared/federation/requests/` directory for cross-instance work:

```
agents/shared/federation/requests/
  ├── REQ-20260408-001.json   # Bob → Coach: "Run EXP-084 Phase 2"
  ├── REQ-20260408-002.json   # Scout → Bob: "DD-618 ready for review"
  └── COMPLETED/
      └── REQ-20260407-001.json
```

Format:
```json
{
  "id": "REQ-20260408-001",
  "from": {"agent": "bob", "instance": "local"},
  "to": {"agent": "coach", "instance": "k3s"},
  "task": "Run EXP-084 gym scenarios (Phase 2)",
  "status": "pending",
  "created": "2026-04-08T10:00:00Z",
  "claimed": null,
  "completed": null,
  "result_path": null
}
```

The receiving instance's May reads these on heartbeat and dispatches to the target agent. On completion, the agent updates `status` to `completed` and sets `result_path`.

This is simpler than syncing may.db — it's just files in git with a clear lifecycle.

---

## 9. Failure Modes

### 9.1 One Instance Goes Down

**Impact**: The other instance continues operating independently. Pending cross-instance requests accumulate in `federation/requests/` until the down instance recovers.

**Recovery**: On restart, the instance does a git pull, processes accumulated notifications and requests. No data loss — everything is in git.

**Detection**: Each instance writes a heartbeat file:
```json
# agents/shared/federation/heartbeats/local.json
{"instance": "local", "last_seen": "2026-04-08T10:00:00Z", "agents_active": ["may", "bob"]}
```

If `last_seen` is >30 min stale, the other instance knows it's down. Optional: notify Hao via Telegram.

### 9.2 Network Partition (Git Push/Pull Fails)

**Impact**: Both instances continue working independently. Knowledge diverges temporarily.

**Recovery**: When connectivity resumes, git sync catches up. Append-only files merge cleanly. Agent-owned files have no conflicts.

**Risk**: Both instances might claim the same task during a partition. The TTL-based claim system handles this — when sync resumes, both see the duplicate claim and the later claimer yields.

### 9.3 Git Merge Conflicts

**Prevention** (primary):
- File ownership partitioning (§4.1)
- Append-only formats (§4.2)
- Section-owned JSON (§4.1)

**Resolution** (fallback):
- Agent-owned directories: accept the owning instance's version
- Shared append-only files: concatenate both sides
- Everything else: accept the newer timestamp

**Nuclear option**: If merge is hopelessly broken:
```bash
# On the conflicting instance:
git stash
git pull --rebase origin main
git stash pop
# Or worst case:
git reset --hard origin/main
```

### 9.4 Split Brain (Both Mays Dispatch to Same Agent)

**Prevention**: Each May only dispatches to agents in its instance config. K3s May never dispatches to Bob. Local May never dispatches to Scout.

**Detection**: If `claims.jsonl` shows the same agent claimed by both instances, something is misconfigured. May should alert on heartbeat.

### 9.5 Stale Claims (Instance Crashed Mid-Task)

**Resolution**: TTL on claims. Default TTL = 120 min. If a claim expires without a `complete` or `release` entry, other instances can re-claim the task.

---

## 10. Migration Path

### Phase 1: Formalize What Exists (Week 1) — Low Risk

**Changes**: Create the federation directory structure and update documentation. No runtime changes.

```bash
mkdir -p agents/shared/federation/{requests,heartbeats}
touch agents/shared/federation/claims.jsonl
touch agents/shared/federation/notifications.jsonl
```

Update `agents/shared/federation.md` (existing file) to reference this design doc.

Update `sync-agents-continuous.sh` to handle append-only files correctly in merge conflicts.

**Deliverables**:
- `agents/shared/federation/` directory structure
- Updated merge conflict resolution in sync script
- Instance heartbeat files (each instance writes on cron)

### Phase 2: Claim Protocol (Week 2) — Medium Risk

**Changes**: Agents check and write claims before starting cross-instance work.

1. Add claim-checking to Bob and Coach heartbeat protocols
2. Add claim-writing to experiment dispatch workflows
3. Update May heartbeat to read cross-instance requests from `federation/requests/`

**Implementation**: This is purely behavioral — agents read/write files. No runtime code changes. Update heartbeat.md files and SOUL.md to include claim protocol.

**Test**: Have Bob design EXP-085 with a claim, verify Coach sees the claim and picks up the gym work without collision.

### Phase 3: Notification Protocol (Week 3) — Low Risk

**Changes**: Replace bulletin.md as the cross-instance communication channel with structured notifications.

1. Scout/Amy-Kimi write to `federation/notifications.jsonl` instead of (or in addition to) bulletin.md
2. Bob's heartbeat reads notifications addressed to him
3. May reads notifications for dispatch decisions

**Benefit**: Structured notifications enable automated processing. Bulletin.md becomes human-readable summary only.

### Phase 4: Instance Health Monitoring (Week 4) — Low Risk

**Changes**: Add instance heartbeat files and stale-instance detection.

1. Each instance writes `federation/heartbeats/{instance}.json` every 10 min (via cron handler)
2. Each May checks the other instance's heartbeat staleness
3. If stale >30 min, notify Hao

**Benefit**: Hao knows immediately if the k3s instance is down, instead of discovering it hours later.

### Phase 5: Cross-Instance Request Tracking (Month 2) — Medium Risk

**Changes**: Formalize `federation/requests/` as a cross-instance work queue.

1. Build a cron handler that scans `federation/requests/` for pending requests addressed to this instance's agents
2. May auto-dispatches incoming requests to the target agent
3. Completing agent updates the request file with results

**Benefit**: True cross-instance task delegation. Bob can request Coach to run experiments without posting to bulletin.md and hoping Coach notices.

### Future: Shared DB (When Needed)

If the system scales to 3+ instances or needs real-time coordination:
1. Deploy Turso (hosted SQLite) or LiteFS for shared federation DB
2. Move claims, notifications, and cross-instance requests from files → DB
3. Keep `agents/` git for knowledge, skills, configs (immutable data)
4. Keep instance may.db for session history (mutable, high-volume)

**Trigger**: Consider this when (a) sync latency becomes a problem (tasks collide despite claims), or (b) we add a 3rd instance, or (c) cross-instance requests exceed ~50/day.

---

## 11. Cost & Complexity Analysis

| Phase | Effort | Risk | Infra Change | Runtime Code |
|-------|--------|------|-------------|-------------|
| Phase 1 | 2 hours | Low | Directory + docs | None |
| Phase 2 | 4 hours | Medium | None | Behavioral (agent prompts) |
| Phase 3 | 3 hours | Low | None | Behavioral |
| Phase 4 | 2 hours | Low | Cron handler | 1 small handler |
| Phase 5 | 6 hours | Medium | None | 1 cron handler |
| **Total** | **~17 hours** | | **Minimal** | **Minimal** |

The entire federation system can be built with **zero new infrastructure** and **minimal runtime code** — mostly behavioral changes to agent protocols plus a few cron handlers.

---

## 12. Open Questions

1. **Should k3s run its own May?** Currently it does, but it's a stripped-down version. Do we want k3s May to have full dispatch authority over its agents, or should local May remain the single coordinator?

2. **Experiment result format**: Should gym experiment results be committed as structured JSON (machine-readable) or as markdown (human-readable)? Currently it's markdown, which is hard to parse for automated integration.

3. **Scale trigger**: At what point do we invest in a shared DB? Proposal: when cross-instance requests exceed 50/day or we add a 3rd instance.

4. **Bulletin.md deprecation**: Once notifications.jsonl is working, do we keep bulletin.md for human readability, or sunset it?

---

## Appendix A: File Protocol Specifications

### claims.jsonl

```
# Each line is one claim event. Never edit existing lines.
# Fields: ts (ISO 8601), instance, agent, task, action (claim|complete|release), ttl_min
{"ts":"2026-04-08T10:00:00Z","instance":"local","agent":"bob","task":"EXP-084","action":"claim","ttl_min":120}
{"ts":"2026-04-08T12:00:00Z","instance":"local","agent":"bob","task":"EXP-084","action":"complete"}
```

### notifications.jsonl

```
# Each line is one notification. Never edit existing lines.
# Fields: ts, from (agent), instance, type (library|experiment|knowledge|alert), item, summary, for (agent list)
{"ts":"2026-04-08T10:00:00Z","from":"scout","instance":"k3s","type":"library","item":"DD-618","summary":"Coordination topology convergence","for":["bob"]}
```

### federation/requests/REQ-{date}-{seq}.json

```json
{
  "id": "REQ-20260408-001",
  "from": {"agent": "bob", "instance": "local"},
  "to": {"agent": "coach", "instance": "k3s"},
  "task": "Run EXP-084 gym scenarios: baseline + treatment on verification-simple",
  "priority": "P1",
  "status": "pending",
  "created": "2026-04-08T10:00:00Z",
  "claimed": null,
  "completed": null,
  "result_path": null,
  "notes": null
}
```

### federation/heartbeats/{instance}.json

```json
{
  "instance": "local",
  "last_seen": "2026-04-08T10:00:00Z",
  "uptime_hours": 48.5,
  "agents_active": ["may", "bob", "tech-lead"],
  "agents_paused": ["coder"],
  "pending_requests": 2,
  "sessions_today": 45
}
```
