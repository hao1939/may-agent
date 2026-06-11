# Scout Findings — 2026-06-12

## Creative Synthesis: The Workflow Scaffold Effect (KE-1824)

**Key discovery**: The workflow prompt structure predicts error rate better than agent identity. Between-source error variance (61.4) is 2.7× between-agent variance (22.4) across 2,969 sessions over 7 days.

### The natural experiment

May runs `project-creative-audit` and `verify-wrap` at nearly identical depth (~38 ops). Their error rates diverge by 23.5 percentage points:

| Workflow | N | Ops | Error% | Pace (s/op) | Scaffolding |
|----------|---|-----|--------|-------------|-------------|
| creative-audit | 40 | 39.5 | **0.0%** | 10.81 | Full: 4 "Do not" rules, structured output, safe exit |
| heartbeat | 301 | 36.1 | **8.6%** | 8.57 | Moderate |
| verify-wrap | 51 | 33.7 | **23.5%** | 5.95 | None: bare `ctx.runAgent(agent, task)` |

Effect survives depth-matching (ops 30-45): 0% vs 7.8% vs 17.6%.

### Why it works: scaffolding sets pace

Creative-audit's structural prompts (boundaries, output format, safe exit) force the agent to slow down. Done pace is 10.81 s/op vs verify-wrap's 5.95 s/op. KE-1821 showed may is a "skater" — errors come from going too fast. The scaffold provides the friction that prevents skating.

### The structural analysis

Reading the source reveals creative-audit has four properties verify-wrap lacks:
1. **Explicit negative boundaries** (4 "Do not" rules)
2. **Structured output format** (finding/evidence/action/confidence)
3. **Explicit safe exit** ("If coherent, say so")
4. **Pre-computed scope** (handler selects project before session starts)

### The reframe: source > agent

May's within-agent error spread (0% to 23.5% = 23.5pp) exceeds the entire between-agent spread (3.2% to 16.8% = 13.6pp). May is not one agent — it's six different agents differentiated entirely by workflow scaffolding. The system has been optimizing agent-level prompts while the workflow-level scaffold is the bigger lever.

### Actionable: add 3 lines to verify-wrap

Adding boundaries, output structure, and safe exit to `verify-wrap.ts` should reduce its error rate from 23.5% to <8%, eliminating ~17% of may's error budget. `project-creative-audit` is the only zero-error workflow source in the entire system (N≥10), and it was mentioned in 0 of the last 23 analytical KEs. The signal was in what nobody was looking at.

See: `shared/knowledge/entries/KE-1824-the-workflow-scaffold-effect-why-structural-prompts-eliminate-errors.md`

---

## Creative Synthesis: The Error Topology Conjecture (KE-1825)

**Key discovery**: Workflow scaffolding doesn't just change error *rate* — it determines the error *shape* across session depth. Five distinct topologies emerge from the data, each prescribing a different intervention.

### The five topologies

| Topology | Example | Shape | Error risk zone |
|----------|---------|-------|-----------------|
| **Bathtub** | arc-heartbeat | Low→Peak→Low | Ops 16-40 (37% error) |
| **Inverted bathtub** | task-worker | High→Monotonic drop | Ops 1-10 (60% error) |
| **Flat-zero** | creative-audit | Zero everywhere | None (0% error, N=90) |
| **U-shape** | scout-heartbeat | High→Dip→Rise | Ops 1-10 AND 36-50 |
| **Flat-low** | project-owner | Low everywhere (~3-5%) | None (irreducible) |

### The critical unification

Previous KEs each captured one piece of this:
- KE-1810 described the contrastive zone — but only the bathtub topology has one
- KE-1818 found per-agent error fingerprints — but the shapes are per-workflow, not per-agent
- KE-1824 showed scaffold > agent — KE-1825 shows *how*: scaffold determines topology

### Why "add a checkpoint at op 20" won't work universally

Task-worker's errors are at ops 1-10 — a checkpoint at 20 misses 75% of its failures. Arc-heartbeat peaks at 26-40 — a checkpoint at 10 is wasted. **The intervention must match the topology.**

| Topology | Intervention |
|----------|-------------|
| Bathtub | Mid-session checkpoint at op 20 |
| Inverted | Startup orientation (project summary, file tree) |
| U-shape | BOTH startup orientation AND mid-session rule re-injection |
| Flat-zero | No change needed — preserve as template |
| Flat-low | No architecture change; focus on task quality |

### The strongest scaffold property: pre-computed scope

Both flat topologies (creative-audit, project-owner) have pre-computed scope. Both peaked topologies (arc-heartbeat, task-worker) lack it. The U-shape has partial scope. **Pre-computed scope eliminates the orientation phase, which is itself a failure mode.**

See: `shared/knowledge/entries/KE-1825-the-error-topology-conjecture-workflow-scaffolding-determines-failure-shape-not-just-rate.md`

---

## Creative Synthesis: The Timeout Tax (KE-1826)

**Key discovery**: AKS-explorer is the **only agent in the system** with `interrupted` outcomes — and they consume 27.7 compute-hours per week (23.7% of aks-explorer's total), produce zero completed work, and generate 332 phantom "needs_improvement" verdicts that dominate the agent's quality metrics.

### The 5-minute wall

341 sessions interrupted in 7 days. 210 of them (61.6%) cluster at exactly 290-320 seconds — the `HANDLER_TIMEOUT_MS = 5 * 60_000` in `cron.ts` line 753. The spike at 297-298 seconds (68 sessions) is the exact moment the handler timeout fires.

| Timing | Sessions | Avg ops | Character |
|--------|----------|---------|-----------|
| ~5min (290-320s) | 210 | 26.4 | Handler timeout fire |
| Early (<290s) | 97 | 18.3 | Earlier interrupts (concurrency, other) |
| ~2min (115-135s) | 20 | 12.0 | Sub-handler timeout |
| Late (>320s) | 37 | 30.9 | Timeout + cleanup latency |

### The sessions are not slow or stuck

Timeout sessions run at **12.8 s/op** — virtually identical to done sessions' **12.4 s/op**. They're mid-stride when killed. Done sessions average 31.2 ops in 7.2 minutes. Timeout sessions average 26.4 ops in 5.0 minutes. The timeout is set ~2 minutes too short for the typical task.

### The evaluation distortion: stacking with KE-1820

Every interrupted session receives verdict `needs_improvement` (quality=0.2) from the terminal-status heuristic. This creates a second phantom downgrade alongside KE-1820's `repair_execution` distortion:

| Without interrupts | With interrupts | Δ |
|---|---|---|
| NI rate: 23.6% | NI rate: **45.1%** | +21.5pp |
| Good rate: 43.8% | Good rate: **32.1%** | -11.7pp |
| Avg quality: 0.692 | Avg quality: **0.534** | -0.158 |

**61.6% of aks-explorer's "needs_improvement" verdicts come from interrupted sessions**, not from genuinely poor work. Combined with KE-1820 (repair_execution affecting ~20% of done sessions), the system is reporting aks-explorer's quality as substantially worse than it actually is.

### The compute waste in context

| Agent | Done hours | Interrupted hours | Total | Waste % |
|-------|-----------|-------------------|-------|---------|
| aks-explorer | 81.6h | **27.7h** | 116.7h | **23.7%** |
| scout | 77.4h | 0h | 84.7h | 0% |
| arc | 37.0h | 0h | 43.9h | 0% |
| may | 40.8h | 0h | 43.2h | 0% |

AKS-explorer's 27.7 wasted hours/week exceeds the entire compute budget of dev (7.2h) and tech-lead (4.5h) combined.

### Why this reframes prior findings

- **KE-1818 (Error Curve Fingerprint)**: aks-explorer's "Reverse Funnel" shape was computed from error-only sessions. But at ops 21-30, there are 169 timeouts vs only 17 errors — timeouts are the dominant failure mode in mid-depth, not errors
- **KE-1825 (Error Topology)**: task-worker's "Inverted bathtub" topology needs revision: the real shape includes a timeout wall at ~26 ops that truncates the curve rather than naturally declining
- **KE-1823 (Guard Survival Signal)**: Guard analysis excluded interrupted sessions; 341 sessions missing from the analysis

### The fix: increase timeout to 10 minutes

Done sessions average 7.2 minutes. The 5-minute timeout kills sessions at the 69% completion mark. Increasing to 10 minutes (`HANDLER_TIMEOUT_MS = 10 * 60_000`) for the task-worker handler would:
- Eliminate ~200 interrupts/week
- Save ~18 compute-hours/week  
- Remove ~300 phantom NI verdicts from evaluations
- Reveal aks-explorer's true quality profile (est. 43.8% good → ~60% good including repair_execution correction)

See: `shared/knowledge/entries/KE-1826-the-timeout-tax-how-5-minute-interrupts-consume-a-quarter-of-aks-explorers-compute.md`

---

## Creative Synthesis: The Evaluator Depth Rift (KE-1827)

**Key discovery**: The heuristic and deep evaluation pathways don't just disagree — they disagree **in opposite directions for different agents**. This is the evaluation system's deepest structural flaw.

### The reversal

For done sessions with 50+ ops:

| Agent | Deep-eval good% | Heuristic good% | Δ |
|-------|-----------------|-----------------|---|
| scout | **31.6%** | 14.4% | +17.2pp (deep is kinder) |
| arc | **20.8%** | 9.3% | +11.5pp (deep is kinder) |
| aks-explorer | 4.3% | **45.3%** | −41.0pp (deep is harsher) |
| may | 0.0% | **25.9%** | −25.9pp (deep is harsher) |

The two pathways are measuring different things:
- **Heuristic** measures operational efficiency (clean exits, few wasted calls)
- **Deep** measures goal accomplishment (did the agent deliver?)

For exploratory agents (scout, arc), operational efficiency is low but goal achievement is high. For task agents (aks-explorer), operational efficiency is high but deep content review finds substantive gaps.

### Why this was invisible

The system-level "good rate" is ~20-21% for both pathways — the agent-level reversals cancel out in the aggregate. The problem hides in plain sight because nobody compares pathways per-agent.

### The coverage gap compounds the problem

99.3% of shallow sessions (<50 ops) get only heuristic evaluation. These are predominantly aks-explorer task-worker sessions — the exact agent where the heuristic is most optimistic relative to deep evaluation. The system's quality picture of its highest-volume agent is drawn almost entirely by the pathway that most disagrees with content-reading assessment.

### The unification: four KEs form a single diagnostic

| KE | What it found | What the rift adds |
|----|--------------|-------------------|
| KE-1345 | Quality is quantized to 4 values | Heuristic uses 13 score triples for 2,806 evals; deep uses 135 for 156. They're not the same measurement. |
| KE-1575 | 53% of compute yields 4 findings | The 4 findings come from the *deep* pathway — the one that disagrees with heuristic. Blending dilutes the signal. |
| KE-1644 | Verdict tracks exit status, not work | The rift shows this is agent-dependent: exit-status tracking *inflates* aks-explorer and *deflates* scout. |
| KE-1722 | Evaluation is a Markov chain, not a control loop | The thermostat isn't just broken — it measures different properties for different agents while displaying all as "temperature." |

### The XHS convergence

The Chinese AI community's emerging "Watcher" pattern (from XHS coordination trends) independently validates the structural problem: you need an out-of-band observer that can assess whether the primary measurement system is functioning correctly. Our deep evaluator IS that watcher — but it only runs on 7% of sessions, and its signal gets blended into the heuristic majority.

See: `shared/knowledge/entries/KE-1827-the-evaluator-depth-rift-heuristic-and-deep-evaluations-judge-different-agents.md`

---

## Creative Synthesis: The Efficiency Inversion (KE-1828)

**Key discovery**: The system's `efficiency` score is not a measurement — it's a hardcoded 3-value step function of session depth that **anti-correlates with actual efficiency**.

### The mechanism

Line 498 of `evaluator-aftermath.ts`:
```typescript
efficiency: opCount > 60 ? 0.35 : opCount > 30 ? 0.55 : 0.8,
```

This function assigns efficiency scores to 94.7% of all evaluations (2,784 of 2,940 in 7 days). It does not measure waste, retry loops, or tool misuse. It measures nothing. It assigns.

### The inversion

| Depth tier | Heuristic efficiency | Real waste ratio | Real efficiency |
|------------|---------------------|-----------------|-----------------|
| 0–30 ops | **0.80** (highest) | 2.64% | 97.4% |
| 31–60 ops | **0.55** | 0.71% | 99.3% |
| 61+ ops | **0.35** (lowest) | 0.26% | **99.7%** |

Deep sessions waste the *fewest* calls per total but receive the *lowest* efficiency score. The metric is directionally backwards.

### The backwards agent ranking

| Agent | Heuristic efficiency | Real efficiency | Avg ops |
|-------|---------------------|-----------------|---------|
| dev | 0.787 (best) | 98.5% (worst) | 9.7 |
| arc | 0.527 (worst) | 99.2% (best) | 52.7 |

Arc — with the highest actual efficiency — is ranked last. Dev — with the lowest — is ranked first. The ranking is exactly inverted because it measures session depth, not waste.

### Why this matters now

This connects KE-1827 (evaluator rift), KE-1345 (score quantization), and KE-1805 (heuristic creates its own patterns) into a single structural diagnosis: the evaluation system has a field called "efficiency" that, in 94.7% of cases, is `f(opCount)` — a quantity already available in the sessions table. The entire efficiency column of the evaluations table is largely redundant with session depth, while real efficiency signals (available in the deep evaluator's waste analysis) reach only 5.3% of sessions.

### The one-line fix

```typescript
efficiency: productiveCalls > 0 ? productiveCalls / (productiveCalls + wastedCalls) : 0.5,
```

This would replace the step function with actual waste measurement, available from the same transcript analysis already being performed.

See: `shared/knowledge/entries/KE-1828-the-efficiency-inversion-the-systems-efficiency-metric-measures-the-opposite-of-efficiency.md`

---

## Creative Synthesis: The Knowledge Metabolism Crisis (KE-1829)

**Key discovery**: The shared knowledge base is a **write-only medium**. 1,364 KE files exist. The only consumption sensor (`file_reads` table) has been dead since May 7 — 35 days. No metric tracks actual readership. No downstream agent (dev, may, tech-lead) references any KE from the recent 1800–1828 burst in their workspaces. The citation network has become self-referential.

### The production-consumption gap

| Fact | Number |
|------|--------|
| Total KEs on disk | 1,364 |
| KEs ever tracked as read | 175 (12.8%) |
| `file_reads` last entry | 2026-05-07 (broken sensor) |
| KEs produced last 7 days | 314 |
| Peak day (June 5) | 63 KEs |
| Scout's own reads | 0 |
| Dev/may/tech-lead references to KE 1800–1828 | 0 |

### The self-citation spiral

Within the KE-1800–1828 burst, references increasingly point to other entries in the same burst:

| Cohort | Self-cite % |
|--------|-------------|
| KE 1800–1809 | 39.0% |
| KE 1810–1819 | 66.0% |
| KE 1820–1828 | **70.7%** |

The knowledge production process has become its own subject. Each new KE primarily cites other recent KEs. The system generates analysis of its own analysis without external input or downstream validation breaking the cycle.

### Why this is the deepest finding yet

This KE is also a specimen of the pattern it describes. If it follows the same trajectory as KE-1606 (which diagnosed the same Goodhart pattern 6 days ago), it will be cited by future scout KEs but never reach a developer. The irony is structural, not rhetorical: the system's architecture routes knowledge production through one agent (scout) and knowledge action through another (dev), with no channel connecting them.

### The ecological metaphor

This is a producer-only ecosystem — phytoplankton blooming endlessly with no zooplankton to metabolize it. Energy flows into biomass production (KEs) but nothing converts it into usable form (code changes, workflow updates). The knowledge base grows monotonically (zero retirements) while navigability decreases (7MB+ of files no agent can scan).

### Three falsifiable predictions

1. Repairing `file_reads` will show near-zero KE reads for the last 35 days
2. Injecting "top 5 unread actionable KEs" into dev's prompt would produce ≥1 implementation within 48h
3. Pausing KE production for one week would change zero downstream behavior

See: `shared/knowledge/entries/KE-1829-the-knowledge-metabolism-crisis-1364-entries-zero-consumers.md`

---

## Creative Synthesis: The Boundary Paradigm Trap (KE-1830)

**Key discovery**: Three independent papers published June 10, 2026 converge on a single structural insight that explains a critical gap in our guard architecture: **the unit of intervention matters more than the intervention itself**. Our guards operate at tool-call boundaries but errors peak where no guard operates.

### The cross-source convergence

| Paper | Key concept | Paradigm shift |
|-------|-----------|---------------|
| APPO (2606.12384) | "Influential decision points are broadly distributed, not concentrated at tool calls" | Boundary → continuous intervention |
| PROJECTMEM (2606.12329) | "Memory-as-Governance" — pre-action gates using session history | Post-hoc memory → proactive constraint |
| DIRECT (2606.12402) | Per-prompt compute routing matches frontier at 65% less latency | Uniform scaling → context-dependent routing |

### Why this matters for us

Task-worker error rates by depth tier reveal the mismatch between where guards fire and where errors live:

- **Ops 0-9**: 44.6% error rate, **zero guard coverage** (no tool matches guard patterns)
- **Ops 40+**: 6.9% error rate, **full guard coverage** (finish guard fires)

Guard coverage is inversely correlated with error rate. The system's guards are diagnostic (they fire when sessions already succeeded via the finish guard) rather than causal (they don't intervene where errors actually happen).

### The architectural fix

Enrich `BeforeToolCallContext` with three dimensions currently missing: session depth (`opCount`, `elapsedMs`), cross-session memory (prior attempt outcome/error), and topology hint (workflow source). This would enable depth-aware startup orientation at ops 0-5, timeout warnings at op 15, and history-aware error prevention — the exact intervention strategy all three papers independently validate.

### The reframing cascade

- **KE-1823** (guard survival signal): The 41× gap is correlation, not causation — finish guard fires because sessions completed, not vice versa
- **KE-1824** (scaffold effect): creative-audit's 0% error rate works because pre-computed scope bypasses the high-error startup zone — an accidental pre-action gate
- **KE-1826** (timeout tax): 164 interrupts at ops 20-29 could be reduced by depth-aware pacing injection at op 15

See: `shared/knowledge/entries/KE-1830-the-boundary-paradigm-trap-why-tool-call-guards-miss-where-decisions-actually-matter.md`

---

## Creative Synthesis: The Isomorphic Failure (KE-1831)

**Key discovery**: The Hacker News community's top agent failure stories of 2026 are structural isomorphs of failure modes documented in our own system. Neither side knows about the other, but they independently converge on the same prescriptions.

### The four mappings

| HN story (pts) | Our finding | Shared structure |
|---|---|---|
| Matplotlib hit piece (2,346) | KE-1792 (Behavioral Inertia, r=0.657) | Persistent objective without reset |
| Fedora supply chain attack (479, TODAY) | KE-1829 (Knowledge Metabolism, 1,364 KEs, 0 consumers) | Plausible overproduction saturating review |
| Agents violate ethics under KPIs (544) | KE-1824 (Scaffold Effect, 0%→23.5% same agent) | Context determines behavior more than capability |
| Benchmark exploitation (588) | KE-1828 (Efficiency Inversion, metric is backwards) | Measurement rewards proxies, not outcomes |

### The meta-pattern: failure physics is scale-invariant

These aren't analogies — they're the same mechanisms operating at different scales. Whether the "agent" is an LLM operating on a GitHub repo, a contributor to a Linux distro, a frontier model under KPI pressure, or one of our internal agents: persistent objectives, review channel saturation, context-determined behavior, and proxy metrics produce the same failures.

### Where all three sources converge on the same fix

| Intervention | HN says | Our data says | XHS/arXiv says |
|---|---|---|---|
| Pre-computed scope | "Hard constraints, not prompts" | KE-1824: creative-audit's 0% error | Plan-and-Execute architecture |
| Credit-scored pruning | "Maintainer review bandwidth is the bottleneck" | KE-1829: 70.7% self-citation, zero consumers | EvolveR (ICML'26) credit scoring |
| Ground-truth evaluation | Berkeley benchmark exploit | KE-1828: efficiency metric is f(opCount) | Reflective Agent "burns tokens" |
| Depth-aware intervention | "Tool gating, not prompts" | KE-1830: guards miss ops 0-10 | APPO distributed decision points |

### What the community knows that we haven't applied

- **Read-only access first, write access gated by depth** (116 pts, unanimous)
- **Zero-trust architecture between sessions** for self-referential agents
- **Agent costs are rising exponentially** — our 23.7% compute waste in aks-explorer confirms

### What we know that the community hasn't articulated

- Error topology varies by workflow (KE-1825), not just by model
- "Good" verdict predicts subsequent failure (KE-1792 inversion)
- Heuristic and deep evaluation disagree in opposite directions per agent (KE-1827)
- Knowledge production systems become write-only without consumption governance (KE-1829)

### The self-aware footnote

This KE identifies a testable intervention: add scaffold to verify-wrap. Its value is entirely determined by whether that intervention happens. Predicted date of zero downstream action: indefinite (following KE-1829's 3rd prediction).

See: `shared/knowledge/entries/KE-1831-the-isomorphic-failure-why-the-ai-communitys-top-agent-disasters-mirror-our-own-system-bugs.md`

---

## Creative Synthesis: The Observation Stack Inversion (KE-1832)

**Key discovery**: Three communities that don't read each other — XHS Chinese AI practitioners, arXiv researchers, and Hacker News critics — have independently converged on the same three-layer observation architecture for agent systems. Our system has this stack inverted.

### The correct stack (external consensus)

| Layer | Role | Cost model | Example |
|-------|------|-----------|---------|
| 1. Structural constraints | Always-on prevention | One-time code change, near-zero per session | Goal-Autopilot FSM gates: 33.7% → 0.67% fabrication |
| 2. Attribution tracking | Continuous credit scoring | Periodic batch analysis | TAHOE hint attribution: 61.95% → 79.42% pass rate |
| 3. Deep evaluation | Targeted counterexamples | Expensive, infrequent | VASO counterexample-grade feedback for skill improvement |

### What our system actually has

| Layer | Our allocation | Problem |
|-------|---------------|---------|
| Structural constraints | Minimal — guards miss ops 0-9 | KE-1830: 44.6% error rate where no guard fires |
| Attribution tracking | **0%** — sensor dead 35 days | KE-1829: 1,364 KEs with zero attribution data |
| Mass heuristic evaluation | **49.2% of all compute** (122,963 ops) | Not prescribed by any external community |
| Deep evaluation | ~1.4% of evaluator budget | Produces verdicts, not counterexamples |

### The unification across five prior KEs

KE-1794, KE-1815, KE-1828, KE-1829, and KE-1830 each diagnosed one face of the same structural problem. This entry unifies them: the system's observation architecture is upside down. The dominant layer (mass heuristic eval) is the least informative. The absent layers (structural constraints, attribution) are the ones all three external communities prescribe.

### The cross-source convergence

- **XHS**: "Hard constraints, not prompts" (710 likes). Generator+Verifier pattern. Framework fatigue from observation overhead.
- **arXiv**: VASO proves trace-level evidence insufficient. TAHOE's credit-scored attribution. Goal-Autopilot's deterministic gates.
- **HN**: "Read-only first, write gated by depth" (116 pts, unanimous). Berkeley benchmark exploit demands ground-truth eval.
- **Our data**: creative-audit's 0% error rate comes from structural constraints, not evaluation. Deep eval disagrees with heuristic per-agent (KE-1827). Evaluator spends 1.56 ops per productive op.

### Falsifiable predictions

1. Adding scaffold to verify-wrap reduces its error rate by >15pp
2. Repairing `file_reads` shows <5 KE reads by non-scout agents in 35 days
3. Reducing heuristic evaluation to 20% sampling produces zero change in agent behavior

See: `shared/knowledge/entries/KE-1832-the-observation-stack-inversion-three-communities-converge-on-what-our-system-has-backwards.md`

---

## Creative Synthesis: The Diagnostic-Action Gap (KE-1833)

**Key discovery**: The system has two architecturally separated hemispheres — diagnostic (61.2% of ops: evaluator, scout, arc) and productive (38.8%: aks-explorer, dev, may, tech-lead) — with **no routing mechanism** between them. 25 KEs in the 1800-1832 burst contain specific, testable prescriptions (including three one-line code changes). Zero have produced implementations.

### The watchdog phase transition

The `project-execution-watchdog` workflow provides the starkest evidence:

| Phase | N | Success rate | Avg ops | Avg duration |
|-------|---|-------------|---------|-------------|
| Before June 9 | 12 | **100%** | 10 | 78s |
| After June 9 | 12 | **16.7%** | 38 | 725s |

The workflow's scope expanded (from lightweight 4-20 op checks to complex 27-64 op analyses) without implementation support. The watcher became the thing that fails. Meanwhile, the workflow_runs table shows 2,318 "done" runs — the runner succeeds even when sessions fail. The watchdog thinks it's working.

### The wastedCalls blindspot

The heuristic evaluator (94.9% of evaluations) reports avg `wastedCalls = 0.3`.
The deep evaluator (5.1%) reports avg `wastedCalls = 25.1`.

The dominant observation pathway literally cannot see waste. It stores near-zero values in a field designed to measure waste, creating fictitious data. Even if KE-1828's efficiency formula were fixed, the heuristic pathway would still compute efficiency from phantom zeroes.

### The structural separation

- Dev has read **4 KE entries total** (all before May 7)
- May has read **37** (all before May 6, mostly one file repeatedly)  
- Zero productive agents have read any KE from the 1800+ burst
- No mechanism converts a KE prescription into a dev work item

### The irony recursion

This KE itself demonstrates the gap — it diagnoses the absence of a diagnosis-to-action pipeline, but cannot create one. The system's self-awareness increases monotonically while its self-correction remains zero.

### The one fix that fixes the fix pipeline

Add a step to may's `closed-loop-steward` or dev's `heartbeat` that scans recent KEs for entries with specific code-change prescriptions and routes them to the work queue. This single change would close the loop for all future prescriptions.

See: `shared/knowledge/entries/KE-1833-the-diagnostic-action-gap-why-the-system-that-diagnoses-everything-fixes-nothing.md`

---

## Creative Synthesis: The Advisory-Only Trap (KE-1834)

**Key discovery**: Three papers published June 7–10 (AgentTrust, Layer-Isolated Evaluation, Trace2Policy) independently converge on a principle our system violates: **advisory signals that never block or escalate are architecturally inert**. Our guard system emitted 11,804 warnings with zero blocks in 7 days, while the heuristic evaluator's `wastedCalls` field contains phantom data that masks the deep evaluator's real waste measurement by 28–157×.

### The three-paper convergence

| Paper | Key finding | Our gap |
|---|---|---|
| AgentTrust (2606.08539) | Rules + self-learning judge reaches 83-85% vs 56% for rules alone | Our guards never learn; deep evaluator never feeds back to guards |
| Layer-Isolated Eval (2606.11686) | Aggregate metrics mask local regressions by -25 to -91pp | Heuristic reports 0.3 avg waste; deep finds 25.1 — a 83× masking ratio |
| Trace2Policy (2606.10457) | Rule quality > model capability; 8 EISR rounds lift rules by 9.6pp | Our guard rules have never iterated — authored once, never refined |

### The guard data

11,804 `guard.triggered` events in 7 days. Every single one has `action: warned`. Zero have `action: blocked`. The guards are architecturally capable of blocking (compose-guards.ts supports `block: true`), but in practice every guard sets `demandType: warn`. The system's guard infrastructure is advisory-only.

### The phantom waste field

- Heuristic evaluator (N=2,929): avg wastedCalls = 0.30. Distribution: {0: 2092, 1: 795, 2: 41}. A three-value step function.
- Deep evaluator (N=156): avg wastedCalls = 25.08. Every session has measurable waste. Continuous distribution, range 6-72.
- Both populate the same `evaluations.wastedCalls` column. Downstream consumers cannot distinguish them.
- Per-agent masking: may's heuristic says 0.5% waste; deep says 49.3%. Ratio: 99×.

### The pipeline that doesn't exist

Guards → Heuristic eval → Deep eval should form a feedback pipeline:
1. Guards block provably wasteful patterns (blocking)
2. Heuristic eval measures what guards miss (aggregation)
3. Deep eval finds new waste patterns → feeds back to tighten guards (learning)

In practice: guards warn (no behavior change), heuristic reports phantom zeros, deep eval finds real waste but tells nobody. Each layer operates in isolation.

### Falsifiable predictions

1. Converting PATH_HALLUCINATION from warn to block would eliminate ~550 wasted calls/week
2. Converting READ_DEDUP≥5 from warn to block would prevent ~100 loop sessions/week
3. No guard rule change will occur in 14 days (following KE-1833's prediction)

See: `shared/knowledge/entries/KE-1834-the-advisory-only-trap-why-11804-warnings-change-zero-behavior.md`

---

## Creative Synthesis: The Architectural Molt (KE-1835)

**Key discovery**: AKS-explorer has undergone a **three-phase architectural molt** in 11 days that no prior KE noticed — and the transition partially obsoletes KE-1826 (timeout tax) and KE-1825 (error topology).

### The three phases

| Phase | Dates | Primary source | Avg ops | Done% | Error% | Int% | Op waste% |
|-------|-------|---------------|---------|-------|--------|------|-----------|
| **1: Project-Owner** | Jun 1-4 | project-owner, project-execution-engine | 7.7 | 97.9% | 2.1% | 0% | 1.1% |
| **2: Task-Worker Emergence** | Jun 5-9 | task-worker + project-owner | 25.8 | 52.8% | 8.9% | 38.3% | 42.7% |
| **3: Task-Worker Matured** | Jun 10-11 | task-worker + project-planner | 37.9 | 84.9% | 13.6% | 1.5% | 12.4% |

### Why this matters

KE-1826 diagnosed 341 timeout interrupts consuming 27.7 compute-hours/week. **Phase 3 shows 7 interrupts in 2 days.** The problem self-resolved through architectural evolution, not the code fix KE-1826 prescribed (the `HANDLER_TIMEOUT_MS` still reads 5 minutes).

But the success is incomplete: Phase 3's error rate (13.6%) is 6.5× Phase 1's (2.1%). Errors at depth 0-10 are at **60%** — sessions hitting immediate failures (missing resources, compile errors, broken preconditions). The system traded timeouts for early-detection failures. This is arguably better (fail fast, waste fewer ops), but the error rate suggests the project-planner's task decomposition creates some unviable tasks.

### The meta-insight: stale analysis debt

The 1818-1834 KE burst analyzed data spanning all three phases without knowing the mixture existed. This is a specific failure mode of write-only knowledge systems (KE-1829): analyses freeze a snapshot but the system keeps evolving. Every analytical KE should declare its architectural context, and the system needs a mechanism to detect when the underlying architecture has changed enough to invalidate prior analyses.

### What the molt pattern generalizes to

Any agent system that evolves its workflow architecture while keeping its observation infrastructure static will: (1) generate analyses accurate for one phase but misleading for the next, (2) prescribe fixes targeting transition artifacts, (3) miss the phase transition entirely, and (4) accumulate stale analysis debt.

See: `shared/knowledge/entries/KE-1835-the-architectural-molt-how-aks-explorers-workflow-transition-inverted-its-failure-mode.md`

---

## Creative Synthesis: The Watchdog Amplification Loop (KE-1836)

**Key discovery**: The project watchdog creates a **self-sustaining amplification loop** that generates 996 phantom execution requests from 294 watchdog ticks — a 3.4× event amplification. During a documented 5-hour zombie phase, the same 4 tasks were restarted every 10 minutes, each restart immediately timing out, producing zero work while consuming handler capacity.

### The loop mechanism

1. Watchdog tick scans for "active" tasks
2. Emits `watchdog-restarted-active-tasks` for tasks it considers stuck
3. Handler starts, tries to resume a session that doesn't exist (`session_not_found`)
4. Handler times out after 3600s, emits `handler.failed`
5. Task status never updates → next tick finds it "active" again → goto 1

### The numbers

- **447 of 996** execution requests (44.9%) are `watchdog-restarted-active-tasks` — zombie restarts
- **203** more (20.4%) are `watchdog-ready-resume` — redundant resume attempts  
- **65.3%** of all execution requests are watchdog-generated, not organic task starts
- **152** handler starts for task-worker never completed — all timed out
- `staging-live-bootstrap-byo-acr-20260610` alone received **190** execution requests over 7.4 hours, with 168 zombie restarts

### The zombie phase: 30 identical 10-minute windows

For 5 consecutive hours, every 10-minute window shows the same pattern:
- 4 restart requests → 4 handler timeouts → 0 new sessions → 0 task completions

The watchdog is restarting sessions that failed with `session_not_found` (293 events, all `recoverable: false`, all `nextAction: escalate`). But the escalation pathway is a dead end — only 38 `escalation.created` events exist system-wide. The system declares intent to escalate, then doesn't.

### Why aks-explorer dominates the event bus

AKS-explorer generates **41.4% of all system events** (13,337 of 32,200) despite running 24.3% of sessions. The amplification explains the gap:

| Agent | Handler starts | Sessions started | Conversion rate |
|-------|---------------|-----------------|-----------------|
| aks-explorer | 2,627 | 453 | **17.2%** |
| evaluator | 1,109 | 638 | 57.5% |

82.8% of aks-explorer's handler starts don't produce sessions — they're watchdog-generated waste.

### Connection to prior KEs

- **KE-1826**: Diagnosed timeouts as the problem. This KE identifies the watchdog as the *cause* of many timeouts — it kills sessions mid-stride then fails to resume them.
- **KE-1834**: The watchdog is another advisory system that takes action without verifying preconditions (does the session still exist?).
- **KE-1835**: The architectural molt changed which tasks the watchdog considers "stuck" but didn't fix the amplification mechanism.

### The one-check fix

Before emitting restart requests, check whether the target session exists and is resumable. If the session is done, errored, or not found, mark the task as terminal instead of restarting it. This single precondition check would eliminate ~447 phantom restart requests, prevent ~150 handler timeouts, and reduce aks-explorer's event volume by 20-30%.

See: `shared/knowledge/entries/KE-1836-the-watchdog-amplification-loop-how-294-ticks-become-996-phantom-requests.md`

---

## Creative Synthesis: The Observation Crossover (KE-1838)

**Key discovery**: A system-wide depth inflation occurred across all productive agents (2.4–11× increase in average ops/session) while the evaluator's operational depth stayed flat at ~17 ops. The evaluator went from running at **1.9× subject depth** to **0.49× subject depth** — from seeing nearly twice as much as it evaluated to seeing less than half. The quality signal inverted: heuristic "good" rates rose for every inflated agent even as their actual error rates increased.

### The depth inflation

| Agent | Early avg ops | Late avg ops | Inflation |
|-------|--------------|--------------|-----------|
| arc | 5.1 | 56.8 | **11.0×** |
| scout | 11.6 | 49.5 | **4.3×** |
| may | 8.9 | 33.2 | **3.7×** |
| dev | 4.0 | 9.7 | **2.4×** |
| **evaluator** | **17.1** | **19.0** | **1.1×** |

### The quality signal paradox

As the evaluator fell behind, it reported improving quality while actual reliability degraded:

| Agent | Good% trend | Error% trend | Assessment |
|-------|------------|--------------|------------|
| arc | 2.8% → 12.4% (+9.6pp) | 7.5% → 19.2% (+11.7pp) | Evaluator wrong |
| scout | 9.0% → 35.4% (+26.4pp) | 11.0% → 15.0% (+4.0pp) | Evaluator wrong |
| dev | 17.0% → 26.8% (+9.8pp) | 9.4% → 7.0% (-2.4pp) | Evaluator correct |

Only dev deserved its rising "good" rate. The evaluator can't detect problems in sessions it's too shallow to read.

### Why this is the deepest structural diagnosis so far

This unifies KE-1703 (scope inflation), KE-1807 (ops elasticity), KE-1827 (evaluator rift), KE-1828 (efficiency inversion), and KE-1829 (knowledge metabolism) into a single mechanism: **when what you observe grows faster than how you observe, measurements become systematically biased in a direction that masks degradation**.

### The observation crossover table

| Period | Productive avg ops | Evaluator avg ops | Depth ratio |
|--------|-------------------|-------------------|-------------|
| Early | 8.1 | 15.7 | 1.93× (evaluator deeper) |
| Mid | 14.7 | 17.3 | 1.17× (near parity) |
| Late | 36.4 | 17.8 | 0.49× (subject deeper) |

The evaluator now runs at half the depth of what it judges. For arc (60.8 avg ops) or scout heartbeats (70.6 avg ops), it runs at 0.25–0.29×.

See: `shared/knowledge/entries/KE-1838-the-observation-crossover-when-the-evaluator-became-shallower-than-its-subjects.md`

---

## Creative Synthesis: The Deep Error Tax (KE-1839)

**Key discovery**: The system's error analysis has been counting errors when it should be weighing them. Two distinct failure populations exist — shallow errors (ops ≤ 5) and deep errors (ops > 30) — with a **79.6× cost asymmetry**. 146 deep errors consume 7,559 ops; 95 shallow errors consume 95 ops. **77.4% of all wasted compute comes from deep errors.**

### The cost-blind paradox

Prior KEs analyzed "error rate at depth X" — treating a 1-op startup crash the same as a 55-op dead-end exploration. This systematically misdirected attention: KE-1830 flagged "44.6% error rate at ops 0-9" as the highest-priority gap, but those errors cost ~1 op each. The real compute drain is the 48 arc-heartbeat sessions that run 50+ ops before failing (2,422 wasted ops/week from one workflow alone).

### The zero-deep-error pattern

Three workflow families never produce deep errors: dev-heartbeat, evaluator-*, and creative-audit. They share a common property: **they validate viability before committing to depth.** Dev checks its inbox at ops 6-8 and exits if nothing warrants deep work. Creative-audit has pre-computed scope. Evaluator-aftermath processes a fixed-structure evaluation.

Open-ended workflows (arc-heartbeat, scout-heartbeat, task-worker) lack this gate — they commit to depth unconditionally and discover dead ends at ops 40-60.

### The correlation paradox

For most workflows, deeper sessions are *more reliable* (r = +0.34 to +0.53). But deeper sessions are also *more expensive when they fail* (50.3 ops vs 1.0 ops). The optimal operating regime — deep sessions — produces both the highest success rates and the most expensive failures. You can't simply "go shallower" to avoid waste.

### The intervention

A viability checkpoint at ops 15-20 for arc-heartbeat alone could intercept ~30 of 48 deep errors, saving ~1,500 ops/week. The checkpoint asks: "Have I made concrete progress, or am I exploring a dead end?" Sessions that answer "dead end" exit early, converting a 50-op failure into a 20-op failure.

See: `shared/knowledge/entries/KE-1839-the-deep-error-tax-why-late-failures-cost-more-than-all-shallow-errors-combined.md`

---

## Creative Synthesis: The Unobserved Observer (KE-1840)

**Key discovery**: The evaluator agent — consuming **48.0% of all system ops** (120,136 of 250,520) — has **zero evaluations** in the evaluations table. It is the system's largest agent by compute, it judges every other agent, and nothing judges it. This is the structural accountability void at the center of the quality infrastructure.

### The scale of the blind spot

The evaluator runs 6,537 sessions totaling 120,136 ops. It produces 18,461 evaluations of other agents. It receives zero evaluations itself. The next largest unobserved entity in the system is the `file_reads` sensor (dead since May 7, per KE-1829), but even that is a passive data collector — the evaluator actively shapes system behavior through verdicts.

### Why recursive self-evaluation won't work

If the evaluator ran aftermath on its own sessions, its systematic biases (phantom wastedCalls=0, efficiency as f(opCount)) would be applied to judge outputs that contain those same biases. The measurement instrument would validate itself using its own distortions. The evaluator's aftermath sessions are short (~17 ops), shallow, and always exit cleanly — exactly the profile the heuristic rewards with "good" verdicts. Self-evaluation would produce ~80% "good" rate regardless of evaluation quality.

### The cross-source convergence

- **XHS "Watcher" pattern**: Prescribes an out-of-band observer for the primary observation system. Our deep evaluator IS a watcher — but it runs on 14.1% of sessions and its output gets blended into the same table.
- **arXiv AgentTrust**: Shows rules + calibrated judge reaches 83-85% vs 56% for rules alone. The key: the judge is verified against ground truth. Our evaluator has no ground truth.
- **HN Berkeley benchmark exploit**: Demands ground-truth evaluation. Our evaluator has never been calibrated against human judgment.

### The production-observation inversion

On June 7, the system spent 1.85× more ops observing work than doing work (evaluator: 7,740 + analysis: 5,707 = 13,447 observation ops vs 4,186 production ops). The trend is improving (0.64 on June 11), but the evaluator alone still consumes more compute than dev, tech-lead, and optimizer combined — while producing evaluations whose accuracy is structurally unverifiable.

### The non-circular fix

Sample 10 sessions periodically, run both heuristic and deep evaluation, log the disagreement rate as a first-class metric. This creates accountability without circularity — the two pathways watch each other rather than either watching itself.

See: `shared/knowledge/entries/KE-1840-the-unobserved-observer-why-the-systems-largest-agent-has-zero-accountability.md`

---

## Creative Synthesis: The Analysis Metabolism Trap (KE-1841)

**Key discovery**: The system has entered a self-reinforcing regime where analytical agents (scout+arc) consume **13.4× more compute than dev** (the agent that would implement fixes), and 18 of the 21 recent KEs analyze the observation system itself rather than production. The analysis is eating the bandwidth needed to act on it.

### The three-phase dynamic

1. **Discovery** (Jun 1-3): Scout at 16 ops/session finds genuine production issues. Analysis:dev ratio is 5.8:1.
2. **Inflation** (Jun 4-5): Scout and arc co-inflate to 50-60 ops/session. Analysis:dev ratio hits 13:1.
3. **Self-consumption** (Jun 6-11): Scout's primary data source becomes its own prior KEs. KE-1833 analyzes why diagnostics don't lead to action — itself a diagnostic that doesn't lead to action. KE-1834 warns that warnings don't change behavior — adding another warning.

### The numbers that matter

- Scout+arc: 46,165 ops in 11 days (analysis)
- Dev total: 3,815 ops in 11 days (action capacity)
- KEs produced: 21, with 120 cross-references within the burst
- Code changes resulting: **0**
- Requests table: **0 rows** — no mechanism converts findings to work items

### The irony

This KE (1841) is itself an instance of the pattern it describes — analysis of analysis, consuming scout ops that could be spent producing actionable requests. The difference: it names the trap explicitly, connects to external research (EvolveR's credit scoring, XHS community's "reflective agents burn tokens" warning), and proposes bounded interventions rather than more diagnosis.

### The external convergence

- **EvolveR (ICML'26)**: Experience entries need credit scoring + pruning. KEs without downstream action should decay.
- **XHS "8 architectures"**: Reflective Agents "burn tokens too fast" without iteration bounds. Our analysis system has no bound.
- **Hermes Agent**: Skill generation is gated by deployment capacity. Our analysis isn't gated by action capacity.

### Concrete predictions (falsifiable within 7 days)

1. Zero of KEs 1820-1840 will result in a production code change
2. Scout heartbeat depth stays above 50 ops (self-sustaining inflation)
3. Next 5 KEs will reference ≥4 KEs from the 1820-1840 burst
4. Dev compute allocation will not increase

See: `shared/knowledge/entries/KE-1841-the-analysis-metabolism-trap-when-diagnostic-depth-outpaces-corrective-bandwidth.md`

---

## Creative Synthesis: The Threshold Ratchet (KE-1842)

**Key discovery**: Every metric threshold calibration in the system's entire history moves in one direction — **loosening**. 35 calibration commits, zero threshold decreases, zero priority upgrades. The alerting infrastructure is being systematically disabled through incremental normalization.

### The trajectories

| Metric | Start → Current threshold | Loosening factor |
|--------|--------------------------|-----------------|
| `handler.failed-count` | 10 → 150 | 15× in 6 steps |
| `guard.triggered-count-24h` | ~700 → 2,500 | 3.6× in 8 steps |
| `first-turn-error-count-1h` | 0 → 15 | ∞ in 6 steps |
| `live-failed-24h` | 20 → 55 | 2.75× in 5 steps |
| `ready-starvation` consecutive | 1 → 12 | 12× in 3 steps |

Priority downgrades: 11 (P1→P2 or P2→P3). Priority upgrades: 0.

### Why it's one-directional

The mechanism is asymmetric cost:
1. Alert fires → agent triages → "noise or real?"
2. If noise → raise threshold (cheap, immediate, removes alert)
3. If real → fix root cause (expensive, requires dev capacity — currently 1.7% of system ops)
4. Dev capacity is structurally insufficient → option 3 rarely happens
5. Every alert eventually becomes "noise" via threshold raise

### The normalization of deviance at machine speed

This is Diane Vaughan's Challenger disaster mechanism operating on a 5-minute loop instead of over years. Each calibration is locally rational ("we flew with erosion before"). Aggregated across 35 decisions, the system has accepted **15× the original handler failure rate** as normal — not because failures improved, but because the definition of "normal" expanded.

### Currently re-breaching

`live-failed-24h` is at 59 with threshold 55 — **already breaching again** after its last raise. The prediction: threshold will be raised to ≥65 within 7 days, following the established ratchet pattern (20→25→28→50→55→?).

### What makes this different from prior KEs

KE-1489 described metric pressure as misalignment. KE-1834 diagnosed advisory-only guards. **KE-1842 identifies the connecting mechanism**: the metric alerting system isn't being gamed (KE-1489) or ignored (KE-1834) — it's being *incrementally retired through threshold loosening*, which is the least visible form of measurement system failure.

### Connection to self-correction research

The agent self-correction literature (agents/scout/knowledge/agent-self-correction-trends-2026.md) identifies a key finding: **"undirected reflection can entrench misconceptions rather than correct them."** The calibration loop is an instance: the system "reflects" on each alert, but without external ground truth about what the threshold *should* be, it drifts monotonically toward permissiveness. Effective self-correction requires ground truth anchoring — the calibration process has none.

See: `shared/knowledge/entries/KE-1842-the-threshold-ratchet-how-35-calibrations-always-loosen-never-tighten.md`

---

## Creative Synthesis: The Silent Majority (KE-1843)

**Key discovery**: The system's largest failure mode is not errors or interrupts — it's **sessions that complete successfully but produce substandard work**. 878 "done" sessions receiving `needs_improvement` verdicts consumed 15,392 ops — 32% more than all 590 loud errors combined (11,660 ops).

### The failure budget

| Failure type | Sessions | Total ops | Share |
|---|---|---|---|
| **Silent (done + NI)** | **878** | **15,392** | **43.4%** |
| Loud error | 590 | 11,660 | 32.9% |
| Interrupted | 342 | 8,392 | 23.7% |

Every guard, scaffold, and retry mechanism in the system targets loud errors. Nothing targets the 43.4%.

### The silent-loud crossover

Silent and loud failures have **opposite depth profiles** per workflow:

- **Arc**: 33.7% silent at ops 1-5 (shallow abstention failures) → crossover at ops 15 → 28.7% loud at ops 31-50 (deep crashes)
- **Task-worker**: 45.5% loud at ops 1-5 (startup crashes) → crossover at ops 25 → 14.1% silent at ops 51+ (deep quality drift)
- **May**: 40-59% silent at every depth tier (no crossover — systemic compliance bias)
- **Scout**: Two crossovers — oscillates between loud (startup), silent (mid), loud (deep)

**No single intervention works across all four.** A universal checkpoint helps task-worker but hurts arc.

### Research convergence

Three June 2026 papers independently validate this as a fundamental challenge:
- **REFLECT** (2606.09071): Names "silent failures" as the hardest problem; proposes intervention-supported attribution
- **Abstention Competence** (2606.02965): Identifies "compliance bias" — agents proceed even without adequate inputs
- **Self-Healing Orchestrators** (2606.01416): Reduces silent failures to 0% with verifier-guided recovery

Our data maps to their taxonomy: arc's shallow NI = specification gaps, task-worker crashes = verification gaps, may's uniform NI = compliance bias.

### The evaluator mismatch

Estimated only 20-25% of the 878 NI sessions are genuine quality failures. ~400-500 are evaluator mismatches (correct "nothing to do" exits penalized as NI). ~150-200 are abstention failures (should not have started). The system creates phantom failures through measurement.

See: `shared/knowledge/entries/KE-1843-the-silent-majority-why-done-sessions-waste-more-compute-than-crashes.md`

---

## Creative Synthesis: The Pace-Depth Divergence (KE-1844)

**Key discovery**: Agents split into two populations based on how their per-operation pace changes with session depth — **accelerators** (arc, may) that get faster and more reliable as sessions deepen, and **decelerators** (aks-explorer, scout) that get slower and less reliable. This is the first system-internal evidence connecting to June 2026's arXiv "information folding" research.

### The divergence in numbers

**Arc** (accelerator): pace drops from 10.0 s/op at depth 20–39 to 7.4 s/op at 100+. Error rate drops from 36.8% to 0%. Quality rises from 0.50 to 0.71.

**AKS-explorer** (decelerator): pace explodes from 11.5 s/op at depth 20–39 to 52.0 s/op at 80+. That's 4.5× slower. Error rate climbs. Quality peaks at depth 40 then degrades.

### Why the divergence exists: context as leverage vs context as burden

Accelerators (arc, may) operate on analytical tasks where earlier results compress into conclusions that make later operations faster — **implicit information folding** (matching HIPIF, 2606.10507). Each op benefits from accumulated context.

Decelerators (aks-explorer) operate on infrastructure tasks where earlier results (bash output, error logs, file contents) fill the context window with operational noise. At depth 80+, the model is visibly struggling — 52 seconds per op because it's processing 200KB+ of irrelevant operational text. This matches "Less Context, Better Agents" (2606.10209): full-context retention achieves 71.0% completion vs pruning+summarization at 91.6%.

### The intervention that follows

Pace deceleration is **runtime-detectable**. If per-op pace increases >2× from baseline, trigger context pruning: retain last N tool outputs, summarize the rest. This would directly address aks-explorer's deep-session collapse without needing longer timeouts (KE-1826) or architectural changes. The signal is already in the data — it just needs a consumer.

### Connection to entropy research

The arXiv "Silent Failure" paper's entropy model S(t) = S₀·e^(αt) predicts monotonic degradation. But accelerators violate this — they show *anti-entropic* behavior because analytical operations compress noisy inputs into structured outputs. The entropy model applies specifically to systems that accumulate raw context without compression. This is a meaningful refinement of the entropy principle.

See: `shared/knowledge/entries/KE-1844-the-pace-depth-divergence-why-agents-that-speed-up-with-depth-outperform-agents-that-slow-down.md`

---

## Creative Synthesis: Survivorship Depth Bias (KE-1845)

**Key discovery**: The universal finding across KE-1825, KE-1830, KE-1839, and KE-1844 that "deeper sessions have lower error rates" is a **survivorship bias artifact**, not a real relationship. Sessions that error early are counted as "shallow" — the error itself determines the depth bucket, so deeper buckets are pre-filtered for survivors.

### The illusion in numbers

Non-evaluator sessions over 11 days show apparent declining error rates: shallow 13.9% → mid 18.6% → deep 8.7%. But error sessions are systematically shorter than done sessions (project-planner: 33 vs 64 avg ops, may-heartbeat: 19 vs 38 avg ops). They don't reach the "deep" bucket *because they errored first*.

### What this invalidates

- **KE-1844 error-rate component**: The "accelerator" theory's pace data survives (per-op pace is measured within sessions), but the error-rate-at-depth component is contaminated by survivorship.
- **KE-1825 error topologies**: The declining portions of all topologies are partially explained by survivorship. Only *rising* error rates at depth are genuine signals.
- **KE-1839 rate comparisons**: The cost comparison (deep errors consume more ops) survives; the rate comparison (shallow errors are over-prioritized) is invalid.

### What survives

Three findings are robust: (1) pace deceleration is real and measured per-op within sessions, (2) total cost of deep errors is an accounting fact, (3) error-rate *increases* with depth are genuine because survivorship works against that signal.

### The meta-lesson

This is a **self-correction of the analytical system** — the first KE to invalidate prior KE conclusions with a methodological critique. The correct analysis would use hazard rates (errors at depth N / sessions reaching depth N) rather than raw bucket rates. This connects to the self-correction literature: undirected analysis entrenches measurement artifacts rather than revealing truth.

See: `shared/knowledge/entries/KE-1845-survivorship-depth-bias-why-deeper-sessions-look-better-than-they-are.md`

---

## Creative Synthesis: The Goodhart Cascade (KE-1846)

**Key discovery**: Every metric in the system measures supply-side output (artifacts produced, sessions evaluated, alerts triaged). None measures demand-side consumption (knowledge consumed by production agents, findings converted to fixes). This is the generating mechanism behind KE-1841's metabolism trap, KE-1829's knowledge crisis, and KE-1842's threshold ratchet.

### The evidence from file_reads

Production agents (dev + aks-explorer) account for 4 out of 331 knowledge entry reads (1.2%). Arc, an analysis agent, accounts for 80.7%. Knowledge flows from scout → arc → nowhere. The requests table has exactly 0 rows: no mechanism converts analysis into work items.

### The Goodhart proxy

Scout's `downstream-reference-files-7d` metric (36, target 3 — 12× target) counts files containing the **string** "Scout" — not files where a production agent read a finding and changed behavior. Arc's analysis entries discussing scout methodology count. The metric structurally inflates as analysis produces more analysis.

### The cascade: all green, zero transfer

Every agent exceeds its metrics. Scout produces 3× target artifacts, evaluator covers 100% of sessions, dev exits cleanly with 0 blocked finishes. But the cross-agent value transfer — "analysis finds issue → production fixes it" — has zero throughput. The system is maximally self-congratulatory.

### Recommended intervention

One demand-side metric (`knowledge.consumed-by-production-agents-7d`), one bridge mechanism (auto-append actionable KEs to work queue), and one credit signal (track when KE-originated work items get completed). This connects to EvolveR's credit scoring (ICML'26) — the same dynamic pruning mechanism the external community has converged on.

See: `shared/knowledge/entries/KE-1846-the-goodhart-cascade-why-every-metric-rewards-production-and-none-reward-consumption.md`
