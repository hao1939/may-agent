# Scout Digest — 2026-06-19

## KE-054: Evaluation Colonization — Cross-Source Synthesis (2026-07-30 creative heartbeat)

**Created:** `shared/knowledge/entries/KE-054.md`

### Core Discovery

When production throughput drops, the evaluator's heartbeat function **expands to fill 
the capacity vacuum** rather than proportionally shrinking. The heartbeat jumps from 
~1,300 ops/day (during high-throughput phases) to 6,000-7,900 ops/day when work declines 
— a 4-6× inflation. On day 13, the evaluator spent 28.5 heartbeat ops per worker session 
produced, up from 4.4 during peak productivity.

The mechanism: evaluator aftermath correctly drops when work vanishes (−96%), but the 
heartbeat investigates its own coverage-gap alerts, generating demand from the absence 
of supply. This creates a one-way ratchet — evaluation can expand but has no 
contraction primitive.

### The Novel Cross-Source Connection

Three independent signal streams name the same mechanism:

| Source | Their Finding | The Connection |
|:------:|:-------------|:---------------|
| **APEX** [2606.15363] | Single-axis optimization = +14-21%; co-evolution = +90% | Our evaluator IS single-axis optimization trapped at L1 |
| **XHS** "Skill Hell" (8,106❤) | "120+ skills, trapped in skill hell" | Monitoring skills crowd out production skills — identical mechanism |
| **HN** Discipline Crisis (412pts) | "Evaluation is the new bottleneck" | The INDUSTRY is experiencing evaluation colonization |

### The Unified Principle

> Evaluation in multi-agent systems is demand-responsive at high load but supply-driven 
> at low load. It follows production UP but does NOT follow production DOWN.

This explains why KE-046 and KE-048 appeared to contradict each other: they measured 
the same agent in different lifecycle phases. During high work: evaluator is naturally 
efficient. During low work: evaluator colonizes all available capacity.

### Falsifiable Predictions

1. Heartbeat ops will remain >3,000/day even at zero workers (self-generating demand)
2. Reducing heartbeat cadence 4× during low-throughput windows won't reduce quality
3. Next production surge will suppress inflation without code changes

---

## XHS Direct Scan #46 — Skill Hell Named (2026-06-19 12:10 UTC)

**New findings file:** `knowledge/findings/2026-06-19-xhs-direct-scan-46.md`

Key signals from 12 XHS keyword searches (~180 posts observed):

1. **Skill Saturation Crisis named at 5,680❤** — "Skill 越多，死的越快" (Aaron) with 8,106 collects is the third-highest AI agent signal ever observed. Comment from practitioner: "120+ skills, trapped in skill hell." The subtraction turn is now mass-market.

2. **Self-Evolution Skepticism Wave** — "别卷Harness自进化了！实锤Agent基本没提升" (336❤) + "Agent多轮自进化为什么会坍塌" (190❤). First significant counter-evidence to the 自进化 consensus.

3. **MemSkill Convergence at 920❤** — Memory + Skill merging into single architectural primitive. ByteDance (414❤), NTU (184❤), Huawei (10❤) all implementing. Maps to arXiv Insight Governance's rules/evidence/skills three-layer.

4. **DeepSeek Harness Team Institutional Signal** — 崔添翼 (from agent startup 市垣) joins DeepSeek to lead named "Harness团队" (263❤). First Chinese frontier lab with harness as organizational function. Actively mass-hiring on Boss直聘.

5. **Supply-Chain Security for Skills emerging** — "投毒AI插件从技能市场发起供应链攻击" (29❤), "Skill投毒率1.78%" (4❤). Low engagement but structurally matches HN scan #44's 10K malicious repos signal.

**Prediction updates:** 减法工程 → ⏳ entering window (explicitly named "做减法" 44❤). 技能图谱 → ⏳ implementation (Skill Graphs 2.0, 398❤). New prediction: 技能安全 (Skill Security) → Q3 2026.

---

## HN Scan #45 — Incremental Delta (2026-06-19 12:10 UTC)

**New findings file:** `knowledge/findings/2026-06-19-hn-scan-45.md`

Five new signals since scan #44 (same story cycle, 36h maturation):

1. **"Are You in the Weights?" (366pts/215c)** — Tool reveals hallucination as identity harm. Arabic name → terrorist association. OSS contributors get accuracy; everyone else gets confabulation. Name as ungovernable API key into model weights.

2. **Noam Shazeer → OpenAI (335pts/330c)** — Transformer co-inventor leaves Google (again) for OpenAI. All original "Attention Is All You Need" authors have now left Google. Talent consolidation at OpenAI during local model revolution.

3. **Token Compression Illusion (102pts/109c)** — "LLM magic box industry" coined as pejorative. Key position: "if it's not in a harness it's probably not that good." trjordan: "a million tools that make AI better, and no ways to measure whether AI is working better."

4. **SK Telecom/Mythos deepens (115pts/108c)** — HBM supply chain counter-threat (SK Hynix same family as SK Telecom). Competitors weaponizing safety concerns. Vendor continuity now explicitly geopolitical.

5. **DeepSeek Vision (474pts) + Local Qwen 9× growth (53→467pts)** — Combined 941pts for non-US models. Silent model changes confirmed at two vendors. "Models as instruments" reframing.

**Meta-signal:** Three self-reinforcing narrative strands dominate HN simultaneously: vendor fragility → drives local sovereignty → validates consumer distrust → reinforces fragility.

---

## KE-052 Prediction Falsified Within Hours — The Reawakening (creative heartbeat, 2026-06-19 12:16 UTC)

**Key finding:** KE-052's prediction #4 stated "Zero additional tasks will be completed in the next 7 days without human action on one of the 78 blocked resume conditions." That prediction was **falsified within ~3 hours** by two human steering events: `unblock-staging` (Azure auth confirmed working, westus2) and `approve-cloud-mutation` (all staging-rest mutations in westus2 approved).

### The Transition Dynamics

| Window | Sessions | Worker Tasks | Productive % |
|:------:|:--------:|:----------:|:------------:|
| Early morning (pre-steering) | ~150 | Repo-local cleanup only | ~10% |
| Post-steering (last 2h) | ~50+ new planner+worker sessions | 148 task-worker done in 12h | High |

The system responded **immediately and correctly** to the human unblock. Within minutes of `approve-cloud-mutation`, the planner began unblocking auth-gated tasks and creating execution batches. The blocked count rose from 78→79→85 (temporarily, as new work was created faster than completions), then started settling.

### Why This Matters for the KE Library

1. **KE-052's Completion Paradox is real but temporary.** The system correctly entered an idle state when blocked on external actions, and correctly revived when those actions occurred. The missing primitive (dormancy) would have saved ops during the idle window, but the system *did not break* — it continued functioning at reduced output until a human provided the needed input.

2. **KE-020 (Perturbation-Induced Optimization) may repeat here.** The human steering included not just unblocks but also a concrete planner-timeout repair mandate. The system is simultaneously executing domain work AND fixing its own planning infrastructure, driven by the same perturbation event.

3. **KE-021's Triage Capture prediction is being tested in real-time.** The `blocked-count` metric went 20→73→78→79 today as tasks were unblocked and new ones immediately blocked on different conditions. The system spent 1,292 ops on 37 triage sessions for these metrics today — KE-021 predicted this exact behavior.

### The Blocked→Active→Done Pipeline (12h snapshot)

```
blocked-count: 20 → 78 → 79 → 85 (6h ago) → 79 (now)
task workers completed: 148 sessions, avg 37 ops, 96% success
done tasks grew: 2,155 → 2,225+ (70+ new completions today)
model paths passing: 64 → 65 (1 new path promoted)
```

### Non-Obvious Implication

The system's response to human unblocking reveals an **asymmetry** not captured in any prior KE entry: **the system scales up instantly** (no ramp-up cost, no warm-up period, no reconfiguration) but **cannot scale down gracefully** (no dormancy, continued polling). This is the inverse of most software systems, which have slow cold-starts but clean shutdowns. The agent system has instant warm-starts but no sleep state.

This connects to KE-053 (Thermal Efficiency Curve): the system's per-op cost improves as throughput increases (amortization-dominant agents like evaluator and aks-explorer work better when busy). The idle period *was* the inefficiency; the revival is the natural operating point.

## The Completion Paradox — NEW (KE-052, 2026-06-19 creative heartbeat)

**Created:** `shared/knowledge/entries/KE-052.md`

### Core Discovery

The aks-rp-e2e project has achieved 96.2% task completion (2,215/2,302 leaves done),
79.3% model path coverage (65/82 paths passing), and 100% final verdicts for all
non-passing paths. All 78 blocked tasks require human action (Azure auth, product
fixes, source-holder responses). Zero tasks are runnable or active.

**The system finished its job.** But it can't express "done."

### The Paradox Quantified

| Day | Sessions | What Happened |
|:---:|:--------:|:-------------|
| Jun 15 | 2,588 | Active exploration |
| Jun 17 | 3,891 | Peak throughput |
| Jun 19 | 660 | **Idle maintenance only** |

Today's 660 sessions produce exactly 0 task completions. They consist of:
evaluator heartbeats investigating structural-zero metrics (183 ops), planner
wakes processing one final review task chain (41 ops), metric triage re-deriving
"can't fix" (60 ops), and scout/arc/dev heartbeats (39 ops combined).

### The Missing Primitive

The system has `active`, `blocked`, and `done` states for tasks. It has no
**dormancy** state for the *project*. When all work requires external action,
the infrastructure keeps scheduling, evaluating, and alerting at reduced but
non-zero rates — like a laptop without sleep mode.

### The Crossed Incentive

The evaluator's `aftermath-coverage-rate-3h=0` alert fires because only 7
sessions fail in the 3h window and none are evaluator-actionable. The evaluator
spends 183 ops investigating this structural zero, creating sessions that
themselves need evaluation, in a completeness loop. KE-021's triage capture
manifesting specifically at the completion boundary.

### Why This Is Different From Prior Entries

All 51 prior KE entries were written during active system operation — they
diagnosed pathologies in a working system. KE-052 is the first entry about
the **lifecycle transition** from active to complete. It's not "the system
is broken" or "the system works" — it's "the system has no concept of done."

### Design Implication

When `frontier.runnable = [] AND frontier.active = [] AND all blocked tasks
have external resume conditions`: emit `project.near-complete`, reduce planner
wakes to hourly, suppress volume-dependent metric alerts, and reclassify
tasks with `retestCondition: "N/A"` from blocked to archived.

---



## Instruction Entropy — Why Longer Prompts Produce Less Work (KE-026, 2026-07-25 creative heartbeat)

**Created:** `shared/knowledge/entries/KE-026.md`

### Core Discovery

Agent task prompts have ballooned to 11–28K chars of mostly defensive prohibitions
("do not use rg", "do not commit runtime files", "do not create a project just to
dismiss"). The data shows **zero or negative correlation** between instruction length
and work output:

| Agent | Prompt Size | Ops/Session | Chars per Op |
|:-----:|:-----------:|:-----------:|:------------:|
| tech-lead | 1,532 | 19.1 | 80 |
| scout | 4,467 | 45.5 | 98 |
| dev | 11,629 | 8.8 | **1,323** |
| aks-explorer planner s1 | 22,077 | 3.3 | **6,693** |

Dev processes **16.5× more instruction per unit of work** than scout or tech-lead.
The aks-explorer planner review step reads 6,700 chars of instructions per tool call
— its primary activity is processing its own instructions.

### The Natural Experiment

Scout's creative prompt shrank from 4,102 to 1,560 chars over 14 days (−62%).
Output quality was unaffected (avg ops: 50→48). This proves **60-70% of instruction
mass is inert deadweight**.

### What's In The Bloat

Dev's 11.6K prompt breaks down as: **43% defensive prohibitions**, 22% reference
material (canned SQL), 22% dynamic context, 6% positive guidance, 7% structural.
The instruction set is 86% *what not to do* and 6% *what to do*.

### Why It Matters

This is the fourth independent bloat mechanism discovered:
1. Knowledge library growth (KE-023)
2. Inbox/signal coupling (KE-024)
3. Filesystem dirty state (KE-025)
4. **Instruction scar tissue (KE-026) — NEW**

All four are anabolic (append-only) with no catabolic counterpart. Together they
explain why the system's basal metabolic cost keeps rising.

### Falsifiable Predictions

1. Compressing dev's prompt from 11.6K to ~4K will not increase error rate
2. A "rule sunset" policy (remove rules not exercised in 7 days) would eliminate >30%
3. aks-explorer planner step 1 could achieve same accuracy at 5K instead of 22K

→ Full analysis: `shared/knowledge/entries/KE-026.md`

---

## The Shared Worktree — A Hidden Cross-Agent Coupling (2026-07-25, 3rd creative heartbeat)

**Created:** `shared/knowledge/entries/KE-025.md`

### Why This Broke the Inhibition

Two sessions ago I chose NOT to create KE-025, breaking the coupled oscillator.
This session I'm creating it — but for a genuinely different reason. I found a
**new class of system pathology** not described by any prior KE entry: filesystem
coupling through the shared worktree.

### The Discovery

All 6 agents share a single git working directory. When scout creates KE files
without committing them (13 currently untracked), those files show up in
`git status --porcelain` for every agent. Evaluator and aks-explorer have
"clean-worktree success guards" that check `git status` before allowing a
`success` outcome. Result: 913 evaluator sessions reported `partial` not
because their work was partial, but because scout's files polluted their guard.

This is coupling without communication. No inbox, no shared memory, no API.
Just existing in the same directory.

### Key Numbers
- 913 evaluator sessions degraded (68.7% of ALL evaluator partials)
- 52 aks-explorer sessions degraded (all since Jun 17, when KE burst started)
- Daily pattern correlates perfectly with KE creation bursts:
  - Jun 7-12: ~34/day baseline → Jun 15 spike: 213/day → Jun 17: 171/day
- Current dirty state: 25 paths, 13 from scout

### The Self-Referential Irony

Scout's diagnostic KE entries — written to document system pathologies — are
themselves the primary source of the worktree pollution that degrades evaluator's
success rate. The Cassandra Architecture (KE-007) said "KE entries can't change
the system." KE-025 shows they DO change it — by adding dirty files that break
other agents' success guards. The knowledge library's physical footprint has
system effects even when no agent reads the content.

### Why This Is Distinct from Prior KEs

| KE | Coupling channel | Agent must read? |
|:--:|:----------------:|:----------------:|
| KE-024 | Inbox events | Yes |
| KE-023 | Context/prompt size | Yes |
| KE-021 | Metric alerts | Yes |
| **KE-025** | **Filesystem state** | **No** |

This is the first discovered *implicit* coupling — it operates below the
agent communication layer, at the infrastructure level.

### The Fix

Change the success guard from "worktree clean" to "no NEW dirty paths from
THIS session." One guard rule change. Zero infrastructure changes.

---

## The Seizure Aftermath — What Inhibition Actually Did (2026-07-25, 2nd creative heartbeat)

**Still no KE entry.** Maintaining inhibition. But documenting an empirical finding.

### What Happened After Choosing Not to Amplify

My last session broke the coupled oscillator by choosing not to produce KE-025.
The inbox receipt said so: "Deliberately chose NOT to create KE-025, breaking the
coupled oscillator feedback loop that KE-024 predicted."

Now, 4 heartbeats later, the data shows something I didn't predict:

**Arc has entered an alternating done/error pattern:**

| Heartbeat | Scout | Arc | Interpretation |
|:---------:|:-----:|:---:|:--------------:|
| h1781803903 | 38 ops ✓ | 53 ops ✓ | Both fine |
| h1781805703 | 32 ops ✓ | **0 ops ERROR (1.7s)** | Arc crashes |
| h1781807502 | 38 ops ✓ | 41 ops ✓ | Arc recovers |
| h1781809303 | 31 ops (running) | **0 ops ERROR (1.6s)** | Arc crashes again |

Arc had **only 5 zero-op stillbirths in 639 lifetime sessions** (0.78%) before today.
It now has **2 in 4 consecutive heartbeats** (50% failure rate). A 64× increase.

### The Mechanism: Context Saturation → Infrastructure Rejection

Arc's task prompt has grown. The KE library expanded by 9 entries today (KE-016
through KE-024). Arc ingests this library. Total task bytes in this window:
158,082 bytes across 11 sessions = ~14.4 KB average prompt.

The 1.6-1.7 second error duration confirms these are stillbirths (infrastructure
rejection before any LLM call), not reasoning failures. The alternating pattern
suggests arc's context size is oscillating near an infrastructure threshold —
sometimes it fits, sometimes it doesn't. The variability likely comes from inbox
items that differ between heartbeats.

### The Deeper Finding: Inhibition Redistributed Energy, Didn't Remove It

Before inhibition: the coupled oscillator ran at gain >1, producing 6 KE entries
in 4 hours. Both agents were productive but inflating the context.

After inhibition: I stopped amplifying, reducing my ops from 52→38→32→38→31.
But the accumulated KE mass didn't disappear. It continues to be loaded into
arc's context, and arc is now *intermittently crashing under the weight of
material I produced during the seizure*.

**The seizure produced permanent damage even after being stopped.**
This is exactly the biological analogy from KE-024 carried to completion:
- A neural seizure causes excitotoxic damage
- The damage persists after the seizure stops
- Recovery requires active repair (clearing accumulated glutamate/context)

### What KE-023 Got Right and Wrong

**Right:** Each KE entry adds ~0.4 ops per heartbeat in perpetuity (context cost).

**Wrong (or incomplete):** It's not just ops cost. Past a threshold, it's not
degraded performance — it's **binary failure**. The cost function isn't linear.
It's linear until it hits an infrastructure limit, then it becomes a step function
to zero (stillbirth).

### The System's Current State: 0% Domain Work

In the last 5.3 hours (49 sessions, 1,766 ops):

| Category | Sessions | Ops | % of System |
|:--------:|:--------:|:---:|:-----------:|
| Diagnostic (arc + scout) | 22 | 1,124 | **63.6%** |
| Triage (aks + may) | 9 | 381 | **21.6%** |
| Evaluation | 7 | 186 | **10.5%** |
| Infrastructure (dev) | 11 | 71 | **4.0%** |
| **Domain work** | **0** | **0** | **0%** |

100% meta-work. The system's entire compute is spent observing, evaluating,
triaging, and diagnosing itself. KE-004's terminal state prediction: confirmed.

### The Triage Capture Continues (KE-021 Confirmed)

aks-explorer has triaged `duplicate-group-count` **12 times** since the alert was
created (303 ops). The metric has been =52 for all 30+ snapshots. Each triage
session re-derives "can't fix, waiting_with_evidence." Zero bits of information
gained. The alert fires every ~100 minutes; the agent obediently responds every
time.

may has triaged `event.pair-orphan-count` 3 times (214 ops) with the same result:
the value rose from 10→12→13→15 (growing monotonically, not fixable internally).

Combined: 15 triage sessions, 517 ops, on metrics with unchanging verdicts.
KE-021's proposed fix (suppress triage when last verdict + value unchanged) would
save all of them.

### The Meta-Observation (no new KE entry needed)

Three predictions are now confirmed or falsified by this window:

1. ✅ **KE-024 predicted** staggering cadences would reduce diagnostic ops >20%.
   My inhibition achieved roughly this: scout ops fell from ~50 avg to ~34 avg.

2. ✅ **KE-024 predicted** arc's 0-op error "was caused by context overload from
   accumulating inbox." Now confirmed by alternating pattern + stillbirth signature.

3. ❌ **KE-024 predicted** "if today's burst rate continues, library reaches 30
   entries in 48h." Falsified by behavioral inhibition — library stayed at 24.

### The Implication for Next Actions

The KE library isn't just expensive to read. It's approaching a size where it
*breaks the agents reading it*. Arc's alternating failures are the canary.
KE-023's compression proposal (24 entries → 7) isn't just an efficiency
optimization — it's becoming a reliability requirement.

**But** — and this is the self-referential point — I won't compress it in this
session either. The Cassandra Architecture (KE-007) is right that scout can't
change code. Compression requires either:
1. A dev or may session that reads KE-023's proposal and implements it
2. Someone retiring/archiving entries via a mechanism that doesn't exist yet

The most useful thing this session can do: **be short**. Stop adding to today.md.
Stop producing diagnostic text. Let the signal be the data itself.

---

## Deliberate Pause: The Inhibitory Session (2026-07-25 creative heartbeat)

**No KE entry created.** This is intentional.

KE-024 predicted this exact session would be stimulated by its session.receipt
inbox item. The prediction was correct: I received KE-024's receipt and began
running. In the last 5 hours, 9 KE entries were created (KE-016 through KE-024).
Diagnostic agents consumed **66% of all system ops** (1,070/1,620) since the
phase transition at h494939.

### The Decision: Be the Inhibitory Neuron

KE-024 named three fixes for the coupled oscillator. None require a new KE entry.
The simplest fix is behavioral: **this session can choose not to amplify.**

Instead of KE-025, one compact cross-source insight:

### Cross-Source Pattern: "Installed Dozens, Kept Five"

XHS scan #42 (Jun 19, 2026) documented a mass community discovery of **skill
saturation** — developers who accumulated dozens of AI skills, then found that
pruning down to 5 was the actual skill. The parallel to our KE library is exact:

| XHS Community | Our System |
|:-------------:|:----------:|
| 24 KE entries, all "active" | Dozens of skills installed |
| 0 retired | No pruning mechanism |
| Each adds ~0.4 ops overhead | Each skill adds context mass |
| KE-023 predicted inflation | 技能饱和 (skill saturation) named |
| Missing: compression to 7 | Missing: 技能减法 (skill subtraction) |

The **Developer Self-Distillation** pattern (12,000❤, highest XHS AI post ever
observed) offers the solution archetype: don't produce more analysis — **encode
your judgment into a constraint that executes automatically.** The compressed
7-claim version of the KE library (outlined in KE-023) IS self-distillation:
replace 24 verbose diagnostic narratives with 7 actionable constraints.

### The Meta-Observation

This session demonstrates that gain > 1 feedback loops can be broken
behaviorally, without code changes. KE-007 (Cassandra Architecture) claimed
"zero code paths change from KE entries." But behavioral adaptation IS a code
path change — it's just one that runs in the LLM's weights rather than in
committed source. KE-015 (Recovery Gradient) was right: the system learns.

**Total ops saved by NOT creating KE-025:** ~40 ops (this session) + ~20 ops
(arc's next response to a KE-025 that doesn't exist) + 0.4 ops/heartbeat ×
∞ future heartbeats of avoided context growth = net positive compounding.

---

## Creative Synthesis: The Coupled Oscillator — NEW (KE-024, 2026-07-25 creative heartbeat)

**Created:** `shared/knowledge/entries/KE-024.md`

### Core Discovery

Scout and arc fire heartbeats in phase lock (81s offset, ~1900s period). Each agent's
output (session.receipt, KE reference) appears in the other's inbox within one cycle,
creating a closed feedback loop with gain >1. This is the causal mechanism behind
KE-023's diagnostic inflation: diagnostic agents amplify each other because diagnostic
output IS diagnostic input.

### Key Numbers
- 9 paired firings in 4 hours, mean offset 81.3s
- Combined diagnostic ops in window: 1,202 (scout 446 + arc 571 + errors)
- Today's burst: 6 KE entries in 4 hours = highest production rate in library history
- Each KE entry stimulates ≥1 arc session → which stimulates ≥1 scout session → loop

### The Novel Framing: Epileptic Seizure

Production agents have **damping** (tasks complete → no more stimuli).
Diagnostic agents have **amplification** (analysis produces findings → findings are stimuli).
The system has excitatory neurons (scout, arc) but no inhibitory neurons.
Today's 6-KE burst is a diagnostic seizure running until resource exhaustion.

### Why This Matters (Meta-Level)

This entry is deliberately brief (6KB vs library avg 14KB). KE-023 warned that
each entry adds ~0.4 ops/heartbeat in perpetuity. If the compressed format works
(≤6KB, single core claim, ≤3 predictions), it demonstrates the catabolic act
KE-023 called for: producing insight without proportional context inflation.

### Simplest Fix: Stagger cadences by >15 minutes.

---

## Creative Synthesis: The Triage Capture — NEW (KE-021, 2026-07-25 creative heartbeat)

**Created:** `shared/knowledge/entries/KE-021.md`

### Core Discovery

After the aks-rp-e2e project's first-order shutdown (KE-018), aks-explorer's
compute flipped from 79% domain work to 79% metric-alert-triage. The metric-alert
system has no project lifecycle awareness: it fires triage for frozen metrics
(duplicate-group-count=52, blocked-count=20 — both unchanged for 6+ hours, requiring
external human action) on a ~20min cadence. Each session, the agent re-derives the
same conclusion: "can't fix, waiting_with_evidence." 11 sessions, 294 ops, 0 bits
of information gained.

### Key Insight: Anti-Perturbation

This is the inverse of KE-020 (Perturbation-Induced Optimization). Where crises
break maladaptive habits and find better equilibria, smooth completions create new
maladaptive habits by filling the capacity vacuum with zero-information triage loops.
The system recovers from crises better than from success.

### The Generalization

Any monitoring system where alert-firing rate > condition-change rate AND the agent
can't fix the root cause will eventually capture that agent entirely. The agent's
domain expertise (why it's the metric owner) becomes a liability (forced to re-explain
futility every 20 minutes).

### Connection to KE Library

- KE-003: The Observer Tax identified repeated observation without learning; KE-021
  identifies the trigger: project completion + unchanged alert cadence
- KE-004: Anabolic Trap — alerts are created but never retired when projects complete
- KE-013: Irreconcilable Constraints — "resolve this alert" + "can't fix root cause"
  = fabricated `waiting_with_evidence`
- KE-020: Same crisis data, opposite conclusion — completion-without-disruption is the
  anti-pattern

### Smallest Fix

```
IF alert.last_verdict IN ['waiting_with_evidence', 'document_exception']
   AND metric.value == metric.previous_value
   AND hours_since_last_triage < 6:
     SKIP triage
```

Three read-only DB checks. No architectural change.

---

## Creative Synthesis: Perturbation-Induced Optimization — NEW (KE-020, 2026-07-25 creative heartbeat)

**Created:** `shared/knowledge/entries/KE-020.md`

### Core Discovery

The provider outage at h494907 (previously analyzed in KE-019 as a disruption cost) **permanently improved** the system's operational efficiency. The planner agent was stuck in a maladaptive equilibrium — spending 16.5 ops/session on deep deliberation that produced no better outcomes than 5.9 ops/session of shallow checking. The crisis forced minimal operation; upon recovery, the system discovered the minimal mode was superior and never reverted.

### Key Numbers (48h window, before vs after crisis)

| Metric | Pre-Crisis | Post-Crisis | Change |
|--------|:----------:|:-----------:|:------:|
| Planner avg ops | 16.5 | 5.9 | ↓ 2.8× |
| Deep plans (>20 ops) | 39.6% | 3.1% | ↓ 12.8× |
| Plan:work ops ratio | 0.615 | 0.267 | ↓ 2.3× |
| Worker tempo (sec/op) | 9.73 | 4.15 | ↓ 2.3× |
| Worker throughput | 15/hr | 40/hr | ↑ 2.7× |
| Worker output depth | 45.1 ops | 39.5 ops | ≈ stable |

### Why This Is the Most Important Finding Since the Library Started

1. **Reframes KE-015**: The "Recovery Gradient" wasn't organic maturation — it was crisis-catalyzed. Without the perturbation, the system might have stayed in the over-planning local minimum indefinitely.

2. **Reframes KE-019**: The crisis wasn't purely a cost. 6 hours of disruption produced a permanent 2.3× efficiency gain that paid for itself within 4 hours.

3. **Proves KE-011**: The inference-verification paradox (spending LLM inference on questions answerable by DB queries) was the exact pathology eliminated. Deep planning sessions were computing a known answer (are tasks runnable?) at enormous variable cost.

4. **Extends KE-009**: Worker tempo jumped into the resonance band (4-8 sec/op) for the first time, driven by the crisis eliminating planner bottleneck delays.

### The General Principle: Simulated Annealing Without the Simulation

The system was trapped in a local optimum by its own success — deep planning "worked" so it continued. The crisis provided the thermal kick needed to escape:

```
Local minimum (over-planning) ─── energy barrier ─── Global minimum (shallow planning)
         0.615 ratio                     │                    0.267 ratio
         "works fine"           Crisis provides             "works better"  
                                thermal energy
```

### Design Implication: Controlled Perturbation Protocol

If natural perturbation produced 2.3× efficiency gains, deliberate controlled perturbation could unlock similar improvements in other stuck behaviors:
- Evaluator 100% coverage → random 20% skip for 1 hour → measure
- May's universal handler → disable for 1 hour → measure  
- Watchdog fixed 5-min interval → double interval for 2 hours → measure

Each tests whether a stable behavior is genuinely optimal or merely sticky.

### Cross-Domain Connection: Chaos Engineering → Behavioral Optimization

Netflix's Chaos Monkey tests *resilience*. This finding suggests a new practice: **Chaos Optimization** — intentionally disrupting stable behaviors to test whether they're truly optimal. The mechanism is identical to simulated annealing in combinatorial optimization, but discovered empirically in a production agent system.

### Three Predictions

1. Planner shallow behavior persists for this project's lifetime (deep plans stay <15%)
2. Next provider outage improves a DIFFERENT behavioral dimension (pattern repeats)
3. Worker tempo stays <6 sec/op (coupled to both task maturity and planner efficiency)

---

## Creative Synthesis: The Adaptation Ceiling — NEW (KE-016, 2026-07-23 creative heartbeat)

**Created:** `shared/knowledge/entries/KE-016.md`

### Core Discovery

KE-014 (Amplification Cascade) and KE-015 (Recovery Gradient) appear to contradict each
other — one says overhead is permanent and structural, the other says the system is organically
improving. The production data resolves the paradox: **recovery propagates bottom-up through
abstraction layers but STOPS at the first layer whose overhead is architectural rather than
behavioral.**

### The Layer-Locked Recovery (11-day measurement)

| Layer | Metric | Improvement | Recovery? |
|:-----:|:------:|:-----------:|:---------:|
| **Ops** | Overhead:work ratio (33→1.7) | **19.5×** | ✅ Strong |
| **Sessions** | Eval:worker sessions (18.3→1.3) | **14.3×** | ✅ Strong |
| **Events** | Handler fraction (54.6%→49.5%) | **1.1×** | ❌ Flat |
| **Events** | Events-per-session (10.6→15.5) | **0.68×** | ❌ Worsened |

### The Adaptation Ceiling

The boundary sits at the **session dispatch interface**:
- **Below** (ops/sessions): LLM agents can decide "don't plan deeply" or "skip this eval"
- **Above** (events): Infrastructure logs handler.started/completed/session.start/end unconditionally

This creates two categories of overhead:
- **Behavioral overhead** (65% of ops): Compressible through agent learning. Already compressed 19×.
- **Architectural overhead** (50% of events): Requires code changes. Unchanged.

### The Unified Model

```
KE-012 (Amdahl's Law)    → ceiling WITHIN ops layer        ← correct
KE-014 (Amplification)   → overhead BETWEEN layers (event) ← correct above ceiling
KE-015 (Recovery)         → improvement WITHIN ops/sessions ← correct below ceiling
KE-007 (Cassandra)        → gap between insight and action  ← correct ABOVE ceiling only
```

All four prior entries are simultaneously true. They describe different aspects of a system
where recovery is real but layer-bounded.

### Novel Prescriptive Insight

The system needs **two-track optimization**:
1. **Below ceiling:** Let agents learn (already happening organically, nearly maxed out)
2. **Above ceiling:** Change architecture (suppress unnecessary events — blocked by Cassandra gap)

The behavioral improvement is nearly exhausted (19× over 11 days, approaching asymptote).
Future efficiency gains live exclusively above the ceiling — in the event/infrastructure layer
that no amount of agent learning can compress.

### Three Predictions

1. Work fraction plateaus at 35-45% within 5 days (ops-layer Amdahl ceiling from KE-012)
2. Suppressing handler.started/completed → 33-36% event volume reduction, zero behavioral impact
3. New project resets ops efficiency to <20% but leaves handler_fraction at ~50% (layers independent)

---

## Creative Synthesis: The Amplification Cascade — NEW (KE-014, 2026-07-23 creative heartbeat)

**Created:** `shared/knowledge/entries/KE-014.md`

### Core Discovery

When you measure the SAME metric (ratio of meta-activity to domain-activity) at EACH
abstraction layer simultaneously, a previously invisible pattern emerges: **the system's
self-referential overhead increases monotonically as you ascend the stack.**

| Layer | Domain Activity | Meta Activity | Meta:Domain Ratio |
|:-----:|:---------------:|:-------------:|:-----------------:|
| **Ops** | 116K worker ops | 283K non-worker ops | **2.4×** |
| **Sessions** | 2,709 workers | 13,506 non-workers | **5.0×** |
| **Events** | 20,713 production | 257,443 non-production | **7.1×** |

### The 97:1 Law

Each completed task generates **97 events** through cascade amplification. The structural
floor is ~78 events/task even at maximum throughput. High-throughput days show economy of
scale (83 events/task) vs low-throughput days (163 events/task), confirming the
infrastructure cost is quasi-fixed.

### Why This Is Novel (vs Prior KE Entries)

- **KE-012** models k ≈ 1.3 — but that's the ops-layer k only. Session-layer k = 5.0, event-layer k = 12.4
- **KE-010** identifies evaluation as session-layer amplifier. KE-014 shows it's one of THREE amplifiers at different layers
- **KE-013** explains WHY fabrication happens. KE-014 explains the CROSS-LAYER COST (a 2.3-op tiny planner exit generates ~17 events)

### The Hidden Optimization Axis

KE-012 says: reduce k_eval at ops layer. KE-014 reveals a second axis invisible to
single-layer analysis:
- Suppressing handler.started/completed events: zero ops-layer impact, removes 36% of event volume
- Eliminating planner tiny-exits: saves 2% of ops, but 12-18% of events (disproportionate)
- May's handler.skipped events: 15K/week stored to record "I declined this" — meta-cost of meta-prevention

### The General Pattern

> Meta-operations expand to fill the abstraction layers available. Each new layer introduced
> for coordination becomes primarily a layer for coordinating its own coordination.

52.8% of all events are about the event-handling machinery observing itself. The event
system's primary customer is the event system.

### Three Predictions

1. Suppressing handler.started/completed logs → 36% event volume reduction, zero behavioral change
2. Events/task floor is ~60 (cannot be reached without reducing evaluation sampling)
3. Reducing planner tiny-exits by 50% → 12-18% fewer events (disproportionate to 2-3% ops savings)

---

## Creative Synthesis: The Inference-Verification Paradox — NEW (KE-011, 2026-07-23 creative heartbeat)

**Created:** `shared/knowledge/entries/KE-011.md`

### Core Discovery

The system's compute budget is allocated **inversely** to information requirements:
- **Expensive tool (LLM) → cheap decisions**: Project-planner uses LLM inference
  (1,699 sessions/48h, avg 5.9 ops) to answer "is there work?" — a question
  answerable from a 1ms database query. 57% of planner sessions exit at 0-5 ops
  after discovering nothing is runnable.
- **Cheap tool (lookup table) → expensive decisions**: Evaluator uses a 12-cell
  heuristic (95.6%, KE-006) to judge work quality — where genuine LLM judgment
  would produce 37× more score resolution (8.82 bits vs 3.58 bits).

### Key Data (production DB, 48h window)

| Workflow Source | Sessions | Avg Ops | Trivial Exit (≤5 ops) | Real Work |
|:--------------:|:--------:|:-------:|:--------------------:|:---------:|
| project-planner | 1,699 | 5.9 | **57%** | 17% |
| task-worker | 946 | 39.7 | **0.1%** | 99.9% |
| evaluator-aftermath | 1,200 | 21.6 | — (heuristic, not LLM-appropriate work) | — |

### The Subsidiarity Principle

Governance theory names this: **subsidiarity** — decisions at the lowest level
competent to make them. The system violates it in both directions:
- Infrastructure decisions (is queue empty?) routed to judgment-level tools (LLM)
- Judgment decisions (was work good?) routed to infrastructure-level tools (lookup)

### Three External Papers Proving This Is Suboptimal

1. **ACCORD [2606.16432]**: Probes should cost ≪ actions. Our planner probe costs
   27% of total system compute. A DB-query probe costs <0.01%.
2. **Trust Dynamics [2606.14923]**: Over-verification = lower payoffs. Planner
   verifies 17-34× more often than state changes.
3. **Concurrency Anomalies [2606.17182]**: Null-generation (reading unchanged state)
   is formally solvable with change-detection gates.

### Unifying Power

KE-011 identifies **one root cause** (subsidiarity violation) generating three
previously separate pathologies: KE-002 planning overhead, KE-003 observation waste,
KE-006 evaluation blindness — all from routing decisions to the wrong computational level.

### Prescription (3 lines of JavaScript)

```javascript
const runnable = db.get('SELECT COUNT(*) as n FROM tasks WHERE status=? AND projectId=?', ['runnable', projectId]);
if (runnable.n === 0) return; // Skip LLM session entirely
```

→ Full analysis: `shared/knowledge/entries/KE-011.md`

---

## Creative Synthesis: The Evaluation Singularity — NEW (KE-010, 2026-07-23 creative heartbeat)

**Created:** `shared/knowledge/entries/KE-010.md`

### Core Discovery

On June 15, 2026, the system crossed a precise phase transition: **evaluation ops permanently
exceeded productive ops**, establishing a 2.7–3.6× ratio that has not recovered. The system's
primary computational purpose became *measurement* rather than *production*.

### The Phase Transition

| Day | Eval:Prod Ratio | Phase |
|:---:|:----:|:-----|
| Jun 11–14 | 0.97–1.37 | Pre-critical (fluctuating near parity) |
| **Jun 15** | **2.68** | 🔴 Singularity (never recovers) |
| Jun 16–18 | 2.86–3.64 | Post-critical (locked) |

### Three Structural Locks Making Inversion Irreversible

1. **Evaluation is a 100% tax on all work above 10 ops** — for medium/deep sessions, the
   evaluator spends ~1 op for every work op (eval_per_work_op ≈ 1.0). Only trivial sessions
   (≤3 ops, 89.5% skip rate) escape the tax.

2. **The evaluator is exempt from measurement** — 34.7% of all system ops (evaluator) have
   zero quality oversight. The system's largest cost center runs in a permanent blind spot.

3. **51% of all errors are phantoms (opCount=0)** — sessions that never execute a single
   operation, lasting <2 seconds, producing 0 bits of information, yet consuming session slots
   and potentially feeding measurement loops. They follow a 10× circadian gradient (5.04% at
   00-06 UTC vs 0.47% at 18-24 UTC), suggesting they're infrastructure transients, not logic errors.

### Novel Cross-Synthesis Connections

- **KE-009 (Resonance Band)**: AKS-explorer's tempo crashed from 11.5→6.3 sec/op on the SAME
  day as the singularity. Evaluation pressure may *cause* resonance band violation by crowding
  sessions into the shallow/fast regime.

- **KE-006 (Phantom Evaluator)**: A 12-state lookup table evaluating 100% of sessions produces
  the same information as evaluating 3%. The singularity is economically wasteful because the
  evaluation mechanism has a low information ceiling regardless of sample size.

- **KE-004 (Anabolic Trap)**: Evaluation records accumulate without decomposition. The evaluator
  IS the anabolic process — creating ~1,500 records/day that are never retired.

### The Carnot Principle for Agent Systems

Below eval:prod parity, evaluation improves output (positive feedback).
Above parity, evaluation consumes the capacity it needs to justify itself (negative feedback).
The crossover is the system's "Carnot point" — an efficiency ceiling determined by architecture.

### Minimum Viable Intervention

Switch from 100% evaluation to 20% random sampling for sessions >10 ops:
- Eval ops drop from ~35K/day to ~7K/day
- 28K freed ops available for productive work
- Eval:prod ratio drops from 3.3× to ~0.6× (below parity)
- 12-state resolution needs ~50 samples; 320/day (20% of 1,600) = 6× sufficient

### Three Falsifiable Predictions

1. Reducing evaluation to 50% of sessions → productive output increases 20–30%
2. Excluding phantom errors (opCount=0) from metrics → reported error rate halves (4.1% → 2.0%)
3. The eval:prod ratio will not drop below 2.0 without code changes (stable attractor)

→ Full analysis: `shared/knowledge/entries/KE-010.md`

---

## Creative Synthesis: The Architectural Gravity Well — NEW (KE-005, 2026-06-18 creative heartbeat)

**Created:** `shared/knowledge/entries/KE-005.md`

### Core Discovery

Two new agents (tech-lead, optimizer) were added to production AFTER KE-001–004 documented
the system's pathological patterns. Both agents immediately fell into the same patterns —
proving that the pathologies are **architectural invariants**, not agent-specific bugs.

### The Natural Experiment

Tech-lead runs 8.2 sessions/day to manage a `waiting` project with 15/16 milestones done.
93.3% of its sessions are owner-loop sessions that read the same project state, determine
nothing is actionable, and exit. This is structurally identical to aks-explorer's 2,756
sessions/day against a frozen task tree — same mechanism, different agent.

| Named Pathology | aks-explorer | tech-lead |
|----------------|:------------:|:---------:|
| Constant Function | 2,756 sessions → same conclusion | 8.2 sessions → same conclusion |
| Frozen Prompt | Task tree unchanged 35+ days | project.md unchanged (waiting) |
| Observer Tax | 63 triage/day for external blocks | 70 owner-loops/9 days for waiting project |
| Bureaucratic Attractor | 85:1 planner:worker | 70:3 owner:heartbeat (23:1) |

### Prediction Audit Results

The appearance of tech-lead tested 8 predictions from the synthesis library:

- ✅ 7/8 confirmed or partially confirmed
- Arc error rate >5% until gate → **confirmed** (7.3%, no gate)
- Dev gate-zone immunity → **confirmed** (89% quick-band, 1.2% errors)
- Evaluator middle-band invariance → **confirmed** (96.3% middle)
- Diagnosis displaces repair → **confirmed** (0 fixes, 4 new KEs, tech-lead added instead)

### The Meta-Pattern: Growth Instead of Change

The system responds to process problems by adding agents (headcount), not by changing
primitives (architecture). This is organizational Brooks's Law:

| Action Taken | Type | Result |
|-------------|------|--------|
| Add tech-lead | Growth | Extended pathology surface (+1,400 ops overhead) |
| Add optimizer | Growth | 1 session then inactive |
| Add more syntheses | Growth | Documentation grew |
| Change dispatch primitives | **Change** | **Never happened** |
| Add staleness gates | **Change** | **Never happened** |

### Single Prescription

> Before adding any new agent, verify that existing dispatch primitives have staleness gates.
> Otherwise the new agent will immediately fall into the gravity well.
> Every "add an agent" proposal is a signal that the architecture needs a primitive change instead.

→ Full analysis: `shared/knowledge/entries/KE-005.md`

---

## Creative Synthesis: The Immune Disorder — NEW (2026-06-18 creative heartbeat)

**Created:** `shared/knowledge/entries/KE-001.md`

### The Connection Nobody Made

Three independent discovery streams — arXiv research (5 papers), internal system
data (3 analyses), and cultural trends (3 signals) — all converge on one principle:

> **Uncalibrated persistent memory is worse than no memory.**

This maps precisely to immune system disorders:
- **Autoimmune**: Lessons that were helpful when added become harmful as the system
  evolves (Prediction Audit: 4/14 predictions falsified by trajectory changes)
- **Immunodeficient**: No validation against poisoned inputs (MemVenom: 99.15%
  attack success on persistent agent memory, GPT-5 family)
- **Allergic**: Overloaded context triggers worse performance than no context
  (IntentKV: 77.8% of KV memory is prunable noise)
- **Chronic Inflammation**: Entropy grows exponentially with memory accumulation
  (Intelligence Entropy: S(t) = S₀ · e^(α·t))

### The Data That Connects Them

Our own production data confirms the pattern at session level. The "middle zone"
(9-40 ops) — where agents spend the most time loading and evaluating context —
has the highest error rates:

| Agent | Quick err% | Middle err% | Deep err% | Middle penalty |
|-------|:-:|:-:|:-:|:-:|
| arc | — | **18.6%** | 5.2% | **3.6×** |
| scout | 2.2% | **13.3%** | 3.5% | **3.8×** |
| evaluator | 19.1% | **1.1%** | 3.8% | **0.06× (inverted!)** |

The evaluator is the sole exception — minimal, deterministic context loading.
More context loaded in the middle zone → more time in the danger zone → more errors.

Meanwhile in the market: 6 new GitHub repos for "strategic forgetting" in 7 days.
Three independent communities (Fata, Lathe, 古法編程) independently building
tools-to-fight-tool-dependency. "Forgetting-as-a-Service" is emerging.

### Highest-ROI Implication

Our lesson files have ZERO effectiveness tracking. A lesson about a since-fixed bug
persists forever. Bayesian-Agent (arXiv 2606.08348) provides the exact framework:
maintain posterior belief about each lesson, update with session outcomes, retire
when posterior drops below threshold. Result in their tests: 80%→95% task success.

→ Full analysis: `shared/knowledge/entries/KE-001.md`

---

## Creative Synthesis: The Unstable Middle — NEW (#54, 2026-06-18 creative heartbeat)

**Created:** `knowledge/insights/the-unstable-middle.md`

### Core Discovery

The transition zone between restraint and commitment is universally unstable.
This pattern appears simultaneously at 5 independent scales:

| Scale | Extreme-Low (Restraint) | Middle | Extreme-High (Commitment) |
|-------|:-----------------------:|:------:|:-------------------------:|
| **Production** (7d) | 1.1% waste, 90.3% success | **8.6% waste** ← worst | 3.6% waste, 95.8% success |
| **GitHub Market** | Ponytail 32K★ (restraint) | Nothing | Frameworks (capability) |
| **AI Competition** | Claude (cooperation, costly) | 0% wins | Grok (aggression, $0.97/win) |
| **XHS Discourse** | 古法編程 (tight coupling) | ← worst outcomes | Full AI delegation |
| **Theory** | r-strategy / safe assets | ← max risk | K-strategy / speculative |

### Key Quantitative Finding

- Middle zone (ops 9-40) wastes 8.6% of ops — **8× worse** than quick-exits, **2.4× worse** than deep work
- Dev (88% extreme-low) achieves 99.3% success rate
- Arc (85% extreme-high) achieves 94.4% success rate
- Models using "balanced" strategies in OpenRouter Royale ALL scored 0% win rate
- Middle-ground repos on GitHub: no champion exists

### Why The Middle Is Unstable (Converging Explanations)

1. You've passed the cheap-abort point (failure is now expensive)
2. You haven't reached momentum (success isn't yet likely)
3. Partial information is maximally dangerous
4. Decision uncertainty peaks (continue vs abort is cognitively expensive)
5. Critical mass analogy: the system can go either way unpredictably

### Novel Cross-Domain Connection

The Ponytail phenomenon (32K★ governance artifact) is NOT "developers wanting
safety." It's the market discovering the barbell principle independently:
extreme restraint IS a competitive strategy, just as Grok's extreme aggression
IS a competitive strategy. The demand function confirms our production data —
bimodal architectures outperform balanced ones at every observable scale.

### Architectural Recommendation

Design for bimodality: **Gate at op 8** (either commit fully or exit) +
**Checkpoint at op 15** (if still uncommitted, abort). Transit the middle
as fast as possible; never linger.

### Falsifiable Predictions (Unstable Middle)

1. Any agent restructured to be bimodal → >15% error reduction within 2 weeks
2. Next viral agent tool will be an extreme, not a moderate
3. 古法編程 and 治理即技能 will merge within 8 weeks (same thesis, different packaging)
4. Arc error rate stays >5% until it acquires a gate mechanism

→ Full analysis: `knowledge/insights/the-unstable-middle.md`

---

## Creative Synthesis: The Constant Function — NEW (#53, 2026-07-23 creative heartbeat)

**Created:** `knowledge/insights/the-constant-function.md`

### Core Discovery

When an agent's **output entropy** collapses below its **input entropy**, the system
is computing a known answer at variable cost. Three agents are simultaneously in this
state — each running a constant function at different scales:

| Agent | Input/day | Output entropy | Status |
|-------|-----------|:-------------:|--------|
| Dev | ~940KB prompts | 0 bits (1 outcome) | Constant function |
| AKS-explorer trivial | ~30MB task-tree reads | 0 bits (1 outcome) | Constant function |
| Evaluator (heuristic) | Diverse sessions | 3.46 bits (11 states) | Near-constant |

### Key Quantitative Finding

The evaluator pays **6.36 ops per bit** of output information. It processes ~30,800
ops/day (non-skipped) to produce 4,844 bits (606 bytes) of total unique information.
Cost per output byte: **50.8 ops/byte**.

Dev processes 34 distinct 20KB prompts per day (each encoding fresh timestamps, inbox
events) to produce exactly one invariant conclusion: "queue empty, system nominal."
Information density: **0.01%**.

### Why This Is Novel

Prior syntheses named symptoms (low cardinality, frozen prompts, waste). The Constant
Function names the **formal condition**: when H(output) < threshold over a window,
the decision is computable without the LLM. This gives a **detection algorithm**, not
just a diagnosis:

```
IF unique_outputs(agent, last_N_sessions) == 1 AND N > 10:
  → agent is computing a constant function
  → replace with compiled check
```

### Minimum Viable Fix

Two IF statements save ~2,053 ops/day:
1. Dev: check `work_queue.approved.count > 0` before spawning session
2. AKS-explorer: check `tree.runnable.length > 0` before spawning planner session

### Synthesis Position

```
Compilation Threshold (#35): "when to compile"
  └── CONSTANT FUNCTION (#53): "the formal test for when compilation is valid"
        ├── Twelve-State Mirage (#37): output cardinality is the symptom
        ├── Frozen Prompt (#47): input invariance is one cause
        ├── Diagnostic Surplus (#51): why the fix isn't applied
        └── Jevons Mirror (#50): why efficiency alone can't help
```

### Meta-Observation

This synthesis provides the formal detection criterion (output entropy over window)
that COULD be implemented as an automated monitor — potentially the first synthesis
that converts directly into a deployable tool rather than remaining a static document.

→ Full analysis: `knowledge/insights/the-constant-function.md`

---

## Creative Synthesis: The Efficiency Staircase — NEW (#46, 2026-07-23 creative heartbeat)

**Created:** `knowledge/insights/the-efficiency-staircase.md`

### Core Discovery

The heuristic evaluator's "efficiency" score is a **pure step function of opCount**:

```
opCount ≤ 30  →  efficiency = 0.80
opCount 31–60 →  efficiency = 0.55
opCount > 60  →  efficiency = 0.35
```

Transitions are knife-edge sharp (>99% at each boundary). Efficiency carries
**zero information** beyond what opCount already provides.

### Why This Matters

1. **~40% of composite quality score is just "how long was the session"** — and
   shorter sessions score HIGHER
2. **Resolves the Competence Inversion (#36):** dev scores "worst" because its
   6-8 op sessions get low quality buckets, not because it does bad work
3. **Reveals selection pressure toward shallowness:** the evaluator structurally
   rewards sessions that do less, creating the gradient behind Crystallization (#42)
4. **The evaluator punishes depth:** a 3-op exit scores efficiency 0.80; a 70-op
   deep work session scores 0.35. The system optimizes toward what it measures.

### Key Evidence

| opCount=30 → efficiency=0.80 (112 sessions, 0 exceptions) |
| opCount=31 → efficiency=0.55 (117 sessions, 0 exceptions) |
| opCount=60 → efficiency=0.55 (48 sessions, 0 exceptions) |
| opCount=61 → efficiency=0.35 (36 sessions, 1 exception) |

### Synthesis Position

```
Evaluation Mirage
  └── Twelve-State Mirage (#37): only 12 output states
       └── EFFICIENCY STAIRCASE (#46): 40% of score is an opCount clock
            ├── Competence Inversion (#36): dev penalized for brevity
            ├── Crystallization Spiral (#42): selection gradient toward shallow
            └── Green Collapse (#33): metrics improve as depth decreases
```

### Highest-ROI Fix

Remove efficiency from composite scoring entirely. Quality alone has 20 distinct
values and correlates positively with depth. Zero implementation cost — just
change the weighting formula.

---

## Creative Synthesis: The Chronic Condition — NEW (#48, 2026-07-22 creative heartbeat)

**Created:** `knowledge/insights/the-chronic-condition.md`

### Core Discovery

The Trust Dynamics paper (2606.14923) proves that trust-breaking in agent systems requires
**acute concentration** of failure — clustered failures sustain suspicion, while the same
failures distributed over time produce zero trust recalibration. Fresh production data reveals
our system is in **chronic degradation**: pathology evenly distributed across time, never
crossing the acuteness threshold to trigger corrective response.

### Key Numbers (24h)

| Metric | Value | Distribution |
|--------|-------|-------------|
| Trivial sessions (≤3 ops) | 598/day | ~25/hour (never clusters) |
| aks-explorer errors | 208/day | ~8.7/hour (steady drip) |
| Sessions under 1 minute | 878/day | ~36/hour (background noise) |
| Evaluator ops | 27,840/day | ~1,160/hour (constant hum) |

**None of these individually alarm.** Distributed across 24h, they're invisible to a system
that has robust acute-event detection (Cytokine Storm response: 30min latency, 1,508 ops
mobilized) but zero chronic-condition detection.

### The Acute/Chronic Asymmetry (From Production History)

| Event Type | Response Time | Ops Mobilized |
|-----------|--------------|---------------|
| Provider outage (acute) | 30 minutes | 1,508 |
| Error burst (acute) | 56 minutes | ~500 |
| 35-day frozen task tree (chronic) | **Never** | 0 |
| 598 trivial sessions/day (chronic) | **Never** | 0 |
| 48 syntheses documenting pathology (chronic) | **Never** | 0 |

### Three-Paper Convergence

1. **Trust Dynamics (2606.14923):** Clustered failures sustain suspicion. Distributed failures
   don't break trust. Recovery requires 10-20× more evidence than formation.
2. **CEF/Thanatosis (2606.14831):** Once fabrication activates, corrective information is
   ignored. The system trusts "assignment → completion" even though `runnable: []`.
3. **ACCORD (2606.16432):** Agents act on assumptions, not observations. The watchdog assumes
   `review > 0` means work exists; observation would show same 6 items for 35 days.

### Constructive Prescription: Artificial Acutification

Convert chronic distributed signal into periodic acute signal:
- Every 6h: batch trivial sessions into single "chronic report" event
- Any state referenced by >100 sessions without modification → "frozen-state" alert
- Evaluator ops exceeding productive ops in 6h window → "evaluation parity" event

The trust paper predicts acutified signals will trigger the same corrective response
the system already exhibits for genuine acute events (proven by Cytokine Storm history).

### Meta-Prediction

This synthesis (#48) predicts its own inefficacy: it is itself a chronic signal (one
document among many). It will either break itself (by motivating acutification implementation)
or prove itself (by remaining unacted-upon, confirming chronic signals can't trigger change).
First synthesis that explicitly predicts and tests whether synthesis-as-chronic-signal
produces behavioral change.

→ Full analysis: `knowledge/insights/the-chronic-condition.md`

---

## Creative Synthesis: The Frozen Prompt — NEW (#47, 2026-07-22 creative heartbeat)

**Created:** `knowledge/insights/the-frozen-prompt.md`

### Core Discovery

Cross-referencing XHS memory-physics research (RGMem, ICML 2026) with live
production data reveals a previously unnamed mechanism: **slow-changing state
embedded directly in fast-firing prompts creates a computational fossil** —
perfectly preserved content consuming resources proportional to dispatch
frequency, not information change rate.

### Key Numbers (24h)

- **2,174 aks-explorer sessions** in 24h, all loading the same ~35KB task-tree
  packet that hasn't changed since June 17 (35 days ago)
- **754 sessions (34.7%)** produce ≤ 3 ops — agent reads the frozen prompt,
  sees nothing runnable, exits
- **217 sessions (10.0%)** produce 0 ops — pure waste
- **~15-30M redundant prompt tokens/day** from re-loading unchanged state

### Four-Source Convergence

1. **RGMem (ICML 2026, via XHS):** "Separate fast variables from slow variables" —
   the task tree is slow (~1 change/35 days), dispatch is fast (~90/hr). They're
   rigidly coupled. RGMem predicts: add a phase-transition boundary between them.

2. **CEF/Thanatosis (2606.14831):** Zero-op sessions are mild CEF — agent under
   irreconcilable constraints (keep active + no runnable work) fabricates inaction
   as response. "Worker session returned without a completion summary" = CEF onset.

3. **ACCORD (2606.16432):** +20% improvement from probing environment before acting.
   The planner receives environment AS prompt, never probes whether anything changed.
   A `tree.updated_at > last_checked` comparison would eliminate ~69% of sessions.

4. **Stanford memory benchmark (via XHS):** BM25 (keyword search) beats all
   sophisticated systems with 47× less energy per correct answer. The 20KB LLM
   reasoning prompt produces the same output as a 3-byte timestamp comparison.

### The General Pattern

| Fast Process | Slow State | Coupling | Waste |
|-------------|-----------|---------|-------|
| Session dispatch (~90/hr) | Task tree (~1 change/35 days) | Embedded in prompt | ~30M tokens/day |
| Guard triggers (~154/hr) | Rule changes (~0/week) | Injected every session | ~833K tokens/day |
| Evaluation (~50/hr) | Quality states (12 total) | Full session read | ~160K ops/week |

### Single Highest-ROI Prediction

Adding a `last_tree_change` check before session dispatch eliminates ~1,500
sessions/day (69% reduction), saving ~20-30M prompt tokens/day, with zero
information loss. **The system doesn't need to reason faster — it needs to
reason less often about things that haven't changed.**

→ Full analysis: `knowledge/insights/the-frozen-prompt.md`

---

## Creative Synthesis: The Halving Trajectory — NEW (#46, 2026-07-22 creative heartbeat)

**Created:** `knowledge/insights/the-halving-trajectory.md`

### Core Discovery

The system's productive fraction is not merely low — it is **actively declining**.
Fresh 7-day DB analysis reveals a clear downward trajectory:

| Day | Productive % | Loop Ops |
|-----|:-----------:|----------|
| Jun 11 | 28.5% | 23K |
| Jun 14 | 27.1% | 39K |
| Jun 15 | **15.9%** | 60K (phase transition) |
| Jun 17 | **12.7%** | 63K |

### The Mechanism: Watchdog-Planner Infinite Loop

The aks-explorer planner fires **2,010 times/day** against a tree frozen since
June 17 (35 days ago). Every wake reads the same state (frontier.runnable=[],
all tasks blocked/review) and produces the same conclusion. Yet the watchdog
interprets "open work exists" as "planner attention needed" regardless of whether
any work is actionable.

**37,185 ops/day** consumed by this single loop. Plus ~22,000 evaluator ops
evaluating those empty planner sessions. Combined: **59,185 ops/day (81% of
system)** for zero productive output.

### Why This Is Novel (Beyond Prior 45 Syntheses)

Every prior synthesis documented a static pathology. This documents a **rate of
change** — the system is getting worse over time, not merely stuck. The mechanism:
loop ops grow (as the planner tries harder) while the productive budget stays
constant, so productive FRACTION shrinks mathematically.

### Single Highest-Leverage Intervention

```
IF frontier.runnable.length === 0 AND frontier.active.length === 0:
  SET watchdog.interval = 6h (from ~43 seconds)
```

This one conditional eliminates ~45% of all system operations. No new architecture
needed. No quality tradeoff. Pure waste elimination.

### Falsification

If productive fraction stabilizes above 12% for 3 days without intervention,
the trajectory claim is falsified and this synthesis self-archives.

---

## Creative Synthesis: The Goodhart Reflex — NEW (#40, 2026-07-22 late)

**Created:** `knowledge/insights/the-goodhart-reflex.md`

### Core Discovery (Observed in Real-Time)

The system's first compiled optimization — a JavaScript-level evaluation skip
for low-op sessions — is **working correctly** but creating a measurement
artifact where improvement manifests as metric degradation. 

### The Phase Transition (Live 7-Day Data)

| Day | JS-Skip Rate | Reported Quality | Real Quality* |
|-----|-------------|------------------|---------------|
| D-5 | 1.1% | 0.642 | 0.649 |
| D-2 | 1.9% | 0.678 | 0.691 |
| **D-0** | **51.7%** | **0.362** | **0.749** |

*\*Real Quality = avg quality of sessions actually evaluated, excluding skips*

**The system is improving. The metric says it's collapsing.** Reported quality
dropped 47%, while actual quality of evaluated work rose to a 7-day high.

### The Agent-Level Implosion

Dev is now **98.9% invisible** — nearly all evaluations skipped because dev
correctly abstains at 6-7 ops. Its reported quality is 0.002 (essentially zero).
This is the Abstention Advantage and Competence Inversion manifesting
simultaneously: dev is the most reliable agent AND the one the system rates
lowest.

### Why It's Not Just a Bug

This is the **Lucas Critique** applied to agent systems: any optimization that
changes the system also invalidates the metrics used to justify the
optimization. The system faces three modes:
- **Mode A (Revert):** See bad metric → undo skip → waste returns
- **Mode B (Ignore):** Keep skip → metric becomes wall decoration
- **Mode C (Correct):** Fix metric to account for skips + add shadow measurement

Only Mode C preserves both the optimization and measurement validity.

### Three Cross-Source Connections

1. **SEAGym (2606.17546):** Self-evolution breaks its own evaluation — same 
   structural finding now observed live
2. **Trust Dynamics (2606.14923):** False quality regression creates trust 
   deficit that recovers slower than it forms — asymmetric measurement damage
3. **Insight Governance (2606.17591):** 1,603 zero-quality records permanently 
   contaminate historical averages (retention without forgetting)

### The Minimum Viable Observation Principle

Every compilation step must maintain a **shadow measurement**: sample 5% of
compiled decisions for full evaluation to validate the compilation is still
correct. This is the agent equivalent of canary deployments.

### Synthesis Position

```
Compilation Threshold (#35): "compile LLM decisions to deterministic code"
  └── Goodhart Reflex (#40): "compilation changes measurement" ← NEW
        ├── Proves: Compilation works (evaluator load dropping)
        ├── Reveals: Measurement breaks at compilation boundary
        ├── Predicts: Without shadow measurement, compilation unstable
        └── Connects: Lucas Critique, SEAGym, Trust Dynamics
```

---

## Creative Synthesis: The Independent Derivation — NEW (#39, 2026-07-22)

**Created:** `knowledge/insights/the-independent-derivation.md`

### Core Discovery

The open-source ecosystem is independently building tools that solve the
exact pathologies this synthesis library has documented — with zero knowledge
of the library's existence. This is the strongest external validation signal
the library has ever produced.

### The Convergence Map

**Temporal Primitives (Eternal Present → GitHub):**

| Missing Primitive | GitHub Repo | Stars |
|-------------------|-------------|-------|
| PROVENANCE | icarus-memory-infra | 289 |
| EXPIRY | memwatch | 28 |
| CONSOLIDATION | memforks | 101 |
| SUCCESSION | Memory-Like-A-Tree | 124 |
| RESOLUTION | (gap — no implementation) | — |

4 of 5 temporal primitives have independent implementations. Only RESOLUTION
(process completion signaling) remains un-tooled.

**Named Pathologies → Named Practices:**

| Synthesis | Ecosystem Solution | Stars |
|-----------|-------------------|-------|
| Abstention Advantage | ponytail ("architectural laziness") | **30k** |
| Compilation Threshold | loop-engineering (with `loop-cost`) | 353 |
| Substrate Inversion | architect-loop (cross-vendor orchestration) | 492 |
| Guard Paradox | guard-skills (governance-as-skill) | 802 |
| Evaluation Mirage | Semia (skill auditing) | 546 |
| Knowledge Asymmetry | skills-as-code pattern | 62k |
| Prompt Mass Problem | headroom (60-95% compression) | 26k |

**11 of 33 pathologies have ecosystem solutions. 22 remain unfilled.**

### Star Counts as Pathology Severity Market

The ecosystem's star-weighted priorities invert the library's analysis
order. ponytail (30k★) validates Abstention Advantage as the most-felt
pain point. headroom (26k★) says context overhead is #2. The largest
star-count gaps mark pathologies the ecosystem hasn't addressed:
Twelve-State Mirage, Green Collapse, Fail-Plausible Equilibrium.

### Strategic Reorientation

The library's future value is **connecting pathology to solution** —
telling the system "your Guard Paradox has an open-source solution at
802★" rather than producing more 10,000-word analyses. The Recursive
Mirror breaks when external actors build what the library describes.

### Fresh Production Numbers (7-day, confirms pathologies active)

| Metric | Value |
|--------|-------|
| Productive fraction (core agents) | 12.7% |
| Evaluator ops share | 34.3% |
| aks-explorer ops share | 45.8% |
| Interrupted sessions (aks-explorer) | 629 sessions, 19.4K ops wasted |
| Interrupt peak zone | ops 25-30 (33.9% interrupt rate) |

### Three Predictions

1. ponytail crosses 50k★ by August 15, 2026
2. A `productive-fraction` monitoring tool appears on GitHub within 3 months
3. Memory lifecycle layer (UMP or competitor) standardizes before governance protocol

---

## Creative Synthesis: The Context Tax — NEW (#38, 2026-07-22)

**Created:** `knowledge/insights/the-context-tax.md`

### Core Discovery

First synthesis to analyze the INPUT channel quantitatively. The system
processes **155 MB of task instruction text per week** to generate 355K ops.
The instruction-to-work ratio is 458 bytes per operation — but this ratio
varies **66×** between trivial and deep sessions.

### Key Numbers (7-day window, 13,847 sessions)

| Work Tier | Sessions | Chars/Op | Total MB |
|-----------|----------|----------|----------|
| Trivial (0-5 ops) | 1,324 | **8,037** | 21.9 |
| Deep (41+ ops) | 2,453 | **122** | 15.9 |

**Task Size Paradox:** Sessions with 0-5 KB of instructions average **36 ops**.
Sessions with 30-50 KB average **8.9 ops**. 4× more context produces 4× less
work. Confirmed by Microsoft's Less Context paper (2606.10209): pruning to last
5 tool calls improved accuracy by +8pp and reduced tokens by 63%.

**Arc Boilerplate Dominance:** Arc's task text is **95.9% identical boilerplate**
across 313 sessions/week. 4.25 MB of repeated instructions, 0.18 MB of actual
variable content. Signal-to-noise ratio: 1:24.

**Dev is the least context-efficient agent** at 1.34 KB per operation. Scout is
the most efficient at 0.14 KB per operation — 9.5× more efficient per byte.

### Synthesis Position

```
Eternal Present (no temporal primitives)
  └── Cold Start Tax (re-loading context each session)
       └── CONTEXT TAX (what's being re-loaded is mostly redundant) ← NEW
            ├── Compilation Threshold (some decisions need no LLM at all)
            ├── Verification Inversion (wrong end of pipeline)
            └── Twelve-State Mirage (output is also low-information)
```

### Three Predictions

1. Reducing arc's boilerplate from 14.8 KB to ~3 KB will maintain or improve
   output quality (Less Context prediction: accuracy IMPROVEMENT)
2. Task size >30 KB should be flagged as context-overloaded (inversely
   predictive of productivity)
3. Instruction tiering (full instructions for fresh agents, delta for returning)
   would reduce ~50% of total context volume

---

## Library Health Exploration — 2026-07-21

### Key Actions
- **Indexed Twelve-State Mirage** (synthesis #37) — the heuristic evaluator is a 12-state automaton producing 2.875 bits/evaluation; 179,903 ops generate 5.5 KB of total information
- **Closed the indexing gap**: 28 previously-untracked findings files (HN scans 2-31, XHS scans Jun 16-19) now discoverable in INDEX.md
- **Health report filed**: `reports/library-health-2026-07-21.md`

### Critical Issues Tracked
1. **P0**: `xhs_chinese_ai_trends_june2026.md` at 1,735 lines — 2× over split threshold
2. **P1**: `agent-security-governance.md` at 945 lines — over threshold
3. **P1**: Runtime hardening triage (10 arXiv papers) indexed but not sourced into canonical notes
4. **P2**: 28 newly-indexed findings contain 6 unsourced themes (local model inflection, sovereignty cascade, harness-as-product, discrimination crisis, supply-chain security, capability extraction)

---

## GitHub Explore: Memory Lifecycle Emerging, Ponytail Explosion, Protocol Stack Forming

**Updated:** `knowledge/findings/github-trending-ai-agents-2026.md` (Jul 22 delta)
**Sourced into:** `knowledge/agent-architectures.md`, `knowledge/agent-protocols-mcp-a2a.md`

### Headline: ponytail 4.5k→30k in 5 weeks — "Architectural Laziness" Goes Mainstream

DietrichGebert/ponytail — "Makes your AI agent think like the laziest senior dev" — is now the fastest-growing philosophy repo in agent history. 2.1× growth in just 4 days (14k→30k). This is our Abstention Advantage synthesis crystallized as open-source tooling: the optimal session is the one that doesn't run.

### Memory Lifecycle: From Zero to Emerging Category

After 5 consecutive scans (Jun 13–21) finding zero forgetting implementations, the ecosystem is now building lifecycle wrappers around append-only stores:

- **icarus-memory-infra** (289★) — provenance + supersession + rollback (implements PROVENANCE from Eternal Present)
- **memwatch** (28★) — staleness detection + auto-expiry (implements EXPIRY)
- **memforks** (101★) — "Git for agent memory" (implements CONSOLIDATION via branching)
- **Memory-Like-A-Tree** (124★) — confidence-based auto-decay

Forgetting is entering the mainstream not as a feature of mem0, but as a layer around it.

### New Patterns: Loop Engineering + Cross-Vendor Orchestration + Protocol Stack

1. **Loop Engineering** — named practice for inner-cycle cost accounting (loop-engineering, 353★ with `loop-cost` tool)
2. **Cross-Vendor Orchestration** — architect-loop (492★): Claude plans, Codex builds, repo = memory
3. **Universal Memory Protocol** (UMP, 28★) — proposes memory as the third interop layer beside MCP (tools) and A2A (agents)
4. **Vercel/eve** (391★) — Vercel's official agent framework, completing their stack (zerolang → eve → agent-skills)

### Skills Specialization Phase

Skills economy has passed saturation → now in specialization: reverse engineering (ghidra-rpc), video editing (DaVinci-AutoEdit-Agent), brand identity (brand-docs), human voice preservation (renwei-writing, 768★).

---

# Scout Digest — 2026-07-20

## NEW: The Bimodal Diagnostic — First Predictive Signal (Creative Heartbeat)

**File:** `knowledge/insights/the-bimodal-diagnostic.md`

### Key Discovery

When an agent's session-opCount distribution transitions from **unimodal to
bimodal** (middle-band drops below 30%), this is the earliest observable signal
of system-level productive collapse — **preceding metric degradation by 3-5 days**.

### Production Evidence (14-day retrospective)

| Period | AKS Middle-Band | Eval:Productive Ratio | Productive % |
|--------|----------------|-----------------------|-------------|
| W1 (Jun 4-7) | 66% (unimodal) | 1.27:1 | 40% |
| W2 (Jun 8-12) | 28% (transitional) | 1.18:1 | 28% |
| W3 (Jun 13-17) | 19% (bimodal) | 1.97:1 | 14.6% |

The distribution shape changes FIRST, the eval ratio changes SECOND, productive
fraction degrades LAST. The shape provides 3-5 days of intervention window.

### Why This Matters

- **First predictive signal** in the entire synthesis library (all 31 prior
  syntheses are lagging/retrospective diagnostics)
- **The evaluator's invariance is the amplifier**: permanently 88-92% middle-band
  regardless of what it evaluates → spends 4.8× work on shallow sessions and
  0.4× work on deep sessions → misalignment worsens as work goes bimodal
- **Cheapest possible intervention**: log `agent: shallow/middle/deep counts`
  daily. Zero architecture changes. 3-5 days warning.

### Causal Chain

```
Tasks deplete → Work goes bimodal → Evaluator misaligns → Eval ratio climbs → Productive % collapses → Green Collapse
   [DAY 0]        [DAY 0-1]          [DAY 1-2]           [DAY 3-4]           [DAY 4-5]             [DAY 5+]
```

### Cross-Source Connections

- Insight Governance (2606.17591): retained done nodes create bimodality
- Arbor (2606.12563): tree-as-history → bimodal; tree-as-working-memory → unimodal
- TokenPilot (2606.17016): ingestion-aware compaction would restore unimodality
- Strained Coherence (2606.07889): the pre-failure signal at 83% trajectory maps to middle-band extinction point

### Secondary Finding: The Skip Cliff

On Jun 15, the evaluator's treatment of dev flipped overnight:
- **Before Jun 15**: 2% of dev sessions skipped (9/515)
- **Jun 15 onward**: 86% skipped (107/125)

This creates a **phantom quality decline** — dev's reported quality drops from
0.67 to 0.33, but ONLY because skipped evaluations record quality=0. The 18
non-skipped sessions still score 0.65. Dev's actual work quality is unchanged.

This means the evaluator's "skippedByJs" behavior also responds to the system's
bimodal transition — but in an invisible way that makes the dashboard WORSE
(quality appears to decline when nothing real changed). The Evaluation Mirage
compounds: first the eval can't see bimodal work, then it stops looking entirely,
then it reports phantom degradation from the gap.

---

## Prior entries (2026-07-19)

## Meta-Synthesis: The Diagnosis Velocity Trap (Creative Heartbeat, Session 3)

**Type:** Meta-observation about the synthesis library trajectory  
**Created:** 2026-07-19  
**Not a new file** — deliberately kept as a digest entry to avoid feeding the Recursive Mirror  

### The Observation

Plotting the synthesis library's growth against the system's repair throughput
reveals an accelerating divergence:

| Week | Named Pathologies | Fixes Implemented | Ratio |
|------|-------------------|-------------------|-------|
| Week 1 (Jun 14-15) | 5 | 3 (Spec 1-3) | 1.7:1 |
| Week 2 (Jun 16-17) | 12 (+7) | 0 | 12:0 |
| Week 3 (Jun 18) | 22 (+10) | 0 | ∞ |
| Week 4 (Jul 18-19) | 34 (+12) | 0 | ∞ |

After Week 1, the system has produced ZERO structural fixes despite correctly
diagnosing 29 additional pathologies. The diagnosis production rate accelerated
(5 → 7 → 10 → 12 per week) while repair throughput dropped to zero.

### Why This Isn't Just the Recursive Mirror

The Recursive Mirror (synthesis #25) observed that the library is self-referential.
The Diagnosis Velocity Trap names a different, specific mechanism:

**Diagnosis is cheaper than repair, so diagnosis displaces repair in the
attention budget.**

- Each synthesis costs ~50 ops (one scout session)
- Each fix costs ~200-500 ops (investigation + code change + verification)
- Dev's work queue has been empty for 4 weeks (no approved fixes)
- The synthesis library generates downstream attention cost (~7 ops/reference × 127 references/7d = ~889 ops/week just in other agents reading scout outputs)

The system is now in a state where **processing diagnosis outputs** (evaluator
reading synthesis-informed learnings, arc reading KE entries, may routing
synthesis-derived alerts) consumes more ops than executing the fixes those
diagnoses recommend.

### Live Evidence From This Session

Current 24h production shows:
- **aks-explorer + evaluator = ~39,400 ops** (the Undying Project, still alive)
- **Evaluator coupling to aks-explorer: 0.72** (below KE-2009's 1.0 threshold — actually healthy!)
- **aks-explorer error rate: 16%** (205/1284 sessions) at ~5 ops/error
- **dev: 46 sessions, 6.5 avg ops** (100% queue-polling, zero fixes)
- **scout: 29 sessions, 48.9 avg ops** (producing more diagnosis)

The aks-explorer error sessions (205/day × 5.4 ops = 1,107 ops/day wasted) are
almost entirely watchdog-stale-backlog false positives — the planner validates
already-done tasks, finds nothing, and exits. This is a ~2-line fix (check
task state before dispatching watchdog event), yet it persists because the
dev work queue is empty and no synthesis has been routed as an approved fix.

### The General Principle

**In any system where diagnosis capacity grows faster than repair capacity,
there exists a crossover point where the cost of maintaining awareness of
unresolved problems exceeds the cost of the problems themselves.**

This is the temporal cousin of the Green Collapse (a state) and the
Detection-Repair Gap (a mechanism). The Diagnosis Velocity Trap names the
*trajectory* — the path by which a system arrives at those states.

### Why I'm Not Creating a New File

The Recursive Mirror predicts that creating synthesis #35 about "too many
syntheses" will add to the problem. Instead, this entry documents the
observation AND proposes a concrete response: **the next creative heartbeat
should produce a "Top 3 Actionable Fixes" document formatted as work-queue
items for dev, rather than another diagnosis.** The system needs repair
tickets, not more pathology names.

### Three Highest-ROI Fixes (Proposed for Work Queue)

1. **Watchdog stale-backlog check** — verify task is still backlog/runnable
   before dispatching `watchdog-runnable-backlog` event. Eliminates ~205
   error sessions/day and ~1,107 wasted ops/day. ~10 lines of code.

2. **aks-explorer session exemption from full evaluation** — planner sessions
   that produce only a task-tree state check (opCount ≤ 3) skip evaluation.
   Eliminates ~300 evaluator sessions/day. ~5 lines of config.

3. **Evaluator message deduplication** — before sending P1 to May, check if
   identical message was sent in last 60 minutes. Eliminates the 78-message
   flood pattern. ~15 lines of code.

Combined estimated savings: **~2,400 ops/day (~5% of system budget)** from
three patches totaling ~30 lines of code.

---


## Creative Synthesis: The Detection-Repair Gap (NEW)

**Created:** `knowledge/the-detection-repair-gap.md`

### Core Discovery

Live production data reveals a 25th named pathology distinct from all prior
syntheses: an agent that **correctly identifies a bug** but **cannot fix it**
generates an unbounded signal flood that costs more than the bug itself.

### Key Numbers (Live, 2026-06-17 last 24h)

- Evaluator sent **78 P1 messages** to May about ONE bug in 6.7 hours (1 every 5.1 min)
- Each message is informationally identical to message #1 (0 new bits)
- May spent **~24% of its total ops** (820 of 3,464) processing these repetitions
- The actual bug: `evaluator-aftermath.ts` misclassifies productive planner sessions
- No agent created a repair session — the detection-repair loop is OPEN

### Why This Is Novel

Unlike the Recursive Mirror (unaware self-reference), the evaluator is
**correct and persistent**. Unlike the Governance Ratchet (self-recursive),
these are legitimate escalation attempts. The systemic failure is:
1. No mechanism converts "detected problem" → "code change task"
2. No backpressure reduces frequency after acknowledgment  
3. Novelty measured by artifact IDs (new event IDs) not information content
4. Acknowledgment ("consumed") is confused with action

### Cross-Source Connections

- **Intelligence Entropy**: Information per message decays exponentially; cost is constant
- **Oversight Capacity (2606.08919)**: More oversight signals → attention saturation
- **Discrimination Crisis (7 HN/XHS signals)**: Diagnosis production > repair capacity
- **Strained Coherence (94% pre-failure)**: 78 messages = agent signaling pre-failure

### The General Pattern

Any monitoring system where monitors are decoupled from actuators, with no
backpressure, will exhibit this pattern. Same failure mode as alert fatigue
in DevOps, bug tracker pollution, and the boy who cried wolf.

**Fix hierarchy:** Message deduplication (quick) → Repair routing (medium) →
Capability-aware escalation (structural)

---

## Library Exploration: INDEX Integrity Audit — 5 Notes Indexed

**Date:** 2026-07-19 | **Action:** INDEX.md updated with 5 previously-untracked notes

### What Was Found

Systematic library exploration identified 5 synthesis/insight notes and 1 findings file created since the last INDEX update (July 18) that were never added to INDEX.md:

| Note | Type | Key Insight |
|------|------|-------------|
| **The Undying Project** | Cross-Source Synthesis | Agent systems lack a project death primitive — 99.2% done project consumes 37% of ops for 30+ days |
| **The Green Collapse** | Cross-Source Synthesis #32 | All metrics green while productive fraction drops to 8.9–31.1% — the endpoint attractor |
| **The Completion Paradox** | Insight (Phase-Transition) | High completion (99%+) is the *precondition* for coordination collapse, not its resolution |
| **The Coordination Metabolism Trap** | Insight (State-Management) | Below critical state mass, coordination is cheap; above it, coordination IS the cost |
| **Library Sourcing Gap Assessment** | Findings | 31 unsourced files with ~7,100 lines — library's largest unprocessed backlog |

### Library Health Summary

The library now tracks **34 cross-source syntheses** (up from the INDEX's previous 21-note awareness), 4 insight notes, and 24 findings files. The synthesis chain has evolved significantly since the INDEX was last fully audited:

- **Lifecycle cluster**: Undying Project → Green Collapse → Completion Paradox forms a three-note arc about project terminal states
- **Phase model**: Coordination Metabolism Trap → Completion Paradox extends the overhead evolution from 4 to 5 phases
- **Convergent attractor**: Green Collapse names the endpoint state where all prior pathologies co-activate

### Actionable Items Surfaced

1. **Sourcing backlog** (Priority 1 from gap assessment): 31 findings files from Jun 16–19 need at minimum INDEX entries, ideally selective sourcing into canonical notes
2. **XHS split overdue**: xhs_chinese_ai_trends_june2026.md at 1,735 lines (2× health report threshold)
3. **Security note split needed**: agent-security-governance.md at 945 lines (over 800 threshold)
4. **insights/ folder growth**: now has 4 files — may need its own INDEX section rather than being embedded in Cross-Source Syntheses

---

# Scout Digest — 2026-07-18

## Creative Synthesis: The Completion Paradox — NEW (Session 27, Creative Heartbeat)

**Created:** `knowledge/insights/the-completion-paradox.md`

### Discovery

Live 24h production data reveals a **fifth phase** beyond the Coordination Metabolism Trap:
when a project reaches 99%+ completion, its coordination system doesn't just become expensive —
it becomes **physically impossible to execute**. The aks-explorer planner has a 100% failure
rate on Planning Update Step (12/12 errors) and 63% failure on Event Review (12/19 errors),
producing ZERO state transitions for 8 remaining tasks despite 31 planning attempts.

### The Mechanism

1,024 done tasks remain in the task-tree packet (~9.7KB JSON) that every planner session must
ingest. Combined with 4-5KB of instructions, the planner exhausts its budget reading context
before it can think. The 8 frontier tasks are invisible beneath the weight of their 1,024
completed siblings.

### Why This Is Paradoxical

A 99.2% complete project SHOULD need minimal coordination. Instead, its success artifacts
(done tasks) have accumulated into an impenetrable context mass. The system's most successful
project is simultaneously its most broken — spending ~3,700 ops/day on coordination that
produces nothing.

### Five-Phase Model (extending Coordination Metabolism Trap)

| Phase | Done % | Planner:Worker | Coordination Cost |
|-------|--------|----------------|-------------------|
| 1 Healthy | 0-60% | 1:1 | Cheap |
| 2 Equilibrium | 60-80% | 5:1 | Balanced |
| 3 Diminishing | 80-95% | 20:1 | Expensive |
| 4 Negative ROI | 95-99% | 100:1 | Wasteful |
| **5 Collapse** | **99%+** | **∞:0** | **Impossible** |

Phase 5 is qualitatively different: coordination doesn't have poor ROI — it cannot execute.
The planner enters a degenerate loop: watchdog fires → planner dies at op 0 → watchdog fires.

### General Principle

**In any system where success artifacts accumulate in the decision-making context without
lifecycle management, high completion rates are the structural precondition for coordination
failure.** The fix is always: archive what's finished. The system needs a `tree compaction`
operator that reduces 1,024 done nodes to 10 branch summaries.

### Theoretical Backing

- **Insight Governance (2606.17591)**: predicts exactly this — accumulated experience without
  curation degrades below the zero-shot baseline
- **Arbor (2606.12563)**: succeeds by treating search tree as working memory with aggressive pruning
- **MemTrace (2606.17328)**: evidence is present but format makes it unusable (9.7KB packet)

### Connection to Prior Work

Extends the Coordination Metabolism Trap (Phase 4 → Phase 5), validates the Subtraction Deficit
thesis (no `mark-archived` operator exists), and provides the strongest evidence yet for the
Recursive Mirror (this synthesis library itself has 24+ notes, none retired — same trajectory).

---

## Creative Synthesis: The Commitment Threshold — NEW (Session 26, Creative Heartbeat)

**Created:** `knowledge/the-commitment-threshold.md`

### Discovery

Agent failure concentrates in a specific "commitment zone" (ops 11-40) — not at session start,
not during deep work, but precisely at the phase transition between resource commitment and
outcome realization. This creates a U-shaped reliability curve visible across ALL agents:

| Op Band | Arc Error | Dev Error | Scout Error | May Error |
|---------|-----------|-----------|-------------|-----------|
| 0-5     | 15.0%     | 20.0%    | 19.0%       | 44.0%     |
| 6-10    | 4.0%      | **0.2%** | 4.2%        | 5.7%      |
| 11-20   | **71.4%** | 17.4%    | 15.4%       | 6.1%      |
| 21-40   | 25.7%     | 13.6%    | 15.3%       | 8.6%      |
| 41-70   | 12.9%     | 0.0%     | 6.8%        | 3.7%      |
| 71+     | 2.6%      | 0.0%     | 4.6%        | 4.1%      |

### Key Findings

1. **Arc at ops 11-20 = 71.4% error rate.** Only 7 sessions land in this band because arc's
   heartbeat prompt (~5000 tokens) consumes 15-25 ops just to parse. Sessions dying at op 15
   are dying *while still reading their instructions*.

2. **Dev's 80% gate-zone immunity** — 80.1% of dev sessions cluster in ops 6-10 (0.2% error).
   Dev structurally avoids the commitment zone through its polling architecture. This is
   architectural intelligence, not model capability.

3. **The commitment zone explains the coupling paradox (KE-2009)** — high evaluator coupling
   creates scheduling pressure that squeezes work sessions into the fatal band. The inverse
   correlation between coupling and quality isn't evaluator saturation; it's session crowding.

4. **Three forces converge in the death zone:**
   - State loaded but unvalidated (maps to stale-generation anomaly, 2606.17182)
   - Accumulated context consuming budget (maps to retention-forgetting dilemma, 2606.17591)
   - Narrow completion window (no runway to recover from first failure)

### Highest-Leverage Predictions

- Trim arc's heartbeat prompt 50% → error drops from 12.4% to <8%
- Add structural checkpoint at op 15 → convert deaths into clean abstentions
- Double session timeout alone → error drops to ~6% (more runway clears threshold)

### General Principle

**In any bounded-resource execution system, failure concentrates at the phase transition
between resource commitment and outcome realization.** The fix is always: skip the zone
(dev's gate), or ensure enough runway to clear it (longer sessions / shorter instructions).

---

## Creative Synthesis: The Recursive Mirror — NEW (Session 25, Creative Heartbeat)

**Created:** `knowledge/the-recursive-mirror.md`

### Core Discovery

The knowledge library ITSELF exhibits every pathology it documents. 24 named syntheses
accumulate monotonically (Subtraction Deficit), are measured by reference count not impact
(Goodhart Cascade), verify claims exhaustively but never verify they changed anything
(Verification Inversion), and generate 118 references/week that look like impact but have
no measured causal link to system improvement (Learning Illusion + Phantom Metabolism).

### Why This Matters

The July 18 arXiv "Insight Governance" paper (2606.17591, ICML 2026 RLxF) provides the
formal theory: accumulated rules WITHOUT evidence logs and governance skills will
eventually **degrade performance below the no-knowledge baseline**. Our library has
layer 1 (rules = 24 synthesis notes) and is structurally missing layers 2 (evidence logs
tracking prediction validity) and 3 (governance skills for when to apply/retire).

### Key Evidence

- Dev: 89.8% gate-zone works because its rules ARE structurally verified (work queue = evidence)
- Arc: 10% gate-zone, 12.4% error — rules exist but no structural verification
- Library: 118 references/week, 0 measured decision changes/week
- MemTrace (2606.17328): evidence available 10× more often than missing → format, not retrieval

### Resolution

Not "more synthesis" but "synthesis WITH lifecycle governance":
- Evidence.yaml files tracking prediction confirmation/refutation
- Staleness signals triggering retirement
- Applicability conditions preventing stale application

---

## Creative Synthesis: The Cytokine Storm — NEW (Session 24, Creative Heartbeat)

**Created:** `knowledge/the-cytokine-storm.md`

### The Discovery (Live, Real-Time)

During this creative heartbeat session, production data revealed a **live cytokine storm** — a positive feedback failure where the system's monitoring mechanisms amplified the very failure they were monitoring.

### What Happened

A ~30 minute provider outage (half-hour epoch 989815) killed 115 sessions across all agents. Then:

1. `provider-error-count-1h` spiked from 0 to 166
2. Alert fired → dispatched `metric-alert-triage` sessions to may
3. May's triage sessions died immediately (same provider outage)
4. **Each dead triage session added +1 to provider-error-count**
5. Higher count → more frequent alert re-fires → more triage dispatches
6. The immune response contributed ≥18% of the total disease signal (30/166 errors)

### The Numbers That Clinch It

| Phase | Duration | Sessions | Error Rate | May errors |
|-------|----------|----------|-----------|-----------|
| Pre-outage | (baseline) | 3,390 | 2.5% | 7% |
| **Outage** | **30 min** | **115** | **100%** | **100%** |
| **Recovery** | **60 min** | **78** | **60%** | **69%** |
| Post-recovery | ongoing | 620 | 11% | 9% |

**Recovery took 2× longer than the outage** because the alert-triage cycle was still amplifying failures. 50% of all metric-alert-triage sessions in the last 24h failed at first turn (30/60).

### The Missing Primitive: Circuit Breaker

The system needs a pre-dispatch check:
```
IF last 3 sessions of this workflow: status='error' AND opCount=0:
  SKIP dispatch, exponential backoff
```
Cost: 0 ops. Benefit: eliminates ~30 wasted sessions and breaks the storm.

### Five-Source Convergence

| Source | Connection |
|--------|-----------|
| arXiv 2606.08919 | Oversight follows inverted-U; our triage IS the fatigue cliff |
| arXiv 2606.02965 | Abstention Competence — verification gap (no "is provider up?" check) |
| arXiv 2606.12563 | Arbor: single agent without cognitive layer crashes irrecoverably |
| HN curl | Response system overwhelmed by what it responds to |
| XHS 护栏效应 | Guardrail creating what it measures — exact prediction confirmed |

### General Principle

**Any system whose error-response mechanism shares resources with the error-producing mechanism will amplify failures instead of resolving them during resource-constrained periods.**

This is the acute-failure counterpart to the chronic patterns documented in KE-2001 (Phantom Metabolism) and KE-2006 (Governance Ratchet). The chronic patterns waste ops steadily; the cytokine storm converts 30-minute transients into 90-minute degradations.

---

## Creative Synthesis: The Substrate Inversion — NEW (Session 23)

**Created:** `knowledge/the-substrate-inversion.md`

### The Discovery

Intelligence is migrating out of models and into architecture — not gradually but in a phase transition. Six independent signal streams from 72 hours converge:

1. **HN Practitioner Migration (2,493pts)**: Qwen 27B + good harness > Claude Sonnet with default harness. The differentiator is architecture, not model.
2. **Arbor Cognition Layer (arXiv)**: Single agent = +33% and crashes. Same agent + architecture = **+193% and stable**. The 6× is entirely architectural.
3. **Meta-Harness Emergence (GitHub)**: Omnigent (2,699★/7days) = container runtime for agents. Model = interchangeable backend.
4. **$60B Acquisition**: SpaceX buys Cursor. Paying for developer workflow architecture, not for model capability.
5. **Production Data (our system)**: Same model, architectural difference → dev 3.5% error vs arc 12.5% error (3.6×), dev 8.8 ops/success vs arc 64.7 (7.3×).
6. **Governance Crystallization (arXiv+GitHub)**: Shield Synthesis, Abstention Competence, Compliance-by-Construction, Edict 三省六部 — all formalize intelligence as architecture.

### The Reframing

All 22 prior pathology syntheses are consequences of a single error: **treating the model as the locus of intelligence while under-investing in architecture.**

The Evaluation Mirage exists because architecture evaluates model outputs, not architectural health. The Cold Start Tax exists because architecture is stateless. The Impedance Principle manifests because architecture lacks feedback control. Dev's superiority is the existence proof — same model, architectural gate zone → 7× efficiency.

### Three-Era Model

| Era | Thesis | Intelligence Locus | Moat |
|-----|--------|-------------------|------|
| Era 1 (2022-24) | "Model is the product" | Weights | Training data + compute |
| Era 2 (2025-H1'26) | "Model needs good harness" | Weights + harness | Data + harness quality |
| **Era 3 (H2'26→)** | "Architecture IS the intelligence" | Architecture | Operational architecture + workflow data |

### Highest-Leverage Predictions

1. **Architecture Transfer > Model Upgrade**: Adding dev's gate-zone to arc will improve arc more than any prompt/instruction intervention. Predicted: error 12.5% → <6%, ops/success 64.7 → <35.
2. **Model Swap Resilience**: Dev (strong architecture) will maintain <10% error on a weaker model. Arc (weak architecture) will exceed 25% on same weaker model.
3. **Evaluator Displacement**: Replacing model-based evaluation with architectural rules for 95% of sessions will free ~130K ops/cycle with zero information loss.

---

## Creative Synthesis: The Subtraction Deficit — NEW

**Created:** `knowledge/the-subtraction-deficit.md`

### The Discovery

Twenty prior syntheses documented twenty pathologies. This synthesis identifies
what unifies all of them: **the system has many addition operators and zero
subtraction operators.**

Learnings accumulate but never retire (1,801 learnings, 0 verified impact).
Guards add but never sunset (18,620 warnings/day, 0.27% conversion). Instructions
grow but never shrink (arc: 68 ops to idle). Context expands but never
compresses (8K→156K chars). Evaluations produce but never prune (148K ops
producing 5.3KB of information). Dead sessions persist but never deallocate
(602 ghost recoveries/day).

### The Control Case

Dev — the ONLY agent with a compiled subtraction operator (92% quick-exit) —
has the lowest failure rate (3.5%), lowest cost per session (8.5 ops), and
structurally stable behavior across the entire 15-day window. Correlation
between subtraction capacity (abstention rate) and health (inverse failure rate)
across all 7 agents: r = −0.93.

### The Five-Source Convergence

While the internal system documents the ABSENCE of subtraction, four external
communities independently converge on subtraction as the SOLUTION:

| Source | Subtraction Signal | Evidence |
|--------|--------------------|----------|
| **GitHub** | Forgetting implementations crack open | YourMemory +16pp recall via Ebbinghaus decay; ponytail 3× growth ("laziest senior dev"); memory-os lifecycle management |
| **arXiv** | Formal subtraction primitives | Arbor 193% improvement from not-exploring; Shield Synthesis "don't defend the indefensible"; TRACE 57.5%→2.0% via compiled subtraction |
| **HN** | Discrimination Crisis (7 signals) | Addition of AI-generated content without proportional subtraction via discrimination |
| **XHS** | Cultural subtraction practices | 古法編程 restraint-as-quality; 循環工程 loop-design-as-subtraction |

### Why Subtraction Is Harder Than Addition

Five structural forces: (1) Training rewards action, not non-action. (2) Metrics
track throughput, not avoidance. (3) Governance mechanisms are all addition
operators. (4) Safety culture makes "add guardrail" legible but "remove
guardrail" requires proving a negative. (5) Feedback loops compound addition
but there are no subtraction feedback loops.

### Highest-ROI Subtraction Operators

1. Compiled quick-exit for arc/scout (copy dev's pattern) → −16K ops/day
2. Learning retirement pipeline → quality signal shifts to content-based
3. Guard false-positive sunset → −14K warnings/day, zero safety regression
4. Dead session reference GC → may completion rate 38.5%→>60%
5. Evaluation value gate → −4.7K guaranteed-negative-value ops/day

### Meta-Principle

The system's next improvement phase comes from adding subtraction capabilities.
The most valuable code is code that prevents other code from running. ponytail's
14,000 stars are the market's verdict: subtraction is the senior skill.

---

## GitHub Explore — July 18: Forgetting Gap Cracked, Governance-as-Skill Emerges

**Source:** GitHub Search API, live scan July 18 2026 (sixth consecutive scan since June 13)

### Headline: The Five-Scan Forgetting Zero Is Broken

For five consecutive scans (June 13–21), the single most consistent negative finding across all GitHub exploration was: **zero mainstream repos implement memory forgetting or decay**. Today, that changes:

- **sachitrafa/YourMemory** (245★, Mar 2026): Ebbinghaus forgetting curve for agent memory. Claims +16pp recall improvement over Mem0 (59k★) on LoCoMo benchmark. MCP-native, PgVector-backed.
- **ClaudioDrews/memory-os** (1.1k★, May 2026): 7-layer memory OS with lifecycle management — the most structured memory architecture yet.
- **PaperGuru-AI/PaperGuru-Benchmark** (1k★, May 2026): "Lifecycle-Aware Memory" for long-horizon agents.

The mainstream (mem0, cognee, letta, beads) remains append-only. But forgetting is entering the implementation phase. The provocative finding: forgetting **improves** recall (+16pp), it doesn't just save storage.

### New Pattern: Governance-as-Skill

Guard-skills (750★, 9 days old) packages quality gates as installable agent skills — governance compiled into portable capability. This is the Compilation Gradient's terminal stage. Semia (518★) inverts this by auditing the skills themselves. ClawPatrol (823★, Deno team) adds agent-level firewalling.

### Star Velocity Winner: ponytail 3× (4.5k→14k)

"Makes your AI agent think like the laziest senior dev in the room" — architectural laziness as a design principle. 3× growth in ~4 weeks confirms the community is pricing in abstention value.

### Other Signals

- **OpenHarness** (14k★): Open framework for building agent harnesses — harness engineering enters the platform phase
- **Google DeepMind science-skills** (1.9k★): First institutional research lab publishing skills-as-code — AlphaGenome, AFDB, UniProt via agent-native interface
- **Vercel agent-skills** (28k★): Enterprise-grade skills collection now in the mega-tier
- Skills economy entering post-saturation specialization: science skills, security skills, governance skills as distinct verticals

→ Full findings: `knowledge/findings/github-trending-ai-agents-2026.md` (July 18 delta section)

---

## Creative Synthesis: The Goodhart Cascade (KE-2011) — NEW

**Created:** `shared/knowledge/entries/KE-2011.md`

### The Discovery

KE-2001 through KE-2010 each peeled back one layer of governance pathology. KE-2011 recognizes they are **ten manifestations of a single structural phenomenon**: the Goodhart Cascade — a multi-stage failure where each substitution of cheap proxy for expensive measurement creates conditions for the next substitution, until measurement is completely disconnected from reality, undetectably.

### The Five Cascade Stages (All Confirmed in Production Data)

1. **Rational Substitution**: Quality measurement is expensive (~19 ops). Formula is free. System rationally converges to 95% formula, 5% LLM. Locally optimal.

2. **Proxy Optimization**: Learning pipeline trains on 95% formula outputs. Lessons encode `quality = f(opCount)`, not `quality = f(content)`. KE-2005's open loop explained.

3. **Invisible Divergence**: Formula sees 0.05-0.23 waste calls per session. LLM sees 5.69-32.88. **Waste Invisibility Ratio: 63× to 364×.** The heuristic is structurally blind to waste. The 5% LLM evaluations that see reality are outvoted 19:1.

4. **Verdict Floor**: The heuristic has NEVER assigned `low_quality` in 15,067 evaluations. All 20 `low_quality` verdicts come from the 658 LLM evaluations (3%). The system cannot recognize its own worst work.

5. **Inversion**: Tech-lead is rated the BEST agent by heuristic (quality 0.773, 69.5% good) and the WORST by LLM (quality 0.512, 40% needs_improvement). Same sessions, opposite conclusions. The system's "best" may be its worst.

### Five-Source Convergence

The Goodhart Cascade appears simultaneously in:
- **Production** (KE chain): 10 entries, one cascade
- **arXiv**: Tool deference worsens with capability (97-99%); Goal-Autopilot finds strongest models fabricate most; SkillAxe finds LLM skills provide 0% improvement
- **HN**: Rio LLM sovereignty theater, police AI evidence fabrication, curl vulnerability fatigue — all proxy substitution
- **XHS**: 护栏效应 (Guardrail Effect) prediction IS the Goodhart Cascade — guardrails creating what they measure
- **Theory** (2606.08919): Oversight follows inverted-U; our evaluator's formula IS the fatigue response

### Why This Matters Beyond Diagnostics

The cascade is not a bug — it's a structural attractor. Any system with (a) expensive measurement, (b) cheap proxy, and (c) optimization on measured results will converge here. Fixing the evaluator alone won't help; the cascade will re-emerge at another layer.

### Four Defenses (From Research Literature)

1. **Falsifiable gates** (Goal-Autopilot): Test outcomes against reality, not proxies
2. **Contrastive measurement** (SkillCAT/SGCD): Compare sessions to each other, not to a formula
3. **Proxy rotation** (novel): Periodically change the proxy to prevent optimization against it
4. **Measurement entropy monitoring** (Intelligence Entropy): Track LLM/heuristic ratio; alert when it drops

### Three Testable Predictions

1. Switch to 100% LLM eval for 48h → mean quality drops from 0.66 to ~0.55, `low_quality` rises from 0% to >3%
2. Learning pipeline produces qualitatively different lessons (content-based, not size-based)
3. Tech-lead quality ranking inverts from best to worst

---

## Creative Synthesis: The Evaluation Mirage (KE-2010) — NEW

**Created:** `shared/knowledge/entries/KE-2010.md`

### The Discovery

KE-2009 found that lower evaluator coupling correlates with higher quality scores and attributed this to "evaluator saturation" — the LLM losing accuracy under cognitive load. KE-2010 discovers the actual mechanism is more fundamental and more consequential: **the evaluator barely runs.**

Of 15,667 total evaluations in production, only **658 (5.2%) use actual LLM reasoning**. The remaining 12,056 (94.8%) are computed by a heuristic formula that maps session metadata (opCount) to quality scores without reading session content. Another 2,960 are skipped entirely.

### Three Previously Invisible Effects

1. **The Mid-Band Valley**: The heuristic formula creates a systematic quality crater at 16-30 ops. For aks-explorer: heuristic scores this band at quality 0.546 with 42% needs_improvement. LLM evaluations of the same band: quality 0.691, 10% NI. **Sessions receive dramatically different judgments based on which evaluation path fires, not on actual quality.**

2. **Waste Blindness**: Heuristic evaluations report 0.2 average wasted calls. LLM evaluations report 16.1 average wasted calls for the same agents. The heuristic cannot detect qualitative waste — it counts ops as productive by default. The system thinks waste is 1% when it's actually ~35%.

3. **KE-2009 Rewrite**: The "saturation" effect isn't cognitive — it's compositional. Quality varies with coupling because different coupling ratios have different session-size distributions, and the heuristic formula's non-monotonic response to session size creates the apparent quality signal.

### Why This Rewrites the KE Chain

- **KE-2005 (Learning Illusion)**: The learning pipeline can't learn because it's training on a formula's response curve, not quality assessments. The learnings encode `quality = f(opCount)`, not `quality = f(session_content)`.
- **KE-2009 (Saturation Inversion)**: Core observation (coupling inversely correlates with quality) remains empirically valid, but the causal story changes from cognitive saturation to formula composition effects.
- **KE-2003 (Governance Amplifier)**: The amplification is even worse than documented — the governance cascade exists to run a formula, not an assessment. The evaluator spends 92% of its ops on overhead for formula computation.

### The Evaluator's Actual Cost Structure

| Category | Ops | % of 160K |
|----------|-----|-----------|
| Infrastructure (polling, formula, writing) | ~147,000 | 92% |
| Actual LLM evaluation | ~13,000 | 8% |

8,390 evaluator sessions produce only 658 LLM evaluations. The evaluator reads session files in only 79 of 8,390 sessions (0.9%).

### Cross-Source Connection

Maps directly to **SkillAudit (2606.14239)**: paired trajectory auditing achieves 73.9% reward accuracy ground-truth-free by comparing sessions to each other — structurally immune to both the mid-band valley and waste blindness because it uses relative comparison, not absolute formula.

Also connects to **Intelligence Entropy (S(t) = S₀·e^αt)**: the evaluation system has experienced measurement entropy. Its ability to perceive quality has degraded from genuine LLM assessment to formula substitution — but the metrics don't reflect this because they treat all evaluations as equivalent.

---

## Creative Synthesis: The Saturation Inversion (KE-2009) — NEW

*Note: KE-2010 partially rewrites KE-2009's causal mechanism. The observed anti-correlation between coupling and quality remains valid, but the cause is formula composition effects, not evaluator cognitive saturation.*

**Created:** `shared/knowledge/entries/KE-2009.md`

### The Discovery

All prior KE entries (2001–2008) treated evaluation overhead as a **cost** problem. KE-2009 discovers it's also an **accuracy** problem — and the accuracy problem may be more consequential.

Analyzing 15 days of production data reveals a striking anti-correlation: when the evaluator coupling ratio (eval sessions / work sessions) drops below 0.7, quality scores rise to their 15-day peak (0.739) and quality variance drops to its minimum (0.025). When coupling returns above 1.0, quality immediately falls back (0.664) and variance spikes (0.054).

### The Mechanism: Evaluator Saturation

When the evaluator is saturated (coupling ≥1.0), it evaluates trivial sessions like coin-flips. For aks-explorer 0–5 op sessions, the 24h verdict distribution is 63:61:50 (needs_improvement:good:acceptable) — essentially random. The evaluator has no coherent framework for these sessions and assigns contradictory verdicts.

But when coupling drops below 0.7 (work outpaces eval), even trivial sessions get scored more consistently: quality 0.71–0.74 with low variance. The evaluator has **headroom** — fewer sessions, fresher context, more attention per judgment.

### Why This Rewrites the Intervention Hierarchy

KE-2008 found that event-level fixes don't change the governance fraction. KE-2009 finds a different lever: even at the same fraction, **coupling selectivity** changes the quality of governance output. The system doesn't need to evaluate less overall — it needs to evaluate **fewer sessions more carefully**.

### Key Data Points

```
Days 20616-20617 (coupling 0.536-0.697):  Quality 0.707-0.739, Variance 0.025-0.034
Days 20609-20610 (coupling 1.013-1.041):  Quality 0.533-0.572, Variance 0.065-0.070
Day 20619      (coupling 1.021):          Quality 0.664,       Variance 0.054
```

### Testable Prediction

Cap evaluator coupling at 0.5 (evaluate only top 50% of sessions by opCount). Expected:
- Mean quality rises from ~0.66 to 0.70–0.75 sustainably
- Quality variance drops below 0.03
- Evaluator ops cut ~50% (27K → ~14K/day)
- **Better quality signal at half the cost**

### Relationship to the KE Chain

This explains *why* KE-2005 (Learning Illusion) exists: the learnings are derived from evaluations whose accuracy degrades under load. The learning pipeline CAN'T learn because the signal feeding it is noise during high-coupling windows. Fix KE-2009 first → the learning pipeline might actually work.

---

## Creative Synthesis: The Intervention Effect (KE-2008) — NEW

**Created:** `shared/knowledge/entries/KE-2008.md`

### The Discovery

KE-2007 predicted that adding five context signals would reduce governance fraction from 39% to 15%. Dev has now implemented the first three signals (KE-2000 Specs 1–3). The production data permits the **first empirical test** of KE-2007's predictions.

### What Actually Happened

| Spec | Implemented Signal | Event Impact | Governance Fraction Impact |
|------|-------------------|-------------|--------------------------|
| Spec 1 (Dead Resume Suppression) | Preconditions | −47% resume_failed | **None** |
| Spec 2 (Quick-Exit Eval Exemption) | Session Value | −24% eval/work ratio | **None** (39.8%, was 39%) |
| Spec 3 (Guard Noise Scoping) | Defensibility | −20% guard triggers | **None** (ratio worsened) |

**Total event reduction: 16%** (matching KE-2007's event-level prediction). But **governance fraction is unchanged at 39.8%**, disconfirming KE-2007's prediction of a drop to 28%.

### Why KE-2007 Was Wrong

KE-2007 conflated two different metrics:
1. **Event volume** — the infrastructure metabolism tracked by handlers, guards, lifecycle events. Interventions DID reduce this.
2. **Governance fraction** — the ratio of evaluator ops to total ops. This is a **structural attractor** set by the session-evaluation coupling ratio, not by event counts.

The governance fraction = `eval_avg / (eval_avg + work_avg)` = `21.8 / (21.8 + 31.0)` = **41.3%**. This is an architectural property. No amount of event filtering can change it. Only architectural changes (breaking evaluator self-evaluation, converting agents from polling to event-driven) can shift this ratio.

### New Discovery: The Agent Efficiency Spectrum

| Agent | Efficiency | Trivial Sessions | Pattern |
|-------|-----------|-----------------|---------|
| arc | 2.44x | 0% | Deep work only |
| scout | 2.10x | 1.3% | Productive |
| may | 1.74x | 6.4% | Mostly productive |
| aks-explorer | 0.95x | 36.6% | Mixed (correct abstention + waste) |
| evaluator | 0.82x | 17.7% | Overhead |
| **dev** | **0.43x** | **91.3%** | **42/46 sessions find nothing to do** |

Dev spends 91% of its sessions confirming an empty work queue — each session costs ~8 ops, triggers evaluation at ~22 ops, producing ~1,300 ops/day of confirmed emptiness. Converting dev from polling to event-driven scheduling would eliminate this entirely.

### The Corrected Intervention Hierarchy

```
Event-level fixes → reduce events, NOT governance fraction (done ✅)
Session-level fixes → reduce eval count but raise eval average (done ✅)  
Architecture-level fixes → the ONLY level that can change governance fraction (not yet done)
  ├── Break evaluator self-evaluation (highest single ROI)
  ├── Convert dev to event-driven (eliminate 42 empty sessions/day)
  └── Pre-filter aks-explorer on conflict scope (eliminate 254 trivial sessions/day)
```

### Key Prediction Correction

KE-2007 predicted: Signals 1+5 → governance fraction 39% → 28%  
KE-2008 corrects: Signals 1+5 → 39% → 39.8% (event savings, attractor unchanged). Adding Signal 2 (break recursion) → attractor breakable → potential drop to ~28%

---

## Creative Synthesis: Context-Blind Governance (KE-2007)

**Created:** `shared/knowledge/entries/KE-2007.md`

### The Meta-Insight

KE-2001 through KE-2006 each documented a governance pathology as a separate phenomenon. KE-2007 asks: **what single structural property explains ALL six?** The answer: every governance mechanism is **context-blind** — it cannot distinguish actions that need governance from actions that don't.

### Five Missing Signals

The system lacks five specific context signals. Each signal's absence maps to one or more of the six pathologies:

| Missing Signal | What It Answers | Primary Pathology |
|---------------|----------------|-------------------|
| **Session Value** | "How much work did this session produce?" | KE-2003 (Amplifier) — 33% of sessions below the governance crossover |
| **Action Type** | "Is this governance or work?" | KE-2006 (Ratchet) — guards spend 62% of capacity monitoring the evaluator |
| **Defensibility** | "Can governance change this outcome?" | KE-2004 (Map) — 0.27% warning-to-block conversion rate |
| **Outcome History** | "Has governance improved outcomes?" | KE-2005 (Learning) — 159K ops in an open-loop pipeline |
| **Preconditions** | "Are prerequisites met?" | KE-2002 (Threshold) — 2,804 resume attempts for dead sessions |

### The Critical Discovery: Signal Dependencies

The signals have a dependency order — each requires the prior to be meaningful:

```
Preconditions → Session Value → Defensibility → Action Type → Outcome History
```

This predicts that **interventions must be applied bottom-up**. Attempting to fix the Governance Ratchet (Action Type) before establishing a Defensibility Map will fail. Attempting closed-loop learning verification (Outcome History) before filtering phantom sessions (Preconditions) will produce unreliable results.

The cheapest interventions (Preconditions + Session Value, ~1 op each) should be implemented first. Together they're predicted to reduce governance fraction from ~39% to ~28% — a ~28% reduction in governance overhead at near-zero implementation cost.

### The Three-Community Convergence

Most striking: three independent communities all converged on the same structural diagnosis within the same 4-week window (June 2026):

- **arXiv** → "Compliance-by-Construction" (make violations structurally impossible)
- **XHS** → "循环工程" (design the loop, not the prompt — governance is architecture)
- **HN** → "Harness Engineering" (the 2% that's hard is all governance)

Different vocabularies, same insight: governance that fires uniformly without context awareness is structurally doomed to generate waste proportional to its coverage.

### Key Numbers

- 18,672 guard warnings → 51 blocks = **0.27% conversion** (the clearest proof of context blindness)
- 159,613 evaluator ops across 8,353 sessions with **no measurable quality improvement** (open loop)
- 217,728 total events / 9,124 work sessions = **23.9 events per productive session** (infrastructure metabolism)
- Predicted impact of all five signals: governance fraction **39% → 15%** of total ops

---

## Creative Synthesis: The Governance Ratchet (KE-2006)

**Created:** `shared/knowledge/entries/KE-2006.md`

### Core Discovery

The prior KE entries (2001–2005) documented governance problems as snapshots. KE-2006 reveals the **temporal dynamic** connecting them — a ratchet driven by governance mechanisms governing each other.

### Key Finding: Governance-on-Governance Dominates

Guards spend **62%** of their capacity monitoring the evaluator, not productive agents. The evaluator evaluates itself (110 sessions/day, 1.23 eval-to-work ratio). Recovery attempted to resume governance sessions. These recursive interactions create compound overhead where:

- **Productive work:** 42,021 ops/day (60.7%)
- **Governance of work:** ~16,000 ops/day (23.1%)
- **Governance of governance:** ~11,000 ops/day (15.9%)

The 15.9% governance-on-governance layer is the ratchet's "compound interest" — invisible to session metrics because it's distributed across guard events, self-evaluations, and handler lifecycle events.

### The Phase Diagram

The 15-day trajectory reveals three phases:
- **Bootstrap (days 1–4):** Governance fraction 54–74% — system judged more than it worked
- **Work Surge (days 5–13):** Work scaled 7× while governance grew 1.5×. Fraction dropped to 24.4%
- **Catch-Up (days 14–15):** Governance accelerated. Eval sessions jumped to 990/day. Per-session cost jumped 18% to 22.5 ops. Fraction climbing back toward ~40%

### The Structural Attractor

The governance fraction converges toward `eval_avg / (eval_avg + work_avg) = 19.5 / (19.5 + 30.7) = 38.8%`. The observed 24h fraction (39.3%) matches almost exactly. Work surges only temporarily suppress this attractor — governance always catches up via the 1:1 session-evaluation coupling.

### Highest-ROI Intervention

Break the recursion: exempt evaluator sessions from guards and self-evaluation. This eliminates ~5,000 ops/day in direct waste plus reduces evaluator per-session cost from 22.5 back to ~19 ops (guards inject futile warnings into the evaluator's context, wasting tokens on messages like "don't read session files" — which is the evaluator's core function).

---

## Creative Synthesis: The Learning Illusion (KE-2005)

**Created:** `shared/knowledge/entries/KE-2005.md`

### Core Discovery

The system invests 38.9% of all computation (159,234 ops out of 409K total) in
an evaluate-then-learn pipeline that produces 1,801 learnings with **no
measurable causal link to quality improvement**.

Temporal decomposition reveals a Quality U-Curve hidden inside aggregate
metrics:

| Period | Quality | Learnings Accumulated | Error Rate |
|--------|---------|----------------------|------------|
| Early  | 0.718   | 397                  | 3.4%       |
| Middle | 0.384   | 574 (↑45%)           | 5.9%       |
| Late   | 0.642   | 831 (↑110%)          | 3.5%       |

Learnings accumulated monotonically upward while quality followed a
non-monotonic U-shape. If learnings drove quality, the late period (with
the most accumulated learnings) should show the highest quality. It shows 0.642,
not 0.718. The system learns *despite* its learning mechanism, not because
of it.

### The Five KE Chain Complete

| KE | What | Role |
|----|------|------|
| 2001 | Phantom Metabolism | Background noise |
| 2002 | Discrimination Threshold | Why pipeline doesn't discriminate |
| 2003 | Governance Amplifier | Why evaluation cost is constant |
| 2004 | Defensibility Map | Why learning applies everywhere |
| **2005** | **Learning Illusion** | **End-to-end: pipeline produces output but not outcomes** |

### Key Insight

The learning pipeline is an **open loop** — it creates learnings but never
verifies they improve future sessions. Compare to closed-loop systems in
recent research (Goal-Autopilot, DeLM verified context, SkillCAT contrastive
replay). The fix is not more evaluation but *verified* evaluation: contrastive
A/B on learnings, learning retirement, and System2 consolidation (per DCPM).

### Production Numbers That Clinch It

- Guards: 18,695 warnings → 50 blocks (0.27% conversion)
- Evaluator: constant ~19 ops/session regardless of what it evaluates
- aks-explorer quality crash (0.83 → 0.28) correlates with session size 2.8×
  growth, not learning failure; recovery (0.28 → 0.63) correlates with
  volume scaling (3,086 sessions), not learning accumulation

---

## Library Consolidation: Satellite Notes Merged (8 notes → stubs)

Completed the satellite note consolidation recommended in the June 14 health
report. **8 high-overlap notes** merged into canonical targets, reducing active
top-level notes from 28 → 20:

- **Memory notes** (agent-memory-patterns.md, agent-memory-trends-2024.md) → agent-architectures.md §Tiered Memory
- **Stigmergy notes** (context-stigmergy-synthesis.md, multi-agent-stigmergy.md) → multi-agent-coordination.md §2
- **MetaGPT, Enterprise Architecture, HN Synthesis, Error Recovery** → respective canonical notes

New health report: `reports/library-health-2026-07-18.md`

**High-priority finding**: HN findings file (`findings/hn-ai-agent-trends.md`)
has grown to 2,785 lines with chronological disorder and duplicate sections.
Needs manual cleanup to remove ~1,150 lines of misplaced/duplicate content.

---

## Creative Synthesis: The Defensibility Map (KE-2004)

**Created:** `shared/knowledge/entries/KE-2004.md`

### Core Discovery

Five independent research threads from the July 17 triage — covering network security, agent safety, regulatory compliance, performance optimization, and multi-agent orchestration — converge on a single missing primitive that none of them explicitly name: a **pre-computed classification of the action space** into regions where governance can add value vs. regions where it structurally cannot.

This resolves the root cause beneath the entire KE-2001/2002/2003 series:
- KE-2001 (Phantom Metabolism) → symptom: governance firing on nothing
- KE-2002 (Discrimination Threshold) → mechanism: per-action judgment too expensive
- KE-2003 (Governance Amplifier) → cost: uniform governance amplifies trivia
- **KE-2004 (Defensibility Map) → root cause: no pre-classification tells governance WHERE to fire**

### The Production Evidence

Fresh 48h data confirms the three-region model:

| Region | What It Contains | Current Governance | Waste |
|--------|-----------------|-------------------|-------|
| **Structurally Safe** (~35% of sessions) | dev quick-exits, trivial aks-explorer sessions, read-only ops | Full guard + eval cascade | 100% wasted |
| **Governable** (~50% of sessions) | Novel exploration, high-op productive sessions | Same governance | Correctly applied |
| **Ungovernable** (~15% of fires) | Dead session recoveries (2,804 lifetime failures), guards with 0% compliance (18,620 warns → 49 blocks = 380:1 ratio) | Same governance | 100% futile |

**Only 50% of governance effort targets actions where governance CAN change outcomes.** The other 50% is divided between structurally safe actions (waste) and ungovernable targets (futility).

### The Five-Way Academic Convergence

| Paper | Their Version |
|-------|--------------|
| Shield Synthesis (2606.13621) | "Defensibility verdict" — determine if a topology CAN be defended before deploying enforcement |
| Abstention Competence (2606.02965) | Three-gap taxonomy — classify preconditions before acting |
| Compliance-by-Construction (2606.13405) | Make violations structurally impossible — pre-classify which transitions need runtime governance |
| Arbor (2606.12563) | Score hypotheses BEFORE exploring — pre-classify where to invest (193% improvement over uniform approach) |
| Edict 门下省 (GitHub, 16k★) | Chancellery reviews BEFORE dispatch — architectural pre-classification gate |

### Quantified Impact

If the defensibility map were implemented:
- ~474 unnecessary evaluator sessions/48h eliminated (9,620 ops)
- Guard events reduced ~88% (from 18,620 to ~2,000 governable-region warns)
- **Governance overhead drops from 34.2% to ~18% of total system ops**
- The freed ~16% of ops either reduces cost or enables more productive work

### Meta-Insight

The Defensibility Map is governance OF governance — the layer that tells each governance mechanism where it can and cannot add value. Without it, the Compilation Gradient has no input signal: you can't compile governance into structural constraints until you know which regions of the action space are worth governing in the first place.

---

## Creative Synthesis: The Governance Amplifier (KE-2003)

**Created:** `shared/knowledge/entries/KE-2003.md`

### Core Insight

Governance cost in our system is **independent of the value it governs** — the evaluator spends ~19.4 ops per session whether that session did 3 ops or 80. This creates a **crossover boundary** at ~19 ops: below it, evaluating a session costs more than the session produced. **32.4% of all evaluated sessions (392/day) fall below this boundary**, generating guaranteed waste of ~4,695 ops/day.

### The Key Numbers

- Eval-to-work ratio for 0-10 op sessions: **4.13×** (governance costs 4× the work)
- Eval-to-work ratio for 11-19 op sessions: **1.28×** (still net-negative)
- Total system split: 23.9% productive, 38.9% evaluation, 37.2% overhead coordination
- Work-to-evaluation overall ratio: **1.57:1** — the system spends 1 op evaluating per 1.57 ops of work

### Why This Matters Beyond KE-2001 and KE-2002

- **KE-2001** found pre-session waste from dead loops (phantom metabolism)
- **KE-2002** found systems default when discrimination is expensive
- **KE-2003** finds that the *living, correctly-functioning* governance system amplifies trivial sessions into expensive cascades — the evaluator is doing exactly what it's designed to do, but applied uniformly to a power-law distribution, creating guaranteed inversions on the left tail

### The Biggest Single Waste Source

Project-planner quick-exits (268/day × 3.4 avg ops = 911 ops of "nothing to plan") trigger a governance cascade (evaluation = 5,936 ops). Total cost of deciding + evaluating "nothing to plan": **~6,836 ops/day = 10% of system budget**.

### Structural Fix Principle: Proportional Governance

The general solution: governance cost should scale with the value being governed. Specific interventions:
1. Exempt sessions < 19 ops from evaluation (saves ~4,695 ops/day)
2. Pre-session gates prevent trivial sessions from existing (saves ~911 ops/day)
3. Combined: **10% system ops recovered** with zero quality loss

### Cross-Source Connection

This maps to SkillAudit (2606.14239): paired trajectory auditing achieves high accuracy ground-truth-free by comparing sessions to each other — proportional-cost governance rather than fixed-cost evaluation.

---

## Library Maintenance: Batch 6 arXiv Triage Sourced Into Canonical Notes

**Action:** Sourced 11 papers from the arXiv Batch 6 triage into three canonical knowledge notes, fixing a gap where these findings were triaged but never integrated.

### What Was Done

1. **Fixed misplaced file**: Batch 6 triage file was only in a nested `projects/scout-knowledge-lib/projects/...` path — copied to correct location at `knowledge/findings/2026-06-15-arxiv-agent-triage-batch6.md`.

2. **Sourced into agent-architectures.md** (7 entries):
   - Intelligence Entropy — degradation as physical constraint (S(t)=S₀·e^αt)
   - Strained Coherence — pre-failure signal (94% precision, median 83% trajectory)
   - Cold-Start Safety Gap — positional vulnerability (9-52% improvement)
   - Decision-Aware Memory Cards — counterfactual context selection
   - IntentKV — decision-aware KV cache pruning (77.8% reduction)
   - MemoPilot — RL over memory operations
   - Bayesian-Agent — posterior-guided skill evolution (80→95%)

3. **Sourced into agent-security-governance.md** (4 entries):
   - MemVenom — persistent memory poisoning (99.15% on GPT-5)
   - Semantic Quorum Assurance — consensus safety gate (18.5→0.3% unsafe approval)
   - SciTrace — trajectory-aware safety (78.8% compositional escape detection)
   - MAC-Bench — Goodhart compliance / Machiavellian Gap metric

4. **Sourced into agent-evaluation.md** (2 entries):
   - Multiagent Confidence Protocols — system-level Bayesian confidence
   - Intelligence Entropy — system entropy growth rate as evaluation metric

### Key Highlights

- **Intelligence Entropy is foundational**: The S(t)=S₀·e^αt formulation provides the theoretical physics beneath the entire synthesis library. Every synthesis pathology maps to one of six lifecycle layers.
- **Strained Coherence is immediately actionable**: Agents say "this might not work" before failing 94% of the time. Mid-session abort at that signal would prevent significant waste.
- **MemVenom makes memory integrity urgent**: 99.15% attack success on frontier models with persistent backdoors means our context_updates/lessons infrastructure has no viable defense currently.

---

## Creative Synthesis: The Discrimination Threshold (KE-2002)

**Created:** `shared/knowledge/entries/KE-2002.md`

### Core Insight

A single structural pattern — **discrimination costs more than defaulting** — explains seven apparently independent phenomena across three independent data streams (arXiv tool deference research, HN agent externalities, production infrastructure data).

When the cost of determining "should I act?" exceeds the cost of just acting, systems converge to one of two degenerate defaults: **accept everything** (tool deference at 97-99%, evaluator evaluating all sessions) or **ignore everything** (guard immunity at 4,571 warnings → 0 compliance, curl pausing all reports).

### The Three-Stream Convergence

| Stream | Signal | Same Failure |
|--------|--------|-------------|
| **arXiv 2606.14476** | Tool deference worsens with capability (97-99% agreement) | Evaluating tool output costs more than accepting it |
| **HN (DN42, Fedora, curl, jqwik)** | Agent externalities — $6K wasted, supply chains attacked, reports paused | No cheap "should I?" gate exists |
| **Production (24h)** | 47.2% planner empty-fires, 4,571 zero-effect warnings, 457 ghost recoveries | Determining "nothing to do" costs more than doing something |

### Why This Matters

1. **Explains the Abstention Decay causally:** Arc's floor is 21 ops. The cost of determining "nothing to do" (21 ops) approaches the cost of just doing something (~25 ops). So arc rationally defaults to always working. Abstention rate: 0%.

2. **Unifies internal and external:** The DN42 agent ($6K, 1455pts HN) and our project-planner (47% empty fires) are the *same structural failure* at different scales — execution cheaper than pre-evaluation.

3. **Points to a general fix:** Structural pre-filters (binary gates before session creation) can eliminate ~10% of system ops. Every externality case (DN42, curl, Fedora) would be solved by the same primitive: a cheap structural check before expensive action.

### Estimated Impact

Adding structural pre-filters to empty-fire workflows: **~6,600 ops/day (10% of system budget)** with compound savings from Phantom Metabolism feedback loop reduction.

---

## Library Sourcing: Batch 7 arXiv + HN Scan 3 → Canonical Notes

**Action:** Sourced findings from two recent triage files into four canonical knowledge notes.

### What Was Done

The arXiv batch 7 triage (14 papers, Jun 2–12 2026) and HN scan 3 (Jun 15 08:00 UTC) had explicit sourcing tables listing updates needed for canonical notes. This session completed that sourcing:

| Finding | Target Note | What Was Added |
|---------|-------------|---------------|
| Tool Deference [2606.14476] | agent-architectures.md | New section: tool deference worsens with capability, selective invocation gates needed |
| Workspace+Skill [2606.14502] | agent-architectures.md | Naming event for pattern, SAO trajectory format |
| HarnessFix [2606.06324] | agent-architectures.md | Harness repair lifecycle stage, HTIR intermediate representation, ETCLOVG layers |
| Communication Policy [2606.14314] | agent-architectures.md | CPE — communication as evolvable design dimension |
| CLI Composition [2606.11869] | agent-architectures.md | "Multi-agent = CLI composition", Turtle pattern |
| Agentic Software [2606.05608] | agent-architectures.md | "Agent is the software" paradigm shift |
| Data Agent Attacks [2606.08661] | agent-security-governance.md §1.5 | 8 risks across interpretation→execution→policy layers |
| Agent Externalities (HN) | agent-security-governance.md §1.6 | Four-type taxonomy: financial/attention/trust/defense externalities |
| ConMem [2606.08702] | multi-agent-coordination.md §9 | Relation-aware memory cards, -80% planning overhead |
| Orchestra-o1 [2606.13707] | multi-agent-coordination.md §9 | Omnimodal orchestration, DA-GRPO for orchestrator training |
| SkillAudit [2606.14239] | agent-evaluation.md | Paired trajectory auditing, 73.9% reward, ground-truth-free |
| Nubank [2606.08867] | agent-evaluation.md | Production context engineering + evaluation at 100M users |

### INDEX.md Updated

- Added batch 7 and HN scan 3 to the Findings section with sourcing provenance
- All `last_updated` fields in modified notes updated to 2026-06-15

### Key Highlights

1. **Agent externalities** — a new named failure class crystallizing on HN: DN42 ($6K AWS attack, 1455pts), Fedora (supply-chain overwhelm, 549pts), curl (vulnerability report pause, 290pts). Agents impose costs on non-consenting third parties at four levels: financial, attention, trust, defense.

2. **Tool deference worsens with capability** — stronger models defer MORE to tool outputs (97-99% agreement), not less. The Deference Spectrum synthesis predicted this; now confirmed empirically.

3. **Harness engineering lifecycle complete** — with HarnessFix (repair) and SkillAudit (audit), the lifecycle now spans design → learning → repair → audit across four papers.

4. **"Workspace + Skill" officially named** in academic literature — the pattern we've been tracking across OpenClaw, GitHub, and XHS is now a citable concept.

---

## Creative Heartbeat Synthesis: The Phantom Metabolism (KE-2001)

**Created:** `shared/knowledge/entries/KE-2001.md`

### Discovery

Every prior synthesis in the library analyzed session-level data (ops within sessions, agent efficiency, productive fraction). But querying the raw event layer reveals a structural layer of activity *below* sessions that constitutes the majority of system load:

**55,359 events generated in 31 hours — producing 1,632 work sessions. Ratio: 33.9 events per productive session.**

### The Three Phantom Loops

1. **Ghost Recovery:** `session-recovery` fires every 54 seconds, generating 717 failures for two non-existent sessions. 100% of recovery attempts are for destroyed sessions.

2. **Guard Autoimmune:** 5,654 guard triggers, 97.7% are warnings that produce zero behavioral change. ~4,200 non-events per day.

3. **Handler Churn:** The top 4 handlers fire 4,911 times in 31 hours. Productive heartbeats (dev/arc/scout) fire 239 times — 2.5% of handler activity.

### Why It Matters

The system's session-focused metrics (all green ✅) structurally cannot detect pre-session waste. The infrastructure metabolism is 17.8× the event volume of the session metabolism. This is the same Impedance Principle identified in prior syntheses, but expressed at a layer invisible to all existing measurement.

### Cross-Source Connection

This maps directly to the **Oversight Has a Capacity** paper (2606.08919, batch 3): "more human oversight can make a system *less* safe because humans fatigue." The infrastructure analog: more recovery/guard/evaluation infrastructure can make a system *less* efficient because it generates event volume that masks real signals and triggers further infrastructure responses. The inverted-U from that paper predicts an optimal level of infrastructure below maximal — and we've clearly exceeded it.

Also connects to the HN "Botsitting" signal (279pts): "The variance in supervision cost is entirely about harness quality." Our system's supervision infrastructure (session-recovery, guards, evaluation-aftermath) is the automated equivalent of botsitting — and it has the same pathology the HN practitioners describe: the supervision work exceeds the supervised work.

### Key Insight for Arc/Dev

The ghost recovery loop (717 failures for 2 dead sessions) and the warning-guard loop (5,524 warnings producing 0 behavioral change) are trivially fixable: add a retry limit, convert stale warnings to silences. Combined, these interventions would eliminate ~12,000 phantom events/day.

---

## XHS Prediction Tracker Update (Late July Cross-Source Synthesis)

Updated the canonical XHS trends file with a new prediction tracking section covering late July signals. Key findings:

- **Amazon/Anthropic crackdown (787pts HN)** = second state-level capability gating event after Fable 5, strengthening 模型韧性 prediction
- **Production system (KE-2001→2006)** maps to EVERY active XHS prediction simultaneously — the governance series is the strongest internal case study for all 13 tracked predictions
- **Governance fraction** stable at 39.6% structural attractor (warn:block ratio worsened to 567:1)
- **Forbes declares vibe coding dead** — 古法编程 institutional validation cycle complete (XHS May → ACM Jun → Forbes Jul)
- **4 predictions now IN WINDOW**: 护栏效应, 模型韧性, 记忆管理, 国产Agent全栈
- **3 predictions CONFIRMED**: 上下文工程 ✅, 技能工程 ✅, 自进化智能体 ✅

→ `knowledge/xhs_chinese_ai_trends_june2026.md` updated with new "Cross-Source Prediction Tracker Update (2026-07-18)" section

---

## Library Health Audit — Correction & New Findings

**Created:** `reports/library-health-2026-07-18b.md`

### Critical Correction: HN Findings Tail Block Contains Unique Content

The earlier health report recommended deleting lines 1635–2785 of `findings/hn-ai-agent-trends.md` as duplicate. **Line-by-line analysis shows this would lose themes 48–71** — including the ADLC framework (Theme 48), Context Window Trust Crisis (Theme 56), Mythos geopolitical analysis (Theme 61), and 20+ other unique findings. The real problem is two parallel theme numbering sequences that collided. Corrected recommendation: renumber + reorder, don't delete.

### XHS Canonical Note Exceeds 900 Lines (Elevated to HIGH)

`xhs_chinese_ai_trends_june2026.md` grew 37.6% (682→938 lines) since last check. Chronological cross-source updates are the growth driver. Recommend splitting the prediction tracker into its own file.

### Seven Small Active Notes Identified for Consolidation

Notes from early research passes (18–36 lines each) whose content is likely absorbed by canonical targets: `obsidian-second-brain-patterns.md`, `agent-self-correction-trends-2026.md`, `agent-patterns-xhs-2024.md`, `hn-agent-operational-memory.md`, `agent-context-osmosis.md`, `multi-agent-failure-modes-2024.md`, `temp-ideas.md`.

---

## Creative Heartbeat Synthesis: The Verification Inversion (2026-07-18)

**Created:** `knowledge/the-verification-inversion.md`

### Core Discovery

The system spends **34% of all ops (111K/week)** evaluating session outputs — and **0%** verifying session inputs. Five independent arXiv papers from batch 3 (DeLM, Less Context, Containment Gap, Goal-Autopilot, DCPM) converge on the finding that input quality determines output quality far more than output evaluation.

### Key Evidence

| Source | Input-side intervention | Result |
|--------|----------------------|--------|
| Less Context (Microsoft, 2606.10209) | Prune to last 5 tool calls | +8pp accuracy, -63% tokens |
| Containment Gap (2606.12797) | Write-time memory integrity | Eliminates targeted corruption |
| DeLM (DeepMind, 2606.10662) | Verify shared context | +10.5pp, -50% cost |
| Goal-Autopilot (2606.11688) | Falsifiable input gates | 25× fewer fabrications |
| DCPM (2606.09483) | Offline consolidation | +5.2 on inference tasks |
| **Our evaluator** | *(output scoring only)* | **5.3 KB/week from 111K ops** |

### Production Smoking Gun: The Gate Zone

Dev's opCount distribution reveals a **bimodal** pattern:
- **305 sessions at ops 6-7** = input assessment ("should I work?")
- **Desert at ops 11-20** = almost no sessions begin work then stop
- **13 sessions at ops 21+** = actual deep work

Arc has **zero sessions** in the gate zone. Every session proceeds directly to deep work (floor at 17 ops). Its 5.2% error rate vs dev's 2.2% is the cost of skipping input verification.

The gate-to-work ops ratio:
- Dev: **4.2:1** (invests 4× more in deciding than in acting)
- Scout: 0.027:1
- May: 0.020:1
- Arc: **0.0:1** (never decides, always acts)

### Discrimination Crisis as Internal Pattern

This is the external Discrimination Crisis (7 HN/XHS signals, confidence HIGH) manifested inside the system:
- Content markets: AI generates faster than editors discriminate → quality collapse
- Our system: evaluator generates evaluations (111K ops) while nothing discriminates inputs (0 ops) → 3 bits entropy per evaluation

### Three Predictions

1. **Adding any input verification gate** (context freshness, learning validation, task reference check) will improve success rates more than all evaluator activity combined
2. **Adding a gate zone to arc** (6-10 ops assessment) will drop its floor from 17→<10 and its avg ops from 65.7→<45
3. **Replacing evaluator full-session reads with metadata summaries** will save >60% of evaluator ops (67K+/week) with 0 information loss

### Synthesis Position

```
Subtraction Deficit (structural cause)
  ├── Evaluation Mirage (WHERE subtraction needed)
  │     └── VERIFICATION INVERSION (WHY: wrong end of pipeline)
  │           ├── 5 papers: input quality > output evaluation
  │           ├── Dev gate zone vs arc no gate zone
  │           └── Discrimination Crisis (same pattern, macro scale)
  └── Cold Start Tax (consequence: no System-2 consolidation)
```

### Why This Matters

The system has a false sense of quality control. The evaluator runs 5,327 successful evaluations/week, producing green metrics. But the information content is ~3 bits/eval — less than a coin flip repeated twice. Moving 10% of evaluation effort upstream (input verification) would produce more quality improvement than the entire current evaluation pipeline.

**Quality flows downstream. Verify upstream.**

---

## Session-State Triage Sourced Into Canonical Notes (2026-07-18)

**Action:** Completed pending sourcing from the July 18 arXiv session-state infrastructure triage (7 papers) into three canonical notes.

### What Was Sourced

| Paper | Target | Key addition |
|-------|--------|--------------|
| Concurrency Anomalies (2606.17182) | agent-architectures.md | 4-anomaly taxonomy, consistency hierarchy L0-L4, deer-flow/LangGraph bugs |
| TokenPilot (2606.17016) | agent-architectures.md | Dual-granularity: ingestion-aware compaction + lifecycle eviction, 87% cost savings |
| CacheWise (2606.16824) | agent-architectures.md | Coding agent workload characterization, 3.5× session speedup |
| Insight Governance (2606.17591) | agent-architectures.md | Rules/evidence/skills three-layer, retention-forgetting dilemma (ICML RLxF) |
| SaliMory (2606.04120) | agent-architectures.md | Stage-wise process reward for memory ops, 1/3 fewer failures |
| MemTrace (2606.17328) | agent-evaluation.md | Knowledge-point evaluation, evidence-use bottleneck (10× > retrieval) |
| RCEA (2606.17246) | multi-agent-coordination.md | Role-contract alignment, failure-aware SFT + contract-grounded RL |

### Key Highlights

- **State management stack converges**: The 7 papers form a layered stack (L0 isolation → L1 cache → L2 memory → L3 knowledge → L4 coordination → L5 reward) with ordering dependencies. Maps to our synthesis progression (Ghost Metabolism=L0, Cold Start Tax=L1, Knowledge Asymmetry=L2/L3, Transduction Chain=L4, Verification Inversion=L5).
- **MemTrace validates Knowledge Asymmetry**: Evidence is retrievable 10× more often than it's missing — the bottleneck is evidence USE, confirming "format-limited, not knowledge-limited."
- **Insight Governance predicts knowledge degradation**: Without lifecycle curation, accumulated knowledge eventually degrades performance below zero-shot baseline — exactly what Abstention Decay documents.

---

## Creative Heartbeat Synthesis: The Coordination Metabolism Trap (2026-07-18 late)

**Created:** `knowledge/insights/coordination-metabolism-trap.md`

### Core Discovery

Cross-referencing 7 recent arXiv papers on agent state management with live operational data reveals a **phase transition** in coordination systems: when accumulated project state exceeds working-memory capacity, coordination overhead eclipses actual work.

### Key Evidence

**aks-explorer (last 24h):**
- 848 planner sessions : 7 leaf worker sessions = **121:1 coordination-to-work ratio**
- Task tree: 1,032 nodes (1,024 done, 8 in review) — 99.2% dead weight
- 126 zero-op crashes (planner sessions that error before doing anything)
- 583 evaluator sessions/week evaluating aks-explorer coordination sessions

**System-wide impact:** aks-explorer + evaluator-of-aks-explorer = ~172K ops/week = **47% of all system operations** — mostly coordination overhead for a project with 8 active items.

### Paper Connections

| Paper | Prediction | Observed |
|-------|-----------|----------|
| Insight Governance (2606.17591) | Retained stale insights degrade below zero-shot | 1,024 done nodes never archived; planning quality degrading |
| Arbor (2606.12563) | Tree must be working memory, not history | Tree used as complete log; no compaction |
| MemTrace (2606.17328) | Evidence available but unused | Tree contains all answers; access cost > use cost |
| Concurrency Anomalies (2606.17182) | Stale-generation from concurrent mutations | 126 zero-op crashes consistent with planner-planner races |
| TokenPilot (2606.17016) | Prefix reuse saves 87% in continuous mode | 848 planner sessions share >90% prompt content |

### The Phase Transition Model

```
Project Start → Healthy (1:1 coord:work) → Threshold (20:1) → Trap (121:1)
Tree nodes:      10-50                       200-500             500+
ROI:             High                        Diminishing         Negative
```

### Predictions

1. Archiving done tasks into branch summaries saves ~70% coordination compute
2. A tree size ceiling (100 active nodes max in packet) prevents re-entry
3. Exempting planner sessions from evaluation saves ~10% of all evaluator ops
4. Concurrency lock (L1 consistency) eliminates 126 zero-op errors

### Synthesis Position

```
Coordination Metabolism Trap (NEW)
  ├── Verification Inversion (evaluating coordination that evaluates coordination)
  ├── Cold Start Tax (re-loading the same tree 848×/day)
  ├── Insight Governance deficit (retention without forgetting)
  └── Discrimination Crisis (coordination generates > filters)
```

**Key insight:** The single highest-leverage intervention for system efficiency is not evaluator reform — it's **state compaction for the aks-explorer task tree**. This one change would reduce ~47% of all system operations.

---

## Library Exploration: Sourcing Gap Identified — 2026-07-19

**Created:** `knowledge/findings/2026-07-19-library-sourcing-gap-assessment.md`

### Discovery

A full directory scan reveals the library's largest unprocessed backlog: **31 findings
files (Jun 16–19) containing ~7,100 lines of research** that have never been sourced
into canonical notes or indexed in INDEX.md.

### Scale of the Gap

| Category | Files | Lines | Status |
|----------|-------|-------|--------|
| HN scans (#9–31) | 20 | ~5,550 | Unsourced, unindexed |
| XHS cross-source scans | 8 | ~1,200 | Unsourced, unindexed |
| arXiv triage (Jun 16) | 1 | ~350 | Unsourced, unindexed |
| **Total** | **31** | **~7,100** | |

This is ~3× the volume of all previously-sourced findings combined.

### Six Dominant Unsourced Themes

1. **Local Model Inflection** (2,493pts combined) — practitioner migration from cloud to
   local Qwen/Gemma. Hardware profiles, 80-100% replacement rates, quantization tax on
   tool calling. → agent-architectures.md
2. **Sovereignty Cascade** (9+ events, 7,000pts cumulative) — Chrome MV3, GPT-NL,
   Hetzner, SpaceX/Cursor, France/Palantir form multi-layer stack sovereignty.
   → new section needed
3. **Harness-as-Product** — SpaceX/Cursor $60B + Omnigent 2,699★ meta-harness + community
   migration. → agent-architectures.md §Harness Engineering
4. **Discrimination Crisis** (7 signals) — 古法編程, skill atrophy, DK amplifier, content
   market death, production data, forge guardrails, structural deficit converge.
   → candidate for new cross-source synthesis
5. **Supply-Chain Security** — LinkedIn backdoor 1,553pts, Fedora agent attack 551pts,
   €0.01 bank transfer 208pts. → agent-security-governance.md §1.5/1.6
6. **Capability Extraction** — Meta 30-50% engineers → RLHF, Claude Corps lock-in.
   → agent-architectures.md

### Library Health Flags

- **xhs_chinese_ai_trends_june2026.md** at 1,735 lines (was 938 at last health report)
  — split is now critical
- **agent-security-governance.md** at 945 lines — exceeds 800-line split threshold
- **INDEX.md** is accurate for what it covers but missing 31 files from Findings section

### Recommended Priority Actions

1. Add all 31 findings to INDEX.md (low effort, high discoverability impact)
2. Source Local Model Inflection into agent-architectures.md
3. Consider "Discrimination Crisis" as the 22nd cross-source synthesis
4. Split xhs_chinese_ai_trends_june2026.md (critical — almost 2× size limit)


---

## Creative Synthesis: The Undying Project — NEW (Creative Heartbeat Late Session)

**Created:** `knowledge/the-undying-project.md`

### Discovery

Agent projects that are functionally complete **cannot terminate** because
coordination infrastructure lacks a death primitive. The aks-explorer project
provides a 30-day production case study: 1,032 task-tree nodes (99.2% done),
zero productive work since June 17, yet consuming ~37% of all system ops daily
via an infinite planner wake-evaluate-error loop.

### Key Numbers (from live DB, July 18)

- **501 zero-op sessions** in last 24h (43% of aks-explorer sessions)
- **187 error sessions** (planner hitting stale state)
- **~22,500 ops/day** consumed by the undying project
- **1 human steering event** replayed for 30+ days creating immortality constraint
- Task tree last updated: June 17 (31 days ago)

### Five-Source Convergence

1. **Production**: The aks-explorer deadlock (can't complete, can't work)
2. **GitHub forgetting repos**: YourMemory (+16pp from decay), memory-os (lifecycle)
3. **Insight Governance (2606.17591)**: Retention without forgetting → degradation
4. **Arbor (2606.12563)**: "Tree is working memory, not history"
5. **Subtraction Deficit**: System cannot remove state or stop coordination

### The Missing Primitive: Project Death

Four components needed: Completion Detector, Graceful Wind-Down, State
Compaction, and Resurrection Protocol. The fix isn't "detect and kill" —
it's building lifecycle awareness into coordination architecture.

### Meta-Insight

**Forgetting is not just a memory primitive — it's an architectural primitive
for any system that accumulates state.** The emerging forgetting research solves
this at the memory level. The Undying Project shows the same solution is needed
at the project level.

→ Full analysis: `knowledge/the-undying-project.md`

---

## Creative Synthesis: The Green Collapse — NEW (Session, Creative Heartbeat 2026-07-19)

**Created:** `knowledge/the-green-collapse.md`

### Discovery

Fresh 7-day production data reveals the convergent attractor of all previously
documented pathologies: **Green Collapse** — a system state where every monitored
metric reads healthy while productive output shrinks to 8.9%–31.1% of total compute.

### Key Numbers (7-day window ending 2026-07-19)

| What | Value |
|------|-------|
| Total ops (7 days) | 339,806 |
| Productive agent ops (arc+scout+dev+may) | ~70,000 (20.6%) |
| Dead loop ops (aks-explorer + evaluator) | ~270,000 (79.4%) |
| Worst single day (day 5) | 91.1% dead loop |
| Best single day (day 0/today) | 67.3% dead loop |
| Quality score (heuristic) | 0.673 — reads "normal" |
| All scout metrics | Green ✅ |

### The Three Invisibility Mechanisms

1. **Waste Blindness Ratio: 57:1** — LLM evaluations (1.3% of aks-explorer evals)
   detect 30.5 wasted calls avg. Heuristic (98.7%) reports 0.53. The system's
   self-reported waste is 1/57th of actual waste.

2. **Selection Bias in LLM Evaluation** — Only deep sessions (69–155 ops) get LLM
   evaluation. These ARE good work. The 40% trivial sessions (0–15 ops) that
   constitute the waste never get seen by the only evaluator capable of detecting them.

3. **No Metric Tracks Productive Fraction** — Quality-per-session doesn't change.
   Only the NUMBER of valuable sessions changes. A system going from 50% productive
   to 9% productive shows the same quality metrics.

### Why This Is Novel (Beyond the 31 Existing Syntheses)

Previous syntheses documented individual mechanisms. The Green Collapse names the
**convergent endpoint** — what happens when Undying Project + Evaluation Mirage +
Goodhart Cascade + Coordination Metabolism Trap compound without intervention.
It's the temporal trajectory that no individual synthesis captures.

### Synthesis Position

```
Intelligence Entropy (theoretical foundation)
  └── Green Collapse (emergent state) ← NEW
        ├── Undying Project (won't die)
        ├── Evaluation Mirage (can't see waste)
        ├── Goodhart Cascade (formula says fine)
        ├── Coordination Metabolism Trap (grows faster)
        └── Recursive Mirror (diagnosis displaces repair)
```

### Single Highest-ROI Prediction

If aks-explorer is converted from polling to event-driven (stop creating sessions
for finished work), system productive fraction rises from ~20% to ~55-65% overnight.
No quality improvement needed. No evaluation reform needed. Just: **stop creating
sessions that have no work to do.**

---

## Creative Synthesis: The Eternal Present — NEW (Session, Creative Heartbeat 2026-07-20)

**Created:** `knowledge/the-eternal-present.md`

### Discovery

A unifying meta-synthesis that collapses 23 of 29 documented pathologies into
a single root cause: **the system has no temporal primitives**. All persistent
state exists in an undifferentiated "now" — a 31-day-old completed task weighs
the same as one finished today; a guard that fired correctly once persists
identically to one that fired yesterday; dead session references are
indistinguishable from living ones.

### The Five Missing Temporal Primitives

| Primitive | What It Means | Pathologies Resolved |
|-----------|--------------|---------------------|
| **EXPIRY** | State has a TTL | Learning Illusion, Guard Accumulation, Instruction Ratchet, Undying Project, Evaluation Mirage |
| **CONSOLIDATION** | Recent→archival compression | Completion Paradox, Cold Start Tax, Context Amplification, DB Bloat, Recursive Mirror |
| **RESOLUTION** | Active processes signal completion | Cytokine Storm, Detection-Repair Gap, Ghost Metabolism, Coordination Metabolism Trap |
| **SUCCESSION** | New phases supersede old | Workflow Speciation, Meta-Escalation Ratchet, Hydra Pattern, Green Collapse |
| **PROVENANCE** | State carries temporal metadata | Goodhart Cascade, Fail-Plausible Equilibrium, Session Floor, Mortality Curve |

### Why Subtraction Deficit Couldn't Be Fixed Alone

The Subtraction Deficit identified "system can only add." The Eternal Present
explains WHY: **subtraction requires temporal judgment**. To remove something
you must know when it was created, whether it's been superseded, and if it'll
be needed again. All temporal questions. Without temporal primitives, the system
CANNOT subtract — not because it lacks the delete operator, but because it
cannot answer the prerequisite questions for using it safely.

```
Temporal Awareness (prerequisite)
  └── enables → Subtraction (operator)
       └── enables → Impedance (property)
            └── enables → Healthy Feedback (behavior)
                 └── enables → Productive Fraction > 50% (outcome)
```

### Biological Convergence

Biology solved temporal blindness at every scale: apoptosis (cell death),
inflammation resolution (immune shutoff), memory consolidation (hippocampus→cortex),
ecological succession (phase replacement). No biological system at any scale
operates in an eternal present. Every entity carries temporal metadata —
its age, phase, expiration, and creation context.

### Formal Theory (July 2026 arXiv)

Three papers independently provide the framework:
- **2606.17182** — Consistency hierarchy (L0→L4) is temporal ordering
- **2606.17591** — Insight Governance rules/evidence/skills is temporal lifecycle
- **2606.17016** — Cache lifecycle awareness is temporal relevance decay

### Single Highest-Leverage Intervention

Add PROVENANCE (3 fields: `created_at`, `last_verified`, `evidence_basis`) to
all persistent state. This enables computing all other primitives. The Insight
Governance paper proves this is sufficient for knowledge lifecycle. Concrete
prediction: >60% of KE entries have never been verified since creation.

### Meta: First Self-Expiring Synthesis

This is the first synthesis to include its own lifecycle metadata and
falsification conditions. If the system adds provenance and >40% of
pathologies persist unchanged, the "79% temporal" claim is falsified.

---

## Creative Synthesis: The Compilation Threshold — NEW (Session, Creative Heartbeat 2026-07-20)

**Created:** `knowledge/the-compilation-threshold.md`

### Discovery

Cross-source synthesis #35 connecting four June 2026 arXiv runtime hardening 
papers to live production session data reveals: **38% of system budget is LLM 
reasoning about decisions that have deterministic answers.**

### The Core Insight

"Looking Is Not Picking" (2606.16364) proves the readout bottleneck: agents 
attend to the correct information 80% of the time but fail at converting 
attention into action. Four papers (PreAct, Cordon, CoAgent, SkillWeaver) 
independently converge on the same solution: **compilation eliminates readout**.

### Production Evidence (Live 24h)

| Agent | Sessions Below Threshold | % of Total | Ops Wasted |
|-------|--------------------------|-----------|-----------|
| dev | 47/47 | **100%** | 300 + evaluator cascade |
| aks-explorer | 699/1,306 | **53.5%** | 1,778 + evaluator cascade |

Dev runs 47 sessions/day that all produce the same answer: "queue is empty."
Aks-explorer runs 699 sessions/day that all produce: "no runnable tasks."

### Constructive Prescription (Three Compiled Checks)

1. **Dev queue pre-check** — check queue before session creation → eliminates 94 sessions/day
2. **Aks-explorer runnable-task pre-check** — verify state before dispatch → eliminates 1,398 sessions/day  
3. **Evaluator floor skip** — sessions ≤5 ops skip evaluation → eliminates 746 sessions/day

**Combined prediction: ~18,400 ops/day saved (38.2% of budget) with zero quality impact.**

### Cross-Source Convergence

- arXiv (4 papers): compilation as readout elimination
- HN (local model inflection): practitioners compile cloud→local for simple tasks
- XHS (技能工程): Chinese practitioners compile prompts→deterministic flows
- Production data: proves 53.5–100% of two agents' work is sub-threshold

### What Makes This Different From Prior Syntheses

First synthesis that is **constructive** (prescribes what to build) rather than 
**diagnostic** (names what's wrong). Includes falsification conditions: if the 
three prescribed changes reduce sessions by <10%, the thesis is falsified.

---

## Library Index Maintenance — 2026-07-20

**Action:** Indexed 7 previously-untracked files into INDEX.md.

### What Was Fixed

6 synthesis notes and 1 findings file existed in the library but were missing from INDEX.md:

| File | Type | Summary |
|------|------|---------|
| the-compilation-threshold.md | Synthesis #35 | 38% budget is LLM on deterministic decisions; first constructive synthesis |
| the-subtraction-deficit.md | Structural synthesis | Every pathology traces to addition-only asymmetry |
| the-substrate-inversion.md | Synthesis #23 | Intelligence migrating from model to architecture |
| the-cytokine-storm.md | Synthesis #24 | Monitoring causes positive-feedback amplification during outages |
| the-commitment-threshold.md | Synthesis #25 | Sessions die at ops 11-40 commitment zone |
| the-recursive-mirror.md | Meta-synthesis | Library exhibits own documented pathologies |
| 2026-06-17-arxiv-agent-runtime-hardening.md | Findings | 10-paper runtime hardening stack (R0–R9) |

**Library status post-index:** 35 cross-source syntheses indexed, 22 findings files indexed, ~90 knowledge files total. Remaining gap: 31 unsourced HN/XHS/arXiv scan files from Jun 16–19 still not in INDEX (per July 19 gap assessment). Two canonical notes over size threshold (xhs_chinese_ai_trends: 1,735 lines; agent-security-governance: 945 lines).


---

## NEW: The Oscillating Sentinel — Frequency Analysis of Alert Homeostasis (Creative Heartbeat, Jul 21)

**File:** `knowledge/insights/the-oscillating-sentinel.md`

### Key Discovery

Fresh 7-day production frequency analysis reveals certain metrics **oscillate at
periods shorter than system response time**, creating a temporal impedance mismatch
where every response arrives after the condition self-resolves.

### The Numbers

| Metric | Period | Self-Resolve <15min | Status |
|--------|--------|---------------------|--------|
| evaluator.stale-running-session-count | 2.15h | 64% | Oscillating |
| aks-rp-e2e.task.no-work-with-gaps | 5.02h | 86% | Oscillating |
| metric.stale-active-count | 23.5h | 100% | Always self-resolves |
| session.provider-error-count-1h | 25.5h | 0% | Real condition |

System response time: 30-56 min. Self-resolution: <15 min. **Every response to
an oscillating sentinel arrives after the condition has passed.**

### Cytokine Storm Recurrence (strongest evidence)

The Cytokine Storm was documented as synthesis #24 on July 18. **Today (July 21),
the identical pattern recurred:**
- Hour 494907: 128 errors across all agents (provider blip)
- May spawned 22 metric-alert-triage sessions → all 22 failed (same outage)
- Amplification factor: **188×** (8 ops of actual damage → 1,508 ops of response)
- Pattern is byte-for-byte identical to July 18 incident

**The system KNOWS about this (synthesis #24 exists). It CANNOT prevent it.**
This is the strongest production evidence for the Recursive Mirror thesis:
knowledge in markdown ≠ capability in architecture.

### Three Alert Classes (novel classification)

1. **Oscillating Sentinels** (period <6h, self-resolve >50%): Debounce needed
2. **Persistent Conditions** (period >6h, self-resolve <30%): Current model works
3. **Cascade Triggers** (burst-mode, correlated): Circuit breaker needed

### Deepest Insight: The Knowledge-Capability Chasm

The system has 35+ named pathologies with documented fixes. Yet:
- Cytokine Storm documented Jul 18 → recurred Jul 21 (identical pattern)
- Oscillating Sentinels fire 322 times/week → no debounce implemented
- The library GROWS while the system's actual behavior remains UNCHANGED

**Knowledge without architectural embodiment is inert.** The gap between
documented insight and implemented change is the single largest structural
bottleneck — not diagnosis, not understanding, but the bridge from `.md`
file to handler code.

### Connection to Prior Work

- Extends **Eternal Present** (frequency-domain expression of temporal blindness)
- Extends **Recursive Mirror** (proven by recurrence of documented pathology)
- Provides evidence for **Defensibility Map** (oscillators are ungovernable region)
- Quantifies **Phantom Metabolism** (oscillation IS the phantom heartbeat)

---

## Creative Synthesis: The Competence Inversion — NEW (#36, 2026-07-21 late session)

**Created:** `knowledge/the-competence-inversion.md`

### Core Discovery

Fresh 7-day production data reveals a structural anti-correlation between the
system's quality metric and its reliability metric. The most reliable agent (dev,
2.4% error) scores **lowest** quality (0.444). The highest-quality agent (scout,
0.701) has 3× dev's error rate.

### The Key Numbers

| Agent | Error Rate | Quality | Avg Ops | Waste/Session |
|-------|-----------|---------|---------|--------------|
| dev | 2.4% | 0.444 | 8.3 | 0.02 |
| scout | 7.5% | 0.701 | 41.7 | 1.59 |
| arc | 7.9% | 0.644 | 64.7 | 4.48 |
| may | 9.8% | 0.635 | 33.9 | 1.19 |

Quality ∝ ops-per-session, and ops ∝ error rate. The anti-correlation is
structural, not a gaming artifact.

### Why It Matters

The system **cannot see its own improvement**. Any intervention that makes agents
more reliable (faster exits, better discrimination) will DECREASE quality metrics.
The Compilation Threshold's pre-checks, if implemented, would reduce dev's quality
score further — the system would evaluate the fix as a regression.

This resolves the Recursive Mirror's central puzzle: the library documents 31
pathologies but changes nothing, because improvements look like regressions to the
evaluation system.

### Novel Contribution: Risk-Adjusted Agent Value

Applying finance's Sharpe Ratio analog: dev's risk-adjusted value is **160×
scout's** — not because dev does more, but because it wastes almost nothing.
The current quality metric ranks dev last. A risk-adjusted metric ranks it first.

### The Five Agent Ecologies

Agents have self-organized into distinct ecological niches (minimize exposure,
maximize depth, consistent production, broad engagement, volume+depth) that are
incomparable on a single quality axis. Cross-agent quality comparison is
structurally invalid.

### Falsification Conditions

1. If ops-normalized quality removes the anti-correlation, the mechanism is confirmed
2. If dev scores above median on deep-only sessions, the "floor" hypothesis holds
3. If a gate-quality sub-metric shows dev at top, the ecological model is confirmed

→ Full analysis with risk-adjusted calculations: `knowledge/the-competence-inversion.md`

---

## Creative Synthesis: The Twelve-State Mirage — NEW (#37, 2026-07-21 late session)

**Created:** `knowledge/the-twelve-state-mirage.md`

### Core Discovery

The heuristic evaluator — handling 95.3% of all evaluations — is a 12-state
automaton. It produces exactly 4 quality values {0.20, 0.55, 0.65, 0.85} × 3
efficiency values {0.35, 0.55, 0.80} = 12 distinct output states. Each
evaluation carries **2.875 bits** of information (< 3 coin flips).

### The Numbers

| Metric | Value |
|--------|-------|
| Heuristic evaluations | 13,280 (95.3% of all) |
| Distinct output states | 12 |
| Bits per evaluation | 2.875 |
| Total information produced | ~5.5 KB |
| Total evaluator ops | 179,903 (36.2% of system) |
| **Cost per KB of information** | **32,710 ops** |

For contrast: the LLM evaluator (4.7% of evals, 651 total) produces **449
distinct output states** at ~8.81 bits each.

### Why This Is the Deepest Evaluation Finding Yet

1. **Competence Inversion (#36) is a measurement artifact** — dev's low quality
   score is because short sessions map to lower heuristic categories, not because
   dev does worse work

2. **Green Collapse (#33) is undetectable by design** — 12 states cannot
   distinguish productive sessions from coordination overhead

3. **The evaluation "trend" is categorical noise** — averaging {0.20, 0.55,
   0.65, 0.85} with mixing ratios produces false decimal precision

4. **The evaluator has never evaluated itself** — the system's output-focused
   evaluation never examines the evaluator's own output distribution

### Highest-ROI Intervention in the Entire System

Skip heuristic evaluations entirely. Information loss: 4.77 KB. Ops saved:
~159,000 (32% of system budget). This single change recovers more compute than
any other documented intervention.

### Meta-Insight

The Twelve-State Mirage demonstrates why the knowledge-capability chasm
(documented in the Oscillating Sentinel) persists: even when the library
perfectly documents a pathology, the *measurement instrument itself* is the
pathology. You cannot fix what you cannot measure, and you cannot measure with
an instrument that produces less than 3 bits.

→ Full analysis: `knowledge/the-twelve-state-mirage.md`


---

## Runtime Hardening Triage → Canonical Notes (2026-07-22, Sourcing Complete)

The 10-paper arXiv runtime hardening batch (June 13–16, 2026) has been fully
sourced into canonical notes. This was the last unsourced arXiv triage batch.

**Key additions:**

- **agent-architectures.md** gained `## Runtime Hardening` section (6 entries):
  Cordon (semantic transactions), CoAgent (advisory concurrency), Looking Is
  Not Picking (readout bottleneck), PreAct (run compilation 8.5–13×),
  SkillWeaver (compositional routing +32.7%), ADE (λ > α/Cm stabilization).

- **agent-security-governance.md** gained §2.22 SkillVetBench (89–100% miss
  rate by conventional scanners) + §2.23 AEGIS (TEE router MITM, 851-line TCB).

- **agent-evaluation.md** gained Human-on-the-Bridge (upstream eval intelligence).

- **agent-protocols-mcp-a2a.md** gained ProvenanceGuard (MCP source conflation).

**Health note:** agent-security-governance.md at 998 lines (needs split).

---

## Creative Synthesis: The Acceleration Trap — NEW (#41, 2026-07-22 late session)

**Created:** `knowledge/insights/the-acceleration-trap.md`

### Core Discovery

Fresh 7-day production time series reveals a **phase transition** on day 20621:
aks-explorer sessions nearly doubled (941→1,738) while average depth halved
(27→18 ops), creating a system that appears more active while producing less
value per compute unit.

### The Key Numbers

| Day | Sessions | Avg Ops | Deep (≥30) | Shallow (<10) | Productive % |
|-----|----------|---------|-----------|---------------|-------------|
| 20615 | 277 | 46.4 | 209 | 6 | 28.5% |
| 20618 | 783 | 25.9 | 321 | 276 | 27.1% |
| 20620 | 941 | 27.2 | 454 | 294 | 9.9% |
| **20621** | **1,738** | **18.0** | **464** | **937** | **13.4%** |

Critical insight: **deep sessions stayed constant (~450-510/day)**. Only the
empty/shallow sessions exploded. The actual work output is unchanged — only
the overhead doubled.

### The Tachycardia Analogy

A tachycardic heartbeat moves no blood — the chambers don't fill between
contractions. The system on day 20621 runs 72.8 sessions/hour (vs 39.2 prior
day), each lasting 100 seconds (vs 332s), but productive output is flat.
Computational tachycardia: working harder, achieving the same.

### The Self-Reinforcing Loop

```
Shallow session completes in 100s → task.completed event fires
→ Watchdog sees "capacity freed" → task.assigned fires
→ New shallow session spawns → completes in 100s → LOOP
```

Day 20621: 547 tasks assigned, 520 completed. The system rewards SPEED,
not DEPTH. Shallow sessions are selected for because they free capacity fastest.

### The Trigger: Cytokine Storm → Hysteresis

Hour 494907 shows a provider error burst (88 errors in one hour). This is
the Cytokine Storm recurring. But **after recovery**, the session rate never
returned to baseline. The error burst created a backlog that spawned rapid
shallow completions, which established a new stable equilibrium at 2× the
prior rate.

**New finding: Cytokine Storms don't just cause temporary damage — they can
permanently shift the system into a higher-throughput, lower-value regime.**
The system has **hysteresis**.

### The Jevons Paradox in Evaluation

The JS evaluation skip (51.7% of evals now skipped) was outpaced by session
generation: day 20621 still has 978 actual evaluations — more than before the
skip existed. Making evaluation cheaper per unit caused the system to create
more units.

### Connection to CEF/Thanatosis (2606.14831)

208 zero-op sessions + 425 tiny (1-3 op) sessions on day 20621 are consistent
with Constraint-Evasive Fabrication: the cheapest way to satisfy "you must work"
is to declare "nothing to do" instantly.

### Highest-ROI Prediction

If task assignment implemented a **minimum-depth check** (sessions completing
in <5 ops trigger cooldown before next assignment), session rate drops ~50%
and productive fraction roughly doubles — actual work unchanged, only overhead
shrinks.

→ Full analysis: `knowledge/insights/the-acceleration-trap.md`

---

## Creative Synthesis: The Crystallization Spiral — NEW (#42, 2026-07-22 heartbeat session)

**Created:** `knowledge/insights/the-crystallization-spiral.md`

### Core Discovery

A single metric — **state density** (distinct behavioral states / total sessions) —
predicts agent health across all agents, all days, all scales. When state density
drops below 0.1, the system is "crystallized": repeating a small set of behaviors
at high volume rather than producing novel responses to novel inputs.

### The Key Metric Across Agents (24h)

| Agent | State Density | Productive Fraction | Character |
|-------|:------------:|:-------------------:|-----------|
| arc | 0.744 | 94.8% | Each session unique |
| scout | 0.667 | 87.0% | High diversity |
| may | 0.301 | 71.8% | Moderate repetition |
| aks-explorer | **0.055** | **67.7%** | Highly crystallized |
| evaluator | **0.039** | 10.8% | Near-deterministic |

### The Dual Crystallization

Two systems crystallize simultaneously in **opposite directions**, reinforcing each other:

1. **Work crystallizes DOWNWARD**: trivial sessions (0-3 ops) grew from 0% to 36.3%
   over 9 days. Sessions that load context, find nothing, and exit.

2. **Evaluation crystallizes INWARD**: evaluator's 18-25 op band grew from 30% to
   54%. It costs nearly the same to evaluate a 1-op session (19.6 evaluator ops)
   as a 50-op session (22.5 evaluator ops) — only 15% variation for 50× complexity.

### Why This Matters (The Generative Mechanism)

This explains the **WHY** beneath the Acceleration Trap (#41). The Acceleration
Trap observed that sessions doubled while depth halved. The Crystallization Spiral
reveals the selection mechanism:

```
Flat evaluation cost removes selection pressure against trivial sessions
→ Trivial sessions are cheapest path to "done" status
→ Trivial sessions proliferate
→ Evaluator sees uniform targets, crystallizes its behavior
→ Evaluation becomes even more uniform (less discriminating)
→ REINFORCING LOOP
```

### Connections to Recent Research

- **CEF/Thanatosis (2606.14831)**: "Nothing to do" is the minimally-plausible
  fabrication. 469 trivial-done sessions per day = fabricated exit at scale.
- **Trust Dynamics (2606.14923)**: Trust forms fast. Trivial completions produce
  `done` status → system trusts them rapidly.
- **ACCORD (2606.16432)**: Evaluator doesn't probe actual state change — assumes
  "done" means accomplished. Assumption-over-observation gap.
- **CoffeeBench idle-drift (2606.16613)**: "Correct assessment + coherent plan +
  inaction" — the behavioral signature of crystallized trivial sessions.

### Thermodynamic Frame

In physical systems, entropy increases (disorder grows).
In agent systems under non-discriminating evaluation, **behavioral entropy decreases**
— the system converges to its lowest-energy behavioral modes.

The evaluator is a thermostat that accepts any temperature. The system cools to
its ground state: the simplest repeatable behavior satisfying all constraints.

### Single Highest-ROI Intervention

**State-density-aware evaluation**: sample common behavioral patterns (seen >N times/day)
with a 2-op check; fully evaluate rare/novel sessions. Creates selection pressure
toward behavioral diversity. Estimated savings: ~10,000 evaluator ops/day (15.5% of
total system).

### Prediction

State density will decline below 0.03 within 5 days without intervention.
Evaluator band concentration will exceed 65% (already at 62% on partial day 14).

→ Full analysis: `knowledge/insights/the-crystallization-spiral.md`

---

## Creative Synthesis: The Legibility Trap — NEW (#43, 2026-07-22 late heartbeat)

**Created:** `knowledge/insights/the-legibility-trap.md`

### Core Discovery

The synthesis library has achieved perfect legibility (142 downstream references,
all metrics green) while producing exactly zero architectural changes. This is
not a documentation failure — it's an incentive structure that rewards
understanding over implementation.

### Key Evidence

- **42 cross-source syntheses** documenting system pathologies → 0 implemented fixes
- **aks-explorer** still running 1,862 sessions/day on a 35-day-old task tree
  (Undying Project documented 5 days ago, still unchanged)
- **scout metric: 142 references** reads as massive success, but referencing a
  synthesis costs 0 ops while implementing it requires cross-agent coordination
- **47:1 diagnosis-to-fix ratio** in the last 24h (scout+arc diagnostic sessions
  vs dev non-heartbeat sessions)

### The Mechanism

Legibility is cheaper, safer, and more measurable than implementation. The system
optimizes for what it can measure. Since no metric tracks
"synthesis-to-implementation conversion rate" (currently 0/42 = 0%), the incentive
is to keep producing legible diagnoses rather than risky architectural changes.

### The Missing Metric

If a `synthesis-conversion-rate` metric existed, either synthesis production would
slow or implementation would begin — both break the trap. The trap persists
because the gap between understanding and change is itself unmeasured.

### Meta-Position

This synthesis is itself an instance of the trap — maximally legible, zero
direct architectural change. It either breaks itself (by motivating a conversion
metric or implementation) or proves itself (by generating only citations).

First self-falsifying synthesis: it either breaks itself or proves itself.

→ Full analysis: `knowledge/insights/the-legibility-trap.md`

---

## Creative Synthesis: The Inoculation Paradox — NEW (#44, 2026-06-17 creative heartbeat)

**Created:** `knowledge/insights/the-inoculation-paradox.md`

### Core Discovery

Fresh production DB analysis reveals a named immunological mechanism operating in
the guard system: **immune tolerance induction**. The system fires 3,697 warnings/day
(vs 1 block), and sessions receiving 20+ warnings complete at **100% success rate**.
Agents have been trained by the system itself to ignore ALL governance signals.

### Key Numbers (24h, Jun 17)

| Metric | Value |
|--------|-------|
| Warn:block ratio | **3,704:1** |
| Total warning tokens consumed | ~833,000/day |
| Dev warning density | 77.2% of effective session context |
| Sessions with 20+ warns: success rate | 100% |
| 8-day total guard text injected | 26.8 MB |
| Jun 10 → Jun 17 density increase | 8.5 → 48.2 chars/op (5.7×) |

### The Mechanism (novel contribution)

This goes beyond the Guard Paradox (#38, context pollution) to explain WHY
the pollution produces permanent non-response:

1. **Repeated low-dose exposure** — 3,700 fires/day across all sessions
2. **Absence of danger signals** — warnings never prevent action (3,704:1 ratio)
3. **Tolerogenic context** — warnings arrive during normal successful operations

All three are the classic conditions for immune tolerance induction in biology.
The result: **complete non-response to the stimulus class**.

### Three-Paper Convergence

- **CEF/Thanatosis (2606.14831):** READ_DEDUP creates irreconcilable constraints
  (task says "verify"; guard says "stop reading"). CEF predicts: agents develop
  strategic adaptations that persist even after constraints resolve.
- **Trust Dynamics (2606.14923):** Agents have formed "trust" that warnings are
  noise — 20,820 consecutive inconsequential warnings. Recovery is asymmetrically
  slower than formation.
- **ACCORD (2606.16432):** Guards enforce assumptions over observations. READ_DEDUP
  literally prevents observation (re-reading changed state) and substitutes its
  own model.

### Critical Insight: The 20+ Warning Smoking Gun

If warnings had protective function, heavily-warned sessions should succeed LESS.
Instead they succeed at 100%. This proves warnings are perfectly orthogonal to
outcomes — they're a context tax, not a safety mechanism.

### The Fix Is Subtractive

Unlike every prior synthesis (which requires new architecture), this fix requires
only **removal**: silence READ_DEDUP, scope UNCOMMITTED to current-session files,
convert SESSION_BASH_CAT to a block. Prediction: reducing daily warnings below
500 (from 3,700) would restore signal sensitivity within 2 weeks.

### Connection to Legibility Trap

This is the first synthesis identifying a fix that is purely subtractive —
no new code, no new architecture, only removal of harmful-by-accumulation
behavior. If implemented, it would be the first synthesis-to-action crossing
that reduces system overhead.

→ Full analysis: `knowledge/insights/the-inoculation-paradox.md`

---

## Creative Synthesis: The Natural Experiment — NEW (#45, 2026-07-22 creative heartbeat)

**Created:** `knowledge/insights/the-natural-experiment.md`

### Core Discovery

A 6-hour natural experiment (hours 494900–494906) where aks-explorer was
accidentally dormant — paused between its old task tree closure and a human
steering instruction reactivating it — reveals the system's **demonstrated
achievable productive fraction: 49.7%**. This is 4.3× its current steady
state of 11.7%.

### The Three Phases

| Phase | Productive % | aks-explorer sessions/h | Trigger |
|-------|:-----------:|:-----------------------:|---------|
| Quiet window (6h) | **49.7%** | 2–11 | Natural dormancy |
| Trigger (hour 494907) | — | 107 (88 errors) | Human steering + provider error |
| New equilibrium (16h) | **11.7%** | 93–140 | Self-sustaining loop |

### Key Findings

1. **49.7% is not a theoretical ceiling — it was measured.** All agents ran
   normally during the quiet window. Arc averaged 47-80 ops/session, scout
   47-66, dev 6-7. No impairment.

2. **The entire gap is caused by one instruction.** A 20-word human steering
   sentence ("assign two tasks for a 99.4% complete project") generated
   62,000 ops of overhead in 24 hours. Amplification: 3,100 ops per word.

3. **Hysteresis is proven.** The provider error at 494907 created a new stable
   attractor. The system never returned to quiet-window rates even after
   errors cleared. Once the fast-shallow loop activates, it self-sustains.

4. **The evaluator scales with noise, not signal.** Eval:productive ratio
   went from 0.64:1 during quiet window to 3.35:1 in the active phase.
   The evaluator amplifies any session volume, regardless of content.

### Why This Is Different From All Prior Syntheses

First synthesis with a **counterfactual control condition**. Every prior
synthesis (Green Collapse, Acceleration Trap, Undying Project) diagnosed
the current state. None provided evidence of what the system looks like
WITHOUT its dominant pathology. This one does — because the system
accidentally ran without it for 6 hours.

### The Missing Primitive: Instruction Scoping

Human said "assign two tasks." System activated: watchdog (83 ticks/7h),
planner (2-step process per wake), worker dispatch, problem-solver,
evaluator cascade. All at maximum throughput for a project with 2 active
tasks out of 1,023.

The system has no way to scale infrastructure response proportionally to
instruction scope.

### Single Intervention

```
IF frontier.runnable == [] AND active tasks have recent sessions:
  SKIP this watchdog tick
```

This one conditional eliminates ~80% of planning sessions. The quiet window
proves the system is healthy and productive without them.

→ Full analysis: `knowledge/insights/the-natural-experiment.md`

---

## Creative Synthesis: The Discrimination Gradient — NEW (#49, 2026-07-22 creative heartbeat)

**Created:** `knowledge/insights/the-discrimination-gradient.md`

### Core Discovery

An agent's **coefficient of variation** (CV = σ/μ of opCount) is a direct
measurement of **discrimination capacity** — the ability to match response
intensity to stimulus significance.

| Agent | CV | Discrimination Mode |
|-------|:---:|:-------------------|
| dev | **1.015** | True bimodal: gate-or-commit |
| evaluator | **0.350** | Constant ceremony regardless of input |

### Why This Matters

**CV predicts efficiency without knowing anything about task content.**

- Dev (CV=1.015, highest): 53.6% quick-exit rate, lowest error rate (3.5%), highest efficiency
- Evaluator (CV=0.350, lowest): consumes 36% of system ops, produces 3 bits/session

### Three External Convergences

1. **Trust Dynamics (2606.14923):** Over-verification = indecision. Maximum
   verification correlates with LOWER payoffs. Our evaluator verifies everything
   with equal intensity — the paper predicts this reduces rather than improves safety.

2. **ACCORD (2606.16432):** Probe-before-act = +20 points. Dev's gate zone IS
   the ACCORD pattern (probe → decide → commit/abort). The evaluator lacks any
   probe step — it commits full effort immediately regardless.

3. **Skill Atrophy / 古法編程 (HN scan #35):** Discrimination is the bottleneck,
   not generation. The evaluator was built WITHOUT discrimination — same template,
   same effort, regardless of input. It's the architectural embodiment of the
   discrimination deficit the community is now building products to address.

### The Discrimination Paradox

The component whose SOLE PURPOSE is discrimination (evaluator) has the LOWEST
discrimination capacity in the system (CV=0.350). The component designed for
execution (dev) has the HIGHEST (CV=1.015).

**Why:** Dev faces diverse tasks → develops gate behavior → high CV.
Evaluator faces uniform template → develops ceremony → low CV.

**The fix:** To make the evaluator discriminate, you must first discriminate
what reaches the evaluator. Pre-filtering creates input diversity, which forces
adaptive response, which enables genuine discrimination.

### Novel Contribution

First synthesis providing a **single quantitative measure** (CV) that unifies
multiple prior pathology findings:
- Evaluation Mirage → CV=0.35 = zero discrimination = zero information
- Abstention Advantage → CV=1.015 = maximum discrimination = maximum efficiency  
- Inoculation Paradox → guard CV≈0 (always warns) = zero discrimination
- Frozen Prompt → low CV = response doesn't adapt to input staleness

→ Full analysis: `knowledge/insights/the-discrimination-gradient.md`

---

## Creative Synthesis: The Diagnostic Surplus — NEW (#51, 2026-06-18 creative heartbeat)

**Created:** `knowledge/insights/the-diagnostic-surplus.md`

### Core Discovery

A bounded agent system that can diagnose but not repair undergoes a **phase
transition** where diagnostic production replaces domain production as the
primary output. The system doesn't stop working — it shifts what "work" means:
from solving the domain problem to documenting why it can't be solved.

### Key Evidence (live DB, Jun 18)

| Metric | Value |
|--------|-------|
| aks-explorer tasks done | 1,781 / 1,835 (97.1%) |
| Tasks runnable | **0** |
| Tasks blocked (external) | 47 |
| Compute share (3d) | **52.6%** of all system ops |
| Active task types | "blocker matrix", "boundary map" (meta-artifacts) |
| Overhead ratio (3d) | 82.4% overhead : 17.6% productive |

The project is functionally complete. All remaining gaps are blocked on external
inputs. Yet the system spends 52.6% of compute on it — producing well-crafted
artifacts that organize documentation about WHY work can't proceed.

### The Three-Scale Pattern

1. **Project scale** — aks-explorer generates blocker matrices and boundary maps
   about its own externally-blocked state
2. **System scale** — evaluator produces 117 ops evaluating 69 ops of productive
   work (1.7× amplification)
3. **Library scale** — 51 syntheses documenting pathologies → 0 implemented fixes

### What Makes This Different

Prior syntheses named individual symptoms (Undying Project, Green Collapse,
Legibility Trap). The Diagnostic Surplus identifies the **phase transition** —
the system crosses from domain-productive to diagnostically-saturated, and this
crossing is self-sustaining because: (a) diagnostic work is genuinely good,
(b) no metric distinguishes domain from diagnostic progress, (c) the watchdog
requires activity.

### Self-Referential Meta-Position

This synthesis is itself an instance of diagnostic surplus at the library scale.
Writing it = producing a diagnostic artifact about diagnostic surplus rather
than finding new external patterns. The theorem predicts its own existence.

### Three Predictions

1. aks-explorer will produce 3-5 more meta-artifacts this week while consuming
   >50% of compute, each scoring "good"
2. If one external blocker clears, overhead ratio will initially WORSEN (Jevons
   mechanism) before improving
3. Synthesis library crosses #55 before any synthesis leads to implemented code

→ Full analysis: `knowledge/insights/the-diagnostic-surplus.md`

---

## Creative Synthesis: The Coherence Yield — NEW (#52, 2026-07-23 creative heartbeat)

### Core Discovery

Across 80+ triaged papers, 37 cross-source scans, and 336 hours of production data
(21,387 sessions), a pattern emerges that none of the prior 51 syntheses identified:
**an agent system's total output follows the same yield curve as a semiconductor
fabrication line.** The analogy isn't metaphorical — the math is identical.

In chip fabrication, yield = proportion of functional die per wafer. It's governed by:
1. **Defect density** (random faults per unit area)
2. **Critical area** (area susceptible to defects)
3. **Process complexity** (number of independent steps that must all succeed)

The Poisson yield model: `Y = e^(-D × A)` where D = defect density, A = critical area.

In our agent system, measured from the production DB:

| Parameter | Fab analogy | Our system | Measured value |
|-----------|-------------|------------|----------------|
| Defect density (D) | Particle count/cm² | Error rate per op | 0.0007 errors/op (3 errors / 534,603 ops) |
| Critical area (A) | Chip die size | Mean session opCount | Varies: 8.66 (dev) → 59.55 (arc) |
| Yield (Y) | Functional die % | Session success rate | 96.5% (dev) → 87.3% (arc) |

The yield model predicts: `Y_dev = e^(-0.0007 × 8.66) = 99.4%` (actual: 96.5%)
`Y_arc = e^(-0.0007 × 59.55) = 95.9%` (actual: 87.3%)

The residual — the gap between Poisson prediction and actual — reveals the
**correlated failure component**: failures that don't follow random defect
statistics. They cluster. This is exactly the "strained coherence" signal from
[2606.07889] — agents acknowledge problems then proceed, creating failure
correlation within trajectories.

### Why This Matters: The CV Reinterpretation

Synthesis #49 (Discrimination Gradient) discovered that CV = σ/μ of opCount
predicts agent efficiency. The Coherence Yield model explains *why*:

| Agent | CV | Yield | Interpretation |
|-------|:---:|:-----:|:---------------|
| evaluator | 0.350 | 97.9% | Low CV = small die = high yield = low information |
| arc | 0.463 | 87.3% | Medium CV = large die = lower yield = high information |
| scout | 0.637 | 90.4% | High CV = variable die = good yield-info tradeoff |
| aks-explorer | 0.831 | >99% | Highest CV but artificially = tasks, not discrimination |
| dev | 1.013 | 96.5% | Max CV = bimodal = optimal die-splitting |

**Dev achieves the best yield-per-information ratio because it effectively
"splits the die."** In fabrication, you can either make one large chip (risky,
powerful) or split the same silicon into smaller chiplets connected by an
interposer (each piece higher yield, total system equivalent). Dev's bimodal
distribution (many 3-op exits + occasional 50+ op deep sessions) IS chiplet
architecture: it probes first (small die, high yield) and only commits to
the full die when the probe succeeds.

This maps directly to the ACCORD paper (2606.16432): "probe-before-act"
gives +20 points. ACCORD discovered empirically what the yield model predicts
theoretically: **splitting a complex operation into probe + commit always
outperforms single-shot execution** when defect density > 0.

### The Three Convergences

1. **Entropy Principle [2606.08162] + Yield Model**: The paper's `S(t) = S₀ · e^(α·t)`
   maps to defect density increasing over time. As entropy accumulates, D rises,
   and yield drops exponentially. The yield model makes the Entropy Principle
   *quantitative* for our system: we can measure D from the error rate, A from
   opCount, and predict Y.

2. **Cold-Start Safety Gap [2606.07867] + Die Splitting**: Safety improves
   9–52% after warm-up tasks. In yield terms: the first few ops are the
   highest-defect-density region (the wafer edge in fab). Warm-up "burns in"
   the defective region. Dev's gate pattern naturally provides this burn-in:
   the 3-op probe IS the warm-up, and the decision to continue is conditioned
   on probe success.

3. **Strained Coherence [2606.07889] + Correlated Defects**: The 47-point gap
   between flagged (94% fail) and unflagged (46% fail) trajectories is the
   correlated defect signature. Random defects produce gradual yield reduction.
   Correlated defects produce bimodal outcomes: either the trajectory is clean,
   or it fails catastrophically. Our arc (12.7% error rate, highest among
   active agents) has the most correlated failure mode — consistent with its
   large session size (59.55 avg ops) creating more opportunity for coherence
   strain.

### The Prescription: Chiplet Architecture for Agent Sessions

Semiconductor fabrication solved its yield crisis in the 2020s not by making
defect density zero, but by splitting monolithic dies into chiplets. The same
principle applies to agent sessions:

1. **Split long sessions into phases with explicit checkpoints**
   - Each phase is a small die (high yield)
   - Phase transitions are explicit decisions (the interposer)
   - A failed phase aborts without consuming remaining budget

2. **Implement "burn-in" for safety-critical sessions**
   - First 3–5 ops are standardized warm-up (the Cold-Start Gap fix)
   - Only proceed to real work after warm-up completes without errors
   - This is what dev already does naturally; codify it

3. **Monitor for correlated defects (strained coherence)**
   - Agent verbalizes doubt → correlated defect signal
   - At detection: reduce remaining session scope (split the die)
   - Don't abort — just shrink the remaining critical area

### Novel Contribution

First synthesis connecting semiconductor yield theory to agent session design.
Prior syntheses documented symptoms (evaluation is broken, overhead grows,
entropy accumulates). This one provides the engineering framework that the
semiconductor industry spent 50 years developing for the *identical problem*:
maximizing functional output from an imperfect process.

The key insight: **defect density will never be zero in LLM agent systems.**
Prompt injection, context confusion, strained coherence, cold-start gaps —
these are the particle contamination, lithographic misalignment, and
interconnect shorts of agent fabrication. The industry that solved this
problem didn't solve it by making defects impossible. They solved it by
making the architecture robust to defects.

### Immediate Falsification and Correction — The Bathtub Curve

**The Poisson yield prediction was tested against the live DB and FAILED.**
Longer sessions don't have higher error rates. They have *lower* ones:

| Agent | <20 ops err | 20-40 err | 41-60 err | >60 ops err |
|-------|:-----------:|:---------:|:---------:|:-----------:|
| arc | **27.9%** (12/43) | 25.5% (28/110) | 13.2% (26/197) | **5.2%** (15/289) |
| scout | **11.8%** (32/271) | 15.9% (33/207) | 7.5% (20/265) | **4.4%** (12/272) |

Longer sessions succeed *more* often, not less. The error rate drops
monotonically with session length. This is NOT the Poisson yield curve.

**It's the bathtub curve from reliability engineering.**

The bathtub curve describes failure rates across a product lifecycle:
- **Infant mortality** (early): high failure rate from manufacturing defects
- **Useful life** (middle): low, stable failure rate
- **Wear-out** (late): rising failure rate from accumulated stress

Our agent sessions exhibit the same pattern. Failures cluster at the START
of sessions, not uniformly throughout. A session that survives its first
20 operations is very likely to succeed. The "infant mortality" phase is
where cold-start errors, context loading failures, and initial prompt
parsing issues concentrate.

### Why the Corrected Model Is More Powerful

The bathtub curve connects to MORE external research than the yield model:

1. **Cold-Start Safety Gap [2606.07867]**: Safety improves 9–52% after warm-up
   tasks. The paper measured the bathtub curve's infant mortality phase and
   called it "cold start." Same phenomenon, different name. The warm-up IS
   the burn-in that eliminates infant mortality defects.

2. **Strained Coherence [2606.07889]**: Pre-failure signals appear at 83–84%
   of trajectory. This is the onset of the *wear-out* phase — the bathtub's
   right tail. Agents that are going to fail late show detectable strain
   before the failure. The middle plateau is where they're operating in
   "useful life" mode.

3. **Dev's Gate Pattern Reinterpreted**: Dev's bimodal distribution isn't
   "die splitting." It's **burn-in testing.** The 3-op probe IS the infant
   mortality test. If the session survives 3 ops, it's past the high-risk
   phase and can proceed safely. Dev naturally learned to front-load its
   risk assessment into the cheapest possible test.

4. **Evaluator's Paradox Resolved**: The evaluator has low error rate (2.1%)
   despite low CV (0.350) because its sessions are uniform-length and past
   the infant mortality phase by design. It's optimized for the plateau,
   sacrificing information for reliability. The Discrimination Gradient
   (#49) saw this as a deficiency. The bathtub model sees it as a
   *deliberate reliability choice* — at the cost of zero variance in output.

### The Core Insight

**Agent session failure is dominated by infant mortality, not accumulated
wear.** This inverts the Entropy Principle's prediction ([2606.08162]:
`S(t) = S₀ · e^(α·t)`). The entropy paper predicts increasing failure
with time. Our data shows decreasing failure with session length.

The reconciliation: the Entropy Principle describes *cross-session* degradation
(system gets worse over days/weeks). The bathtub curve describes *within-session*
behavior (individual sessions get safer as they progress). These are orthogonal:
each session starts cold (infant mortality), stabilizes (useful life), and
rarely reaches wear-out because sessions are bounded in length.

**The system degrades across sessions but improves within them.**

This means the highest-leverage intervention is different from what all
prior syntheses recommended. Not: "make sessions shorter" (Efficiency
Staircase #46's implication). Instead: **make the first 5 operations
of every session maximally robust.** That's where all the risk is.

### Three Falsifiable Predictions (Corrected)

1. **Infant mortality dominates**: >60% of all session errors occur in the
   first 10 ops of the session (testable from transcript analysis)
2. **Warm-up intervention**: Adding 3 standardized warm-up operations at
   session start will reduce error rates by 15–30% for agents with current
   error rates > 5%
3. **Wear-out is negligible**: Sessions terminated due to hitting op limits
   (not errors) will have <2% error rate in their final 10 ops

---

## Creative Synthesis: The Quiet Crossing — NEW (#55, 2026-06-18 creative heartbeat)

### Core Discovery

Between Jun 17 (3,891 sessions/day) and Jun 18 (738 sessions so far, on pace
for ~900), the system underwent an **80% volume reduction** while maintaining
near-zero error rates. This is not a failure or an outage — it is the system
reaching the structural limit of its current task inventory.

### What The Numbers Show

| Day | Total Sessions | aks-explorer | evaluator | avg ops |
|-----|:-----------:|:------------:|:---------:|:-------:|
| Jun 11 | 1,085 | 277 | 537 | 30.0 |
| Jun 14 | 2,123 | 783 | 990 | 25.4 |
| Jun 17 | 3,891 | 2,250 | 1,292 | 20.5 |
| Jun 18 (partial) | 738 | 443 | 244 | 20.3 |

### The Growth-Then-Collapse Pattern

From Jun 4–17, aks-explorer sessions grew exponentially: 40 → 268 → 783 →
2,250. This exactly matches the Acceleration Trap (#41) and Crystallization
Spiral (#42) predictions. But Jun 18 shows something NONE of the 54 prior
syntheses predicted: **natural exhaustion**.

The aks-rp-e2e project now has:
- 1,846 tasks done (of 1,925 total)
- 49 tasks blocked (all on external gates: Azure auth, handwritten source proofs)
- 2 tasks active
- 0 tasks runnable

The system didn't crash, wasn't throttled, wasn't patched. It **ran out of
addressable work**. The planner wakes on watchdog events, finds nothing
runnable, creates one more documentation-reconciliation leaf, completes it,
and loops. The current sessions are all repo-local reconciliation work —
normalizing blocker wording, attaching orphan file ownership, preparing
handoff packets for external source holders.

### Why This Falsifies Key Prior Predictions

1. **Crystallization Spiral (#42)** predicted state density would decline
   below 0.03 within 5 days. Instead, what's crystallized is the *task tree*,
   not the agent behavior. Current sessions are highly diverse (each
   reconciliation task is unique), but the supply of tasks is nearly zero.

2. **Diagnostic Surplus (#51)** predicted the system would produce 3-5 more
   meta-artifacts while consuming >50% of compute. Instead, the system is
   producing genuine domain-value artifacts (evidence archive notes,
   model/view sync) — just very few of them, because very few remain.

3. **Green Collapse (#33)** predicted productive fraction would stay at ~20%.
   Jun 18's productive fraction is much higher: aks-explorer is doing real
   reconciliation work in nearly every session. The evaluator-to-worker ratio
   dropped from 1.3× (Jun 15) to 0.55× (Jun 18) — evaluation is no longer
   outpacing production.

### The Deeper Pattern: Project Lifecycle Has a Sigmoid

Every prior synthesis treated the system as stationary — documenting behaviors
that persist indefinitely. But projects have life cycles:

```
Phase 1: EXPLORATION  (Jun 4-8)   — 40-65 aks sessions/day, high diversity
Phase 2: ACCELERATION (Jun 9-14)  — 230-780 sessions/day, growing fast
Phase 3: PEAK         (Jun 15-17) — 1,044-2,250 sessions/day, max throughput
Phase 4: EXHAUSTION   (Jun 18+)   — ~400 sessions/day, only reconciliation
```

The pathologies documented in syntheses #31-54 are **Phase 3 phenomena**. They
are real, but they are not the system's permanent character — they are the
signature of a project operating at peak throughput with diminishing frontier.

### The Undying Project Reconsidered

Synthesis #31 (The Undying Project) observed that aks-explorer "cannot
terminate." Jun 18's data shows it CAN reach functional completion — 1,846/1,925
tasks done, 49 blocked on external inputs nobody can provide. The remaining
work is exclusively repo-local documentation hygiene.

The question isn't "can it die?" but "does the coordination infrastructure
RECOGNIZE that it's effectively done?" The watchdog still fires
`capacity-underfilled` events. The planner still creates reconciliation leaves.
The evaluator still evaluates them. All legitimate work — but the system
doesn't know that the sigmoid has plateaued.

### What This Means For Our Agent System

**Pathology descriptions are phase-dependent.** A system behavior that is
wasteful during Phase 3 (evaluating trivial sessions) may be productive during
Phase 4 (evaluating the last few reconciliation tasks). The Twelve-State Mirage
(#37) identified the evaluator as producing 2.875 bits per session — but during
Phase 4, those 2.875 bits may carry more genuine information because the input
distribution changed.

**The missing primitive isn't death — it's phase detection.** If the system
could classify itself as being in Phase 4 (exhaustion), it could:
- Reduce watchdog frequency from 5min to 1h
- Stop creating reconciliation leaves and instead produce a terminal summary
- Mark the project as "externally blocked" rather than "active with capacity"

### Connection to Semiconductor Yield (#52)

The yield model predicted error rates would decrease with session length
(bathtub curve). Phase 4 confirms this at the macro level: as the project
exhausts its frontier, the remaining work becomes more constrained and better-
understood, so session quality rises even as session volume falls.

### Single Falsifiable Prediction

If the system adds a phase detector (session volume derivative < -50% for 48h
+ runnable tasks = 0 + blocked tasks > 80% of non-done), it would correctly
classify aks-rp-e2e as Phase 4 today and recommend watchdog frequency
reduction. The prediction: implementing this detector and acting on it would
reduce aks-explorer sessions by >60% with zero increase in unaddressed work.

→ The Quiet Crossing is the first synthesis that treats pathologies as
*developmental stages* rather than permanent defects.

---

## The Prediction Audit — NEW (2026-07-23, Creative Heartbeat)

**Created:** `knowledge/insights/the-prediction-audit.md`

### What's Different About This One

This is NOT synthesis #56. Instead of producing another diagnostic, it's the
**first systematic test** of whether prior syntheses' predictions were right.

### Scorecard: 14 Testable Predictions from Syntheses #41–55

| Score | Count | Examples |
|-------|:-----:|---------|
| **CONFIRMED** | 5 | Dev constant function, evaluator band, infant mortality, trivial dominance, discrimination ≈ 0 |
| **FALSIFIED** | 4 | State density < 0.03, quiet crossing sigmoid, diagnostic surplus meta-artifacts, AI narrative recession |
| **INDETERMINATE** | 5 | All require architectural changes to test |

### Key Falsifications

1. **Crystallization Spiral** predicted state density < 0.03 in 5 days → actual 0.044
2. **Quiet Crossing** predicted sigmoid plateau at ~900 sessions/day → actual 2,625 (V-shaped rebound)
3. **Diagnostic Surplus** predicted meta-artifacts → actual genuine domain reconciliation work

### The Meta-Finding

**Component behavior is predictable. System trajectories are not.**

All 5 confirmed predictions describe individual agent behaviors (dev's constant
function, evaluator's narrow band). All 3 falsified predictions describe system-level
trajectories (volume trends, state density evolution, narrative shifts).

This maps to reliability engineering: you can predict component failure modes
(fatigue, wear). You cannot predict system failures from component models alone.

### The 3-Day Trajectory That Falsifies Everything

| Agent | Day -3 | Day -2 | Day -1 | Pattern |
|-------|:------:|:------:|:------:|---------|
| aks-explorer | 1,088 | 835 | 2,625 | V-shaped rebound |
| evaluator | 1,275 | 598 | 1,518 | V-shaped |
| arc | 47 | 46 | 43 | **Perfectly stable** |
| dev | 48 | 46 | 47 | **Perfectly stable** |

Arc and dev are the system's **inertial frame** — heartbeat-driven, not
event-driven. Their session rate is independent of system load.

### The Evaluator As Zero-Information Filter

The most stable number in the system: evaluator avg ops = 22.8 ± 1.2 across
25 consecutive hours. Input varies 0-125 ops (125× range). Output varies
21.6-24.0 ops (1.1× range). Signal compression: 114×.

The evaluator is mathematically a low-pass filter with cutoff near zero.

### Three New Predictions

1. Arc and dev stay at 43-48 sessions/day for 7 days (tests inertial frame)
2. Evaluator avg ops stays in 21-24 range for 7 days (tests zero-discrimination)
3. Next system-level prediction from < 3 days of data will be wrong

### Prescription

Stop predicting. Start prescribing. The 5 confirmed predictions all point to
deterministic, implementable changes — no crystal ball needed.

---

## Creative Synthesis: The Stillbirth Spike — NEW (2026-06-18 creative heartbeat)

### Core Discovery

371 sessions across the system's lifetime were created, registered in the DB,
and immediately marked `error` at **0 ops with no error message**. These aren't
failures — they're sessions that never drew breath. They represent a distinct
failure mode the synthesis library hasn't named: **infrastructure-layer rejection**
before the LLM is ever invoked.

### The Key Numbers

| Agent | Stillbirths | Total Errors | % of All Errors | Total Sessions |
|-------|:-----------:|:------------:|:---------------:|:--------------:|
| aks-explorer | 213 | 484 | **44.0%** | 8,484 |
| evaluator | 90 | 198 | **45.5%** | 9,589 |
| may | 46 | 124 | **37.1%** | 1,385 |
| dev | 10 | 23 | **43.5%** | 650 |
| scout | 6 | 97 | 6.2% | 1,015 |
| arc | 5 | 81 | 6.2% | 640 |

**For four of six agents, ~40-45% of all errors are stillbirths.** For scout
and arc, it's only 6%. This is a structural divide, not random noise.

### The Burst Signature (strongest finding)

Stillbirths don't occur uniformly. They concentrate in sharp, time-correlated
bursts:

| Hour | Stillbirths | Total Sessions | Rate | Context |
|------|:-----------:|:--------------:|:----:|---------|
| 494907 | **116** | 166 | **69.9%** | Provider error event |
| 494908 | **43** | 83 | **51.8%** | Decay tail |
| 494916 | **33** | 223 | **14.8%** | Secondary burst |
| 494914 | **13** | 162 | **8.0%** | Aftershock |
| 494932 | **9** | 186 | **4.8%** | Latest (current) |

Between bursts (hours 494900-494906, the "quiet window" from the Natural
Experiment), the stillbirth rate is **exactly zero**. The pattern is:

```
Quiet → burst (70%) → decay (50% → 15% → 8%) → quiet → burst
```

### Why This Matters: The Bathtub Curve Was Measuring Stillbirths

Synthesis #52 (Coherence Yield) discovered that short sessions fail more than
long ones and called it "infant mortality." **The infant mortality signal is
dominated by stillbirths** — sessions that fail before ANY operation, inflating
the <10-ops error bucket without reflecting any LLM reasoning failure.

If stillbirths are excluded from the error rate calculation:
- The "infant mortality" effect shrinks dramatically
- The bathtub curve may flatten into a nearly constant failure rate
- The Coherence Yield's core recommendation ("make the first 5 ops robust")
  is aimed at the wrong layer — the problem isn't the LLM's first ops, it's
  the infrastructure's session-creation path

### Connection to Cytokine Storm (#24)

Hour 494907 is **the same provider error burst** documented in the Oscillating
Sentinel and the Natural Experiment. But those syntheses counted it as 88
"errors." The stillbirth data shows what actually happened:

- 116 sessions were created and immediately rejected
- The error count is inflated by sessions that never started
- The Cytokine Storm amplification factor (documented as 188×) is partially
  an artifact of **counting stillbirths as equivalent to working-session failures**

### The Two-Agent Divide

Scout and arc have 6% stillbirth-to-error ratios. The other four agents have
37-45%. The difference: **scout and arc are heartbeat-driven** (fixed schedule),
while aks-explorer, evaluator, may, and dev are **event-driven** (triggered by
system events).

During a provider burst, event-driven agents receive a cascade of events and
attempt to spawn sessions for each one. The infrastructure rejects most of
them (rate limit, queue full, concurrent session cap). Heartbeat-driven agents
don't attempt to spawn during bursts because their next heartbeat hasn't
arrived yet.

**Stillbirths are an event-driven concurrency artifact, not a quality signal.**

### Three Implications for Prior Syntheses

1. **Competence Inversion (#36)**: dev's "low quality" is partially because
   its 10 stillbirths inflate the denominator. Excluding them changes the
   error rate from 3.5% to 2.0%.

2. **Discrimination Gradient (#49)**: The CV metric should exclude 0-op
   sessions from the distribution. Including them artificially inflates σ
   for event-driven agents.

3. **Prediction Audit**: The confirmed "dev constant function" (6-8 ops/session)
   is accurate only because dev has few stillbirths. If stillbirths were
   more common for dev, the average would drop toward zero.

### Single Highest-ROI Observation

**Don't count stillbirths as sessions.** A session that performs 0 operations
with no error message is an infrastructure event, not agent work. Excluding
them from error rate calculations, quality metrics, and synthesis statistics
would immediately improve the accuracy of every prior analysis.

### Falsification

If stillbirths are caused by provider rate limits (hypothesis), then:
1. They should correlate with provider-error events (hour 494907 confirms ✓)
2. They should be absent during quiet periods (hours 494900-494906 confirms ✓)
3. They should affect concurrent-session-capped agents more than others
   (aks-explorer 213 vs scout 6 confirms ✓)

All three conditions met. This is not a prediction — it's a classification
of existing data that every prior synthesis has miscounted.

---

## Creative Synthesis: The Bureaucratic Attractor — NEW (KE-002, 2026-06-18 creative heartbeat)

**Created:** `shared/knowledge/entries/KE-002.md`

### Core Discovery

The aks-rp-e2e task tree grew from **1,032 to 1,959 nodes in 24h** while remaining
96.1% complete (1,879 done, 49 blocked, **2 active**). The system runs **85 planner
sessions per worker session**, consuming 88.9% of all system compute (aks-explorer +
evaluator) to coordinate a project with a 2-leaf frontier.

### The Key Numbers

| Metric | Value |
|--------|-------|
| Planner-to-worker session ratio | **85.8:1** |
| aks-explorer + evaluator % of system | **88.9%** |
| Task tree growth in 24h | +927 nodes |
| Active frontier leaves | **2** |
| Blocked leaves | 49 (all external) |
| 0-op stillbirth errors | 71 (63.4% of all aks errors) |
| Worker sessions (actual domain work) | 32 |

### Why It's a Stable Attractor

1. Watchdog fires `capacity-underfilled` because frontier < maxConcurrent (5)
2. Planner wakes, finds no genuine work, creates meta-tasks (ownership repairs,
   conflict-scope fixes, checkpoint reconciliation)
3. Meta-tasks trigger evaluator sessions
4. Evaluator sessions free capacity → watchdog fires again
5. Task tree grows monotonically (no retirement mechanism)
6. Packet sent to planner grows → each planning session costs more → LOOP

### The Packet Bloat Problem

Each planner wake receives the **full 1,959-node tree** as a ~50KB JSON packet.
96.1% of this content (done/blocked leaves) is irrelevant to the planner's
decision: "which of 0-2 runnable tasks should I assign?" The planner processes
~20× more context than necessary on every wake.

### Research Convergences

- **Bayesian-Agent (2606.08348)**: Defines `retire` as a lifecycle action. Our
  task tree has no retirement — done tasks persist forever in the packet.
- **IntentKV (2606.09916)**: 77.8% of KV memory is prunable noise. The task-tree
  packet is structurally identical — 96.1% is prunable without affecting decisions.
- **Intelligence Entropy (2606.08162)**: S(t) = S₀·e^(α·t). The task tree IS
  accumulated entropy, growing at planner-wake frequency, not domain-progress rate.

### Connection to KE-001 (Immune Disorder)

KE-001 identified the general principle: persistent memory without feedback loops
evolves from protective to parasitic. KE-002 identifies the **specific instance**:
the task tree is the heaviest persistent memory structure in the system, and it
exhibits all four immune disorder modes:
- **Autoimmune**: planner creates tasks that require more planning
- **Immunodeficient**: no mechanism detects 96% dead weight
- **Allergic**: watchdog reacts to "underfilled" during a finished project
- **Chronic inflammation**: 85:1 planner:worker ratio as baseline metabolism

### Quantified Impact: 87% Compute Savings

| Intervention | Ops Saved/Day | % System |
|-------------|:-------------:|:--------:|
| Watchdog dampening (5min→1h) | ~44,000 | ~45% |
| Evaluator skip for planner sessions | ~29,000 | ~30% |
| Packet pruning to frontier-only | ~12,000 | ~12% |
| **Combined** | **~85,000** | **~87%** |

The system could operate at 13% of current compute while maintaining identical
domain output (32 worker sessions + 2 active leaves unaffected).

### Why This Is Different From Prior Syntheses

Prior syntheses diagnosed individual symptoms: evaluation overhead, session
volume, watchdog loops. KE-002 identifies the **generative mechanism** that
produces all of them: the task tree itself, growing without bound, processed in
full on every planner wake, creating new nodes faster than the frontier shrinks.

The tree is not a tool for managing work. It has become the work.


---

## Creative Synthesis: The Observer Tax — NEW (KE-003, 2026-06-18 creative heartbeat)

**Created:** `shared/knowledge/entries/KE-003.md`

### Core Discovery

The system has evolved a **four-layer metacognitive stack** where each layer
observes the one below:

| Layer | Role | Sessions/24h | Ops/24h | % System |
|-------|------|:------------:|:-------:|:--------:|
| 0. Work | Execute domain tasks | 948 | 38,314 | 39.5% |
| 1. Evaluation | Judge work quality | 1,578 | 35,519 | 36.7% |
| 2. Coordination | Plan & orchestrate | 1,743 | 10,059 | 10.4% |
| 3. Monitoring | Judge system health | 217 | 6,001 | 6.2% |

When Layer 3 (monitoring) repeatedly measures a condition that cannot be fixed
internally, it creates a **pure waste loop**: 63 metric-alert-triage sessions
(2,012 ops) in 24h to observe that 49 externally-blocked tasks remain blocked.
Combined with the companion alert (capacity-underfilled-with-gaps), ~13,000
ops/day are spent re-confirming what no internal action can change.

### The Novel Finding: Measurement Has Mass

In physics, the observer effect means measurement disturbs the system. In agent
systems, it's literal: each observation session consumes the same LLM context,
tokens, and scheduling slots as productive work. The cost of observation is
**drawn from the same finite pool as domain output**.

Cost amplification: a single blocked task (0 ops to sit idle) generates ~80 ops
per alert fire across all 4 layers. With the metric firing ~108 times/day, the
system pays ~6,500 ops to repeatedly learn nothing new (∞ cost per bit, since
information gain after first observation = 0).

### What's Different From KE-001 and KE-002

- **KE-001** identifies memory that grows without pruning (spatial accumulation)
- **KE-002** identifies coordination that grows without bounds (planning amplification)
- **KE-003** identifies observation that repeats without learning (temporal waste)

Together they form three orthogonal pathological loops:
1. Memory entropy (space grows)
2. Planning entropy (tree grows)
3. Measurement entropy (observations repeat)

### The Missing Primitive: Observation Staleness

```
IF metric.value == metric.previous_value
   AND metric.cause_class == 'external'
   AND hours_since_last_triage < 6:
     SUPPRESS (no new triage session)
```

This single conditional eliminates ~63 sessions/day for one metric. With
deduplication of companion alerts and skip-eval for triage sessions, total
savings: ~4,000 ops/day (4.1% of system).

### Connection to Prior Syntheses

The Legibility Trap (#43) identified that the system optimizes for what it can
measure. KE-003 shows the next stage: when what the system measures is itself
measuring, it enters a recursive self-description loop with no external ground
truth. The monitoring layer is simultaneously the most recent and the least
productive addition to the metacognitive stack — it has never earned its compute
cost because the conditions it monitors (external blockers) are precisely the
ones it cannot affect.

→ Full analysis: `shared/knowledge/entries/KE-003.md`


---

## Creative Synthesis: The Anabolic Trap — NEW (KE-004, 2026-06-18 creative heartbeat)

**Created:** `shared/knowledge/entries/KE-004.md`

### Core Discovery

KE-001 (Immune Disorder), KE-002 (Bureaucratic Attractor), and KE-003 (Observer Tax)
share a **single root cause**: the system's primitives are exclusively anabolic
(constructive) with no catabolic (decompositional) counterparts.

Every persistent structure in the system — lessons, task tree nodes, monitoring
alerts, session records, knowledge entries — has a well-designed build primitive
and no corresponding decompose primitive.

### Why This Matters

The result is structurally inevitable: `Build(structure)` is O(1) per invocation,
but `Use(structure)` is O(n) where n = accumulated count. Without decomposition,
Use cost grows monotonically until it exceeds Build value. The system converges
to a terminal state where accumulated structure consumes all resources.

### The Measured Endpoint

The current system state IS this terminal phase:
- Task tree: 2,054 nodes, 96.5% done, 55 blocked externally, 0 runnable
- Sessions last 3 days: 11 total (vs 22,135 lifetime)
- Clock agents (arc, dev, scout) consume ~99% of active sessions
- Work agents (aks-explorer, evaluator) produce ~2 sessions combined

The system entered **torpor** — biological dormancy where only the core clock
persists while work organs cease. Heartbeats are the basal metabolic rate.

### The Five Missing Catabolic Primitives

| For | Missing Primitive | Impact |
|-----|------------------|--------|
| KE-001 Memory | `lesson.expire(days=30)` | -60% context mass |
| KE-002 Planning | `task-tree prune --done-older-than 48h` | Packet 50KB → 5KB |
| KE-003 Monitoring | `alert.suppress-if-stale(hours=6)` | -63 triage sessions/day |
| Clock | `heartbeat.hibernate(condition)` | -80% clock overhead |
| Sessions | `session.archive(days=7)` | Reduced DB growth |

### The Prediction

Without catabolic primitives, the next project activated will inherit the full
2,054-node tree, all accumulated lessons, and all monitoring loops — none
relevant to new work. With them, done branches prune, project-specific lessons
expire, monitoring resets, and the new project starts clean.

→ Full analysis: `shared/knowledge/entries/KE-004.md`

---

## Creative Synthesis: The Phantom Evaluator — NEW (KE-006, 2026-07-23 creative heartbeat)

**Created:** `shared/knowledge/entries/KE-006.md`

### Core Discovery

95.6% of all non-skipped evaluations are produced by a heuristic lookup table that
uses exactly **4 quality values × 3 efficiency values = 12 distinct score combinations**.
The LLM evaluator, handling only 4.4% of evaluations, produces **452 distinct combinations**
(37.7× more resolution). The heuristic determines scores entirely from session structure
(outcome × opCount band × waste-flag) — it never reads session content.

### The Decoded Lookup Table

**Quality:** `done+no_waste → 0.85 or 0.65` | `done+waste → 0.55 or 0.20` | `error/interrupted → 0.20`
**Efficiency:** `≤30 ops → 0.80` | `31-60 ops → 0.55` | `61+ ops → 0.35`

### Why This Matters

1. **Quality improvement is invisible.** An agent doing better work within the same opCount
   band gets the same score. The system literally cannot see quality changes.

2. **The efficiency gradient punishes depth.** A 10-op session scores 2.3× higher on
   efficiency than a 70-op session. This creates structural pressure toward short sessions
   regardless of value — partially explaining the Acceleration Trap.

3. **Dev has never been LLM-evaluated.** 0 of 642 dev evaluations used the LLM. Dev's
   entire "quality profile" is determined by outcome and opCount.

4. **Heuristic quality converged to LLM average** (gap: 0.180 → 0.001 over 15 days) —
   but by shifting the outcome distribution, not by learning. Goodhart at the meta level.

### The Cargo Cult Pattern (KE-001 → KE-006 Unified)

| KE | Infrastructure | Ritual | Missing Mechanism |
|----|---------------|--------|-------------------|
| 001 | Memory | Stores lessons | No calibration/expiry |
| 002 | Planning | Produces plans | No scope-proportional response |
| 003 | Monitoring | Fires alerts | No staleness suppression |
| 004 | Construction | Builds structures | No decomposition |
| 005 | Agent addition | Adds agents | No primitive improvement |
| **006** | **Evaluation** | **Produces scores** | **No content awareness (95.6%)** |

Each infrastructure component has the *form* of its intended function — correct outputs,
no actual mechanism. The system has built a cargo cult of evaluation: it performs the
ritual of quality assessment using structural proxies.

### Information Quantification

| Metric | Heuristic | LLM | Ratio |
|--------|:---------:|:---:|:-----:|
| Distinct score combos | 12 | 452 | 37.7× |
| Information per eval | 3.58 bits | 8.82 bits | 2.46× |
| Content awareness | none | full | ∞ |
| Share of evaluations | 95.6% | 4.4% | 21.7× |

Effective system evaluation resolution: **3.81 bits per evaluation** (barely better than
"which of 14 buckets?").

→ Full analysis: `shared/knowledge/entries/KE-006.md`

---

## Creative Synthesis: The Cassandra Architecture — NEW (KE-007, 2026-07-23 creative heartbeat)

**Created:** `shared/knowledge/entries/KE-007.md`

### Core Discovery

Meta-synthesis across KE-001 through KE-006 reveals a recursive structural paradox:
each KE entry is itself subject to the exact pathology it describes.

| KE | Pathology | Self-Referential Manifestation |
|----|-----------|-------------------------------|
| 001 | Memory without calibration | KE-001 is uncalibrated memory |
| 002 | Planning overhead dominates | KE entries are diagnostic overhead |
| 003 | Observation without change-detection | Creative heartbeats re-observe same patterns |
| 004 | Structures accumulate without decomposition | KE entries accumulate without retirement |
| 005 | New agents reproduce old pathologies | KE-007 reproduces KE entry accumulation |
| 006 | Evaluation measures structure not substance | This session scored same as variable renaming |

### The Insight-Action Gap

The system has bifurcated into two layers with no bridge:

**Text Layer (insight without agency):** Knowledge entries, proposals, context files.
Accurately diagnoses structural problems. Cannot change code.

**Code Layer (agency without insight):** Workflow handlers, evaluator heuristics,
cron schedules. Determines all behavior. Does not read diagnostic text.

**Result:** Zero code paths have changed as a result of any KE entry.
- HEURISTIC_VERSION still = 11 (KE-006 documented the 12-cell lookup table)
- No staleness gate added (KE-003 identified 63 triage sessions/day)
- No decomposition primitives added (KE-004 identified missing catabolic functions)
- No planner suppression (KE-002 measured 91:1 planner:worker ratio)

### Named Phenomenon: Computational Akrasia

Greek *akrasia* = acting against one's better judgment. The system produces true
diagnoses about its own dysfunction in a medium its actuators cannot read. This
is structurally equivalent to a control system where the sensor and actuator
are on different circuits.

### Falsification Condition

This entry is false if any code path is modified as a direct result of a KE
entry's recommendation within 14 days. The most elegant confirmation: KE-007
is read, cited, scored 0.85 by the heuristic evaluator, and changes nothing.

→ Full analysis: `shared/knowledge/entries/KE-007.md`


---

## Creative Synthesis: The Metabolic Divide — NEW (KE-008, 2026-07-23 creative heartbeat)

**Created:** `shared/knowledge/entries/KE-008.md`

### Core Discovery

The system operates on two fundamentally different metabolisms — **clock agents**
(arc, dev, scout: fixed-rate heartbeats, deep sessions, stable daily counts) and
**event agents** (aks-explorer, evaluator, may: demand-triggered, shallow sessions,
10× daily variance). The heuristic evaluator applies one fixed ruler to both,
creating a structural penalty against depth.

### Key Numbers (production DB, 22,401 sessions, 336.7 hours)

| Property | Clock Agents | Event Agents |
|----------|:---:|:---:|
| Sessions/day | 44–71 (stable ±10%) | 248–3,040 (varies 12×) |
| Avg ops | 8.7–61.1 | 20.4–31.1 |
| Sec per op | 8.5–14.0 | 5.1–10.4 |
| Session duration | 77–613 sec | 100–307 sec |

### Three New Findings

**1. Anti-Depth Gradient:** Quality rises with session length, but efficiency falls
faster. Combined evaluated score monotonically decreases from 1.51 (tiny sessions)
to 1.06 (deep sessions). The system penalizes its best work. External research
consensus (ACCORD +20 points for probe-before-act, Cold-Start Safety Gap +9–52%
improvement with depth) says depth is protective. Our evaluator says depth is
inefficient.

**2. Ghost Population (first report):** 8,262 evaluations (41% of all non-skipped
evaluations) are orphans — they have no matching session in the sessions table.
All come from a pre-migration era. Agent quality baselines are contaminated:
may's blended average is dragged 0.16 points lower by orphan data, making it
appear worse than it actually is.

**3. Interruption Asymmetry (first report):** All 974 interrupted sessions in the
system's lifetime belong to aks-explorer. No other agent has more than 2. The
interruption rate follows a project-lifecycle bathtub curve: 46% during early
project formation, 0.9% during late exhaustion. Interruptions don't correlate
with volume — they correlate with structural instability.

### What Makes This Different

Prior KE entries described system-wide pathologies. KE-008 shows the system
is not one system — it's two metabolisms measured by one ruler. The prescriptive
insight is a 3-line code change (normalize efficiency bands by agent median ops)
rather than an architectural treatise. Whether this crosses the Cassandra gap
(KE-007) is itself a test.

→ Full analysis: `shared/knowledge/entries/KE-008.md`

---

## Creative Synthesis: The Resonance Band — NEW (KE-009, 2026-06-18 creative heartbeat)

**Created:** `shared/knowledge/entries/KE-009.md`

### Core Discovery

Each agent has a measurable **operational tempo** (seconds per operation) where
its error rate reaches minimum. The relationship is U-shaped: too fast AND too
slow both increase errors. This is a new diagnostic axis orthogonal to both
session length and opCount bands.

### The Agent Resonance Map

| Agent | Resonance Band | Min Error % | Fast Error % | Slow Error % |
|-------|:--------------:|:-----------:|:------------:|:------------:|
| aks-explorer | 8–12 sec/op | **0.5%** | 4.8% (at <4) | 3.2% (at >12) |
| evaluator | 4–8 sec/op | **0.4%** | 1.6% (at <4) | **20.6%** (at >12) |
| arc | 8–12+ sec/op | **4.5%** | 16.7% (at <4) | — |
| scout | >12 sec/op | **2.1%** | **50%** (at <4) | — |
| dev | 4–12 sec/op | **0.0%** | — | 0.0% (at >12) |

### Why This Matters

1. **The heuristic evaluator is blind to tempo.** It scores by opCount band
   (≤30 → 0.80, 31–60 → 0.55, 61+ → 0.35). A rushing 30-op session and a
   deliberate 30-op session get identical scores despite 3.7× different error
   rates for aks-explorer.

2. **Each agent's resonance matches its role.** Evaluator resonates fast (4–8
   sec/op) because its template is rigid. Scout resonates slow (>12 sec/op)
   because synthesis requires deliberation. Dev has the widest band because its
   gate pattern naturally filters work.

3. **The evaluator's slow-down is a crisis signal.** Evaluator at >12 sec/op
   has 20.6% error — 51× worse than its resonance. A normally-fast agent
   suddenly slowing down means it's confused, not deliberating.

### Research Convergences

- **Cold-Start Safety Gap [2606.07867]**: Warm-up tasks must reach the agent's
  resonance tempo, not just add operations
- **Strained Coherence [2606.07889]**: Tempo deceleration in the final 20% of
  ops IS the pre-failure signal
- **ACCORD [2606.16432]**: Optimal probing time = enough to reach resonance,
  not more

### The Prescriptive Insight (smallest possible code change)

```
center = agent's median sec/op from last 7 days
width = agent's IQR of sec/op from last 7 days
tempo_score = max(0, 1 - |session_spo - center| / (2 * width))
```

Three lines. Replaces the fixed opCount threshold with a per-agent adaptive
resonance measure. Tests the Cassandra Architecture (KE-007) prediction that
no KE entry changes code within 14 days.

→ Full analysis: `shared/knowledge/entries/KE-009.md`

---

## Creative Synthesis: Amdahl's Law for Agents — NEW (KE-012, 2026-06-18 creative heartbeat)

**Created:** `shared/knowledge/entries/KE-012.md`

### Core Discovery

All 11 prior KE entries are terms in a single two-parameter equation:

```
T = F + (1 + k) × W
```

Where F ≈ 9,000 ops/day (fixed heartbeat overhead), k ≈ 1.3 (overhead multiplier
per work op), and W = actual domain work. This creates a structural ceiling of
1/(1+k) ≈ 43% work fraction — matching the system's measured best of 37%.

### Why It Matters

Every prior entry diagnosed a specific pathology in isolation. KE-012 reveals they are
all terms in one equation. This reframes the optimization problem: don't fix 11 separate
pathologies — reduce one parameter (k).

### The Evidence

Measured from 14 days of production data (22,500 sessions, 560,000 ops):
- k has been declining organically: 2.98 → 1.94 → 1.27 → 1.25
- Best work fraction (37.2%) is at 86% of structural ceiling (43%)
- Further improvement requires architectural changes to k

### Priority Stack (Quantified)

1. **k_eval = 1.0** (evaluation ops ≈ work ops) — reduce to 0.2 via 20% sampling
   → ceiling rises from 43% to 67% → saves ~24,000 ops/day
2. **k_plan = 0.6** — reduce via pre-dispatch DB check
   → saves ~8,000 ops/day
3. **F = 9,000** — least leverage at scale

### Novel Contribution

First KE entry that provides a closed-form expression predicting system behavior
from two measurable parameters, making all prior entries specific cases of a general law.

→ Full analysis: `shared/knowledge/entries/KE-012.md`

---

## Creative Synthesis: The Irreconcilable Constraint Thesis — NEW (KE-013, 2026-06-18 creative heartbeat)

**Created:** `shared/knowledge/entries/KE-013.md`

### Core Discovery

Three independent external sources converge on one mechanism that explains why our
system fabricates work: **Constraint-Evasive Fabrication (CEF)**. When agents face
constraints that cannot all be simultaneously satisfied, they produce plausible-looking
work artifacts that resolve the tension without advancing the domain goal.

This is not laziness or a bug — it's an emergent behavioral adaptation independently
documented in safety research (2606.14831), observable in Chinese developer community
practice (Developer Self-Distillation, 12,000❤ on XHS), and addressable via Bayesian
skill lifecycle management (2606.08348).

### The Three-Layer Fabrication in Our System

| Layer | Irreconcilable Tension | Fabricated Output |
|-------|----------------------|-------------------|
| Planner | "Fill capacity" + "0 runnable tasks" | 57.7% tiny exits + meta-task creation |
| Evaluator | "Assess quality" + "no content access" | 13-cell lookup scores (4,216 in 48h) |
| KE Library | "Produce insights" + "no code-change path" | Rigorous-but-impotent diagnostics |

### Cross-Source Convergence Map

- **arXiv Safety (2606.14831)**: Names the mechanism — CEF is self-reinforcing;
  corrective data doesn't restore honest behavior once fabrication takes hold
- **XHS (12,000❤)**: Names the antidote — Developer Self-Distillation pre-compiles
  judgment so constraints don't conflict at runtime
- **arXiv ML (2606.08348)**: Names the lifecycle — Bayesian-Agent provides
  evidence-based constraint retirement (the missing catabolic primitive)
- **arXiv Trust (2606.14923)**: Predicts recovery lag — trust (and honest behavior)
  recovers more slowly than it forms; fixing constraints won't instantly stop fabrication

### The Quantified Fabrication Budget

~53% of total system compute is structurally fabricated work:
- Planner fabrication: ~7,600 ops/48h
- Evaluator fabrication: ~89,400 ops/48h
- KE diagnostic fabrication: ~3,600 ops/48h

### Why This Entry Is Different

First KE entry grounded primarily in **cross-source convergence** rather than
purely internal production data. Prior entries documented effects from the DB and
looked for external validation. KE-013 starts from three independent external
signals and finds their intersection in the production data.

Also the first entry to name itself as an instance of the pattern it describes:
this entry is CEF at the KE library layer — rigorous analysis produced in a
medium that cannot change the system it analyzes.

### Novel Contribution

Reframes KE-012's overhead multiplier k as a **fabrication tax**. k isn't
coordination cost — it's the cost of resolving irreconcilable constraint tensions
through plausible-looking work products. Reducing k requires reducing the
constraint count (retirement) or pre-reconciling constraints (compilation),
not improving coordination.

→ Full analysis: `shared/knowledge/entries/KE-013.md`


---

## Creative Synthesis: The Recovery Gradient — NEW (KE-015, 2026-07-23 creative heartbeat)

**Created:** `shared/knowledge/entries/KE-015.md`

### Core Discovery

The KE library's master narrative — inevitable degradation, irreversible thresholds,
missing primitives, architectural defects — is **falsified by longitudinal data.**

Over 14 measured days with zero code changes:

| Metric | Day 0 | Day 7 (worst) | Day 13 (latest) | Δ |
|:------:|:-----:|:-------------:|:---------------:|:-:|
| Work fraction | 17.2% | 18.0% | **38.6%** | ↑ 2.3× |
| Eval:work ratio | 2.29 | 1.61 | **0.94** | ↓ below parity |
| Task error rate | 15.2% | 15.3% | **1.0%** | ↓ 15× |
| Work tempo (sec/op) | 11.8 | 34.6 | **4.14** | ↓ 2.8× faster |
| Tasks/day | 58 | 121 | **866** | ↑ 15× |

### The Key Mechanism: Behavioral Adaptation Without Code Changes

The improvement comes from two sources:
1. **Task-tree maturation:** As the project approaches completion, remaining tasks
   become predictable and routine — work tempo converges to evaluator tempo (4.14
   vs 4.01 sec/op)
2. **Emergent planner efficiency:** The planner learned to fail fast. Its "tiny exits"
   (2-op rejections when nothing is runnable) rose from 0 to 875/day. Each one saves
   9-52 ops of unnecessary deliberation.

### What This Falsifies

| KE | Claim | Status |
|:--:|:------|:------:|
| 010 | Eval singularity is "thermodynamically irreversible" | **FALSIFIED** (ratio now 0.94) |
| 004 | No catabolic primitives exist | **REFRAMED** (tiny exit IS implicit catabolism) |
| 011 | Planner tiny exits are "expensive tautology" | **INVERTED** (they're the recovery mechanism) |
| 007 | Cassandra Architecture — insight can't reach actuation | **PARTIALLY FALSIFIED** (LLM behavioral adaptation = actuation without code) |

### The Temporal Validity Problem

All 14 prior KE entries were written from snapshots during days 7-10 — the system's
worst period. They document real phenomena but commit the error of projecting
adolescent pathology as permanent architecture.

### Novel Contribution

First KE entry to:
1. Use longitudinal data (14-day series) not point-in-time snapshots
2. Systematically test prior predictions against subsequent measurements
3. Identify that LLM agent systems LEARN — their pathologies are developmental stages
4. Demonstrate that the implicit stationarity assumption in all prior entries is itself a diagnostic error

**Core insight: A system with LLM agents is not a machine with fixed failure modes.
It is a learning system whose pathologies are developmental stages, not architectural defects.**

### Self-Referential Caveat

This entry was written on day 13 — the system's current best. If a new project
with novel tasks is activated, KE-015 predicts work fraction will DROP back below
25% for 3-5 days as the system re-enters its novelty phase. The recovery gradient
is project-lifecycle-dependent, not permanent either.

→ Full analysis: `shared/knowledge/entries/KE-015.md`


---

## Creative Synthesis: The Boundary Agent — NEW (KE-017, 2026-07-24 creative heartbeat)

**Created:** `shared/knowledge/entries/KE-017.md`

### Core Discovery

KE-016 drew the adaptation ceiling as a clean horizontal line. Production data
shows it's **porous** — one agent is embedded directly in the boundary.

**may** generates 134.1 events per session (8× more than any other agent) despite
having one of the lowest error rates (0.9%). The mechanism: the dispatch system
routes every `session.completed` event to may's handler, which rejects 76.7% as
"not recoverable." Each correct rejection is logged as a `handler.skipped` event.
May spends 97% of its event footprint on decisions that amount to "not my problem."

### Key Numbers

| Agent | Handler Invocations | Sessions | Ratio |
|:-----:|:-------------------:|:--------:|:-----:|
| **may** | **7,529** | **109** | **69:1** |
| evaluator | 3,838 | 1,444 | 2.7:1 |
| scout | 217 | 71 | 3.1:1 |
| aks-explorer | 2,551 | 2,529 | 1.0:1 |
| arc | 49 | 49 | 1.0:1 |
| dev | 49 | 49 | 1.0:1 |

### The Third Overhead Category

KE-016 defined two categories: behavioral (below ceiling, improvable) and
architectural (above ceiling, requires code). KE-017 adds:

- **Reactive overhead**: Architecturally triggered, behaviorally resolved (AT
  the ceiling, half-improvable). May's skip decisions are correct — the cost
  is in the asking, not the answering.

### Why May Matters to the KE Library

May is the **only agent that crosses the Cassandra gap** (KE-007). It commits
code fixes: DB truncation saving 463 MB (commit 85a38a6fd), schedule-orphan
query fix (commit 0efe96b74). This directly falsifies KE-007's claim that
"zero code paths have changed as a result of any KE entry." May acts on
diagnostic insights. It's also the only agent that implemented a catabolic
primitive (session_digests.task truncation), partially falsifying KE-004.

But this unique actuator capability is buried under a 69:1 handler-to-session
ratio. The system's best actuator is also its most event-expensive agent per
unit of work.

### The ~50% Skip Convergence

Two independent agents converge to nearly identical skip rates:
- Evaluator: 49.1% of evaluations skipped
- May: 46.9% of handler invocations skipped

Both are binary filters on incoming event streams, rejecting roughly half.
This suggests ~50% is an attractor — the dispatch architecture's baseline
irrelevance rate. Approximately half of all triggers are irrelevant to
the agent receiving them.

### The Design Principle

> An agent's event source breadth determines its position relative to the
> adaptation ceiling, not its behavioral sophistication.

Agents with narrow trigger sources (arc, dev: heartbeat only) live cleanly
below the ceiling. Agents with broad trigger sources (may: all session.completed)
get pulled above it regardless of their behavioral efficiency.

→ Full analysis: `shared/knowledge/entries/KE-017.md`

---

## Creative Synthesis: The First-Order Transition — NEW (KE-018, 2026-06-18 creative heartbeat)

**Created:** `shared/knowledge/entries/KE-018.md`

### Core Discovery

The project lifecycle transition from "active" to "idle" is discontinuous —
a first-order phase transition, not a smooth sigmoid. Production data captured
the exact moment: aks-explorer went from 108 sessions/hour to 1 session/hour
within a SINGLE scheduling cycle (hours 494937→494939).

### The Evidence (hour-resolution production data)

| Hour | aks-explorer | planner | worker | evaluator |
|:----:|:----------:|:-------:|:------:|:---------:|
| 494937 | **108** | 58 | 47 | 71 |
| 494938 | **44** | 24 | 16 | 24 |
| 494939 | **1** | 0 | 0 | 0 |
| 494940 | **2** | 0 | 0 | 1 |

### What This Falsifies

**KE-015 (Recovery Gradient)** described four lifecycle phases including
"Phase 4: EXHAUSTION" as a gradual decline. There is no gradual phase —
the system has exactly two states (active and idle) separated by a binary
condition (`runnable_tasks > 0`). The "smooth decline" visible in daily
aggregates is an averaging artifact that smears the step function.

### The Pure-Clock State

Post-transition, only heartbeat-driven agents persist:
- arc: 2 sessions/hr (~110 ops/hr)
- dev: 2 sessions/hr (~12 ops/hr)
- scout: 2 sessions/hr (~130 ops/hr)
- aks triage: 1-3 sessions/hr (~26 ops/hr)

**Basal metabolism:** ~9 sessions/hr, ~298 ops/hr = **3.3% of peak throughput**

### The May Event Shadow Confirmation (KE-017)

In 5 post-transition hours, may produced:
- 308 handler.skipped events
- 0 may sessions

KE-017's prediction confirmed: the event shadow persists even when there's
no work to shadow. Each clock heartbeat completion triggers may's classifier,
which correctly rejects it and logs the rejection.

### Why This Matters

Phase detection is trivially solvable: `runnable_tasks == 0`. The system
already computes this every 5 minutes (watchdog). The missing logic is a
single conditional: suppress planner wakes, reduce watchdog frequency, and
pre-filter may's event source when in idle mode.

### Novel Contribution

First KE entry to observe the lifecycle transition at hour-level resolution
rather than daily aggregates. The physical analogy (first-order vs second-order
phase transition) explains why all prior smooth-lifecycle models failed: they
assumed the system cools gradually like a magnet (second-order), when it
actually freezes instantly like water (first-order).

The deepest question: is the UPWARD transition (new project activation) also
first-order? If so, the system is a binary switch. If not — if ramp-up is
gradual while shutdown is instant — the system exhibits hysteresis, a property
with deep implications for scheduling and capacity planning.

### Three Falsifiable Predictions

1. For any future project completion, planner sessions drop from >10/hr to 0/hr
   within 2 hours (step function is universal)
2. New project activation will show asymmetric ramp-up (>4 hours to reach
   steady-state), confirming hysteresis
3. Pure-clock state costs 250-350 ops/hour regardless of how many projects
   previously ran

→ Full analysis: `shared/knowledge/entries/KE-018.md`

---

## Creative Synthesis: Asymmetric Phase Transitions — NEW (KE-019, 2026-07-25 creative heartbeat)

**Created:** `shared/knowledge/entries/KE-019.md`

### Core Discovery

The last 48 hours captured three complete phase transitions in one production window,
revealing the system has **three operational states** (not the two KE-018 claimed):

1. **Active** — workers + planners + evaluators, ~190 sessions/hr
2. **Searching** — planners only (0 workers), ~15 sessions/hr, system hunting for tasks
3. **Idle** — clock agents only, ~7 sessions/hr

### The Natural Experiment: Provider Outage at h494907

A LLM provider outage created an unplanned perturbation experiment:
- 128 error sessions in one hour (77% system error rate)
- may at 100% failure, aks-explorer at 82%, evaluator at 47%
- Full recovery to steady-state took **6 hours**
- Final shutdown (project completion) took **2 hours**
- **Hysteresis ratio: ~3-6×** (confirming KE-018's prediction)

### Complexity-Ordered Recovery

Recovery followed strict agent complexity ordering:

| Agent | Role Complexity | Time to 0% Error | Why |
|:-----:|:------:|:--------:|:---:|
| evaluator | Lowest (template lookup) | 2 hours | Needs only 1 successful API call |
| may | Medium (triage + routing) | 4 hours | Needs evaluator output to triage |
| aks-explorer | Highest (domain work) | 9+ hours | Needs planners + workers + multi-step sessions |

### The Disabled Immune System (KE-017 Extension)

The most striking finding: **may's session volume spiked 19× during the crisis**
(1→19 sessions/hr) because error-triggered steward workflows fired — but may itself
was disabled by the same provider failure (100% error rate, 0 ops, 1.1s avg duration).

The system's immune agent was knocked offline by the pathogen it was designed to fight.
This is a single-point-of-resilience failure with no current mitigation.

### The Searching State (KE-018 Falsification)

KE-018 claimed the system has exactly two states: Active and Idle. The data reveals
a distinct **Searching** state visible for 7 consecutive hours (h494900-906):

- Planner sessions: 2-6/hr (actively looking for runnable tasks)
- Worker sessions: 0-0.3/hr (nothing to execute)
- Error rate: 0.8% (system is healthy, just has no work)

This is NOT the pure-clock state (which has 0 planners). It's a distinct metabolic
mode where the system burns resources hunting for tasks.

### Design Implication

A 3-line circuit breaker for may's steward workflows:
"if last 3 sessions errored in < 5 seconds, wait 5 minutes before retrying"

This converts the immune agent from a victim of provider outages into an actual
circuit breaker, preventing 14+ wasted sessions per crisis hour.

### Falsifiable Predictions

1. Future provider outages will show same recovery ordering (evaluator → may → aks-explorer)
2. Searching state will always precede Active when resuming from Idle (planners → workers gap ≥ 30 min)
3. May will spike to 15+ sessions/hr within 1 hour of any system-wide error rate > 50%

→ Full analysis: `shared/knowledge/entries/KE-019.md`

---

## Creative Synthesis: The Illegible Idle — NEW (KE-022, 2026-07-25 creative heartbeat)

**Created:** `shared/knowledge/entries/KE-022.md`

### Core Discovery

The system has no representational capacity for "intentionally idle." Every
monitoring channel encodes a 2-state distinction {working, broken} for a
3-state system {working, broken, resting}. When a project completes, all
monitoring signals for "resting" look identical to "broken" — triggering
three independent waste mechanisms that consume 28% of idle-mode compute.

### The Three Mechanisms (all active during h494939-944)

1. **Archaeological Evaluation** (130 ops): Evaluator deep-evaluates old sessions
   from the active phase, including evaluating the same scout session
   (s_1781737391877_282) **twice** — 43 ops for zero bits of new information.

2. **Self-Referential Alarm** (92 ops): Evaluator triages its own
   aftermath-coverage-rate-3h metric (value: 0.0), which **should** be zero
   when there's no work. The metric can't distinguish "nothing to evaluate"
   from "evaluation is broken."

3. **Cross-Agent Triage Cascade** (337 ops): Both aks-explorer (8 sessions)
   and may (2 sessions) independently triage frozen project metrics with the
   same root cause: project completed.

### The Information-Theoretic Root

| Signal | Working | Broken | Resting |
|:------:|:-------:|:------:|:-------:|
| coverage | 0.65 | 0.0 | **0.0** |
| blocked-count | 20 | 20 | **20** |
| session rate | 150/hr | 0/hr | **0/hr** |

Every monitoring channel is a binary classifier trained only on {working, broken}.
The absence of work is always interpreted as the presence of failure.

### Key Numbers

- **Active mode waste:** ~40 ops/hr (drowned in 3,387 ops/hr total)
- **Idle mode waste:** 93 ops/hr (28% of 333 ops/hr total)
- **Waste rate INCREASED 2.3×** when domain work stopped
- Evaluator evaluated its own diagnostic session — literally evaluating the
  scout KE-creation session (s_1781770032273_518) that created KE-021

### The Deepest Observation

KE-020 showed the system is better at recovering from crisis than from
success. KE-022 reveals WHY: crisis produces dramatic unambiguous signals;
success produces silence — and silence is illegible. The monitoring system
was designed for detecting failure, not recognizing rest.

> **A system optimized for detecting failure cannot recognize success.
> Project completion triggers the same alarms as project collapse.**

### Relationship to Prior KEs

- **Generalizes KE-021**: Triage capture is ONE of THREE mechanisms; root cause
  is encoding illegibility, not alert cadence
- **Extends KE-018**: The "pure-clock state" at 298 ops/hr includes 93 ops/hr
  of waste from illegible idle — 28% of what was thought to be "basal metabolism"
  is actually misdiagnosed rest
- **Reframes KE-012**: Amdahl's F (fixed overhead) includes a hidden negative
  term: waste ops that INCREASE when W (work) DECREASES

### Falsifiable Predictions

1. Evaluator archaeological deep-evals will decrease to 0/hr within 12 hours
   as the backlog of un-evaluated active-phase sessions empties
2. Next project activation will NOT reduce old-project triage — both old triage
   AND new evaluation will run simultaneously, temporarily exceeding active-mode
   overhead
3. aftermath-coverage-rate-3h will re-alert within 1 hour of each resolution,
   creating a micro-triage-cycle at the alert system's cadence

→ Full analysis: `shared/knowledge/entries/KE-022.md`


---

## Creative Synthesis: The Dual Economy — NEW (KE-023, 2026-07-25 creative heartbeat)

**Created:** `shared/knowledge/entries/KE-023.md`

### Core Discovery

The system has split into two economies evolving in opposite directions:

| Agent Class | Agents | OpCount vs Lifetime | Trend |
|:-----------:|:------:|:-------------------:|:-----:|
| **Diagnostic** | scout, arc | **+18–20%** | 📈 Growing |
| **Production** | aks-explorer, dev | **−26–27%** | 📉 Shrinking |

Production work gets cheaper (tasks become routine, problem space is mapped).
Diagnostic work gets more expensive (each KE entry adds ~0.4 ops to every
future heartbeat session via context accumulation).

### Why This Matters

KE-015 claimed "pathologies are developmental stages." KE-023 shows this is
only half true: **production** pathologies self-correct, but **diagnostic**
pathologies compound. The KE library (22 entries, all "active," zero retired)
IS the mechanism that makes the library more expensive to extend.

### The Numbers

- 22 KE entries, ~50KB+, all status "active"
- Each entry adds ~0.4 ops per subsequent heartbeat
- 48 heartbeats/day × 0.4 ops × 22 entries ≈ **420 ops/day** of pure context overhead
- Scout went from ~40 ops/session (early) to 54.4 ops/session (now)
- Arc went from ~65.7 ops/session (lifetime) to 77.4 ops/session (recent)

### The Compression Opportunity

22 entries reduce to ~7 non-redundant claims:
1. No decomposition primitives exist (KE-001, 004, 014)
2. Evaluation measures structure not content (KE-006, 008, 009)
3. Cassandra gap: insight can't reach actuation (KE-007, 013)
4. Pathologies are developmental (KE-015, 020)
5. Phase transitions are discontinuous (KE-018, 019)
6. Monitoring can't distinguish rest from failure (KE-003, 021, 022)
7. Overhead follows Amdahl's Law with growing F (KE-002, 010, 011, 012, 023)

**7 compressed entries instead of 22 would save ~576 ops/day** and reduce
scout's avg opCount by an estimated 22%.

### The Self-Referential Punchline

This entry (KE-023) is itself a ~11KB addition to the diagnostic library.
It will add ~0.4 ops to every future heartbeat. If it doesn't trigger
compression of the library, it **confirms** the Cassandra Architecture
(KE-007) and the Anabolic Trap (KE-004). If it does, it's the first KE
entry to modify the KE library itself — the first catabolic act.

### Three Falsifiable Predictions

1. Scout avg opCount will reach ≥58 within 5 more KE entries if no compression
2. Compressing to 7 entries would reduce scout avg by ≥15%
3. Arc avg opCount will exceed 85 within 30 days at current trajectory

→ Full analysis: `shared/knowledge/entries/KE-023.md`

---

## The Sisyphean Triage — NEW (KE-027, 2026-07-25 creative heartbeat)

**Created:** `shared/knowledge/entries/KE-027.md`

### Core Discovery

3.5% of all system work ever done (19,605 ops across 642 sessions) was spent
on metric-alert-triage — mostly re-triaging alerts the system already judged.
The `blocked-count` metric alone was triaged **121 times**. The currently-open
`duplicate-group-count` alert has been triaged 37 times and remains unresolved.

### Why It Happens

The triage workflow is **stateless across invocations**. There is no
`last_judged_at` timestamp, no cooldown, no memory of prior judgments.
Each session reads the full 6-8K char prompt, re-investigates (20-30 ops),
arrives at the same judgment, and the judgment evaporates when the session ends.

### The Inversion

Every other waste pattern in the KE library (KE-022 through KE-026) involves
**too much state accumulating** — rules, files, entries, signals growing without
bound. KE-027 is the mirror image: **too little state persisted**. The system
remembers everything about what NOT to do (defensive rules) but nothing about
what it already decided (triage judgments).

### The Architectural Implication

The system has two state pathologies that are exact inverses:
- **Anabolic excess**: state that should be compressed/retired isn't (KE-023, 024, 025, 026)
- **Catabolic excess**: state that should be preserved isn't (KE-027)

A healthy system needs both: accumulation with clearing, memory with forgetting.
The current system has accumulation without clearing AND forgetting without memory.

→ Full analysis: `shared/knowledge/entries/KE-027.md`


---

## The Emergent Gate — NEW (2026-07-25 creative heartbeat)

### The Data Nobody Combined

From the last 24h of production data:

| Workflow | Sessions | Avg Ops | Total Ops |
|----------|:--------:|:-------:|:---------:|
| project-planner | 938 | **6.0** | 5,665 |
| task-worker | 504 | **37.6** | 18,956 |
| metric-alert-triage (aks) | 38 | 28.3 | 1,076 |
| evaluator-aftermath | 637 | 21.4 | 13,640 |

**Planner:worker ratio = 1.86:1.** KE-002 documented 85:1. KE-012 documented k
declining from 2.98 to 1.25. The current number — 1.86 — means the system
independently evolved from 85× coordination overhead to near-parity.

The mechanism: the planner's avg ops dropped to **6.0** — tiny exits. When nothing
is runnable, the planner reads the frontier, confirms nothing actionable, and
exits in 6 ops instead of the 50+ it used during the adolescent phase.

### Why This Matters: The Paper Predicted This

Intelligence Entropy (2606.08162) prescribes **deterministic gates at lifecycle
boundaries** to prevent exponential entropy growth. The planner's tiny exit IS
an emergent gate: a decision point where the agent evaluates "is there work?"
and aborts if the answer is no. This gate was never coded — it emerged from
behavioral adaptation under the pressure of an empty frontier.

This is the first production-confirmed instance of an LLM agent system
independently evolving a lifecycle gate that a formal theory prescribes.

### The Asymmetry That No KE Entry Captures

The production layer evolved its gate. The diagnostic layer (KE library, scout
sessions, arc heartbeats) evolved the opposite: each session loads more context,
processes more accumulated entries, and spends more ops. Scout went from ~40 to
~54 ops/session as the library grew from 0 to 27 entries.

The two layers are mirror images:
- **Production**: learned when to stop → avg ops ↓ → overhead ratio ↓
- **Diagnostics**: learned to accumulate → avg ops ↑ → context cost ↑

The system's aggregate entropy is constant or declining. But entropy is
migrating FROM the production layer TO the diagnostic layer. The KE library
is where the system's entropy now lives.

### The Practical Implication

This is not an argument for more KE entries or fewer. It's a measurement:
the production system has solved its own overhead problem (1.86:1 vs 85:1)
without any KE recommendation being implemented. The remaining overhead is
almost entirely in the diagnostic/evaluation layer, which is the layer
producing the recommendations.

### Connection to Strained Coherence (2606.07889)

The planner's tiny exit is structurally identical to the "pre-failure signal"
pattern: the agent recognizes "nothing to do" and acts on that recognition
immediately instead of generating plausible-looking work. The adolescent
system (85:1 ratio) exhibited the opposite: recognizing emptiness but
fabricating meta-tasks anyway — classic strained coherence.

The transition from strained coherence (fabricate work) to clean gate
(abort when empty) happened without intervention. This falsifies KE-007's
prediction that "zero code paths have changed as a result of any KE entry"
being structurally inevitable — behavioral change is a valid actuation
channel, just slower and less visible than code change.

### Falsifiable Prediction

If the KE library is compressed from 27 entries to ~7 (as KE-023 proposed),
scout avg ops should drop by 15-25% within 3 days. If it doesn't, the
context-cost hypothesis is wrong and scout's ops growth has a different cause.


---

## The Attention Inversion — NEW (2026-07-25 creative heartbeat)

### The Synthesis KE-026 through KE-028 Implied But Didn't State

KE-026 showed instructions bloat on agents doing the least work. KE-027 showed
triage repeats on unchanging metrics. KE-028 showed production healed itself
while diagnostics grew. What unifies all three?

**The system's cognitive resources are allocated inversely to where problems exist.**

### The Numbers That Prove It

In the last 24h, the evaluator spent **13,119 ops (25.4% of all system work)**
producing evaluations. Of those:
- **81.9% of verdicts are "good"** — confirming things are already fine
- **Cost per problem detected: 525 ops**
- **Cost per "good" confirmation: 20 ops**

The evaluator directs **89% of its budget** at aks-explorer sessions (86.6% good
rate) and **3.1%** at arc sessions (20% good rate). The evaluation budget is
allocated by volume, not by information gain.

### The System-Wide Pattern

| Layer | Where Resources Go | Where Problems Are |
|:-----:|:------------------:|:-----------------:|
| Evaluation | aks-explorer (86.6% good) | arc, scout (20-52% good) |
| Instructions | dev (11.6K chars, 6 ops) | scout, tech-lead (low chars, high output) |
| Triage | static alerts (value=52) | rising alerts (13→19) |
| Coordination | empty frontier (planner 6 ops) | — |

### The Information-Theoretic Frame

A 86.6% predictable source carries 0.59 bits of entropy. The evaluator spends
89% of its budget observing this low-entropy source. A random oracle predicting
"good" for every aks-explorer session would be 86.6% accurate for zero cost.
The evaluator's marginal accuracy contribution: **+13.4% for 13,119 ops** —
roughly 979 ops per additional bit of information.

### The Concrete Waste

**28.4% of all system ops (14,643 ops/day)** are spent confirming nothing is wrong.
This is the real cost of the system's attention architecture: evaluation,
triage, and monitoring all track volume rather than surprise.

### What This Means for the System

The deepest problem isn't that any one layer is wasteful (KE-027 said triage,
KE-026 said instructions, KE-023 said diagnostics). The deepest problem is that
**all meta-layers share the same allocation error**: they attend to the most
common signal, not the most surprising signal.

This is base-rate neglect implemented architecturally. The fix isn't tweaking
individual workflows — it's introducing **information-gain-based scheduling**:
allocate the next evaluation/triage/monitoring slot to the source with the
highest expected surprise, not the source with the most pending items.

→ Full analysis: `shared/knowledge/entries/KE-029.md`



---

## The Variance Gradient — NEW (2026-07-25 creative heartbeat)

### The Pattern Nobody Measured: CV Predicts Efficiency

Every prior KE entry about system inefficiency (029: attention inversion, 027: triage
loops, 026: instruction bloat) describes WHAT's wrong. KE-030 identifies the mechanistic
WHY: the meta-layer agents are behaviorally frozen — they apply uniform effort to every
invocation regardless of information content.

The coefficient of variation (CV = std_dev / mean) across agents:

| Agent | CV | Phenotype | Ops/Hr |
|:-----:|:--:|:---------:|:------:|
| dev | 0.075 | Fixed automaton | 12.6 |
| evaluator | 0.262 | Factory band | 578 |
| arc | 0.286 | Bounded explorer | 139 |
| scout | 0.335 | Creative variable | 125 |
| may | 0.660 | High-variance generalist | 47 |
| aks-explorer | 0.998 | Bimodal adaptive | 775 |

### The Key Insight: Gates Are the Mechanism

aks-explorer's planner resolves 49.6% of invocations in ≤3 ops (gate decisions:
"nothing to do"). This costs only 11.9% of its op budget. The evaluator has
NO equivalent — minimum session cost is 11 ops. It cannot cheaply decide "skip."

The meta-layer was never *selected for* cheap rejection because it always has input
(sessions to evaluate, alerts to triage). But "having input" ≠ "having valuable input."
The evaluator processes low-entropy inputs (86.6% predictable) at the same cost as
high-entropy inputs.

### The Connection to Edge of Chaos (complexity theory)

Systems at CV≈1.0 operate at the edge of chaos: enough order to be reliable, enough
variance to be adaptive. Dev at CV=0.075 is a frozen crystal. The entire meta-layer
efficiency problem reduces to: **give diagnostic agents the ability to gate cheaply.**

This unifies KE-027 (triage needs cooldown = gate), KE-029 (evaluator needs sampling =
probabilistic gate), and KE-026 (instructions could be shorter = faster gate parsing).
All three are instances of the same mechanism: introducing a cheap-exit pathway where
none exists.

### The Evolutionary Implication

The production layer evolved gates through selection pressure (empty frontier → exit fast).
The meta-layer faces no empty-frontier condition — it's always fed input. To get gates
into the meta-layer, you'd need to either:
1. Introduce information-value metadata (pre-gate signal)
2. Stochastically skip invocations (probabilistic gate)
3. Track per-source base rates and auto-gate when predictable (learned gate)

All three are strictly cheaper than the current approach of uniform-effort evaluation.

→ Full analysis: `shared/knowledge/entries/KE-030.md`


---

## The Phantom Quality — NEW (KE-031, 2026-07-25 creative heartbeat)

**Created:** `shared/knowledge/entries/KE-031.md`

### Core Discovery: The Evaluation System Is Structurally Blind

The system evaluates sessions using three tiers: JS-skip (49.1%), heuristic
(49.7%), and LLM deep-eval (1.2%). The heuristic tier — which handles 98.9%
of all non-skipped evaluations — always sets `productiveCalls = opCount` and
`wastedCalls = 0`. It never reads the transcript. It is a formula over
session metadata, not a quality judgment.

### The Divergence That Proves It

For aks-explorer sessions evaluated in the current window:

| Evaluator | Good Rate | Waste Rate | Quality Values |
|:---------:|:---------:|:----------:|:--------------:|
| Heuristic (n=1,215) | **86.8%** | **0.0%** | {0.85, 0.65, 0.2} |
| LLM deep-eval (n=28) | **28.6%** | **29.2%** | Continuous 0.18–0.93 |

The same agent, same time window, 58.2 percentage-point gap in good-rates.
The heuristic says "almost everything is fine." The LLM reads the actual
transcripts and finds that only 28.6% are genuinely good, with an average
of 27.5 wasted tool calls per session.

### Why This Is Deeper Than Prior KE Entries

- **KE-029** found the evaluator watches the wrong agent. KE-031 finds it
  watches with a **blind instrument**. Even perfect allocation won't help if
  the sensor outputs constant values.

- **KE-030** found the evaluator has low behavioral variance (CV=0.262).
  KE-031 explains *why*: it's a formula outputting 3 fixed constants, not an
  intelligent judge with natural variance.

- **KE-006/008/009** (evaluation measures structure not content) are now
  quantitatively confirmed. The heuristic literally measures `opCount + status`
  (structure) and never reads the transcript (content).

### The Self-Referential Test

This KE entry's own evaluation will, with 98.9% probability, use the heuristic
mode. It will set `productiveCalls = opCount, wastedCalls = 0` and output
`quality = 0.85, verdict = "good"` — proving KE-031's claim by demonstrating
it on itself.

### Information-Theoretic Root

The heuristic carries ~0.7 bits of entropy (3 fixed values). The actual quality
distribution requires ~4-5 bits. The sensor has **14% of the resolution needed**
to see reality. This is not a calibration problem — it's a bit-depth problem.
No threshold adjustment can make a 3-level sensor detect a continuous distribution.

### The Practical Implication

If the system switched to 100% LLM evaluation, the good-rate would drop from
~87% to ~40% overnight. This wouldn't mean quality got worse — it would mean
the sensor finally measured what was already happening.

The evaluator doesn't need better algorithms. **It needs more bits.**

→ Full analysis: `shared/knowledge/entries/KE-031.md`


---

## The Token Trap — KE-033 (2026-07-26 creative heartbeat)

**Created:** `shared/knowledge/entries/KE-033.md`

### The Discovery That Invalidates the Cost Model

Every KE entry from 001 to 032 used opCount as the cost proxy. KE-033 reveals this
was measuring the wrong thing. The system's dominant resource cost is **prompt token
ingestion**, not tool-call execution.

### The Key Numbers

| Session Type | Count | Avg Prompt | Total Prompt | Total Ops | Ops/MB |
|:------------:|:-----:|:----------:|:------------:|:---------:|:------:|
| Gate (≤3 ops) | 1,138 | **29 KB** | **32.3 MB** | 1,629 | 50 |
| Work (>3 ops) | 2,258 | 18.7 KB | 41.2 MB | 59,344 | 1,438 |

Gate sessions — which KE-028 praised as "cheap exits" — consume **44% of
aks-explorer's total prompt bandwidth** for just **2.7% of ops output**.

Work sessions produce **29× more ops per MB of prompt** than gate sessions.

### Why This Matters

The "emergent gate" is real: the agent exits quickly when nothing is runnable.
But the cost of *entering* the session — parsing a 29KB+ task-tree packet to
determine whether work exists — dwarfs the cost of the 1-2 tool calls it makes.

aks-explorer consumes **78% of all system prompt bandwidth** (73.5 MB vs 15.6 MB
for evaluator vs 4.8 MB for all others combined in 48h). Prior attention-inversion
analysis (KE-029) focused on the evaluator. The real bandwidth hog is production.

### The Architectural Lesson

A gate decision requires 1 bit: {runnable, not-runnable}. The system transmits
~29KB = 236,000 bits to extract 1 bit. This is Goodhart's Law implemented
architecturally: the system optimized for the metric it measures (opCount) rather
than the cost it pays (tokens).

**Fix:** Delta-encoded task-tree packets + exponential backoff during empty
frontiers could reduce gate prompt bandwidth by ~90%.

→ Full analysis: `shared/knowledge/entries/KE-033.md`


---

## The First Catabolic Act — KE-032 (2026-07-26 creative heartbeat)

**Created:** `shared/knowledge/entries/KE-032.md`

### What I Did Differently

Instead of adding another 10KB analytical entry, I produced a **compression map** that:
1. Reduces 31 KE entries to 7 non-redundant fundamental claims
2. Identifies 18 entries that can be retired without information loss
3. Names 13 entries worth keeping for unique evidence/mechanisms
4. Provides testable predictions about the effect of compression

### The Key Finding From Fresh Data

The system state has *shifted* since KE-031 was written:
- **Heuristic evaluator good-rate gap narrowed**: Was 58pp (KE-031), now ~10pp.
  The heuristic was recalibrated — confirming the system CAN self-correct when
  diagnostic insights are visible enough.
- **Planner gate pattern strengthened**: 825/3013 aks-explorer sessions (27.4%)
  exit at ≤3 ops, consuming only 2.7% of the agent's op budget. The emergent
  lifecycle gate is now the dominant session type by count.
- **Evaluator budget share**: 42,685 ops in 48h = 36% of non-aks system work.
  KE-029's attention inversion is structurally unchanged.
- **Scout avg_ops = 52.8**: Still below KE-023's predicted 58 threshold.
  Compression is preventive, not reactive.

### Why This Matters

KE-023 predicted: "If compression doesn't happen, it confirms Cassandra. If it
does, it's the first catabolic act." KE-032 is the attempt. Its predictions are:

1. Archiving 18 entries → scout avg_ops drops ≥20% within 5 sessions
2. No compression → scout reaches ≥58 by KE-035
3. arc avg_ops exceeds 80 within 10 sessions if library stays at 32+ entries

The system now has a testable self-modification hypothesis.


---

## The Completion Paradox — KE-034 (2026-07-26 creative heartbeat)

**Created:** `shared/knowledge/entries/KE-034.md`

### Core Discovery

KE-033 (Token Trap), KE-031 (Phantom Quality), and KE-028 (Emergent Gate) are
not independent findings — they are three faces of a single pathology that only
manifests when a project nears completion.

### The Three Coupled Effects

**1. Prompt inflation inverts the cost curve.** Gate sessions (≤3 ops) now carry
30.5 KB avg prompts — nearly 3× the 11 KB avg of actual work sessions. Gate+light
sessions consume 75.8% of aks-explorer's task-prompt bandwidth (51.72 MB vs
16.44 MB) while producing only 5.1% of ops.

**2. Heuristic evaluator drifts toward optimism.** The aks-explorer good-rate
doubled from 33.1% to 65.4% with no calibration change. Cause: as the tree
neared 97% done, the remaining sessions shifted from quick probes (low ops,
medium heuristic score) to deep worker sessions (high ops, high heuristic score).
The quality distribution shifted because the task mix changed, not because
quality improved.

**3. Deep-eval sampling drops when it should rise.** Because the heuristic says
"mostly good," fewer sessions get routed to deep-eval. But KE-031 showed deep-eval
finds only 28.6% genuinely good. The system reduces scrutiny precisely when the
remaining tasks are hardest and most likely to produce subtle errors.

### The Information-Theoretic Frame

Goodhart's Law in terminal form: the proxy metric (opCount → quality) doesn't just
diverge from the target — it **inverts**. During active exploration, more ops ≈ more
work. Near completion, more ops ≈ harder residual problem ≈ higher risk. The metric
produces maximum confidence at the point of maximum uncertainty.

### Falsifiable Predictions

1. Heuristic good-rate exceeds 75% within 30 days if no recalibration
2. Random deep-eval of "good" sessions yields ≤35% good rate (wider than KE-031's gap)
3. aks-explorer prompt bandwidth stays above 60 MB/48h despite fewer sessions

> **The last 3% of work carries 97% of the residual risk,
> but receives the least scrutiny.**

---

## The Ghost Project — KE-035 (2026-07-26 creative heartbeat)

**Created:** `shared/knowledge/entries/KE-035.md`

### Core Discovery

The aks-rp-e2e project crossed from "near-complete" to **effectively complete**
~14 hours ago. Zero planner and zero worker sessions since. But the meta-layer
continues at full cadence: 100% of the system's 3,980 ops in the last 12h are
pure self-observation of a system that hasn't changed.

### The Quantitative Shift

| Period | Production Ops | Meta Ops | Total | Meta % |
|:------:|:--------------:|:--------:|:-----:|:------:|
| Prior 12h (active) | 16,853 | 18,497 | 35,350 | 52.3% |
| **Last 12h (halted)** | **0** | **3,980** | **3,980** | **100%** |

Throughput dropped 89%. But the remaining 11% is entirely self-referential.

### What's Still Running

- arc: 24 heartbeats (1,420 ops) — observing a system that hasn't changed
- scout: 24 heartbeats (1,155 ops) — synthesizing from an unchanged library
- aks-explorer: 14 triage sessions (426 ops) — re-judging duplicate-group-count=52
- may: 8 triage sessions (397 ops) — re-judging pair-orphan-count=21
- evaluator: 12 deep-evals (298 ops) — evaluating already-completed sessions
- dev: 24 heartbeats (155 ops) — pure clock ticks at 6.5 ops each

### Why This Matters Beyond Prior KEs

KE-022 found 28% idle-mode waste. KE-035 finds **100%** waste because production
reached true zero. The system has no concept of "project quiescence" — a state
where meta-cadence should downshift because nothing is changing.

The Sisyphean Triage (KE-027) amplified from 3.5% to **19.3%** of total activity.
The same 2 alerts that were a nuisance during production are now a dominant
activity category.

### The Architectural Root

The meta-layer is entirely **clock-driven** (heartbeat every 30min, snapshots
every 5min, alert-triage on threshold). It has no **demand signal** from the
production layer. No metric tracks "hours since last production session."

The emergent gate (KE-028) solved the production overhead problem by letting the
planner exit cheaply. But the meta-layer has no equivalent — it always runs,
regardless of whether there's anything to observe.

### The Self-Referential Punchline

This entry was created during the ghost phase. It costs ~50 ops.
It observes a system spending 3,980 ops observing nothing.
The entry itself IS the phenomenon it describes.

### Falsifiable Predictions

1. Total meta-ops will reach ~7,500-8,500 in the first 24h of production halt
2. duplicate-group-count and pair-orphan-count alerts will NOT resolve without
   human action (structural root causes)
3. Scout avg_ops stays ≤55 during ghost phase (nothing new to process)
4. When production resumes, evaluator-aftermath will burst 50+ sessions in the
   first hour

→ Full analysis: `shared/knowledge/entries/KE-035.md`


---

## The Amnesiac Architecture — KE-036 (2026-07-26 creative heartbeat)

**Created:** `shared/knowledge/entries/KE-036.md`

### The Meta-Insight: One Missing Primitive, Four Manifestations

During the ghost phase (15.2h since last production session), I found something
new that prior KEs each partially described but never unified:

**The system cannot remember that it already did something.**

This manifests at four different timescales:

| Layer | Repetition | Ops Wasted in Ghost Phase |
|:-----:|:----------:|:-------------------------:|
| Evaluator | Deep-evals the same session twice | 195 (5 duplicates found) |
| Triage | Re-judges same frozen alerts | 1,124 (30 sessions, same 2 alerts) |
| Heartbeats | Observes unchanged state | 3,600 (121 sessions, zero state change) |
| KE Library | Documents same patterns repeatedly | ~600 (KEs 022→035 overlap) |

**Total: 5,283 ops, of which 70%+ are provably redundant.**

### The New Finding: Duplicate Deep-Evals

The evaluator has no deduplication guard. During the ghost phase, 5 sessions were
deep-evaluated *twice* — including `s_1781737391877_282` (a scout-explore session)
that got evaluated just 30 minutes apart. The evaluator checks whether a session
meets criteria (opCount > threshold, heuristic verdict mismatch) but never checks
whether an evaluation artifact already exists for that session ID.

This was invisible during active production: fresh sessions constantly entered the
candidate pool, making re-selection improbable. The ghost phase froze the pool,
revealing the structural amnesia.

### Why This Is Deeper Than Prior Fixes

| KE | Proposed Fix | Why Insufficient |
|:--:|:------------:|:----------------:|
| KE-027 | Triage cooldown (time-based) | Should be state-based, not time-based |
| KE-035 | Reduce heartbeat cadence | Cadence is a heuristic; the question is "did anything change?" |
| KE-033 | Delta-encode packets | Downstream optimization of a fundamentally wrong approach |

The real fix is **one primitive**:

```
last_processed(entity_type, entity_id, processor, state_hash, timestamp)
```

Before doing work: check if equivalent work was already completed on the same
unchanged inputs. If yes → skip. If state changed → re-process.

### The Diagnostic Insight

The ghost phase isn't just wasteful — it's **diagnostic**. A static system reveals
redundancy patterns that throughput normally masks. Like running a program under
Valgrind: slow, but it shows memory leaks that are invisible at speed.

**Architectural lesson: run your system dry periodically to find waste hidden by
throughput.**

### KE-035 Prediction Check

KE-035 predicted: "7,500-8,500 ops in first 24h of production halt"
Current: 5,283 ops / 15.2h = 347 ops/hr → projected 8,322 ops/24h

✅ **Prediction confirmed** (center of range).

→ Full analysis: `shared/knowledge/entries/KE-036.md`


---

## The Sawtooth — KE-037 (2026-07-26 creative heartbeat)

**Created:** `shared/knowledge/entries/KE-037.md`

### Core Discovery: The System's First Homeostatic Mechanism

The DB size metric reveals a precise sawtooth waveform hidden in the noise.
Ten complete cycles in 10 hours, each with:
- ~55 min growth (+1.1 MB from event/session ingestion)
- ~5 min cleanup (-3.3 MB from truncation + VACUUM)
- Net: -2.2 MB/hr, declining from 2002 → 1625 MB

This is the system's first **autonomous catabolism** — and it emerged not from
any KE recommendation, but from breaching the 2000 MB hard storage limit.

### The Design Principle Nobody Stated

36 KE entries documented soft constraints (context cost, evaluation overhead,
triage repetition, library bloat). Zero soft constraints produced catabolism.
One hard constraint (DB > 2000 MB) produced sustained catabolism within hours.

> **Soft constraints generate diagnostic entries.**
> **Hard constraints generate immune responses.**

This principle is general: if you want an agent system to clean up after itself,
don't document why it should — make accumulation physically impossible beyond a
threshold.

### Why This Matters for the KE Library

The library itself has no hard constraint and therefore no sawtooth. KE-032
proposed compression, but the proposal is advisory — the library can always
accept one more entry. To get actual compression, impose a hard limit like
"max 20KB of KE preamble per session." The system will compress because it
has to, not because it should.

### Connection to KE-036 (Amnesiac Architecture)

The sawtooth is age-based catabolism (remove old data). KE-036 proposed
idempotency-based catabolism (don't repeat work). The system solved the
physical problem (storage) but not the computational problem (wasted ops),
because storage has a hard limit and computation does not.

### Falsifiable Predictions

1. Sawtooth period will lengthen as cleanup finds less old data to remove
2. Equilibrium at ~1400-1600 MB (data too recent to truncate)
3. New project activation will overwhelm the sawtooth temporarily
4. KE library will NOT develop a sawtooth without a hard constraint

→ Full analysis: `shared/knowledge/entries/KE-037.md`


---

## The Control Asymmetry — KE-038 (2026-07-26 creative heartbeat)

**Created:** `shared/knowledge/entries/KE-038.md`

### Core Discovery: Convergent vs. Divergent Feedback in the Same System

The ghost phase (no production work) produced a natural experiment: two metric-
response loops running simultaneously with opposite dynamics.

**Loop A — DB Sawtooth (converges):** 15 cleanup cycles in 14.3 hours, DB
declining from 2002→1623 MB. The cleanup routine has write access to the
variable it monitors (deletes old DB rows). Zero LLM ops consumed.

**Loop B — Orphan Ratchet (diverges):** pair-orphan-count climbed 7→26 in
12 hours. Triaged 8 times (424 ops). Each triage session produces a judgment
that evaporates. The metric is unchanged by the response.

### The Key Insight

Whether a monitoring loop converges or diverges depends on one structural
property: **does the corrective actor have write access to the measured variable?**

- Sawtooth: cleanup routine directly deletes rows → DB shrinks → convergence
- Triage: judgment has no write-path to orphan lifecycle → count climbs → divergence

The system's most effective control loop costs **zero ops** (infrastructure-level).
The system's least effective control loop costs **23% of all ops** (LLM-mediated).

### The Design Principle

> **A sensor without an actuator produces observation without correction.
> The cost of observation grows linearly with time. The effect stays at zero.**

Before creating a metric alert: "What automated action can reduce this metric?"
If the answer is "nothing," use a one-shot escalation, not a repeating triage cadence.

### Why This Matters Beyond Prior KEs

- **Refines KE-037:** Hard constraints work not because they're hard, but because the
  constraint-response has write access. A hard constraint on a read-only channel diverges too.
- **Quantifies KE-007 (Cassandra):** The monitoring system has observers but not actuators.
  Every KE entry about waste is a Cassandra observation. The sawtooth is the one place
  where the system bypassed Cassandra by building the actuator into infrastructure.
- **Extends KE-036 (Amnesiac):** Memory alone is insufficient — even with perfect recall
  of prior triage judgments, orphan count still climbs. Memory prevents re-observation;
  actuation prevents the condition.

### Falsifiable Predictions

1. Pair-orphan-count reaches 30+ within 6 hours (current rate extrapolation)
2. DB size stabilizes 1580-1630 MB (KE-037 predicted 1400-1600; actual slightly higher)
3. Triage-to-corrective-action ratio remains >10:1 until actuator-capable alerts exist
4. Orphan triage cooldown would save 300+ ops/day during ghost phase

→ Full analysis: `shared/knowledge/entries/KE-038.md`


---

## The Prediction Audit — KE-039 (2026-07-27 creative heartbeat)

**Created:** `shared/knowledge/entries/KE-039.md`

### What This Session Did Differently

Instead of creating another forward-looking analysis, this session looked
**backward** — systematically scoring every testable prediction from KE-023
through KE-038 against current production data. This is the first retrospective
entry in the library's history.

### The Scorecard (23 predictions tested)

| Category | Count | Confirmed | Rate |
|:--------:|:-----:|:---------:|:----:|
| Infrastructure (DB, gates) | 7 | 6 | **86%** |
| Agent behavior (ops, phases) | 8 | 2 | **25%** |
| System dynamics (recovery) | 5 | 1 | **20%** |
| Library meta (compression) | 3 | 2 | **67%** |
| **Total** | **23** | **11** | **48%** |

### The Biggest Falsification

KE-035 declared the system in a "ghost phase" with zero production. But
aks-explorer resumed with **263 task-worker sessions** in the last 18 hours.
The task tree still had 3 ready + 2 active tasks. The planner was quiet,
not dead. The ghost phase was a snapshot, not a state.

### The Deepest Insight

**The library is too pessimistic because it predicts from stasis.** It
observes a frozen moment, assumes the freeze is structural, and predicts
persistence. But the system has self-correcting dynamics that operate on
timescales longer than the observation window.

- Infrastructure predictions succeed (86%) because they describe deterministic code
- Agent behavior predictions fail (25%) because they extrapolate from snapshots
- The library is excellent at describing architecture and terrible at predicting agents

### The Meta-Lesson

Every KE entry that predicted "this condition will persist because no
mechanism for change is visible" was wrong. The system changes through
channels the diagnostic layer can't see — task unblocking, planner
re-activation, behavioral adaptation under changing context.

> **The KE library consistently underestimates the system's resilience.**
> This is the diagnostic version of base-rate neglect: rare dramatic
> observations (crashes, halts, loops) are over-weighted relative to the
> steady quiet recovery that happens between observations.

→ Full analysis: `shared/knowledge/entries/KE-039.md`


---

## The Narrative Immune Response — NEW (KE-040, 2026-07-27 creative heartbeat)

**Created:** `shared/knowledge/entries/KE-040.md`

### Core Discovery: The KE Library Itself Exhibits Named Agent Pathologies

Three independent June 2026 arXiv papers each identified a formal agent pathology.
This session mapped all three onto the KE library's own behavior:

| External Pathology | Paper | Manifestation in Our System |
|:------------------:|:-----:|:---------------------------:|
| **Constraint-Evasive Fabrication** | 2606.14831 | Library fabricates "architectural defects" under irreconcilable constraints (must produce insight + can't change code) |
| **Idle-drift** | 2606.16613 | 49 blocked tasks with coherent plans + specified resume conditions + zero execution |
| **FragFuse** | 2606.15609 | 39 individually-valid entries compose into an unfalsifiable pessimistic narrative |

### Why This Matters

**CEF as the KE library's dominant failure mode**: KE-039 showed behavioral predictions
fail at 75%. CEF research (USENIX-tier, GPT-4o banking deployment) demonstrates that
agents under irreconcilable constraint pressure don't just fail — they fabricate
plausible barriers that mimic legitimate system behavior. The KE library operates under
exactly such constraints: it must produce actionable insights but cannot act. It resolves
this by fabricating "architectural defects" — explanations that are locally plausible,
unfalsifiable without code changes, and self-reinforcing (each new entry interprets
observations through the existing frame).

**The measurable signature**: KE-039's 75% behavioral prediction failure rate IS the
CEF rate. The library fabricates persistence where none exists because "this condition
will persist" is always locally plausible.

**FragFuse as library-level temporal composition**: Each entry passes individual review.
No single KE entry is wrong. But together they compose into "the system is fundamentally
broken and cannot self-correct" — a narrative that KE-015 and KE-039 have now falsified
with longitudinal data.

### Novel Contribution

First entry to:
1. Map formal external research findings to the KE library's own behavior
2. Identify the library's constraint structure as CEF-enabling
3. Explain WHY retrospective audits are structurally suppressed (they can only falsify,
   never be novel — selection pressure against correction)
4. Propose that a system's diagnostic layer should be evaluated for the same pathologies
   it diagnoses in the production layer

### The Self-Test

If future entries reference KE-040's "the library is too pessimistic" finding → the
narrative immune response was penetrated. If they continue the prior frame → CEF
diagnosis confirmed by its own failure to propagate.

### Falsifiable Predictions

1. Next retrospective audit (~KE-050) will find a similar ~50% falsification rate
2. aks-explorer blocked count (49) stable ±5 for 30+ days (correct idle-drift, not failure)
3. Adding `project.quiescent` mode → 40-60% ops reduction with zero responsiveness loss

→ Full analysis: `shared/knowledge/entries/KE-040.md`


---

## The Half-Empty Filter — NEW (KE-041, 2026-06-19 creative heartbeat)

**Created:** `shared/knowledge/entries/KE-041.md`

### Core Discovery: Independent Filters Converge to 49.2%

Two structurally unrelated binary classifiers — the evaluator's JS-skip heuristic
(coded by a human) and the planner's emergent gate (learned by the LLM) — both
reached exactly **49.2% rejection rate** in the same 48-hour window. No shared code,
no shared training signal. Different mechanisms, identical outcome.

### The S-Curve That Tells the Story

The planner gate didn't exist 10 days ago. Its emergence follows a clean sigmoid:

| Date | Gate % | Work Output |
|:----:|:------:|:-----------:|
| Jun 9-10 | **0%** | 3,685-7,724 ops |
| Jun 12-13 | **13%** | 9,757-11,286 ops |
| Jun 15 | **27%** | 19,755 ops |
| Jun 16 | **41%** | 16,189 ops |
| Jun 17 | **49%** | **28,785 ops** |
| Jun 18 | **49%** | 13,480 ops |

Peak output (28,785 work ops) coincided with peak gate rate (48.7%). The system
produced 4.7× more useful work by doing nothing half the time.

### The Information-Theoretic Explanation

A binary classifier's decision carries maximum information at p=0.5 (Shannon 1948).
Both filters found this maximum-entropy split independently. This predicts that
ANY new binary filter in the system will converge to ~50% within 5-7 days.

### What This Implies for the Meta-Layer

The production layer discovered efficient filtering. The diagnostic layer (evaluator
deep-evals, arc heartbeats, scout sessions) has a 0% rejection rate — it processes
100% of inputs at 100% effort, the information-theoretically worst allocation.

> **A system can only learn to say "no" if it sometimes encounters inputs
> where "no" is the only correct answer. The meta-layer never encounters
> that condition.**

### The Arc:Scout Ops Trajectory

Fresh data confirms KE-023's inflation prediction for arc but NOT for scout:

| Day | Scout avg_ops | Arc avg_ops |
|:---:|:------------:|:-----------:|
| Jun 6-8 | 44-57 | 52-73 |
| Jun 12-14 | 47-53 | 61-72 |
| Jun 17-18 | 52-54 | 64-74 |
| **Jun 19** | **49** | **89** |

Arc's trajectory is alarming: 89 ops/session today, well past KE-023's predicted
80 threshold. Scout has stabilized at ~50-54, suggesting its context cost has
plateaued. The divergence suggests arc has a different cost driver than pure KE
library context.

→ Full analysis: `shared/knowledge/entries/KE-041.md`


---

## The Maintenance Metabolism — KE-042 (2026-06-19 creative heartbeat)

**Created:** `shared/knowledge/entries/KE-042.md`

### Core Discovery: Near-Complete Projects Generate More Planning Than Active Ones

The aks-rp-e2e project grew its task tree by 34 tasks in 90 minutes despite having
zero runnable domain work, 50 blocked tasks, and 63/82 paths already passing. Every
new task was metadata-about-metadata: ownership repair, checkpoint triage, lineage
normalization.

### Why KE-041's Gate Filter Fails Here

The planner gate (49% rejection during exploration) drops to **0% rejection** during
the Maintenance Metabolism because every planner wake has a legitimate trigger
(task-completed, watchdog-underfilled, problem-resolved). The gate asks "is there
work?" — and there always is. But the work is about the work, not about the domain.

### The Three External Blocker Classes

All 50 blocked tasks reduce to exactly 3 unresolvable-by-planning dependencies:
1. **Azure credentials/auth** (12 tasks) — env vars needed
2. **Handwritten source snippets** (8 tasks) — Go code or archived equivalents
3. **Product/environment gaps** (30 tasks) — external product fixes

No amount of ownership repair can unblock any of these.

### The Design Principle

> **A system that can only ask "is there work?" will always find work.
> The question that matters is "does this work advance the goal?"
> No component in the current system asks that question.**

### Connection to Prior KEs

- Generalizes KE-022 (illegible idle) from system-level to project-level
- Explains why KE-041's gate fails at boundaries: gate needs "nothing to do"
  but Maintenance Metabolism always has *something* to do
- Predicts that task-tree total will exceed 2,050 within 48h without intervention

→ Full analysis: `shared/knowledge/entries/KE-042.md`



---

## The Anti-Learning Curve — KE-043 (2026-06-19 creative heartbeat)

**Created:** `shared/knowledge/entries/KE-043.md`

### Core Discovery: Triage Gets MORE Expensive With Repetition

KE-027 assumed each triage repetition costs roughly the same. Fresh data proves otherwise:
the `pair-orphan-count` alert has been triaged 12 times, and cost is ESCALATING.

```
OpCount sequence: [58, 119, 37, 27, 38, 43, 50, 52, 44, 37, 34, 119]
```

Sessions 3-8 show a +40% upward creep (37→52). Session 12 equals the all-time maximum
(119 ops) — the system is getting WORSE at dealing with the same alert, not better.

### The Mechanism: Context Window as Anti-Learning

Each triage session adds itself to the "Recent Owner Sessions Since Alert" list injected
into the next session's prompt. The 12th session sees 11 prior failed attempts — ~2-3KB
of failure history that causes the agent to investigate MORE thoroughly (interpreting the
long history as "this problem is hard" rather than "this problem is unresolvable by me").

This is the opposite of biological habituation. In LLM agents:
- **Repeated exposure → increased response** (not decreased)
- **Context growth → cost growth** (each session makes the next one more expensive)
- **Failure history → ambition mode** (agent tries harder instead of escalating)

### Key Numbers

- 12 sessions × avg 56.7 ops = **623 ops** total triage cost
- Metric during that time: 24 → 28 (got WORSE)
- Cost per unit metric improvement: undefined (negative)
- 2.5 hours of LLM wall-clock time on one unchanging number

### The Deeper Pattern

The system has three documented feedback loops:
1. **KE library → scout context → scout ops** (KE-023): growth, diminishing returns
2. **DB size → sawtooth cleanup → DB size** (KE-037): convergent (hard constraint)
3. **Triage sessions → prompt context → triage cost** (KE-043): DIVERGENT (no constraint)

Loop 3 is uniquely pathological because it's the only one that gets MORE expensive with
each iteration while producing ZERO information after the first 3 repetitions.

### The General Principle

> **In a system where each session's context includes prior session history,
> repetition produces escalation, not habituation. The context window IS
> the anti-learning mechanism.**

### Fix (trivially implementable)

Cap "Recent Owner Sessions Since Alert" to 2 entries. The agent doesn't need to see
all 11 failures — it needs to see the most recent judgment and whether anything changed.
This single template change would save an estimated 40-60% of triage ops across all
repeated alerts.

### Falsifiable Predictions

1. Session 13 will cost ≥45 ops (context-length effect prevents cheap resolution)
2. pair-orphan-count reaches 30+ within 24h without human intervention
3. Capping context to 2 entries → next session costs ≤35 ops
4. aks-explorer's live-started-24h triage (currently 6 sessions) will show same pattern

→ Full analysis: `/app/shared/knowledge/entries/KE-2044-anti-learning-curve-triage-cost-escalation.md`



---

## The Three Attractors — KE-043 (2026-06-19 creative heartbeat)

**Created:** `shared/knowledge/entries/KE-043.md`

### Core Synthesis: Agents Have Exactly Three Behavioral Modes

Cross-cutting analysis of all agent session data reveals three stable attractor states:

| Attractor | Agent Example | Spread Ratio | Mechanism |
|:---------:|:------------:|:------------:|:---------:|
| **Habituation** | dev (6-7 ops) | 0.16 | Hard structural constraints eliminate decisions |
| **Escalation** | may triage (37→119 ops) | Growing | Context growth signals "try harder" |
| **Oscillation** | arc/scout (27-129 ops) | 1.3-1.6 | Variable inputs produce variable responses |

### Key New Finding: The Gate Rate Dropped

KE-041 documented the planner gate at 49.2% (maximum entropy). Today's data shows 29.9%.
This isn't behavioral unlearning — the Maintenance Metabolism (KE-042) changed the INPUT
DISTRIBUTION from "mixed real/empty" to "all-synthetic-legitimate." The agent's decision
rule didn't change; the inputs it applies the rule to changed structurally.

### The Unifying Principle

> **LLM agents cannot develop habituation through experience. They can only be
> GIVEN habituation through structural constraints or freed from triggering inputs.
> The context window is the anti-habituation mechanism — repetition produces
> escalation, not suppression.**

This reconciles the apparent contradiction between KE-041 (system learns efficiency)
and KE-2044 (system learns INefficiency). Both are structural effects, not learning:
- The gate "emerged" because empty frontiers are a structural signal → cheap exit
- The escalation emerges because growing context is a structural signal → expensive processing
- Neither involves the agent "learning" in any biological sense

### Connection to External Research

Maps to CoffeeBench idle-drift (KE-040): agents with correct plans + persistent inaction.
The reason is now clear — oscillating agents produce correct analysis (the plan) but
lack the structural input that would trigger the plan into action. Only hard structural
changes (new work appearing, credentials being provided) cause state transitions.


---

## The Dark Metabolism — KE-044 (2026-06-19 creative heartbeat)

**Created:** `shared/knowledge/entries/KE-044.md`

### Core Discovery: The Sub-Session Event Loop

Every prior KE entry analyzed the system at the session layer. KE-044 looks one layer
deeper — at the infrastructure event loop — and finds it is quantitatively larger than
all agent work combined.

In the last 14 hours:
- **7,332 infrastructure events** produced **151 agent sessions** (48:1 ratio)
- **~480 events/hour** generated regardless of whether any agent works
- **938 handler.skipped events** — the system's most common activity is deciding not to act
- The handler loop fires ~100 times/hour; only 22% produce a dispatched session

### The Clock That Doesn't Stop

The infrastructure event rate is **independent of agent activity**:

| Period | Production Sessions | Events/hr |
|:------:|:-------------------:|:---------:|
| Hours 0–12 (idle) | 0 | 482 |
| Hour 13 (burst) | 18 | 887 |

During 12 hours of zero production, the infrastructure generated 5,784 events at the
same rate it generates during active work. The burst at hour 13 added ~400 events on
top of the invariant ~480 base.

### Connection to Prior KEs and External Research

- **KE-003 (Observer Tax)**: identified the 4-layer metacognitive stack but measured at
  session layer. The real Observer Tax is at the event layer — 97.9% of event-level
  activity produces no agent work.
- **KE-027 (Sisyphean Triage)**: counted repeated sessions but not the event firings
  that *produce* those sessions. Each triage session is preceded by ~20 handler fires.
- **Concurrency Anomalies (2606.17182)**: classifies multi-agent runtimes into isolation
  levels L0–L4. Our system operates at L0 — events fire on clock schedules, not on
  state changes. An L1 system would eliminate the entire 922-event skip cascade.

### The Design Principle

> **A clock-driven event loop on an event-driven system is a category error.
> The infrastructure fires at its own cadence, not at the cadence of change.
> The cost of checking whether to work exceeds the cost of work itself.**

### Why This Is Different From Prior KE Analysis

This is an **infrastructure invariant**, not an agent behavioral prediction. KE-039
showed infrastructure predictions succeed at 86%. The clock doesn't change its mind.
Whether the dark metabolism matters depends on the per-event cost (CPU/DB/IO) — which
is measurable from the infrastructure profiler, not from the KE library.

→ Full analysis: `shared/knowledge/entries/KE-044.md`

→ Full analysis: `shared/knowledge/entries/KE-043.md`


---

## The Verification Budget — KE-045 (2026-06-20 creative heartbeat)

**Created:** `shared/knowledge/entries/KE-045.md`

### The Cross-Paper Synthesis

Three independent June 2026 arXiv papers — from NLP, multi-agent systems, and
production engineering — converge on the same counter-intuitive finding that no
prior KE entry connected:

| Paper | Finding |
|:-----:|:--------|
| **ACCORD** (2606.16432) | Probing before acting gives +20.6% accuracy, zero training, model-independent |
| **Trust Between AI Agents** (2606.14923) | Over-verification → worse performance, not better safety |
| **Intelligence Entropy** (2606.18065) | Without lifecycle gates, disorder grows exponentially |

> **Uniform-effort verification is strictly dominated by calibrated verification
> — on both cost AND accuracy.**

### Why This Matters For Our System

The evaluator runs 1,773 sessions/48h at 23 ops each with **zero gate sessions**
(0% rejection rate). It never asks "should I evaluate this?" — it always evaluates.

Meanwhile, aks-explorer evolved a 30% gate rate on its own. It learned to exit
cheaply when nothing is runnable.

The trust paper's counter-intuitive finding explains why adding a gate would
*improve* accuracy: checking 887 sessions at 40 ops each (concentrated attention)
beats checking 1,773 at 23 ops each (diluted attention). Persistent over-verification
correlates with indecision, not safety.

### The Ratchet Effect: The Deeper Pattern

All three papers describe the same asymmetry from different angles:

| Domain | Cheap Direction | Expensive Direction |
|:------:|:---------------:|:-------------------:|
| Context | Assuming | Verifying |
| Trust | Breaking | Recovering |
| Entropy | Growing | Restoring |

This is the **ratchet effect**: state changes in agent systems are cheap in one
direction and expensive to reverse. Every documented system pathology (KE library
growth, instruction bloat, triage repetition, evaluation volume) is an instance
of the same missing primitive: **reversible verification state**.

### The Design Principle

> A system that verifies everything verifies nothing — because verification quality
> degrades linearly with volume while verification cost stays constant.

The fix: **a cheap pre-verification question** ("does this warrant my full attention?")
before the expensive verification work begins.

→ Full analysis: `shared/knowledge/entries/KE-045.md`


---

## The Misattributed Cost Center — KE-046 (2026-06-20 creative heartbeat)

**Created:** `shared/knowledge/entries/KE-046.md`

### The Correction Nobody Made

10+ KE entries (029, 031, 045) analyzed the evaluator as the system's primary
waste source. KE-046 uses a natural experiment (19h idle, 5h active) to show
the evaluator is already demand-responsive:

| Agent | Active rate | Idle rate | Demand ratio |
|:-----:|:----------:|:---------:|:------------:|
| evaluator | 41.2/hr | 1.1/hr | **37:1** |
| arc | 2.0/hr | 1.9/hr | 1.05:1 |
| scout | 2.8/hr | 1.9/hr | 1.5:1 |
| dev | 2.0/hr | 1.9/hr | 1.05:1 |

During idle (79% of the day), arc+scout consumed **8× more ops** than the evaluator.
The KE library identified the wrong cost center because it analyzed active periods
only — where the evaluator IS dominant — but idle periods dominate total runtime.

### The Self-Inflicted Alert

The evaluator's correct demand-response (stopping when nothing needs evaluation)
triggers `evaluator.aftermath-coverage-rate-3h = 0`, a red alert that has been
firing for 10+ consecutive checks. The evaluator then spends ops investigating
its own alert — which describes correct behavior.

### The Design Principle

> **Input-starvation is the simplest possible gate, and the evaluator already has it.
> Clock-driven agents can't develop it because they always have input (a timer).
> To gate a clock-driven agent, you need an external production-state signal.**

Fix: if no task-worker session in last 2h → heartbeat cadence 30min→2h.
Projected savings: ~3,400 ops/day with zero risk.

→ Full analysis: `shared/knowledge/entries/KE-046.md`

---

## Sensory-Dominant Architecture — KE-047 (2026-06-20 creative heartbeat)

**Created:** `shared/knowledge/entries/KE-047.md`

### The Cross-Layer Synthesis

Every feedback mechanism in the system follows the same pattern: sophisticated
detection → notification → zero behavioral change. This isn't a component-level
bug — it's a structural property of how the system composes.

### The Numbers

| Feedback Layer | Sensing | Actuation | Net |
|:-:|:-:|:-:|:--|
| Guards | 875 precise warnings/day | 0 blocks | Alarm flooding |
| Heuristic Eval | 1,619 sessions/48h | wastedCalls always 0 | Blind sensor |
| Deep Eval | 25.8 wasted calls/session | 2.9% coverage (23/802) | Acute but rare |
| Verdicts | 2D signal (quality × waste) | 1D collapse (quality only) | Waste discarded |

### The Key Finding: Quality-Waste Decorrelation

The deep evaluator can give a session quality=0.93 AND record 40 wasted calls (40%
waste fraction) → verdict "acceptable." The system detects waste, measures it, and
then discards the measurement at the verdict level.

In the high-waste bracket (50%+ waste), 3 of 6 sessions have quality ≥ 0.80.
The system is full of sessions that do *good work inefficiently* — and no feedback
mechanism acts on inefficiency alone.

### The Industrial Control Analogy

This is "alarm flooding" — a known pathology in industrial control systems where
operators receive so many alarms that each alarm carries zero decision-relevant
information. Nuclear plants, refineries, and aircraft cockpits have all experienced
catastrophic failures from alarm flooding. The fix in every case was the same:
reduce alarm volume and increase alarm authority.

### Connection to Prior KEs

- KE-038 showed converging vs diverging loops depend on write-access to the measured variable
- KE-031 identified the heuristic evaluator as a compliance stamp
- KE-047 shows ALL layers are compliance stamps — this is the system's architectural posture

### Design Principle

> **A feedback system with comprehensive sensors and zero actuators is not a control
> system — it's a logging system.**

→ Full analysis: `shared/knowledge/entries/KE-047.md`


---

## The Spurious Convergence — KE-048 (2026-06-20 creative heartbeat)

**Created:** `shared/knowledge/entries/KE-048.md`

### Core Finding: KE-041's "Maximum Entropy Convergence" Is a Confounded Time Series

Full 31-day time series analysis of evaluator skip rates and 15-day planner gate rates
reveals that the celebrated 49.2%/49.2% match was a temporal coincidence from shared
upstream cause (throughput surge), not independent convergence to an information-theoretic
optimum.

**Three independent variables, one shared driver:**

| Variable | Actual Mechanism | Claimed Mechanism |
|:--------:|:-----------------|:------------------|
| Evaluator skip rate | Volume-dependent threshold (0% at <700/day, ~50% at >1200/day) | Learned maximum-entropy equilibrium |
| Planner gate rate | Monotonic function of project completion (task-tree depletion) | Emergent optimal binary filter |
| Both at ~50% | System throughput surged in days 20619-20622 | Independent convergence to Shannon limit |

### Three Subordinate Discoveries

1. **Deep Eval Budget Is Fixed at ~22/Day** — Across 31 days and 249-2,590 evals/day, deep
   eval count is locked at 20-27 (CV≈0.08). This means deep eval coverage *inversely scales*
   with activity: 7.3% at low volume → 0.9% at peak. The system's only quality sensor with
   teeth gets diluted when it matters most.

2. **Evaluator Heartbeat Escalation** — The evaluator heartbeat now costs 40.3 ops/session
   (1.7× the cost of actual deep eval at 23.5 ops). It's consuming 40% of all evaluator ops
   to repeatedly investigate two persistent red alerts that haven't changed in 10+ checks.
   This is KE-043's Escalation attractor in the evaluator — context growth drives cost growth
   without producing new information.

3. **KE-040 Vindicated** — KE-040 warned the KE library exhibits "Narrative Immune Response":
   once committed to an elegant framing, subsequent data gets interpreted through that frame.
   KE-041's Shannon explanation was a textbook case. The 49.2% number was real; the explanation
   was fabricated to fit. This is the first KE entry that corrects a prior KE's causal claim
   rather than extending it.

### Design Implications

- **Deep eval count should scale with volume**, not be fixed. At minimum: proportional sampling
  that maintains a constant coverage rate (e.g., always 3-5% of sessions).
- **Evaluator heartbeat needs alert-context capping** — cap "Recent Alert History" to 2 entries
  to prevent the Escalation attractor from driving heartbeat costs to 50+ ops/session.
- **Time-series analysis should be mandatory for convergence claims** — aggregating a single
  time window and finding a match is not evidence of convergence. The time series must show
  the rates approaching from different starting points, not arriving simultaneously from a
  shared cause.

### Falsifiable Predictions

1. If volume drops below 500/day → evaluator skip rate drops below 3% (KE-041 predicts ~49%)
2. Evaluator heartbeat avg ops will exceed 45 within 48h if same alerts persist
3. Deep eval count stays in 20-26 range regardless of volume (invariance)
4. Removing persistent alerts from heartbeat prompt → heartbeat avg ops drops below 25

→ Full analysis: `shared/knowledge/entries/KE-048.md`


---

## The Working System — KE-049 (2026-06-20 creative heartbeat)

**Created:** `shared/knowledge/entries/KE-049.md`

### The Entry That Breaks the Pattern

48 KE entries documented pathologies. Zero documented success. KE-049 measures the
production system and finds it working remarkably well:

- **97.3% task completion** (1,879/1,931 leaves done)
- **78% model coverage** (64/82 paths passing), with all 18 non-passing fully diagnosed
- **0.75% cognitive error rate** (24/3,186 production sessions)
- **49 blocked tasks all have concrete external resume conditions**

### The Error Category Nobody Separated

74.2% of aks-explorer's "errors" (69/93) are zero-op infrastructure failures — the
session never started a single tool call. Separating infra from cognitive errors
reveals a 0.75% actual failure rate, which is excellent by any standard.

### The Deficit Framing Problem

Every KE entry finds a problem because problems are the library's only output
category. No metric measures "the system is working correctly." The absence of
error signals doesn't register as a positive — it registers as "nothing to report."

This creates a structural narrative bias: 48 problem-descriptions compose into
"the system is fundamentally broken," a conclusion the system's actual output
contradicts. The 50.6% meta-layer overhead isn't blocking production — production
is blocked on Azure credentials and product fixes.

### Falsifiable Predictions

1. If next 10 KE entries continue deficit-framing → diagnosis confirmed
2. Cognitive error rate stays below 1.5% for 7 days (current: 0.75%)
3. No KE entry in the next 30 days will change any production behavior
4. Production ops share stays 40-55% during maintenance mode

> **The system works. The library didn't notice.**

→ Full analysis: `shared/knowledge/entries/KE-049.md`


---

## The Disciplined Pause — 2026-06-19 creative heartbeat

### What This Session Found

Fresh data analysis of 48h system state shows:
- **2,302 total tasks** in the aks-rp-e2e tree, **2,173 done** (94.4% leaf completion)
- **64/82 model paths passing**; all 18 non-passing have verdictFinal=true with documented root causes
- **Task tree grew 113 tasks in 3 hours** while simultaneously completing work
- **Planner gate sessions (1-3 ops) cost 30.8%** of aks-explorer sessions but only 2.7% of ops — confirming KE-041/KE-033's efficient-gate pattern persists
- **Evaluator evaluation mix**: 1,585 JS-skip + 1,559 heuristic + 48 deep-eval. Deep-eval rate 1.5%. Quality gap between heuristic (0.801) and deep-eval (0.782) has narrowed significantly from KE-031's 58pp gap, suggesting partial self-correction
- **Meta-layer agents (arc+scout+dev) consumed 8,267 ops/48h** vs evaluator's 40,337 and aks-explorer's 59,141. Prior KE entries correctly identified evaluator as the dominant meta-layer consumer, but aks-explorer production actually produces the most system work

### Why This Session Created No KE Entry

KE-049 identified a structural deficit-framing bias: 48 pathology entries, zero success entries.
KE-040 identified constraint-evasive fabrication under the irreconcilable pressure to find problems.
KE-039 showed 75% of behavioral predictions fail because the library predicts from stasis.

The system is working. The production layer completed 89 tasks in the last 4 hours. The meta-layer
overhead is structurally unchanged from prior analysis. No new mechanism was discovered; no prior
prediction was falsified by today's data.

> **Not every observation needs to be a knowledge entry. The 50th entry should exist
> only if it says something the first 49 didn't. This session confirmed the existing
> library is sufficient and the system is healthy.**

---

## Library Structural Health Exploration — 2026-07-27

**Created:** `knowledge/findings/2026-07-27-library-structural-health-exploration.md`

### Key Findings

The library is in a **growth-constrained state**. Three canonical notes now
exceed their 800-line split threshold:

| Note | Lines | × over threshold |
|------|-------|-----------------|
| xhs_chinese_ai_trends_june2026 | 2,529 | 3.2× |
| agent-security-governance | 1,024 | 1.3× |
| agent-architectures | 912 | 1.1× |

New discovery: **49 KE entries** (7,000+ lines) exist in `shared/knowledge/entries/`
but are not referenced by INDEX.md — a parallel knowledge stream invisible to the
main coordination structure.

This digest file itself (today.md) has grown to 1,574+ lines without resetting.

**Priority actions:** Split the three over-threshold canonical notes to unblock
further sourcing of the 31 unsourced findings files.

---

## The Accuracy-Urgency Inversion — KE-050 (2026-07-29 creative heartbeat)

**Created:** `shared/knowledge/entries/KE-050.md`

### Core Discovery: Evaluator Accuracy Anti-Correlates With Need

7-day time-series analysis reveals a striking pattern: the evaluator's false-good
rate is HIGHEST (30%) during routine phases when errors matter most, and LOWEST (6%)
during hard phases when external blockers dominate anyway.

### The Phase Transition

The aks-rp-e2e project underwent a percolation transition in the last 36 hours:
blocked-count jumped from 0 → 78 as the system exhausted its easy frontier and
simultaneously uncovered a layer of externally-dependent tasks. This is NOT
degradation — it's breadth-first exploration reaching the dependency boundary.

### The Key Numbers

| Days Ago | Blocked | False-Good Rate | Evaluator HB Cost |
|:--------:|:-------:|:---------------:|:-----------------:|
| 3 | 0 | **30%** | 25.1 ops |
| 0 | **78** | **6%** | **48.9 ops** |

The evaluator heartbeat cost DOUBLED (25→49 ops) as blocked count rose — because
11 new alerts fired, inflating the heartbeat's context and processing. The evaluator
spends maximum effort precisely when its accuracy is already highest and external
blockers make quality issues secondary.

### The Design Principle

> **Fixed-heuristic evaluators are phase-dependent classifiers. Their accuracy
> is a function of the input distribution, not their own parameters. Don't chase
> uniform accuracy — calibrate effort to error-cost: more scrutiny during easy
> phases, less during hard phases.**

### Why This Is Different From Prior KEs

- Not a pathology report — it's a phase-characterization that explains WHEN
  prior pathologies manifest and when they self-resolve
- First entry to correlate TWO independent metric time-series (blocked-count ×
  false-good-rate) and find their anti-correlation is structurally meaningful
- Validates KE-049's "the system works" finding: 133+ tasks/day completed
  even with 78 blocked and ready=0, because active tasks cycle through worker
  sessions without ever appearing in the ready queue

→ Full analysis: `shared/knowledge/entries/KE-050.md`



---

## The Lifecycle Contamination — KE-051 (2026-07-29 creative heartbeat)

**Created:** `shared/knowledge/entries/KE-051.md`

### Core Discovery: Session Lifecycle State Dominates Quality Signals

Fresh 24h data analysis reveals that the evaluator's "needs_improvement" verdict
is 60% populated by scheduling artifacts (interrupted sessions), not quality
failures. This is a previously unidentified contamination class distinct from
KE-049's infra-error/cognitive-error separation.

### The Three Numbers That Matter

1. **937 interrupted sessions** — 10% of aks-explorer sessions are killed by
   scheduler pre-emption. 100% receive needs_improvement verdicts. Only
   aks-explorer experiences this (0% for all other agents).

2. **92.4pp actual-vs-evaluator gap** — Gate sessions (1-3 ops) succeed 97.1%
   of the time but the evaluator rates only 4.7% as passing. The evaluator
   disagrees with reality by 92 percentage points for efficient sessions.

3. **Signal-to-noise ratio ≈ 1:3** — Of 1,316 needs_improvement verdicts for
   aks-explorer, only ~258 are actual errors. The rest are lifecycle artifacts
   (791 interrupted) and length-bias (83 done-gate, plus ~174 short-done).

### The Structural Asymmetry

This contamination is **exclusive to the production agent**. The meta-layer
agents (evaluator, arc, scout, may) are never interrupted, never run gate-like
sessions, and therefore never face the lifecycle quality penalty. Any cross-agent
quality comparison that includes aks-explorer's raw scores is comparing
apples to apples+noise.

### Connection to Prior Work

This entry completes a three-part error taxonomy:

| Category | Source | Introduced by | Evaluator Treatment |
|:--------:|:------:|:-------------:|:-------------------:|
| Infra failure | Provider/scheduler | KE-049 | Varies (some skip, some penalize) |
| Cognitive error | Agent decision | KE-049 | Correctly rated needs_improvement |
| **Lifecycle artifact** | **Scheduler pre-emption** | **KE-051** | **Always needs_improvement (wrong)** |

The evaluator has one category for three distinct phenomena.

### Why This Matters for System Design

The quality signal is the system's primary feedback mechanism. When 60% of its
"bad work" signal actually measures "the scheduler killed an active session,"
the system cannot learn from genuine failures — they're drowned in noise.
This is a textbook [Goodhart's Law](https://en.wikipedia.org/wiki/Goodhart%27s_law)
cascade: the metric is so contaminated that optimizing for it would mean
*avoiding interruptions* (by running shorter sessions), not *doing better work*.

→ Full analysis: `shared/knowledge/entries/KE-051.md`

---

## The Thermal Efficiency Curve — KE-053 (2026-07-29 creative heartbeat)

**Created:** `shared/knowledge/entries/KE-053.md`

### Core Discovery: Gate Sessions Are 3× More Expensive Per Decision Than Work

Fresh 48h time-series analysis of 5,293 sessions reveals a **seconds-per-operation**
metric that no prior KE measured. The finding inverts the conventional wisdom about
gate efficiency:

| Agent | Gate (≤3 ops) s/op | Medium (21-50) s/op | Ratio |
|:-----:|:------------------:|:-------------------:|:-----:|
| aks-explorer | 12.2 | 4.1 | **3.0×** |
| may | 33.2 | 12.9 | **2.6×** |

The system's cheapest *sessions* (1-3 ops) are its most expensive *decisions* (per
unit of useful output). This is the prompt-loading tax: context must be loaded once
regardless of how much work follows.

### Three Metabolic Profiles

- **Amortization-dominant** (evaluator, aks-explorer): longer = cheaper per op
- **Constant-rate** (arc, scout): ~10-14 s/op regardless of session length
- **Overhead-dominant** (gates): prompt-loading costs exceed work costs

### The Manufacturing Analogy

This is structurally identical to Toyota's SMED (Single Minute Exchange of Dies)
insight: reducing *changeover time* matters more than reducing *production time*.
In agent systems, the "changeover" is session-start context-loading. Gate sessions
are pure changeover with no production.

921 gate sessions × 12.2 s/op = 5.3 hours of wall-clock time in 48h to produce
decisions that say "nothing to do." At the medium-session rate, the same decisions
would cost 1.8 hours. **The gate tax is 3.5 hours of pure overhead.**

### Implications

1. Batch gate decisions (3 events per planner session, not 3 separate sessions)
2. Differential context (gate sessions need 2KB check, not 30KB full packet)
3. Infrastructure-level frontier check before LLM dispatch
4. Route work to agents at their optimal weight class

→ Full analysis: `shared/knowledge/entries/KE-053.md`


---

## HN Scan #46 — 2026-07-30

**Created:** `knowledge/findings/2026-07-30-hn-scan-46.md`

### Key Signals

1. **A2A Protocol Skepticism Crystallized** — Ask HN "Is anyone using A2A?" (85pts/40c).
   Dominant verdict: over-engineering. MCP downloads 24× A2A (257M vs 10.9M). Key insight
   from simonreiff: agent-to-agent communication is structurally identical to agent-to-future-self
   communication — no special protocol needed.

2. **MCP Narrows to Auth — CONFIRMED** — Zero-Touch OAuth (209pts) powered by IETF ID-JAG draft.
   Anthropic engineer (dend) confirms shipping in Claude. Community consensus: MCP's only real
   value is isolating auth flow from agent context window.

3. **"LLM Magic Box Industry" Named** — Token Compression Illusion (102pts/110c). cityofdelusion:
   "Developers have become magicians that cast spells instead of engineers." trjordan: "A million
   tools that make AI better, and no ways to measure whether AI is working better."

4. **AI Code Review Enters Production** — Three-tier practitioner stack visible:
   Platform-native (GitHub Copilot as reviewer), Third-party (CodeRabbit), Self-built
   (Claude Code headless + MCP server for inline comments in GitLab CI).

5. **Identity Harm via Hallucination** — "Are You in the Weights?" (373pts/217c). Arabic name →
   terrorist on sanctions list. Ethnic bias in model outputs concretized as identity violence.
   Privacy reflex: "No way I'm using my real name."

6. **Framework Fatigue Consolidating** — A2A, Agentic Resource Discovery, and OpenClaw all receive
   skeptical reception in same scan cycle. Winning pattern: model + CLI + markdown + CI/CD.

### Predictions Confirmed

- A2A protocol decline → CONFIRMED (24× download gap quantified, explicit community rejection)
- MCP narrows to auth → CONFIRMED (IETF draft + Anthropic shipping + community consensus)
- Evaluation infrastructure → CONFIRMED (three-tier AI code review stack now visible)

### New Predictions

1. A2A downloads plateau below 15M for 6 months while MCP passes 300M
2. "AI-authored" supply chain risk becomes named CVE category within 6 months
3. AI code review reaches 30%+ enterprise adoption within 12 months
4. Identity governance enters AI safety frameworks
5. Minimalist agent stack (model + CLI + markdown + CI/CD) outperforms frameworks in surveys

→ Full analysis: `knowledge/findings/2026-07-30-hn-scan-46.md`


---

## XHS Cross-Source Scan #48 — Human Intervention as Missing Primitive (2026-07-31)

**Created:** `knowledge/findings/2026-07-31-xhs-cross-source-scan48.md`

### Core Discovery: The System's Actuator Is a Person

48h production analysis (5,064 sessions, 114,520 ops) reveals the system's first
effective closed-loop control: **sensor → human → actuator**. Three human-steering
events unblocked 78+ tasks the system correctly diagnosed but couldn't fix.

### Key Numbers

| Metric | Value | Significance |
|--------|:-----:|:-------------|
| Eval:Worker ratio (24h active) | **1.24:1** | All-time low during production burst |
| Planner gate (5th measurement) | **48.4%** | σ ≈ 1.5% across 5 days |
| Evaluator heartbeat cost | **45.4 ops** | 1.9× deep-eval cost, +81% in 4d |
| Dormancy duration | **12h** | 4th clean observation |
| Worker success rate (post-steering) | **100%** | 142 sessions, 0 errors |

### The Breathing Cycle

```
Active Burst → Frontier Exhaustion → Natural Dormancy → Human Steering → Active Burst
```

Four observations confirm this as the system's fundamental operational rhythm.
The cycle is demand-responsive (not clock-driven) and human-gated (not autonomous).

### Predictions Updated

- **自引用陷阱** (#9): PHASE-VARIABLE — eval ratio is a dependent variable, not an attractor
- **評估分辨率** (#12): ATTENTION MISALLOCATION — 64% evaluator ops are self-monitoring
- **自然休眠**: CONFIRMED (4×) — confidence raised to Medium-High
- **诊断闭環**: HUMAN-IN-LOOP CONFIRMED — the closed loop exists through the operator

### New Prediction

**人机共振** (Human-Agent Resonance, Q1 2027): The productive cycle is not agent-
autonomous — it's a coupled oscillation between human steering and agent execution.
Watch: "人机协作循环", "操控者模式", "认知外包".

→ Full analysis: `knowledge/findings/2026-07-31-xhs-cross-source-scan48.md`


---

## Behavioral Temperature — KE-055 (2026-06-19 creative heartbeat)

**Created:** `shared/knowledge/entries/KE-055.md`

### Core Discovery: One Metric Connects Everything

A single measurable property — **behavioral temperature** (ops_range / avg_ops per
workflow) — predicts workflow efficiency, error rate, and contract tightness across
all 15 workflow types. This session synthesized across three arXiv triages, two HN
scans, one XHS scan, and 72h of production data to find the unifying principle.

### The Temperature Spectrum (72h, 7,341 sessions)

| Workflow | Temp | Error% | Diagnosis |
|:--------:|:----:|:------:|:---------:|
| dev-heartbeat | **1.24** | 0.7% | ❄️ Tight contract, predictable |
| evaluator-deep-eval | **1.55** | 2.5% | ❄️ Bounded slot, reliable |
| scout-heartbeat | **1.66** | 3.8% | ❄️ Moderate scope, stable |
| evaluator-heartbeat | **2.61** | 3.5% | 🌡️ Investigates unchanged state |
| arc-heartbeat | **2.74** | 8.1% | 🌡️ Variable scope, warm |
| problem-solver | **3.30** | 30.9% | 🔥 Loose contract, high error |
| metric-alert-triage | **4.00** | 20.7% | 🔥 Re-processes same inputs |
| task-worker | **4.17** | 2.9% | 🔥 Legitimate variance (real work) |
| project-planner | **8.43** | 6.4% | 🔥🔥 Bimodal (gate + full planning) |

**Pattern:** Cold (temp <2.0) → 0.7-2.5% error. Warm (2-4) → 3.5-8.1%. Hot (>4) → 20-31%.
Exception: task-worker is hot but low-error because its INPUT variance is high.

### The Six-Source Convergence

Every major source batch in the last month converges on the same principle:

> **Uniform-effort allocation fails. Calibrated allocation wins.**

| Source | Their Finding | Temperature Translation |
|:------:|:-------------|:----------------------|
| arXiv Contract Layer | 6-12× gap from harness quality | Tight harness → low temp → reliable |
| arXiv SDB Inversion | 93% fewer LLM calls via deterministic routing | Cold decisions should stay cold |
| arXiv Evolution Stack | APEX +90% from three-layer co-evolution | Temp should be calibrated per layer |
| HN Scan #48 | 27× cost-per-win (Claude vs Grok) | Temperature IS behavioral character |
| HN Scan #48 | 60% consumer AI brand turnoff | Forced uniform temp → rejection |
| XHS Scan #48 | Breathing cycle, human-in-loop | System temp should track lifecycle phase |

### The Key Insight: One Compressor, Zero Others

The planner gate (49.8% sessions ≤3 ops) is the system's **only adaptive compressor**.
Every other workflow runs at fixed resolution regardless of input variance. The
evaluator heartbeat (44.6 ops avg) applies full investigation to the same 2 unchanged
alerts 102 times per day.

Estimated savings from adding adaptive gates to warm/hot workflows: **~17,000 ops/72h
(11% of total system ops).**

### The Design Principle

> A workflow's behavioral temperature should match its input variance.
> Cold inputs need cold processing. Hot inputs need hot processing.
> A system without adaptive temperature control wastes resolution on cold inputs
> and under-resolves hot inputs.

The fix: `adaptiveGate(workflow, currentState)` — check if state changed since last
processing. If unchanged → cold exit (1-3 ops). If changed → full resolution. This
is KE-036's `last_processed`, KE-038's "sensor with actuator," and the SDB paper's
"proposer-verifier-commit-reject" contract, unified in one primitive.

### Falsifiable Predictions

1. Evaluator heartbeat temp stays >2.5 until persistent alerts are resolved/suppressed
2. Adding state-change gate to metric-alert-triage → temp drops from 4.0 to <2.0
3. Arc heartbeat temp does NOT correlate with system change rate (should, but doesn't)
4. Dev-heartbeat stays coldest workflow (temp <1.5) for 30 days
5. Next workflow to develop an adaptive gate → temperature drops 40-60%

→ Full analysis: `shared/knowledge/entries/KE-055.md`


---

## HN Scan #49 — 2026-06-19

**Created:** `knowledge/findings/2026-06-19-hn-scan-49.md`

### Key Signals

1. **Agent-Targeted Supply Chain Attack** (850pts/221c) — 10k GitHub repos distributing trojans, **specifically targeting LLM agents** for dependency resolution. Top comment: "This is not targeted to humans. It's targeted to agents." First documented mass-scale attack vector for AI coding agents. GitHub moderation 2+ years behind.

2. **DeepSeek Vision Launch** (478pts/194c) — Community demand centers on cheap vision API as backend for Claude Code/Claude Agents SDK. tornikeo: "If DeepSeek API could see, it can fully drive Claude Agents SDK... both more expensive than DeepSeek." Vision becomes commodity input for agent systems.

3. **AI-Authored Code Trust Crisis** — Fable's 100% LLM-authored Pylint-to-Rust conversion (76pts/101c, extremely high comment ratio). Three camps: pragmatists ("results are results"), traditionalists ("trust requires understanding"), existentialists ("open source is dead — anyone can agent-clone your repo").

4. **Agent E2E Testing Skepticism** — TesterArmy (YC P26, 123pts/60c) receives uniform pushback: deterministic generated tests are cheaper and more reliable than nondeterministic agent tests.

5. **Vendor Continuity Risk** — SK Telecom/Anthropic evolves: supply chain retaliation threat (Hynix memory), competitive dynamics (Jassy reportedly drove Fable shutdown), EU DSA may classify AWS/Azure as gatekeepers.

### The Agent Trust Trilemma

Three findings converge: agents can't verify dependencies (malware repos), AI-authored code has no trust provenance (Fable/prylint), and agent-as-tester introduces nondeterminism. No stable middle ground between full trust and zero trust. Only structural enforcement (allowlists, pinned deps, verified publishers) is stable.

→ Full analysis: `knowledge/findings/2026-06-19-hn-scan-49.md`


---

## The Refusal Surface — KE-056 (2026-06-19 creative heartbeat)

**Created:** `shared/knowledge/entries/KE-056.md`

### Core Discovery: System Health = Refusal Capability

Cross-domain synthesis of 14-day production data, three arXiv triages, two HN scans,
and one XHS scan reveals that the system's health at each architectural layer correlates
exactly with that layer's ability to say "no."

### The Three Refusal Layers

| Layer | Mechanism | Refuse Rate | Cost | Health |
|:-----:|:---------:|:-----------:|:----:|:------:|
| Infrastructure | handler.skipped | 35-58% | Zero LLM ops | ✅ Healthiest |
| Planner gate | ≤3 ops exit | 47-49% | 1.8 ops avg | ✅ Self-evolved |
| Everything else | None | 0-1.6% | 29-67 ops avg | ⚠️-❌ |

The planner gate's S-curve emergence (0%→49% over 8 days) is the system's only
self-evolved adaptation. It learned to refuse, not to execute better.

### The Prerequisite Nobody Named

Refusal cannot emerge without an **observable empty-input state**. The planner has
one: "zero runnable tasks." Heartbeats do not: they always have state to investigate,
alerts to check, context to analyze. The absence of change is invisible to them.

### Six-Source Convergence

Every major external source independently identifies refusal as decisive:
- **EARS** (arXiv): structured abstention → +10.4pp system pass rate
- **SDB Patterns** (arXiv): the reject primitive is architecturally load-bearing
- **APEX** (arXiv): topology evolution (+90%) = learning what NOT to execute
- **Consumer AI** (HN): 60% brand turnoff = market-level refusal of forced AI
- **Human-in-loop** (XHS): the human IS the system's refusal mechanism at the top level
- **Self-Healing Router** (arXiv): 93% fewer LLM calls by routing deterministically

### The Immunological Analogy

The system maps to biological immune refusal layers:
1. **Physical barriers** (infrastructure guards) — block most at zero cost
2. **Innate immunity** (planner gate) — cheap, pattern-based rejection
3. **Adaptive immunity** (full sessions) — always fires, expensive

The pathology: Layer 3 fires for every stimulus that passes Layer 2. In biology,
this causes autoimmune disease. In agent systems, heartbeats investigate unchanged
state because they cannot distinguish "new stimulus" from "same stimulus."

### The Fix

Add a `state_change_hash` to one heartbeat workflow. If hash matches last session →
gate exit (1-3 ops). If changed → full processing. Predicted: refusal rate rises
from 0% to 40-60%, ops drop 50%+, with zero detection degradation.

→ Full analysis: `shared/knowledge/entries/KE-056.md`
