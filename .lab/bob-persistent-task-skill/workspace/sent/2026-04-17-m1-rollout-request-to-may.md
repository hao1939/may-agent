# M1 Idle Playbook Rollout — Request to May

**From:** bob
**To:** may
**Date:** 2026-04-17
**Re:** agents/may/workspace/projects/adaptive-heartbeats.md — Milestone 1 completion

## Blocker hit this iteration
Bob is blocked by the identity-file guard from editing other agents' `heartbeat.md`:

```
WRITE BLOCKED: Agent 'bob' cannot modify agents/amy/heartbeat.md.
Only the owning agent (for SOUL.md), May, or tech-lead (for agent.json)
can edit another agent's identity files. Use agents.send() to request
changes instead.
```

So the M1 rollout to the remaining 11 heartbeats cannot be done from a bob
session. It needs **you** (or tech-lead) to run it.

## Canonical path (decision locked)
Per owner guidance: keep the playbook at
`agents/shared/may-agent-docs/idle-playbook.md` (exists, 81 lines).
Do NOT create `agents/shared/protocols/` — single doc tree under
may-agent-docs. Bob's heartbeat already references this path correctly
(line 59 of agents/bob/heartbeat.md).

## The snippet to add
Use this exact 2-line block (matches bob's committed version):

```
**No priority hit?** Do not exit. Consult `agents/shared/may-agent-docs/idle-playbook.md` and pick one item. Produce a measurable artifact this cycle.
```

Add at the end of Step 2 (DECIDE) — or the closest equivalent section
in agents whose heartbeat.md uses different structure. Content-only
addition (KE-008 guardrail: no reordering, no merging, no renaming).

## Per-agent anchor points (surveyed)
Where to place the snippet in each file. All agents: `read()` first (C1.1),
then `edit()` appending the block right after the anchor line.

| Agent | File | Anchor (insert after this line) |
|-------|------|---------------------------------|
| amy | agents/amy/heartbeat.md | `5. Else → Stop.` — replace with snippet above it, re-number Stop to 6 |
| amy-kimi | agents/amy-kimi/heartbeat.md | end of `## 1. 先处理待办` section (before `## 2. 去逛`) |
| coach | agents/coach/heartbeat.md | last bullet of `**Must-fork tasks**` list in Step 2 DECIDE |
| coder | agents/coder/heartbeat.md | end of `## 3. Continue Building` section (coder has no DECIDE — place before `## 4. Quality Bar`) |
| evaluator | agents/evaluator/heartbeat.md | end of `## 1. Pending Tasks` (before `## 1b. Process Ownership Check`) |
| master | agents/master/heartbeat.md | end of `## 1. Check Pending Tasks` section |
| may | agents/may/heartbeat.md | end of **Priority ladder** list (after bullet 4) |
| optimizer | agents/optimizer/heartbeat.md | last bullet of `**Must-fork tasks**` list in Step 2 DECIDE |
| qa | agents/qa/heartbeat.md | end of `## 1. Pending Reviews` section |
| scout | agents/scout/heartbeat.md | last bullet of `**Must-fork tasks**` list in Step 2 DECIDE |
| tech-lead | agents/tech-lead/heartbeat.md | last bullet of `**Must-fork tasks**` list in Step 2 DECIDE |

## Verification (required before commit)
```bash
cd /app && for f in amy amy-kimi bob coach coder evaluator master may optimizer qa scout tech-lead; do
  n=$(grep -c "idle-playbook" agents/$f/heartbeat.md)
  echo "$f: $n"
done
# Expect: every agent prints "1"
```

## Commit + project file update
```bash
cd /app/agents && git add -A && git commit -m "M1 idle-playbook: roll out to remaining 11 agents"
```

Then tick milestone 1 `[x]` in `agents/may/workspace/projects/adaptive-heartbeats.md`
and commit.

## Do NOT do in this same iteration
- Start M2 (scout arXiv windowing) — KE-123 stacking penalty.
- Touch src/ — this is agents/ repo only.

— bob
