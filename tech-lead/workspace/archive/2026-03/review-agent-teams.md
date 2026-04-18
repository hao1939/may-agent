# Review: Agent Teams Architecture

**Reviewer**: tech-lead  
**Date**: 2026-03-24  
**Document**: agents/shared/may-agent-docs/design/agent-teams.md  
**Verdict**: Good architecture. The team/meta separation is sound. Runtime changes are straightforward. A few gaps need attention.

---

## Answering the direct questions first

### "What runtime changes are needed for team-aware loading?"

Three concrete changes, in order of implementation effort:

**1. `--team` flag (small — 1-2 hours)**

`AGENTS_ROOT` is currently set once in `src/app/may.ts:28`:
```ts
const AGENTS_ROOT = resolve(process.env.AGENTS_ROOT || resolve(PROJECT_ROOT, "agents"));
```

And `loadAgents()` in `agent-loader.ts:587` just does `readdirSync(agentsRoot)` to find agent dirs. Adding `--team` means changing AGENTS_ROOT to point at `agents/<team>/` instead of `agents/`. This is trivial:

```ts
const team = args.team || process.env.AGENT_TEAM || "meta";
const AGENTS_ROOT = resolve(PROJECT_ROOT, "agents", team);
```

One CLI arg, one env var, done. Everything downstream — loadAgents, buildTools, send-tool, system-status — already takes `agentsRoot` as a parameter. No plumbing changes needed.

**Difficulty: easy.** The loader is already designed for this — it scans whatever root you give it.

**2. Cross-team isolation in send/call (medium — half day)**

Currently `send-tool.ts` already has an `allowedTargets` list. We'd need to enforce that agents can only call/send within their team by default. The `manager-agents-tool.ts` does agent resolution by name — we'd need to make sure `agents.call("reviewer")` resolves to `acme/reviewer`, not `meta/reviewer`.

Two options:
- **Simple**: when `--team acme` is set, only acme agents are loaded. Meta agents aren't in the registry at all. No cross-team calls possible because the targets don't exist. This is probably sufficient for v1.
- **Full**: load all teams, namespace agent names as `team/agent`, enforce boundaries. More work, questionable value right now.

**Recommendation: go simple.** One process per team. Meta and product teams don't need to be in the same process.

**3. Meta team cross-team access (medium — half day)**

The doc says meta agents need read access to product teams' `.state/` and write access to their config files. This is just filesystem access — coach reads `agents/acme/.state/may.db`, evaluator reads session logs. No protocol change needed.

The only runtime addition: meta agents need to *know about* other teams. A config file listing team paths:
```json
{ "teams": ["acme", "widgets"] }
```
Then coach/evaluator/optimizer tools get a `--teams` list to iterate over. The evaluate-sessions cron already scans `.state/` — extending it to scan multiple team dirs is straightforward.

### "How hard is the slim binary?"

**Not hard at all.** The binary is already just `bun run bundle` → one JS file. "Slim" just means:
- Bundle with `AGENTS_ROOT` pointing at `agents/acme/` instead of `agents/meta/`
- Don't include `agents/meta/` in the distribution
- Same binary, different agent config directory

There's no code to remove. Meta-specific behavior (evaluator, coach, gym) only exists because those `agent.json` files are loaded. Remove the agent dirs → no meta behavior. The binary doesn't even know about "meta" as a concept.

**If we want a truly minimal binary** (no cron infrastructure, no multi-agent orchestration), that's a bigger effort — but I don't think it's needed. A product team still benefits from cron, delegation, and session management.

---

## What's good

1. **The directory-per-team model is right.** It maps directly to how `loadAgents()` already works. The migration is literally `mkdir agents/meta && mv agents/{may,coder,qa,...} agents/meta/`. I verified — the loader scans whatever `agentsRoot` points to.

2. **Meta-as-platform, not meta-as-manager.** The doc is clear that meta doesn't assign work to product agents. This avoids the mess of cross-team orchestration and keeps teams independent. Good boundary.

3. **common-sense.md per team.** Different teams have different workflows. Meta needs gym-before-ship. A product team needs their own test/lint/deploy rules. Splitting this makes sense.

4. **The "every agent knows how to operate" section** is the most important part of the doc. This is the actual interface contract. If every agent follows these six behaviors, the team structure works regardless of how you organize the directories.

---

## What needs work

### 1. shared/ location is ambiguous

The current layout has `agents/shared/` at the top level with common-sense.md, CONVENTIONS.md, SIGNALS.md, focus-tasks.md, etc. After migration, this becomes `agents/meta/shared/`.

But the doc also shows `agents/acme/shared/common-sense.md`. So each team gets their own shared dir. Fine. But what about cross-team shared resources? Right now system-status reads `agents/shared/focus-tasks.md` (hardcoded path in `system-status.ts:189`). If we move to `agents/meta/shared/`, this breaks.

**Decision needed:** is there a top-level `agents/shared/` for cross-team stuff, or does each team only see its own shared dir?

**My recommendation:** each team is fully self-contained. No cross-team shared dir. If meta needs to push conventions to a product team, it writes to that team's shared dir. Simpler model.

### 2. gym/ is listed as a meta agent but it's not an agent

The layout shows `agents/meta/gym/` alongside real agents. But `gym/` is a directory of test scenarios, not an agent with `agent.json`. The loader already skips dirs without `agent.json`, so this works accidentally. But it's confusing in the docs.

**Suggestion:** either make gym/ a proper agent (with agent.json, a cron to run scenarios), or move it under `agents/meta/shared/gym/` to signal it's a resource, not an agent. Currently it's in a weird middle ground.

### 3. The "one directory move" migration understates the work

The doc says migration is one directory move. The actual migration:
1. `mkdir agents/meta`
2. `mv agents/{may,coder,qa,scout,bob,tech-lead,coach,optimizer,evaluator,gym,judge,master,shared} agents/meta/`
3. Update `AGENTS_ROOT` default to `agents/meta/`
4. Update every hardcoded path in the codebase that references `agents/shared/`, `agents/<name>/` etc.
5. Update agent.json `context_files` paths if any are relative to old root
6. Update `.state/` paths — currently at `.state/`, would need to be `agents/meta/.state/` or stay at project root
7. Update all `agents/shared/` references in system-status.ts, growth.ts, etc.

Items 4-7 are the real work. Not huge, but not "one directory move."

### 4. .state/ location needs to be decided

Currently `.state/` is at project root. Each team session goes into the same DB. If teams are isolated processes, each needs its own `.state/`. But then meta's cross-team monitoring needs to read multiple DBs.

**Options:**
- A: Keep single `.state/` at project root, all teams share it (simpler, but coupling)
- B: `.state/` per team under each team dir (cleaner isolation, harder for meta to monitor)
- C: `.state/` per team, plus meta gets a symlink or config listing all state dirs

**My recommendation:** Option B with a meta config listing team state dirs. Clean isolation by default, explicit cross-team monitoring.

### 5. No mention of versioning

When meta pushes changes to a product team's SOUL.md or common-sense.md, what happens? Is there a changelog? A rollback mechanism? The current system has no concept of this. For one team (us), it's fine — git history is enough. For multiple product teams, you probably want some kind of version tracking per team config.

Not blocking for v1, but worth thinking about before we ship team management to real users.

### 6. Missing: how does a product team get created?

The doc shows the lifecycle ("Human tells may-agent: I need a team") but doesn't specify the mechanics. Is there a `create-team` handler? A template directory? Does may scaffold the agent.json files, or does the human provide them?

**Suggestion:** define a minimal team template:
```
agents/<name>/
  shared/
    common-sense.md   # from template, human edits
  coder/
    agent.json        # minimal default
    SOUL.md           # generated from human description
```

The growth.ts module already has agent cloning/promotion. Extending it to team creation seems natural.

---

## Implementation plan (if approved)

**Phase 1: Directory restructure (no runtime changes)**
- Move current agents into `agents/meta/`
- Update AGENTS_ROOT default
- Fix all hardcoded paths
- Verify everything still works (gym, evaluator, cron, etc.)

**Phase 2: --team flag**
- Add CLI arg and env var
- Test: `--team meta` loads current agents, `--team acme` loads acme agents
- Per-team .state/ directories

**Phase 3: Cross-team monitoring**
- Meta config listing known teams
- Evaluator/coach/optimizer can scan multiple team state dirs
- No cross-team agent calls

**Phase 4: Team lifecycle**
- Create-team command/handler
- Team templates
- Version tracking for pushed config changes

---

## Bottom line

The architecture is right. The team/meta separation maps cleanly to how the code already works. The `--team` flag is easy. Cross-team isolation is easy if we go with "one process per team." The main work is in the migration (hardcoded paths) and deciding where `.state/` lives. I'd estimate Phase 1-2 at 2-3 days of implementation.

The document could be clearer on .state/ location, shared/ scope, and team creation mechanics. Everything else is solid.
