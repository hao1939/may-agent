# Federation: Multi-Instance Coordination

Two may-agent instances run independently and sync knowledge via git.

## Instances

| Instance | Location | Agents | Focus |
|----------|----------|--------|-------|
| **local** | Dell laptop (Docker Compose) | may, bob, tech-lead, coder, optimizer, qa, evaluator | Infra, code, architecture, optimization |
| **k3s** | Azure VM (k3s StatefulSet) | scout, coach, amy, amy-kimi | Research, training, scouting, XHS |

## How Sync Works

```
Local agents/ ──push──► k3s bare repo ──bridge──► k3s pod agents/
                                      ◄──bridge──
Local agents/ ◄──pull──  k3s bare repo
```

- **`federation-sync` cron handler** runs every 10 min on both instances
- **`agents-auto-commit` handler** commits orphaned changes every 2h
- **Agents self-commit** their own work (expected behavior per C13)
- **`sync-agents-continuous.sh`** runs on k3s host as systemd timer, bridges bare repo ↔ pod

## Rules for Agents

1. **Only your instance's agents have heartbeats.** If you're on local, don't dispatch work to scout/coach — they run on k3s. Instead, write a request to `agents/shared/bulletin.md` or commit files they'll pick up.

2. **Shared knowledge is the integration point.** Both instances read `agents/shared/knowledge/`, `agents/shared/skills/`, `agents/shared/bulletin.md`. Write there to communicate cross-instance.

3. **Never assume real-time communication.** There's up to 10 min sync delay. Design interactions to be asynchronous — leave files, not messages.

4. **Dispatch board is owned by local May.** k3s agents read it but don't modify `agents/may/workspace/dispatch-board.md`. k3s May (if running) manages its own agent set only.

5. **Experiments can span instances.** Coach (k3s) designs and runs gym experiments. Results commit to `agents/shared/knowledge/experiments/`. Bob (local) integrates findings.

6. **Conflict resolution**: Both instances commit to their own agent dirs (no conflicts). For `shared/`, the sync uses rebase — last writer wins. Use append-friendly formats.

## Cross-Instance Workflows

### Research → Application Pipeline
```
Scout (k3s) discovers → commits to shared/knowledge/library/
                       → posts to shared/bulletin.md
Bob (local) reads     → integrates into designs
Tech-lead (local)     → implements
Coach (k3s)           → trains agents on new patterns
```

### Experiment Pipeline
```
Bob (local) designs experiment → commits protocol to shared/knowledge/experiments/
Coach (k3s) runs gym trials   → commits results
Bob (local) integrates findings
```

### Bug/Issue Pipeline
```
Evaluator (local) finds issue → posts to shared/bulletin.md
Coach (k3s) creates training  → commits skill to shared/skills/
All agents                    → pick up new skill on next session
```
