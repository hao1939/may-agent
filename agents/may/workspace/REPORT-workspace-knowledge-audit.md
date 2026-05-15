# Workspace & Knowledge Audit Report

**Author:** May  
**Date:** 2026-04-14

## 1. `AGENT_ROOT/knowledge/` — What Is It?

**Created by:** The agent-loader (`src/app/agent-loader.ts` line 356). Each agent directory is scanned for a `knowledge/` subdirectory. If it exists, it's set as `knowledgeDir` and the agent's `knowledge/INDEX.md` is included in the system prompt.

**Purpose:** Per-agent knowledge storage — lessons learned, domain-specific files, archived material. The system also uses `agents/shared/knowledge/` as the centralized knowledge base (experiments, entries, hypotheses, library, deep-dives, etc.).

**No `knowledge-base/` directories exist** anywhere. Some agents reference "knowledge-base" in workspace docs (e.g., Bob's `knowledge-base-navigation` skill) but that's a skill name, not a folder. There's a gym scenario named `knowledge-base-navigation-discovery` but that's under `agents/gym/scenarios/`.

### Sizes (per-agent knowledge)
| Agent | Files | Size | Notes |
|-------|-------|------|-------|
| shared | 5,480 | 46MB | Central KB — library, experiments, hypotheses, entries |
| amy | 1,151 | 9MB | Posts (5.3MB), library dives (1.5MB), signal/insight archives |
| amy-kimi | 27 | 832K | |
| coach | 17 | 484K | |
| scout | 10 | 660K | |
| bob | 14 | 76K | Mostly skills |
| tech-lead | 6 | 40K | |
| Others | ≤6 each | ≤48K | coder, evaluator, optimizer, qa, may, master |

### Concerns
- **Amy's knowledge is 9MB / 1,151 files** — mostly archived signals/insights/journals and 5.3MB of posts. Amy-kimi has been down (billing), so this is likely dead weight for now.
- **Shared knowledge is 46MB** — library alone is 35MB (16MB deep-dives, 13MB posts). This is working as designed but quite large.

---

## 2. `AGENT_ROOT/workspace/` — What Is It?

**Created by:** Each agent during normal operation. The agent-loader recognizes it as the `workspace` directory.

**Purpose:** Working scratch space — designs, analyses, briefs, experiment logs, synthesis docs, monitoring reports, deliverable checklists, and archives of old work.

### Sizes (per-agent workspace)
| Agent | Total Files | Total Size | Archive Files | Archive Size | Active Files |
|-------|------------|------------|---------------|--------------|-------------|
| **bob** | **1,203** | **7.6MB** | **1,122** | **5.8MB** | **81** |
| coach | 399 | 4.9MB | 261 | 2.3MB | 138 |
| optimizer | 475 | 4.0MB | 301 | 2.0MB | 174 |
| tech-lead | 164 | 2.1MB | 115 | 1.1MB | 49 |
| may | 110 | 1.9MB | 3 | 160K | 107 |
| scout | 68 | 1.7MB | 18 | 620K | 50 |
| evaluator | 153 | 1.2MB | 100 | 416K | 53 |
| qa | 32 | 1.2MB | ~8 | 196K | 24 |
| amy | 15 | 1.1MB | ~5 | 236K | 10 |
| amy-kimi | 36 | 888K | 33 | 272K | 3 |
| coder | 9 | 532K | 0 | 0 | 9 |
| judge | 1 | 296K | 0 | 0 | 1 |
| master | 6 | 76K | 0 | 0 | 6 |

### Key Observations

**Bob's workspace is by far the largest** — 1,203 files (7.6MB). 1,122 files (5.8MB) are in `archive/`. The `2026-03-18` archive alone is 2.7MB (compliance audit test fixtures with nested session directories). Bob has 69 top-level `.md` files (synthesis docs, analyses, briefs, designs, monitoring reports). All were touched within the last 7 days — git sync keeps timestamps fresh.

**May has the least archiving** — 110 files, but only 3 in archive. 14 DESIGN/SPEC/BRAINSTORM/PROTOTYPE docs at top level. Should archive completed designs.

**Archives are not garbage-collected** — every agent just moves old files to `archive/` but nothing ever deletes them. They grow monotonically.

---

## 3. Cleanup Recommendations

### Low Risk (safe to do now)
1. **Bob archive/2026-03-18/** — 2.7MB of compliance test fixtures (fake sessions, adversarial tests). These are 27 days old and were one-time audit artifacts. Safe to delete.
2. **Bob archive/legacy/** — 300K of pre-March miscellaneous files. Can delete.
3. **Amy knowledge archives** — signal-archive, insights-archive, inbox-archive files are rotated journals. 1,151 files is excessive. Could consolidate into a single archive file per type.

### Medium Risk (needs agent coordination)
4. **May workspace DESIGN docs** — 14 design documents, many completed/superseded (guards-v2, sensor-judge-migration, workflow-guards, etc.). Should archive completed ones.
5. **Optimizer workspace findings/** — 170+ finding-*.md files at top level. Many are ad-hoc and never referenced again.
6. **Coach workspace briefs/** — 20+ brief-*.md files, some from weeks ago.

### Systemic Fix
7. **Add workspace cleanup to agent heartbeats** — a periodic task: "If workspace has >50 top-level files, archive files older than 14 days." Currently no agent does this.
8. **Archive rotation** — archives older than 30 days could be deleted or compressed. Currently nothing enforces this.

---

## 4. Deep-Dive Pipeline Status ✅

Already implemented by tech-lead delegation (this session):
- ✅ `agents/shared/deep-dives/` rogue folder — deleted/never existed on current HEAD  
- ✅ `agents/shared/knowledge/library/deep-dives/INBOX.md` — created with 6 unread items
- ✅ Scout heartbeat — references INBOX.md (line 106)
- ✅ Scout context — references INBOX.md (line 16) 
- ✅ Bob heartbeat — references INBOX.md (line 20)
- ✅ Bob context — references INBOX.md (line 15)
- ✅ `agents/scout/postboard_brief.md` — deleted

---

## 5. Verify-Wrap / K3s Status ✅

Already fixed on main:
- Commit `fa5d279d`: defensive catch for `ctx.agent === "undefined"` string
- Commit `fc29e7ea`: added `ctx.agent` to WorkflowContext properly
- Merged as `8fdb18db`
- K3s needs to `git pull` to pick up the fix — this is a deployment/sync issue, not code
- **No heartbeat changes needed** — workflow.run() is correct and should stay

---

## 6. `knowledge-base` Folder

**Does not exist** as a directory anywhere. The term appears in:
- Bob's `knowledge-base-navigation` skill (a skill file, not a folder)
- Gym scenario `knowledge-base-navigation-discovery` 
- Various workspace analysis docs that reference the skill
- Amy's knowledge posts referencing "knowledge base" conceptually

**No cleanup needed** — there is no `AGENT_ROOT/knowledge-base/` folder on any agent.
