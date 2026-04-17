# Metric Reaction Investigation

**Status:** active — M1+M2 done, next: M3 (write findings report) and propose simplest intervention
**Owner:** may
**Created:** 2026-04-17
**Master project:** system-evolution
**Next:** M3 — write findings report. Leading hypothesis to test: "Agents use the literal word 'red' as the trigger; since the prompt never marks any metric red (only shows `val → target: tgt`), agents conclude 'no red metrics' and skip action." Simplest intervention: add a ⚠️/🔴 marker in the metric-injection renderer when `value != target` (and value != 'unmeasured').

## Goal
Understand why agents see metrics in their heartbeat context but don't act on them. Propose fixes based on evidence.

## Investigation questions
1. Do agents actually SEE their metrics? (prompt inspection)
2. When a metric is below target, what do they do? (action trace)
3. Is the metric presentation wrong? (too much, unclear, no action mapping)
4. Is it a prompt issue? (does the heartbeat connect metric → named action?)
5. Propose fixes backed by specific transcript evidence.

## Milestones
- [x] M1: Sample ≥20 recent heartbeat sessions; record: metric visible, metric red, agent reacted (fork/message or project edit)
- [x] M2: Classify by bucket (not-seen / seen-ignored / seen-mentioned / seen-acted) with transcript excerpts
- [ ] M3: Findings report with concrete evidence per bucket
- [ ] M4: Propose 2-3 interventions, pick simplest
- [ ] M5: Implement + gym-test + deploy with kill switch

## Success criteria
- Real-work ratio (sessions with persistent task started or project milestone closed / total) rises from ~10% → ≥25% within 48h of intervention.

---

## M1 Results — Sample of 25 most recent heartbeat/cron sessions

**Method:** For each, read the first user turn, extract the `## Injected: metrics` block, then scan all assistant turns for `agents` tool calls (fork/message/call) or edits touching `projects/` paths. "Red" = a metric line whose value differs from target and is not `unmeasured`, OR an explicit `BELOW THRESHOLD / ⚠️` marker.

**Script:** `/tmp/sample.py` (parses `.state/sessions/history/*/session.jsonl`).

### Aggregate counts

| Metric | Count |
|---|---|
| Sessions sampled | 25 |
| Metrics block present in prompt | **17 / 25** (68%) |
| Red metric visible | **8 / 25** (32%) |
| Red **and** agent forked/messaged a fix | **0 / 8** (0%) |
| Red **and** agent touched a project file | **0 / 8** (0%) |
| Any `agents` tool call at all (forks/messages) | **2 / 25** (both were may, neither on a red metric) |

### Per-session table

| session | agent | metrics? | red? | turns | tool calls | forks/msgs | touched project | tools used |
|---|---|---|---|---|---|---|---|---|
| s_1776438041651_428 | qa | yes | no | 14 | 16 | 0 | no | bash,edit,finish,read |
| s_1776438041584_426 | scout | yes | **yes** | 21 | 20 | 0 | no | bash,edit,finish,read,write |
| s_1776438030733_424 | may | yes | **yes** | 10 | 9 | 0 | no | bash,finish,read |
| s_1776437833307_422 | may (cron) | no | — | 12 | 12 | 0 | no | agents,bash,edit,finish,write |
| s_1776437636567_420 | coach | yes | no | 18 | 19 | 0 | no | bash,finish,read |
| s_1776437531546_418 | may (cron) | no | — | 16 | 15 | 0 | no | bash,edit,finish,read |
| s_1776437526164_417 | bob | yes | **yes** | 11 | 12 | 0 | no | bash,finish,workflow |
| s_1776436239517_404 | qa | yes | no | 10 | 13 | 0 | no | bash,edit,finish,read |
| s_1776436239483_403 | tech-lead | yes | **yes** | 10 | 10 | 0 | no | bash,edit,finish,read,workflow |
| s_1776436239448_402 | scout | yes | **yes** | 20 | 20 | 0 | no | bash,edit,finish,read,workflow |
| s_1776436237133_401 | optimizer | yes | no | 8 | 8 | 0 | no | bash,finish,read,workflow |
| s_1776436231766_400 | may | yes | **yes** | 11 | 10 | 0 | no | bash,edit,finish,read |
| s_1776436033817_399 | coach (cron) | no | — | 52 | 51 | 0 | no | bash,edit,finish,read |
| s_1776435727417_395 | bob | yes | no* | 21 | 20 | 0 | no | bash,finish,workflow |
| s_1776435539201_393 | coach | yes | no | 12 | 12 | 0 | no | bash,edit,finish |
| s_1776435133425_388 | may (cron) | no | — | 12 | 11 | 0 | no | bash,edit,finish |
| s_1776434832410_386 | may (cron) | no | — | 12 | 11 | 0 | no | bash,edit,finish |
| s_1776434531866_383 | may (cron) | no | — | 14 | 13 | 0 | no | bash,edit,finish,read,system_status |
| s_1776434441512_378 | qa | yes | no | 11 | 13 | 0 | no | bash,edit,finish,read |
| s_1776434441478_377 | tech-lead | yes | **yes** | 9 | 11 | 0 | no | bash,edit,finish,workflow |
| s_1776434441444_376 | scout | yes | **yes** | 15 | 14 | 0 | no | bash,edit,finish,read,write |
| s_1776434439183_375 | optimizer | yes | no | 16 | 16 | 0 | no | bash,edit,finish,read,workflow,write |
| s_1776434438630_374 | coach (cron) | no | — | 37 | 36 | 0 | no | bash,edit,finish,read |
| s_1776434431253_373 | may | yes | **yes** | 8 | 7 | 0 | no | bash,edit,finish,read |
| s_1776434233134_372 | may | no | — | 23 | 22 | 0 | no | agents,bash,edit,finish,read |

### Observations (raw, pre-classification)

1. **Metrics are almost always injected** on regular heartbeats (17/17 real heartbeats had the block). The 8 "no metrics" rows are all `cron:project-resume` triggers for may, which use a different prompt template — that's expected, not a bug.
2. **Red metrics are common** (8/17 heartbeats = 47%) and **never triggered a dispatch** in this window.
3. **Only 2 of 25 sessions** used the `agents` tool at all, and both were may cron/heartbeat sessions where the action was unrelated to any red metric.
4. **Workflow tool usage** (9 sessions) is much more common than `agents` tool — agents follow their workflow playbooks (scout triage, bob KE authoring, tech-lead implement) but those workflows are self-directed, not metric-triggered.
5. **may itself** had red metrics (Premature DONE rate = 9 → target 0, Agent utilization = 9 → target 0) in 4 sessions and did not fork anyone to investigate — the previous review (s_1776436881034_412) had already dispatched tech-lead, but subsequent heartbeats didn't log that fact as a reason.
6. **Metric block is terse** — just `- [fast] <Name>: <val> → target: <tgt>`. No red/green marker, no "if red do X" mapping, no link to a project or recent trend.

### Surprises

- **The rate is worse than expected**: 0/8, not "low" — literally zero red-metric reactions in 25 sessions across 7 agents.
- **Coach is the biggest idle-turn sink** (52 turns + 37 turns on two cron sessions) — lots of activity, zero forks, zero project touches. Classic busywork pattern.
- **The metric block lacks any affordance**: value/target is shown, but no imperative ("RED — fork fix") and no named project/action to attach to. Agents "see" it the way one sees a dashboard they don't own.

---

## M2 Results — Classification with transcript excerpts

**Method:** For each of the 8 "red metric visible" sessions, read first two assistant text turns. Classify:
- **not-seen**: no metric reference anywhere
- **seen-mentioned**: metric referenced but no action
- **seen-ignored**: metric block read, agent explicitly dismisses ("no red metrics") and pivots elsewhere
- **seen-acted**: agent started a task in response

### Classifications (8 red-metric sessions)

| session | agent | bucket | evidence (first-turn quote) |
|---|---|---|---|
| s_1776438041584_426 | scout | **seen-ignored** | *"No P0/P1 pending... Per idle-playbook: do ONE iteration"* — metrics block present but agent jumped directly to idle-playbook rotation without referencing Coverage: 52→0. |
| s_1776438030733_424 | may | **seen-ignored** | *"System snapshot is healthy (9 agents, zero errors, no stuck sessions)"* — own metrics PD rate=9, util=9 not mentioned; dismissed the whole stack as "healthy idle cycle." |
| s_1776437526164_417 | bob | **seen-ignored** | *"No active persistent tasks, **no red metrics**, no P0/P1"* — explicit denial. Agent's own block had unmeasured/0 targets for some, and non-zero values for others. |
| s_1776436239483_403 | tech-lead | **not-seen** | First turn never references metrics at all; goes straight to lens-rotation: *"Last lens was D → next is A"*. |
| s_1776436239448_402 | scout | **not-seen** | Jumped to idle-playbook item 5 (workspace hygiene) without any metric reference. |
| s_1776436231766_400 | may | **seen-mentioned** | *"pending metric warning (PD rate 8→9) is already dispatched to tech-lead"* — only session where the red value appears in the narrative; cited as "already dispatched" to justify no-op. |
| s_1776434441478_377 | tech-lead | **seen-mentioned** | *"Build-health metric is stale (tsc passes clean)"* — mentions metric but acts on lens-rotation instead. |
| s_1776434441444_376 | scout | **seen-ignored** | *"no P0/P1 pending, **no red metrics**, arXiv already triaged"* — explicit denial; same pattern as bob. |

### Bucket counts (8 red-metric sessions)
- **not-seen:** 2 / 8 (25%)
- **seen-ignored:** 4 / 8 (50%) ← largest bucket
- **seen-mentioned:** 2 / 8 (25%)
- **seen-acted:** **0 / 8 (0%)**

### Key finding (leading hypothesis for M3)

**Two agents (bob, scout) literally wrote "no red metrics" in their first turn despite their prompt containing metrics with value ≠ target.** This is strong evidence that the presentation — `- [fast] Name: val → target: tgt` — does **not** trigger the "red" concept. Agents look for the word "red" or a ⚠️ marker. Without one, a line like `Coverage: 52 → target: 0` is parsed as "informational, nothing urgent."

Corroborating: the heartbeat prompts themselves tell agents *"Any \"Injected: metrics\" item marked ⚠️ BELOW THRESHOLD?"* (scout heartbeat line). Since the renderer never emits that marker, the answer to that question is always "no" — even when values deviate from target.

### Minor findings
- may-own session (s_1776436231766_400) showed the "already-dispatched" lifecycle gap: once a metric-fix is in flight, there's no prompt affordance for "keep tracking" vs "free to dispatch again." Low-priority.
- tech-lead and scout lean heavily on self-directed rotations (lens A/B/C/D, idle-playbook items). These workflows don't consult the metric block at all. A metric-to-action map is needed for those agents.

---

## Report to s_1776336175530_25 (parent project)
Issued as a separate message after commit.
