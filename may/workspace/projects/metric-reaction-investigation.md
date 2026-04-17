# Metric Reaction Investigation

**Status:** active — M1 done, next: M2
**Owner:** may
**Created:** 2026-04-17
**Master project:** system-evolution
**Next:** M2 — classify the 25 sampled sessions into (not-seen / seen-ignored / seen-mentioned / seen-acted) with one-line reasoning each, using session.jsonl assistant turns.

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
- [ ] M2: Classify by bucket (not-seen / seen-ignored / seen-mentioned / seen-acted) with transcript excerpts
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

## M2 queue (next)

For each of the 8 red-metric sessions, open session.jsonl and read the first 3 assistant text turns to classify:
- **not-seen**: agent never references any metric
- **seen-mentioned**: agent mentions metric in narrative but no action
- **seen-ignored**: agent reads the block and pivots to an unrelated task
- **seen-acted**: agent forks/messages or starts a project step

Target: 8 one-line classifications with transcript excerpt.

---

## Report to s_1776336175530_25 (parent project)
Issued as a separate message after commit.
