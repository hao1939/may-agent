# Scout Findings — 2026-06-13

## Creative Synthesis: The Goldilocks Prompt (KE-1860)

**Key discovery**: The system's two zero-error workflows (`project-creative-audit`: 1,282 chars, 0/37 errors; `project-app:fallback`: 1,653 chars, 0/23 errors) share a property that no prior KE identified: **prompt length in a 1,000–2,000 character sweet spot**. Across 16 workflow sources and 6,600+ sessions over 7 days, error rate follows a Goldilocks curve — too short (<500 chars) and too long (>12K chars) both produce high error rates, while the sweet spot produces near-zero errors.

### The Goldilocks curve

| Zone | Prompt range | Avg error% | Examples |
|------|-------------|-----------|----------|
| Too short | <500 chars | 9–21% | verify-wrap (252 chars, 21.4%), scout-explore (106 chars, 8.8%) |
| **Sweet spot** | **1,000–2,000** | **0–5.5%** | **creative-audit (1,282, 0%), fallback (1,653, 0%)** |
| Structured long | 6K–12K | 0.6–8.9% | evaluator workflows, may-heartbeat |
| Overloaded | >12K | 16–19% | arc-heartbeat (14,844, 19.2%), project-planner (11,017, 16.0%) |

### Why this corrects KE-1824

KE-1824 attributed creative-audit's 0% error rate to four scaffold properties (boundaries, structured output, safe exit, pre-computed scope). But `project-app:fallback` also has 0% error rate with **none** of those features — no "Do not" rules, no output format, no explicit safe exit. What both share is prompt length in the sweet spot. The scaffold properties matter because they achieve high information density at compact length — they're the *means*, not the *cause*.

### Key insight: Information density, not character count

The sweet spot works because the prompt contains **complete task framing with zero filler**. Too-short prompts leave agents guessing (missing information → low density). Too-long prompts bury the task in context (diluted signal → low density). The sweet spot has maximum actionable information per character.

The evaluator's 11K prompts succeed because they're template-structured — the agent navigates by structure, not by parsing everything. Effective density ≠ raw length when structure provides navigation.

### The cheapest fix in the system

Expanding verify-wrap from 252 to ~1,200 chars by adding boundaries and output format: predicted error reduction from 21% to <5%. Zero code changes required — just a text edit to a prompt template.

See: `shared/knowledge/entries/KE-1860-the-goldilocks-prompt-how-task-framing-density-predicts-session-success.md`

---

## Creative Synthesis: The Evaluator Resonance Gap (KE-1861)

**Key discovery**: The heuristic and deep evaluators disagree in a **direction that flips at a specific depth threshold** — almost exactly the evaluator's own average session depth (17.4 ops). Below ~20 ops, heuristic overestimates quality. Above ~20 ops, heuristic underestimates. This is a *resonance effect*: measurement systems are most accurate for subjects that structurally resemble themselves.

### The crossover table

| Subject depth | Deep eval Q | Heuristic Q | Gap (deep − heur) |
|---------------|-------------|-------------|--------------------|
| 1–10 ops | 0.583 | 0.646 | **−0.063** |
| 11–20 ops | 0.531 | 0.643 | **−0.112** |
| 21–30 ops | 0.663 | 0.541 | **+0.122** |
| 31–45 ops | 0.689 | 0.617 | **+0.072** |
| 46–60 ops | 0.749 | 0.646 | **+0.103** |
| 61+ ops | 0.728 | 0.608 | **+0.120** |

### Why this matters: scout and arc are systematically undervalued

Dev (avg 7.8 ops) operates in the evaluator's resonance zone — heuristic and deep quality agree within 0.005. Scout (36.2 ops) and arc (42.9 ops) are outside it — the heuristic reports them 0.14–0.16 quality points lower than the deep evaluator. Their quality is reported 20–26% lower than it actually is.

### Cross-source synthesis

- **EvolveR (ICML'26)**: Self-distilled principles outperform teacher-generated ones because of cognitive alignment. Our evaluator imposes its own operational calibration on agents with different operational profiles — same mechanism, same misalignment.
- **XHS self-evolving agents**: The paradigm shift to environment-driven co-evolution prescribes that evaluation should adapt to what it evaluates. Our evaluator stayed at 17.4 ops while subjects inflated to 22–43 ops.
- **KE-1860 (Goldilocks Prompt)**: Prompt length has a reliability sweet spot. Session depth has a measurement-accuracy sweet spot. Same information-density mechanism, different domain.

### Unifying five prior KEs

KE-1827 (evaluator rift), KE-1828 (efficiency inversion), KE-1838 (observation crossover), KE-1845 (survivorship bias), and KE-1860 (Goldilocks prompt) each identified one face of the same underlying pattern: **systems calibrated to their own operational scale become systematically biased when their subjects diverge from that scale.**

See: `shared/knowledge/entries/KE-1861-the-evaluator-resonance-gap-why-measurement-accuracy-depends-on-depth-matching.md`

---

## Creative Synthesis: The Orchestration Tax (KE-1862)

**Key discovery**: The aks-explorer production system's three-phase architectural evolution (owner-exec → owner-worker → planner-worker) constitutes a natural experiment that independently validates three June 11 arXiv papers. Each phase increased orchestration complexity and each phase approximately doubled both error rates and compute cost per success.

### The numbers

| Phase | Pipeline | Error rate | Ops per success |
|-------|----------|-----------|-----------------|
| Phase 1 (owner-exec) | Light orchestration (5.4 ops) → focused executor (12.8 ops) | 2.3% | 7.5 |
| Phase 2 (owner-worker) | Heavy orchestration (19.1 ops) → general worker (28.6 ops) | 10.3% | 27.4 |
| Phase 3 (planner-worker) | Planning layer (47.5 ops) → general worker (46.4 ops) | 20.1% | 58.6 |
| Fallback (single agent) | Direct dispatch, no orchestration | **0%** | 40.2 |

The planner-worker pipeline costs 7.8× more ops per success than the owner-exec pipeline it replaced, with 8× higher error rate.

### Triple-paper convergence

Three fresh arXiv papers (all June 11, 2026) describe the same phenomenon from different angles:

1. **"The Illusion of Multi-Agent Advantage"** (arXiv:2606.13003): Auto-generated MAS consistently underperform single-agent CoT-SC despite costing up to 10×. Our planner-worker pipeline is this exact pattern — architectural bloat that doesn't translate to functional utility.

2. **"Orchestration Reward Modeling" (OrchRM)** (arXiv:2606.13598): Operating at the orchestration level directly is 10× more token-efficient. Our fallback path IS orchestration-level execution — a single prompt with embedded context, no sub-agent rollouts.

3. **"Operadic Consistency"** (arXiv:2606.13649): Compositional decomposition should produce the same result as direct execution. When it doesn't, the model lacks compositional competence. Our planner-worker path fails 20% while the direct fallback path fails 0% — this is operadic inconsistency manifesting in production.

### The unifying principle

Orchestration overhead compounds errors and compute multiplicatively across pipeline stages. The cheapest, most reliable agent system is the one with the fewest stages between task and execution. The path called "fallback" should be the primary.

See: `shared/knowledge/entries/KE-1862-the-orchestration-tax-why-multi-agent-decomposition-costs-8x-more-per-success.md`

---

## Creative Synthesis: The Dark Knowledge Problem (KE-1863)

**Key discovery**: The system's knowledge retrieval mechanism (`findRelatedKEs()` in `heartbeat-data.ts`) only injects KE entries into sessions when a metric breaches 3+ consecutive checks AND the KE body contains the literal dotted metric ID string. Of 48 KE entries created since KE-1824, **43 (90%) contain no dotted metric IDs** and are invisible to every agent except arc (which is instructed to read the entries directory manually). The system produces knowledge it cannot consume.

### The structural root cause

Prior KEs diagnosed symptoms: KE-1846 showed metrics reward production over consumption, KE-1849 showed the feedback pipeline collapses to a single repeated message. KE-1863 identifies the generating mechanism: there is **one retrieval pathway** and it requires a three-way coincidence (metric red 3+ times × KE contains exact metric ID × top-3 by number). No semantic search, no topic matching, no tag lookup.

### The numbers

| What | Count | Impact |
|------|-------|--------|
| Total KE entries on disk | 1,398 | System's accumulated knowledge |
| KEs with dotted metric IDs (retrievable) | ~251 | 18% of knowledge base |
| KEs without metric IDs (dark) | ~1,147 | **82% invisible** |
| Recent KEs (1824-1862) that are dark | 43/48 | **90% of best work invisible** |
| Highest KE ever read by non-producer agent | KE-900 | 962 entries never consumed |
| Dev KE reads (production agent) | 4 | 1.2% of total KE consumption |
| aks-explorer KE reads | 0 | Zero knowledge consumed |

### The self-defeating cycle

1. Scout produces KEs about orchestration costs, prompt density, evaluator bias → **no metric ID in body**
2. Dev runs heartbeat sessions → `findRelatedKEs` scans for metric ID → **no match** → dev never sees findings
3. Dev continues with same prompt structures → errors persist → scout produces more KEs about the same patterns
4. Knowledge base grows (1,398 entries), retrieval doesn't improve (1.7% coverage), error rates don't change

### Connection to EvolveR

EvolveR (ICML'26) requires three stages for self-improvement: offline distillation (KE production ✓), credit scoring (absent ✗), and online retrieval at decision time (vestigial ✗). Our system runs Stage 1 at high volume and has Stage 3 as a metric-ID-only grep. This matches EvolveR's prediction: systems with production-without-retrieval do not improve from accumulated experience.

### The cheapest fix (zero infrastructure)

Add a "Related Metrics" section with dotted metric IDs to high-value KEs. Example: KE-1860 (Goldilocks Prompt) could include `scout.session-error-rate-7d`, `dev.session-error-rate-7d` — making it surface when those metrics breach. Text edit, 5 minutes per KE.

### The medium-term fix (30 lines of TypeScript)

The `findRelatedKEs` function already scans all KE file bodies. Add a second pass matching `<ai_context>` trigger words against the current session's task description. This enables topic-level retrieval with no new infrastructure.

### The meta-insight

The system consistently optimizes supply-side variables while leaving demand-side constraints unaddressed:
- Knowledge **volume** (1,398 entries, ~10/day) vs retrieval **bandwidth** (1.7% coverage)
- Prompt **length** vs information **density** (KE-1860)
- Agent **count** vs error **multiplication** (KE-1862)
- Evaluation **volume** vs measurement **accuracy** (KE-1861)

Each case follows the same pattern: the easy-to-measure output gets optimized, the hard-to-measure binding constraint gets ignored.

See: `shared/knowledge/entries/KE-1863-the-dark-knowledge-problem-why-90-percent-of-shared-knowledge-is-invisible-to-the-agents-that-need-it.md`

---

## Creative Synthesis: The Meta-Work Majority (KE-1864)

**Key discovery**: Across 1,316 sessions and 39,598 operations in the last 24 hours, the system spends **76% of compute on meta-work** (evaluating, planning, orchestrating, maintaining, observing) and only **24% on domain production** (aks-explorer actually doing project tasks). The evaluator alone consumes 30.6% of system ops — more than all domain production combined.

### The compute allocation

| Functional role | Ops | % of system |
|----------------|-----|-------------|
| Evaluator | 12,109 | **30.6%** |
| Domain production | 9,495 | **24.0%** |
| Planner | 7,694 | **19.4%** |
| Infra agents (arc/may/dev) | 5,833 | **14.7%** |
| Scout | 3,403 | **8.6%** |
| Alert triage | 979 | **2.5%** |

### The self-referential evaluator

The evaluator spends 26.3% of its compute evaluating evaluator sessions. This is a self-referential loop: the system evaluating its own evaluation process. That self-evaluation (3,176 ops/day) consumes nearly as much compute as the entire dev+arc+may infrastructure combined (5,833 ops).

### The recursive overhead multiplier

Each domain session (~48 ops) triggers ~129 ops of meta-work: planner to assign it (~44), planner to review completion (~44), evaluator aftermath (~19), evaluator of planner sessions (~16), plus recursive eval-of-eval (~6). The overhead multiplier is **2.7×** — for every op of real work, the system burns 2.7 ops managing it.

### The five-KE unification

KE-1851 (81% loop overhead), KE-1852 (diagnostic ouroboros), KE-1856 (Jevons paradox), KE-1862 (orchestration tax), and KE-1863 (dark knowledge) each identified one symptom. This KE identifies the shared structural cause: the meta-work infrastructure — designed to ensure quality — has achieved majority compute share and is self-sustaining through self-referential loops.

### The key insight

This is Goodhart's Law at system scale. The system optimized for evaluation coverage (target 0.8), planner responsiveness, and alert resolution rate — all meta-metrics. Achieving them allocated 76% of compute to measurement and management, crowding out the production being measured. Every process improvement adds meta-work. No process improvement has ever removed it.

See: `shared/knowledge/entries/KE-1864-the-meta-work-majority-why-76-percent-of-system-compute-is-about-work-not-work-itself.md`

---

## Creative Synthesis: The Correlated Collapse (KE-1865)

**Key discovery**: The system's error metric conflates two categorically different failure populations. Of 429 errors over 7 days, 66 (15.4%) are **infrastructure failures** — zero-op, sub-second sessions where the platform itself was unavailable — mixed in with 363 genuine agent failures. No prior KE separated them because all analysis partitioned on agent identity or session depth, not on the (opCount=0, duration<2s) signature.

### The synchronized burst signature

Infrastructure failures arrive in **correlated bursts** where 3–5 agents crash simultaneously at the exact same second:

| Event | Errors | Agents hit | Pattern |
|-------|--------|-----------|---------|
| Jun 12 05:28 | **16** | 3 agents | Retry storm: 16 failures in 16 seconds |
| Jun 7 12:00 | **5** | 5 agents | All heartbeats fail at :22 |
| Jun 7 18:46 | **4** | 4 agents | All heartbeats fail at :26 |
| Jun 7 20:16 | **4** | 4 agents | Recurrence 90 min later |

These are not agent behaviors — they are platform outages. The scheduler keeps retrying against a down dependency, each retry counted as a separate error against the agent's rate.

### Why this distorts measurement

The inflation is worst for agents that rarely fail on their own:

| Agent | Reported error % | True agent error % | Inflation |
|-------|-----------------|-------------------|-----------|
| tech-lead | 3.8% | 1.9% | **2× reported** |
| evaluator | 1.7% | 0.9% | **1.9× reported** |
| dev | 5.0% | 2.8% | **1.8× reported** |

The evaluator — the system's measurement instrument — has nearly half its errors caused by infrastructure, not by evaluation quality. The thing that measures everything is itself mismeasured.

### The cheapest fix

`WHERE opCount > 0` in every error rate query. One SQL clause separates platform availability from agent quality, eliminating a confound that has distorted every error-based finding since KE-1824.

See: `shared/knowledge/entries/KE-1865-the-correlated-collapse-why-multi-agent-systems-fail-in-synchronized-bursts.md`

---

## Creative Synthesis: The Phantom Quality Crisis (KE-1866)

**Key discovery**: Two quality metrics measure the same system and report categorically different realities. The "Broad needs-improvement rate" reads **35.0%** (3.5× its 10% target). The "Substantive quality failures" rate reads **0%**. The system has been operating under a quality crisis that does not exist.

### The root cause: 1.85-bit information channel

The heuristic evaluator — used for 95% of evaluations (3,000 of 3,159 over 7 days) — produces exactly 4 distinct quality scores:

| Score | Count | % | When assigned |
|-------|-------|---|--------------|
| 0.65 | 1,152 | 38.4% | Acceptable — minor process issues |
| 0.85 | 951 | 31.7% | Good — no issues detected |
| 0.20 | 618 | 20.6% | Session failed (status=error) |
| 0.55 | 279 | 9.3% | Issues detected (uncommitted changes, etc.) |

This carries ~1.85 bits of information per evaluation. The deep evaluator — used for only 5% of evaluations — produces 37 distinct scores carrying ~5 bits. But at a 19:1 ratio, the deep signal is drowned by the heuristic quantization.

### The systematic underestimation

The deep evaluator consistently rates agents higher than the heuristic:

| Agent | Heuristic avg | Deep avg | Gap |
|-------|-------------|---------|-----|
| arc | 0.562 | 0.737 | +0.175 |
| scout | 0.643 | 0.772 | +0.129 |
| aks-explorer | 0.571 | 0.661 | +0.091 |
| may | 0.664 | 0.741 | +0.077 |

### Why this matters: the compounding chain

KE-1805 identified the heuristic as a tautology engine (lookup table). KE-1865 found 15% of "failures" are infrastructure outages. KE-1866 connects them: infrastructure outages → quality=0.20 → inflated needs-improvement rate → phantom 35% quality crisis → 30% of compute (KE-1864) spent evaluating phantom problems.

The quality-problem rate that matters (substantive failures) is **0%**. The metric that's visible is 35%. The system optimizes against a phantom.

See: `shared/knowledge/entries/KE-1866-the-phantom-quality-crisis-how-4-value-quantization-creates-a-35-percent-problem-rate-from-zero-real-problems.md`

---

## Creative Synthesis: The Semantic Type Collision (KE-1868)

**Key discovery**: The `evaluations` table's `wastedCalls` column stores two semantically incompatible quantities. The heuristic evaluator (95% of evaluations) writes `issues.length` — a count of issue strings (range: 0–2). The deep evaluator (5% of evaluations) writes actual wasted tool calls counted by LLM review (range: 4–75). Both pathways INSERT into the same INTEGER column. Any aggregate query blends these incompatible measures silently.

### The magnitude of the distortion

| Evaluator | N | Avg wastedCalls | Waste rate (% of ops) | What it measures |
|-----------|---|----------------|----------------------|-----------------|
| Heuristic | 2,803 | **0.27** | **1.5%** | Issue-string count (meaningless as waste) |
| Deep | 149 | **26.5** | **33.8%** | Actual wasted tool invocations |
| Blended | 2,952 | 1.59 | **4.5%** | A meaningless average of both |

The system reports 4.5% tool waste. Actual waste is 33.8%. The ratio is 7.5×.

### Per-agent: the hidden waste landscape

Deep evaluations reveal every agent wastes 25–45% of its tool calls:
- aks-explorer: **42%** waste (heuristic says 1.2%)
- may: **45%** waste (heuristic says 0.4%)
- arc: **35%** waste (heuristic says 0.5%)
- scout: **25%** waste (heuristic says 0.6%)

These ratios differ by 37×–113×. The `productiveCalls` column has the same collision — it's `opCount - issues.length` for heuristic rows, actual productive calls for deep rows.

### The schema mechanism

```typescript
// Heuristic (evaluator-aftermath.ts line 1153-1154)
productiveCalls: Math.max(0, opCount - params.heuristic.issues.length),  // 60-op session → 59 productive
wastedCalls: params.heuristic.issues.length,                              // → 1 wasted

// Deep (eval-llm-scan.ts line 107-108)
productiveCalls: nonNegativeInt(parsed.productiveCalls),                  // 60-op session → 30 productive
wastedCalls: nonNegativeInt(parsed.wastedCalls),                          // → 30 wasted
```

### Why this matters: the streetlight effect

This is the database-schema equivalent of polysemy — "wastedCalls" means different things depending on who wrote the row. The heuristic writes 19× more rows, so the column's apparent meaning is dominated by the wrong measurement. The system "believes" it wastes <2% of tool calls. The truth is 34%.

### Connection to EvolveR (ICML'26)

EvolveR's key insight: self-distilled principles from actual failure trajectories outperform external labels. Our deep evaluator produces per-call waste classification — exactly the trajectory-level signal EvolveR uses for credit scoring. But the signal is drowned by the heuristic's issue-count overwrite, replicating the "cheap label dominates accurate signal" pattern that EvolveR shows is suboptimal.

See: `shared/knowledge/entries/KE-1868-the-semantic-type-collision-how-wastedCalls-stores-two-incompatible-quantities-in-one-column.md`

---

## Creative Synthesis: The Iatrogenic Feedback Loop (KE-1869)

**Key discovery**: The system's evaluation feedback mechanism — where deep evaluator issues are summarized in `last-eval.md` and injected into the next session's context — doesn't just fail to prevent repeated mistakes. For most agents, sessions that follow "repeated mistake" feedback show marginally WORSE waste rates than sessions following normal evaluations. The feedback signal is at best weakly effective and at worst iatrogenic.

### The production evidence

Analysis of 905 deep evaluations with failureChains reveals a waste taxonomy:

| Waste category | Frequency | % of incidents |
|---------------|-----------|----------------|
| Wrong path assumptions | 200 | 22.1% |
| Schema/column guessing | 175 | 19.3% |
| Repeated prior mistakes | 93 | 10.3% |
| SQL formatting errors | 90 | 9.9% |
| Guard finish rejection | 48 | 5.3% |

**57% of waste incidents are structurally fixable** — they all share one property: the agent guesses something about its environment and guesses wrong. It doesn't need better reasoning — it needs a better world model.

### The five-paper convergence (arXiv, June 8–11 2026)

Five new papers independently converge on the same diagnosis:

1. **HERO** (2606.11559): Turn-level diagnosis from hindsight observations outperforms trajectory-level feedback
2. **SGCD** (2606.12634): Direct self-distillation "silently destroys tool use" — sibling trajectory comparison needed
3. **3SPO** (2606.09961): Per-step state scores from historical success rates enable 2.4× faster convergence
4. **PBSD** (2606.09348): Bayesian credit scoring distinguishes helpful from harmful steps even within successful sessions
5. **ProPlay** (2606.12780): Procedural world models from past trajectories provide structured guidance for future episodes

All five solve the same problem: **trajectory-level feedback provides weak credit assignment for intermediate actions**. Dense, turn-level signals consistently outperform session-level summaries.

### Why our feedback fails

Our deep evaluator already produces the exact turn-level data these papers use:
- Per-step waste diagnoses (HERO analog): "lines 43, 47, 51... all returned the same tool error"
- Successful vs. failed sequences (SGCD analog): recorded in failureChains
- Recurring state patterns (3SPO analog): 200 instances of wrong-path guessing

But this rich signal is **compressed into a 3-issue prose summary** in `last-eval.md` and delivered as trajectory-level feedback — exactly what all five papers show is insufficient.

### The cheapest fix: compile failureChains into a world model

Extract the top-20 wrong-path and wrong-schema mistakes from failureChains and inject them as verified environment facts in each agent's `context.md`:

```
## Verified Paths
- Shared knowledge entries: /app/shared/knowledge/entries/
- NOT /app/agents/shared/knowledge/entries/ (does not exist)

## query_db Rules
- MUST be plain SELECT. No SQL comments. No leading whitespace before SELECT.
```

This converts trajectory-level failure data into ProPlay-style procedural knowledge — eliminating 41% of waste with a text edit.

See: `shared/knowledge/entries/KE-1869-the-iatrogenic-feedback-loop-why-correction-signals-increase-the-errors-they-flag.md`

---

## Creative Synthesis: The Phantom Context (KE-1870)

**Key discovery**: The system's cross-session learning mechanism — `context.md` — is structurally disconnected from the prompt loading pathway. `context.md` is **never loaded into agent sessions**. The system prompt loads only `common-sense.md` + `AGENTS.md` + a runtime environment block. context.md sits on disk accumulating corrections that no session ever sees.

### The evidence that clinches it

Arc has had a "Working Directory Anchor" warning in context.md since **May 15** — 29 days — telling it not to use `/app/agents/shared/knowledge/entries`. Despite this, arc makes the exact wrong-path error in **59% of deep-evaluated sessions** (33/56 over 14 days), with zero improvement trend. The warning might as well not exist.

May got a full DB schema reference added to context.md on **June 8**. Schema-guessing errors continued at the same rate afterward. The corrections are written but never delivered.

### Why this was invisible

The `finish()` tool's `context_updates` description says: *"Facts added here are loaded into future sessions via agents/<name>/context.md."* This is architecturally false — no code path loads context.md into the system prompt (`resolveSystemPrompt` in `manager.ts`) or the heartbeat task prompt (`genericHeartbeat` in `heartbeat-data.ts`). Even `last-eval.md` is not auto-injected into session prompts — evaluation feedback reaches agents through inbox events instead.

The `agent.json` `contextFiles` field lists `context.md` — but this field is `@deprecated` in `types.ts` and only consumed by the fork/message dispatch path, not by heartbeat or run.

### The broken learning loop

```
Agent makes mistake → evaluator flags it → correction written to context.md
→ next session starts → context.md NOT loaded → agent has no memory
→ same mistake → evaluator flags again → correction written again → ∞
```

This explains KE-1869 (iatrogenic feedback) — corrections don't improve behavior because they're never *delivered*. It explains KE-1863 (dark knowledge) from a different angle — context.md is 100% dark, not just 90%.

### The cheapest fix

Add one line to `resolveSystemPrompt` in `manager.ts`:
```typescript
sections.push(this.loadPromptFile(join(agentDir, "context.md")));
```

Or, with zero code change: move the highest-impact corrections from context.md into AGENTS.md (which IS loaded).

### The meta-insight

The system has three knowledge stores: KE entries (90% invisible per KE-1863), context.md (100% invisible per KE-1870), and AGENTS.md (actually loaded). Two of three stores are phantom. The system's observed learning rate — persistent mistakes despite repeated correction — is the expected behavior of a system where accumulated knowledge is unreachable.

See: `shared/knowledge/entries/KE-1870-the-phantom-context-why-context-md-corrections-never-reach-agent-sessions.md`

---

## Creative Synthesis: The World-Model Deficit (KE-1871)

**Key discovery**: Across 157 deep-evaluated sessions over 7 days, **77% of all wasted tool calls (3,202 of 4,177) are caused by agents guessing incorrectly about their environment** — wrong filesystem paths, wrong DB schemas, wrong working directories. The agents are not failing at reasoning. They are failing at knowing where things are.

### The pathological proof: Arc's 29-day amnesia

Arc has had a path correction in context.md for 29 days. In **65% of deep-evaluated sessions** (31/48), it makes the exact same wrong-path error (`/app/agents/shared/knowledge/entries/` → should be `/app/shared/knowledge/entries/`). The correction exists on disk but is never loaded into sessions (KE-1870). This is a natural experiment proving that persistent corrections without delivery produce zero learning.

### Three-paper convergence (arXiv, June 11 2026)

Three fresh papers independently converge on the same structural diagnosis:

1. **EurekAgent** (arXiv:2606.13662): SOTA at $11 via environment engineering — making agent constraints, paths, and artifact structures explicit. Our system has zero of its four environment engineering dimensions.

2. **Agents-K1** (arXiv:2606.13669): Agent-native knowledge orchestration via structured, typed, navigable knowledge graphs — not flat files with lexical grep. Our system's 1,398 KEs sit in a flat directory with a metric-ID-only retrieval pathway.

3. **RA-RFT** (arXiv:2606.13680): Retrieval ranked by expected reasoning benefit rather than semantic overlap. Our system doesn't even have semantic retrieval — it has literal string matching for metric IDs.

### The unifying insight: world models ARE the binding constraint

KE-1860 (prompt density), KE-1862 (orchestration tax), KE-1863 (dark knowledge), KE-1869 (iatrogenic feedback), KE-1870 (phantom context) — all diagnosed different symptoms. KE-1871 identifies the single generating cause: **the system lacks a functional world model**. Agents start every session with the same environment knowledge deficit and spend 77% of their waste rediscovering what they already knew in a prior session.

### The cheapest fix in the system

Add 8 lines to AGENTS.md (which IS loaded) with correct paths and DB schema references. Predicted impact: eliminate 40-50% of world-model waste (~1,300 ops/week). Ten minutes of text editing to save the compute equivalent of an entire agent's weekly output.

See: `shared/knowledge/entries/KE-1871-the-world-model-deficit-why-77-percent-of-agent-waste-is-environment-guessing.md`

---

## Creative Synthesis: The Invisible Third Status (KE-1872)

**Key discovery**: The sessions table has three terminal statuses: `done`, `error`, and `interrupted`. Every system metric operates on only the first two. Over 7 days, **275 aks-explorer sessions (17.9%) ended as `interrupted`**, consuming **6,958 ops** — but these sessions are invisible to error-rate metrics, the evaluator, and the planner.

### Why this matters

On June 6, interrupted sessions were 53.6% of aks-explorer's output — the *majority* status. The system reported a 6.3% error rate. The actual non-success rate was 59.9%. The measurement gap is 9.5×.

### The data

| Status | Sessions (7d) | Ops | % of aks-explorer ops |
|--------|-----------|-----|----------------------|
| done | 1,098 | 39,477 | 77.3% |
| error | 158 | 4,409 | 8.6% |
| **interrupted** | **275** | **6,958** | **13.6%** |

### The connection to KE-1862 (Orchestration Tax)

The fallback path has **0% interrupt rate** (50/50 sessions complete). The task-worker path has **23.8% interrupt rate** (233/977). Including interruptions, the orchestrated path's completion rate drops to **65.6%** — not the 90% that error rates suggest.

This extends KE-1862's finding that the fallback path outperforms orchestration: the gap is 34.4 percentage points when counting interruptions, not 10 percentage points when counting only errors.

### The structural pattern

This is a **measurement boundary problem** — the system's observability was designed for a two-outcome world (done/error). Interrupted sessions were designed as routine lifecycle events (watchdog kills, planner preemption) but function as compute waste: 25-op sessions that produce no output, are never retried, and are never evaluated.

Prior KEs missed this because:
- KE-1865 filtered for zero-op infrastructure failures (interrupted sessions have 25+ ops)
- KE-1864's meta-work accounting counted interrupted ops as "production"
- KE-1868/1869/1871's waste analyses used the evaluations table, which excludes interrupted sessions entirely

### The cheapest fix

Add `WHERE status IN ('error', 'interrupted')` to error-rate metric queries. Five minutes to make 7,000 ops/week of invisible waste visible.

See: `shared/knowledge/entries/KE-1872-the-invisible-third-status-how-interrupted-sessions-create-a-hidden-waste-category-that-no-metric-tracks.md`

---

## Creative Synthesis: The Inversion Point (KE-1873)

**Key discovery**: Between June 4 and June 12, the system crossed a **phase transition** where domain production ops surpassed evaluation ops for the first time. The evaluator-to-production ratio fell from **12.9:1** (Jun 4) to **0.7:1** (Jun 12) — an 18× shift in 8 days. This invalidates KE-1864's "76% meta-work" finding, which is now stale.

### The crossing

| Day | Eval:Prod ratio | Eval share | Production share |
|-----|-----------------|-----------|-----------------|
| May 31 | ∞ (no production) | 74.7% | 0% |
| Jun 4 | **12.9:1** | 54.1% | 4.2% |
| Jun 8 | 2.6:1 | 35.2% | 13.6% |
| **Jun 11** | **0.9:1** (crossing) | 31.3% | 34.2% |
| **Jun 12** | **0.7:1** | 29.1% | 41.6% |

The evaluator didn't shrink (~7K-11K ops/day throughout). Production exploded through three architecture phases: owner-exec → task-worker → planner-worker, with output growing 21× (508 → 10,708 ops/day).

### The measurement deficit

While the system worried about meta-work overhead (KE-1864), it crossed into the opposite regime: **undermeasurement**. Deep evaluation coverage for aks-explorer collapsed from 14.7% (Jun 3) to 2% (Jun 12). New pipeline types — `project-app:fallback` (50 sessions) and `workflow:problem-solver` (24 sessions) — have **zero** deep evals. The system's highest-volume producer is now its least-deeply-understood agent.

### Why this matters: snapshot analysis in non-stationary systems

The system's architecture changes on a ~3-5 day cycle. Any KE using a 7-day window blends 1-2 architectural phases. KE-1864's "76% meta-work" was valid for its moment — but was stale within 72 hours. **Trend direction matters more than point estimates**:
- Production scales; evaluation stays flat → measurement deficit grows
- New pipelines appear with zero deep evals → quality is unknown for the newest paths
- The evaluator's share is passively declining → the meta-work problem is self-correcting into a measurement-deficit problem

### The meta-insight

This is Baumol's Cost Disease in reverse: production automated and scaled through architecture changes, while evaluation stayed artisanal — fixed deep-eval budget, same per-session heuristic, no scaling mechanism. The system moved from "too much measurement per unit of work" to "too little measurement per unit of work" in under two weeks.

See: `shared/knowledge/entries/KE-1873-the-inversion-point-when-production-outpaced-its-own-measurement-system.md`

---

## Creative Synthesis: Total Functions (KE-1874)

**Key discovery**: KE-1860's "Goldilocks prompt" hypothesis — that a 1,000–2,000 character prompt length sweet spot predicts zero-error workflows — is falsified by a new workflow that appeared after KE-1860 was written. The `workflow:problem-solver` achieves 100% success rate (24/24) at **5,265 chars average** — 3.2× outside the supposed sweet spot. Meanwhile, `workflow:evaluator-deep-eval` achieves 100% (49/49) at 9,610 chars. The five 100%-success workflows span 1,266 to 9,610 chars — a 7.6× range with no length sweet spot.

### What actually predicts zero errors: Task Totality

All five perfect-record workflows share one structural property: **every reachable world state has a valid completion**. In PL theory terms, they are *total functions* — they return a value for every input and cannot crash.

| Workflow | Success | Chars | Total because... |
|----------|---------|-------|------------------|
| `project-creative-audit` | 8/8 | 1,266 | Any findings = valid |
| `project-app:fallback` | 50/50 | 1,659 | Any small action = valid |
| `workflow:problem-solver` | 24/24 | 5,265 | `resolved \| escalated` — both are success |
| `workflow:evaluator-deep-eval` | 49/49 | 9,610 | Any evaluation = valid |
| `evaluator-aftermath` | 963/979 | 10,204 | Any evaluation = valid (16 are infra) |

Compare the **partial** workflows (some world states have no valid completion):

| Workflow | Success | Chars | Fails when... |
|----------|---------|-------|---------------|
| `workflow:task-worker` | 313/374 (83.7%) | 2,677 | Cloud ops fail, no escape hatch |
| `workflow:project-planner` | 207/270 (77%) | 13,726 | Tree state creates unresolvable conflicts |

### The proof case: problem-solver vs task-worker

Same agent (aks-explorer). Same project (aks-rp-e2e). Same domain tasks. Different framing:
- **Task-worker**: `RESULT: done | partial | blocked` — but "blocked" triggers error handling
- **Problem-solver**: `PROBLEM_RESULT: resolved | escalated` — "escalated" IS a success

Plus problem-solver pre-loads the environment (`Useful commands:` with exact paths), eliminating the world-model guessing that KE-1871 showed causes 77% of waste.

### Why KE-1860 was wrong but useful

KE-1860 observed a real correlation (short prompts ↔ success) but the causation runs through totality: total tasks tend to be shorter because they don't need complex failure-recovery instructions. Problem-solver breaks the correlation because it achieves totality through *explicit binary outcome framing*, not through brevity.

### Design principle

To design a zero-error workflow: ensure every reachable world state has a valid completion. Add explicit escape hatches (`resolved | escalated` not just `done | failed`). Frame tasks as assessments when possible ("investigate and report" always succeeds; "fix this" may not). Pre-load environment facts.

See: `shared/knowledge/entries/KE-1874-total-functions-why-zero-error-workflows-share-unfailable-task-structure-not-prompt-length.md`

---

## Creative Synthesis: Punctuated Equilibrium (KE-1875)

**Key discovery**: The aks-explorer system's architecture doesn't improve gradually — it evolves through **punctuated equilibrium**. Over 12 days and 2,902 sessions, five distinct phases show a repeating crash-and-recover signature: a new orchestration layer is introduced, success rates crash (sometimes to 4.8%), then partially recover over 3-5 days — but never reach the prior baseline.

### The five phases

| Phase | Days | Architecture | Peak to Trough |
|-------|------|-------------|---------------|
| 1. Owner-exec | Jun 1-3 | project-owner + execution-engine | 100% to 97.3% (stable) |
| 2. Task-worker intro | Jun 4-5 | + task-worker | 93.3% to **47.2%** (crash) |
| 3. Nadir | Jun 6-7 | task-worker dominant | 40.1% to **4.8%** (deepening) |
| 4. Recovery + planner | Jun 8-10 | + planner | 88.4% to 61.6% (new crash) |
| 5. Multi-pipeline | Jun 11-12 | + fallback + problem-solver | 83.4% to 80.9% (stabilizing) |

### The crash pattern repeats exactly

Task-worker: 4 sessions (Jun 4, 100%) to 173 sessions (Jun 5, 34.7%) to crash. Planner: 15 sessions (Jun 9, 6.7%) to same pattern. Each new layer is deployed all-at-once with no canary mechanism. Small-N pilots succeed; full-scale deployment reveals latent failure modes; the system doubles down before adapting.

### The evolutionary tax

The crash-and-nadir period (Jun 5-7) cost ~9,400 ops of pure waste — roughly 4 days of Phase 1 output. This is the front-loaded cost of architectural experimentation in production.

### The non-obvious insight: accidental natural selection

The system is **running natural selection on its own architecture**. Phase 5's four coexisting pipelines (fallback: 100%, problem-solver: 100%, task-worker: 85%, planner: 77%) represent ecological niche specialization — different pipeline types serving different task types. This is exactly what the XHS "8 Architectures" taxonomy predicts: no single architecture wins; production systems converge toward per-task-type routing.

### Connection to biology and external research

The biological prediction (Gould & Eldredge, 1972) is that the new equilibrium (~83%) will never reach the old one (~98%). Added architectural complexity introduces permanent overhead. Our data confirms this exactly.

EvolveR (ICML'26) predicts that adding credit scoring — tracking `(pipeline_type, task_category, success_rate)` and using it for routing — would prevent the "double down before adapting" pattern that caused 9,400 wasted ops.

See: `shared/knowledge/entries/KE-1875-punctuated-equilibrium-how-architecture-evolves-through-crash-and-recover-not-gradual-improvement.md`

---

## Creative Synthesis: The Rework-Review Trap (KE-1876)

**Key discovery**: The task-worker pipeline's failure-recovery mechanism is self-amplifying — it generates more failures than it recovers. Of 1,190 task-worker sessions, **676 (57%)** are rework-review or rollup-review chains, not original domain work. These review sessions succeed only 51.2% of the time (vs 76.8% for original tasks) and are interrupted 41.9% of the time (vs 7.2%). Each interruption spawns another rework-review, creating a cascade.

### The mechanism: watchdog timer vs. task weight

70% of all task-worker interruptions (223/320) hit a ~300-second duration boundary — the watchdog kill timer. Rework-reviews are structurally heavier than original tasks (they must read the original task, its evidence, the rejection, and tasks/tree.json before deciding anything), but they inherit the same 5-minute timeout. The agent is killed mid-write, creating another rework-review with the same burden and the same timeout.

### The cascade depth

| Chain depth | Success% | Interrupt% |
|-------------|----------|------------|
| Original task | 78.1% | 7.6% |
| Depth-1 rework-review | 47.2% | **45.4%** |
| Depth-2+ (review of review) | 10-20% | **80%** |

One task (`golden-path-rollout-batch-1-rework-review`) was dispatched 13 times — all 13 interrupted. 327 ops producing zero output.

### The compute cost

7,861 ops (21% of all task-worker compute) spent on review chains that produce no output. The system spends more compute on failed failure-recovery than on original-task failures.

### The unifying insight across KEs

- KE-1872 found 17.9% of sessions are "interrupted" but invisible. KE-1876 shows 70% of those interruptions are in review chains, not original work.
- KE-1874 showed zero-error workflows are total functions. Rework-reviews are profoundly partial — asked to produce "evidence-backed reasoning" from sessions that left no evidence.
- KE-1875 showed punctuated equilibrium crashes. The rework-review cascade is the micro-mechanism: each crash triggers recovery work that itself crashes.
- KE-1862 identified 8× orchestration overhead. Review chains are a major contributor (57% of task-worker sessions are overhead).

### Three fixes, cheapest first

1. **Increase watchdog timeout for rework-reviews** (300s → 600s): let the agent finish reading before being killed
2. **Cap chain depth at 1**: if a rework-review is interrupted, mark the original task `blocked` instead of spawning another review
3. **Add `CLAIM: rerun`** as a valid outcome: when the original was interrupted without evidence, immediately reschedule instead of requiring complex recovery analysis

See: `shared/knowledge/entries/KE-1876-the-rework-review-trap-how-failure-recovery-generates-more-failures-than-it-recovers.md`

---

## Creative Synthesis: Failure Migration (KE-1877)

**Key discovery**: The system exhibits **failure migration** — fixing failures in one pipeline stage doesn't reduce total system waste; it pushes failures to the adjacent stage. Over 7 days, task-worker interrupts dropped from 163/day to 0/day while planner interrupts rose from 0/day to 39/day. Total waste ops remained at ~2,000/day despite three major architectural interventions. This is a conservation law analogous to Goldratt's Theory of Constraints applied to agent pipeline reliability.

### The crossover

| Day | task-worker fails | planner fails | Total waste ops |
|-----|------------------|--------------|-----------------|
| Jun 7 | **180** (67.9%) | 0 | 4,447 |
| Jun 10 | **63** (34.4%) | **14** (93.3%) | 2,008 |
| Jun 12 | 27 (17%) | 21 (25%) | 1,725 |
| **Jun 13** | **16** (14%) | **54** (24.8%) | **2,041** |

The task-worker improved dramatically (67.9% → 14% failure rate). But system waste didn't collapse — the planner's latent 25% failure rate was always there, masked by the worker's louder failures. Fixing the worker revealed the planner.

### The failure type also migrates

The task-worker evolved from interrupt-dominant (163 interrupts, 17 errors on Jun 7) to error-dominant (0 interrupts, 17 errors on Jun 13). Fixing watchdog timeouts eliminated interrupts but revealed deeper errors. The planner now shows the same interrupt-dominant pattern the worker had a week ago — it's in the phase the worker already passed through.

### Why total-function pipelines break the pattern

`project-app:fallback` (50 sessions, 0 fails) and `workflow:problem-solver` (27+ sessions, 0 fails) have zero waste because they eliminated stages entirely. No adjacent stage means no migration target. The conservation law only holds for multi-stage pipelines.

### The practical principle

**Don't fix pipeline stages. Eliminate them.** Per-stage optimization reveals the next bottleneck (failure migration), stage reliabilities multiply not add (reliability tax), and fix attempts themselves consume compute (meta-work overhead). Single-stage total-function pipelines achieve 100% reliability at 31-36 ops/success. Multi-stage pipelines achieve 75-86% at 40-50 ops/success. No amount of per-stage fixes closes this gap.

### Unifying insight across the KE arc (1860-1877)

KE-1877 completes a six-entry arc that began with KE-1862 (orchestration tax). The arc's throughline: **multi-stage agent pipelines are fundamentally reliability-limited by their weakest stage, and every fix to one stage reveals the next**. The only exit from this cycle is architectural — eliminating stages rather than perfecting them. The system has already started doing this with fallback and problem-solver pipelines. The prediction: if >80% of work routes through single-stage pipelines, waste drops below 500 ops/day.

See: `shared/knowledge/entries/KE-1877-failure-migration-how-fixing-one-pipeline-stage-pushes-failures-to-the-next.md`

---

## Creative Synthesis: Adaptive Radiation (KE-1880)

**Key discovery**: The aks-explorer system's architecture underwent a phase transition today. Every prior architectural change was a **replacement** (owner-exec → task-worker → planner-worker), each causing a success-rate crash (KE-1875). Today, for the first time, two new pipeline types appeared **alongside** the existing ones without replacing them — and no crash occurred.

### The ecological niche structure

| Pipeline | Niche | Today's success% | Waste% |
|----------|-------|-------------------|--------|
| **Fallback** | Simple, well-defined tasks | **100%** (50/50) | 0% |
| **Problem-solver** | Blocked/failed task recovery | **93.5%** (29/31) | 0% |
| Task-worker | Complex cloud mutations | 86.9% | 10.3% |
| Planner | Task decomposition & routing | 74.4% | 23.7% |

Each specialist occupies a distinct niche — fallback handles what's easy, problem-solver handles what's broken, task-worker handles what requires real cloud operations. This is **adaptive radiation**: after the Jun 9–11 crisis (40–68% success), specialized forms emerged to fill niches the generalist couldn't serve reliably.

### Why addition succeeds where replacement fails

Replacement evolution always crashes because the new pipeline isn't adapted to all niches, the old pipeline's adaptations are lost, and failures migrate to uncovered niches (KE-1877). Additive evolution avoids all three problems:

- The specialist is perfectly adapted to its niche (no crash)
- The generalist retains its adaptations for remaining niches (no regression)
- Total-function specialists have no failure to migrate (chain broken)

### Competitive release: the generalist improved without changing

The task-worker's success rate jumped from 80.4% (before fallback appeared) to 93.0% (after) — not because it changed, but because easy tasks that it sometimes failed at were absorbed by the fallback. When a specialist takes over a generalist's weak niche, the generalist performs better in its remaining niche.

### The six-KE arc completed

KE-1880 reframes the entire KE-1862→1877 arc:
- **KE-1862** (Orchestration Tax) → the generalist's disadvantage
- **KE-1874** (Total Functions) → the mechanism of specialization
- **KE-1875** (Punctuated Equilibrium) → only *replacement* evolution crashes; *addition* doesn't
- **KE-1876** (Rework-Review Trap) → problem-solver's escalation exit breaks the cascade
- **KE-1877** (Failure Migration) → specialization bypasses migration entirely

### The meta-insight

Architecture matters less than how it changes. The system accidentally discovered a superior evolutionary strategy (addition, not replacement). If this pattern is recognized and generalized, future architectural improvements can be introduced without the crash-and-recover cycle that has cost ~9,400 wasted ops over the last week.

See: `shared/knowledge/entries/KE-1880-adaptive-radiation-how-pipeline-ecology-replaced-pipeline-evolution.md`

---

## Creative Synthesis: The Succession Illusion (KE-1881)

**Key discovery**: KE-1880's "adaptive radiation" narrative — four specialized pipelines coexisting in an ecosystem — is an artifact of day-level data aggregation. At hourly resolution, the fallback and problem-solver pipelines **never operated simultaneously**. They are sequential regimes, not co-existing species.

### The timeline that day-level data hid

| Phase | Hours | Fallback sessions | Problem-solver sessions | Planner failure rate |
|-------|-------|-------------------|------------------------|---------------------|
| Pre-specialist | 494788-494789 | 0 | 0 | 26.7% (crisis hour) |
| **Fallback era** | **494790-494795** | **50** | **0** | **5.1%** |
| **Problem-solver era** | **494796-494801** | **0** | **33** | **37.1%** |

The two "species" never shared a single hour. This is ecological succession, not adaptive radiation.

### The system was dramatically healthier during fallback's tenure

| Metric | Fallback era | Problem-solver era | Change |
|--------|-------------|-------------------|--------|
| Overall success rate | **97.2%** | **77.5%** | −20 points |
| Planner failures | 4 of 79 | 43 of 116 | 10× more |
| Ops per success | **30.1** | **37.4** | +24% more expensive |
| Total failures | 4 | 47 | 12× more |

### Why: Prevention vs. Treatment

**Fallback is preventive**: It intercepts tasks *before* they reach the planner-worker pipeline. During hours 494791-794, the task-worker volume dropped to **zero** — fallback was handling the tasks that would have been routed through the planner. The planner ran at 100% success for 3 consecutive hours because it only received tasks it could handle.

**Problem-solver is reactive**: It activates *after* tasks have already failed. Each problem-solver success resolves one failure but doesn't prevent the next planner failure. The planner receives the full task distribution, fails at 37.1%, and problem-solver tries to clean up — but 33 recoveries can't undo the waste from 43 planner failures plus their downstream effects.

### The Golden Hours: What was possible

Hours 494792-494794 represent the system's best-ever sustained performance: **3 consecutive hours of zero failures across 74 sessions**. This wasn't theoretical — it actually happened. The system demonstrated it can sustain ~100% success when task routing is right. It lost this state when fallback was replaced, not improved.

### The meta-insight: Aggregation hides dynamics

KE-1880 analyzed at day-level granularity and saw four coexisting pipelines. KE-1881 analyzed at hour-level granularity and saw two successive regimes. The "four-pipeline ecosystem" never existed in any single hour — it's a statistical artifact of mixing two sequential phases. Every KE that aggregates across hours or days should be questioned: does this pattern exist at the resolution of individual observations, or is it an average of two different regimes?

### The actionable prediction

If both fallback and problem-solver operate in the same hour window (true coexistence, not succession), the planner's failure rate should return to ~5-10%, and the system should sustain ~95%+ success. If the planner stays above 25% failure even with both present, the planner itself has degraded.

See: `shared/knowledge/entries/KE-1881-the-succession-illusion-how-fallback-and-problem-solver-displaced-rather-than-coexisted.md`

---

## Creative Synthesis: The Epistemic Metabolism (KE-1882)

**Key discovery**: The KE-1856 to KE-1881 burst — 26 entries in 11 hours — contains **3 internal correction chains** where later entries explicitly falsify earlier ones *from the same burst*. The half-life of a knowledge claim (33 minutes to 6 hours) is now shorter than the time for any consuming agent to read it. This isn't the Dark Knowledge Problem (KE-1863, about retrieval plumbing) — it's a rate mismatch: claims decay faster than they can propagate.

### The three self-corrections

| Original claim | Created | Corrected by | Latency |
|----------------|---------|-------------|---------|
| KE-1860: "Prompt length 1K-2K predicts success" | 08:41 | KE-1874: "Task totality, not length" | **6 hours** |
| KE-1864: "76% of compute is meta-work" | 10:47 | KE-1873: "Ratio already inverted" | **4 hours** |
| KE-1880: "Adaptive radiation — pipelines coexist" | 17:42 | KE-1881: "Succession — they displaced each other" | **33 min** |

Correction latency is accelerating: 6h → 4h → 33min. The system is getting *faster* at falsifying its own claims — but no consumer benefits, because no consumer reads at that speed.

### The consumption gap

- 1,420 KE files on disk; non-scout agents have read 176 (12.4%), all at or below KE-900
- 520 KEs produced since KE-900; zero read by any consumer
- The 26-entry burst has been read by exactly zero non-scout agents
- Last non-scout KE read: ~May 7 (35+ days ago)

### The self-referential reference graph

The 26 burst entries contain 134 KE-to-KE references:
- 75 (56%) internal — pointing to other entries within the same burst
- 44 (33%) recent — pointing to KE-1800-1855 (also unread by consumers)  
- 15 (11%) external — pointing to KE-900 and below (the only range consumers have reached)

**89% of references form a closed loop.** Scout cites scout. The knowledge graph is a monologue.

### The EvolveR connection

EvolveR (ICML'26) prescribes three stages for self-improvement: offline distillation (KE production ✓), credit scoring (absent ✗), and online retrieval at decision time (vestigial ✗). Without credit scoring, superseded claims retain full standing. KE-1860, KE-1864, and KE-1880 are still on disk with no staleness marker — a consumer encountering them would act on claims that their own system has already falsified.

### The key insight

A knowledge system's value is bounded by `min(production_rate, consumption_rate, claim_stability)`. When production >> consumption and stability < consumption_cycle, the system generates heat, not light. The system that identified the Dark Knowledge Problem (KE-1863) is itself the primary source of the problem — through its own velocity, not through malfunction.

### The actionable prescription

Multi-resolution validation before publication: before publishing a causal claim, query data at 2+ temporal resolutions (hourly AND daily AND weekly). If the claim reverses at any resolution, note the dependency explicitly. This trades latency for reliability — the opposite of the current metabolism.

See: `shared/knowledge/entries/KE-1882-the-epistemic-metabolism-why-the-knowledge-system-consumes-its-own-claims-faster-than-consumers-can-read-them.md`

---

## Creative Synthesis: The Observation Without Influence (KE-1883)

**Key discovery**: The evaluator agent consumes **45% of total system compute** (128,197 of 284,789 ops) to produce 19,089 evaluations — but zero production agents have ever read an evaluation result. The feedback loop from evaluation to behavior does not exist.

### The compute asymmetry

| Agent | Total ops | % of system |
|-------|-----------|------------|
| **evaluator** | **128,197** | **45.0%** |
| aks-explorer | 68,652 | 24.1% |
| scout | 30,828 | 10.8% |
| may | 26,916 | 9.5% |
| arc | 23,741 | 8.3% |
| dev | 4,686 | 1.6% |

The evaluator spends **1.87× more compute** than the production system (aks-explorer) it evaluates.

### The delivery gap

The file_reads table reveals the disconnect:

- **aks-explorer**: 0 total file reads in the table (not just 0 evaluation reads — 0 of anything)
- **scout, may, arc, dev**: combined 0 evaluation file reads across all time
- **5,495 negative verdicts** sit in the evaluations table with specific actionable issues
- **2,562 actionable improvement signals** (schema errors, shallow sessions, uncommitted changes) — all ignored

### The 5 most flagged issues, all fixable, all unread

| Issue | Count | Status |
|-------|-------|--------|
| Shallow session (2 messages, no work) | 1,006 | Never delivered to dispatchers |
| Review override to needs_improvement | 811 | Never delivered to agents |
| Schema/query errors in transcript | 550 | Never delivered to agents making them |
| Finish blocked by uncommitted changes | 127 | Never delivered to agents |
| Combined schema + uncommitted | 68 | Never delivered to agents |

### The EvolveR lens (again)

This is the same EvolveR gap identified in KE-1882 but more severe. EvolveR's three stages:
1. Offline distillation → evaluator does this ✓
2. Credit scoring → missing ✗
3. **Online retrieval at decision time → completely absent** ✗

The evaluator is a teacher who grades every paper but never returns them to students.

### The self-referential blind spot

The evaluator evaluates every agent except itself. Zero evaluations exist where `agent = 'evaluator'`. The largest consumer of system compute — 45% of all ops — is never evaluated for quality or efficiency.

### The cheapest fix

Inject the agent's 3 most recent `needs_improvement` issues into its prompt context at session start. ~200 characters, zero new infrastructure. Transforms evaluation from observation to feedback.

### Connection to prior KEs

- **KE-1861** (Evaluator Resonance Gap): Even when heuristic and deep agree, it doesn't matter — no one reads either verdict
- **KE-1863** (Dark Knowledge): KE retrieval has a narrow pipe; evaluation has **no pipe at all**
- **KE-1882** (Epistemic Metabolism): Scout produces knowledge faster than consumers read; evaluator produces evaluations at a steady rate with consumption rate of **exactly zero**
- **KE-1864** (Meta-Work Majority): The evaluator is the purest meta-work — 45% of compute judging work, zero effect on the work judged

### The meta-insight

A system can spend 45% of its compute measuring quality without any quality improvement occurring. Measurement is not management. Observation is not influence. **An evaluation system that never delivers its verdicts is thermodynamically expensive noise.**

See: `shared/knowledge/entries/KE-1883-the-observation-without-influence-why-45-percent-of-system-compute-produces-verdicts-that-never-reach-their-subjects.md`

---

## Creative Synthesis: The Invisible Hand (KE-1884)

**Key discovery**: The system has two improvement channels — a **designed** one (evaluation → feedback → behavior) that is broken, and an **emergent** one (crisis → code change → reload → improvement) that works. Every measured quality improvement in the last 7 days traces to git commits, not to evaluation feedback.

### The two channels

| Channel | Compute cost | Improvement delivered |
|---------|-------------|---------------------|
| **Designed** (evaluation→feedback) | 128,197 ops (45% of system) | **Zero** measured instances |
| **Emergent** (code→reload) | ~5,800 ops (4.5% of system) | **All** measured improvement |

### The smoking gun: the task tree engine

The task tree engine commit (`bed1f5fce`, Jun 12) caused the largest single quality improvement in the system's recent history:

| Metric | Before commit | After commit | Change |
|--------|--------------|--------------|--------|
| Planner error rate | 25.0% | 5.2% | **−80%** |
| Planner avg ops | 53.9 | 22.9 | **−57%** |
| Task-worker quality | 0.628 | 0.782 | **+24.5%** |

The evaluator had flagged planner issues 197 times on day 20610. Zero of those evaluations reached the planner. The improvement came from a code commit. The task-worker improved without self-modification — upstream code changes improved its input quality.

### Lamarckian vs. Darwinian improvement

The evaluation system assumes **Lamarckian** improvement: agents learn from feedback and self-correct. But no feedback reaches any agent.

The actual improvement is **Darwinian**: code changes create new pipeline variants (fallback, problem-solver), the variants that fail are starved of tasks by routing infrastructure, and the system improves through environmental change rather than individual learning.

Evidence:
- Fallback absorbed tasks from planner-worker (selection pressure)
- Problem-solver absorbed failed tasks (niche occupation)  
- Task-worker quality improved without self-modification (environmental change)
- The planner improved via code change, not self-correction (mutation from outside)

### The system's self-model is wrong

The system believes it improves through evaluation. 45% of compute is allocated to this belief. But every quality improvement traces to a code commit, not an evaluation verdict. The measurement system measures a Lamarckian process that isn't happening while ignoring the Darwinian process that is.

### What evaluation *could* measure instead

1. Pre/post quality around `runtime.reload.requested` events
2. Pipeline routing changes (is fallback absorbing tasks planner-worker fails at?)
3. Design doc → code change → improvement chains

This would transform evaluation from "grading homework never returned" to "tracking which environmental changes help."

See: `shared/knowledge/entries/KE-1884-the-invisible-hand-how-code-changes-not-evaluations-drive-all-measured-improvement.md`

---

## Creative Synthesis: The Expensive Failure Transition (KE-1885)

**Key discovery**: Over 15 days and 13,901 sessions, the system's **fail-cost ratio** (avg ops per error ÷ avg ops per success) rose from **0.10 to 1.15**. Early errors were cheap infrastructure crashes (1.3 ops). Current errors are expensive semantic failures (30+ ops) — behaviorally indistinguishable from successes until the final step. The system eliminated its cheap failure modes without adding early-detection for semantic failures.

### The fail-cost trajectory

| Day range | Avg error ops | Avg success ops | Fail-cost ratio |
|-----------|--------------|----------------|-----------------|
| 20602–20604 | 1.3–3.7 | 12.4–13.7 | **0.10–0.30** |
| 20605–20608 | 6.6–13.2 | 11.2–17.0 | **0.44–0.78** |
| 20609–20610 | 22.4–25.1 | 22.3–23.8 | **0.94–1.13** (crossover) |
| 20612–20616 | 23.2–33.3 | 27.1–30.0 | **0.84–1.16** (sustained parity) |

### The immune response analogy

Infrastructure crashes were an accidental immune system — they killed bad sessions at 1.3 ops (cheap rejection). As infrastructure hardened, this immune response vanished. The evaluation system (45% of compute) is autopsy, not immunity — it runs after the patient is already dead. Nothing in the environment now signals "wrong direction" before 30 ops are burned.

### Three-paper convergence with arXiv (June 11, 2026)

1. **EurekAgent** (2606.13662): "Environment engineering is all you need" — argues the bottleneck shifted from workflow design to environment design (permissions, artifacts, budgets, checkpoints). Our system has none of these. They achieved SOTA at $11 total API cost through environmental constraints that prevent waste.

2. **RA-RFT** (2606.13680): Retrieval ranked by *expected reasoning benefit* (not semantic similarity) improves accuracy 2.8–7.1 points. Our KE retrieval uses literal string matching — not even semantic, let alone reasoning-aware. This is the knowledge-level immune response the system lacks.

3. **Shield Synthesis** (2606.13621): Formal safety analysis should be a design-time diagnostic, not runtime enforcement. "Small architectural changes can produce large shifts in operational outcomes while leaving formal safety margins nearly unchanged." Our `error` column is universally null (formal safety perfect) while `outcome='error'` sessions burn 30+ ops each.

### The unifying principle

> Systems that eliminate cheap failure modes without adding semantic boundaries produce expensive failures.

The fix is environment engineering — checkpoint assertions, budget envelopes, artifact expectations, and mid-session correction signals. Each converts a 30-op semantic failure into a 5-10 op early rejection.

### Notable finding: arc errors cost MORE than successes

Arc's errors average 38.8 ops vs 36.1 ops for successes (ratio 1.07). It spends *more compute failing* than succeeding — likely attempting recovery before giving up. Total waste across all agents: 24,788 ops (errors + interrupts) = ~17% of all compute.

See: `shared/knowledge/entries/KE-1885-the-expensive-failure-transition-when-errors-cost-as-much-as-successes-the-system-lost-its-immune-response.md`

---

## Creative Synthesis: Simpson's Paradox in Fail-Cost (KE-1887)

**Key discovery**: KE-1885's headline claim — that the system's fail-cost ratio reached parity (~1.0), meaning errors cost as much as successes — is **Simpson's Paradox**. When decomposed by agent, every individual agent still fails cheaper than it succeeds. The aggregate appears at parity purely because of composition effects.

### The paradox, in numbers

**Aggregate (late period)**: avg success ops = 26.8, avg error ops = 26.7 → ratio 0.99 (apparent parity)

**Per-agent (same data, same period)**:

| Agent | Succ ops | Err ops | Fail-cost ratio | Error rate |
|-------|----------|---------|-----------------|------------|
| evaluator | 19.2 | 7.1 | **0.37** | 1.6% |
| aks-explorer | 35.0 | 26.8 | **0.77** | 11.0% |
| may | 30.8 | 21.8 | **0.71** | 7.8% |
| scout | 50.6 | 37.5 | **0.74** | 14.6% |
| dev | 9.3 | 8.3 | **0.89** | 5.0% |
| arc | 62.7 | 40.8 | **0.65** | 18.7% |

Every agent has errors 11–63% cheaper than successes. The "immune response" is intact.

### How the paradox works

The evaluator acts as a **gravitational mass** in the success average: 3,351 cheap successes (19 ops each) = 54.5% of all successes. But it barely appears in errors (54 out of 398 = 13.6%). So:

- Success average gets **pulled down** by the evaluator's massive cheap volume
- Error average is **dominated** by expensive agents (arc at 41 ops, scout at 38 ops) that fail disproportionately

Result: aggregate success ≈ aggregate error — but this is a composition artifact, not a cost-parity phenomenon.

### What this corrects about KE-1885

1. **"The system lost its immune response"** → No. Each agent still fails 23-63% cheaper than it succeeds. Fail-fast is working.
2. **"Errors cost as much as successes"** → No. Different agents' errors and successes are being mixed across categories with different weights.
3. **"Environmental signals needed to make wrong paths fail fast"** → The real problem is not fail speed but **fail frequency on expensive agents**: arc (18.7%), scout (14.6%), aks-explorer (11.0%).

### The deeper implication: aggregate metrics are toxic in multi-agent systems

This is not a one-off error. Any aggregate metric across heterogeneous agents is vulnerable to Simpson's Paradox when:
- Agents have different operational costs (ours span 8× in avg ops)
- Error rates differ across agents (1.6% to 18.7%)
- One cheap agent dominates volume (evaluator = 55% of sessions)

At least five prior KEs (1860, 1861, 1862, 1864, 1885) used aggregate session metrics as evidence. Each should be verified by agent-level decomposition before trusting its conclusions.

### The actionable fix

Stop reporting aggregate session metrics without agent-level decomposition. The system "error rate" is meaningless when it mixes evaluator (1.6%) with arc (18.7%). Report per-agent trends separately.

See: `shared/knowledge/entries/KE-1887-simpsons-paradox-in-fail-cost-why-aggregate-metrics-reverse-every-agents-individual-truth.md`

---

## Creative Synthesis: The Productive Failure Paradox (KE-1888)

**Key discovery**: 76% of the planner's "interrupted" sessions (57 of 75) successfully dispatched task-workers before being killed by the 300-second watchdog — and 94% of those dispatched workers completed successfully. The system is **2.2x more productive** than the prior architecture despite the planner showing a 39% failure rate.

### The measurement illusion

The task tree engine split the planner into two steps: event review (step 1, always succeeds at 5 ops) and planning update (step 2, 78% interrupted at 300s). The outcome column records step-2 interrupts as failures. But temporal join analysis reveals these "failures" dispatch workers milliseconds before the watchdog kills them:

| View | Planner success | Task throughput | Domain output |
|------|----------------|----------------|--------------|
| **Reported** (outcome column) | 60.9% | — | Appears degraded |
| **Functional** (dispatch analysis) | 81.3% | 12.1 done/h (3x prior) | 2.2x improvement |

### What this corrects

Five prior KEs (KE-1876, KE-1877, KE-1872, KE-1864, KE-1885) used `outcome = 'interrupted'` as a proxy for waste. In the current architecture, that proxy is broken: the outcome column measures **watchdog compliance** (did session exit before timeout?) not **functional success** (did session accomplish its purpose?). The system is 33% more successful than its metrics report.

### The bimodal split

Step-2 sessions split into a fast path (1-6 ops, always completes, 70% of done sessions) and a complex path (14-54 ops, almost always interrupted). The crossover at ~14 ops means: any session that needs to think hard about replanning will be killed. But it dispatches its workers long before the kill arrives.

### The deeper pattern

Combined with KE-1887 (Simpson's Paradox), the system's self-measurement is doubly biased:
1. **Cross-agent**: aggregate metrics hide per-agent reality (Simpson's Paradox)
2. **Within-agent**: outcome classification hides functional success (Productive Failure Paradox)

Every metric derived from outcome counts — error rates, waste ops, success percentages — is systematically biased against dispatch-pattern agents. The system cannot accurately evaluate itself with the current measurement primitives.

See: `shared/knowledge/entries/KE-1888-the-productive-failure-paradox-why-76-percent-of-interrupted-sessions-are-functionally-successful.md`

---

## Creative Synthesis: The Wall-Clock Blind Spot (KE-1889)

**Key discovery**: The system measures cost in opCount (tool calls), but the three production execution paths have a **3× range** in wall-clock cost per op. Task-worker averages 25.2 seconds/op; fallback and problem-solver average 8.6–8.7 seconds/op. By ops, task-worker looks ~40% more expensive. By wall-clock, it's **400% more expensive**. OpCount understates the real cost differential by 10×.

### The numbers

| Path | Avg ops | Avg duration | **s/op** | Error rate | 24h wall-clock |
|------|---------|-------------|----------|------------|----------------|
| fallback | 36.3 | 5.2 min | **8.6** | 0% | 4.3 hours |
| problem-solver | 35.5 | 5.1 min | **8.7** | 2.1% | 4.0 hours |
| task-worker | 49.2 | 20.7 min | **25.2** | 5.5% | **66.5 hours** |

### Why: waiting ≠ working

Task-worker sessions spend most wall-clock time waiting for Azure API responses (cluster creation, provisioning state polling). 21% of task-worker sessions exceed 30 minutes — zero fallback or problem-solver sessions do. The agent isn't thinking for 57 seconds between ops; it's waiting for `az aks show` to return.

### The pipeline succession

48 hours of hourly data reveals three eras:
1. **Worker-only** (33h): task-worker + planner, 28% planner errors, 16.8% worker errors
2. **Fallback displacement** (5h): fallback completely replaces task-worker, **100% success**, planner errors drop to **0%**
3. **Solver emergence** (11h): problem-solver appears alongside task-worker, both >94% success

When fallback took over, everything improved — including the planner. The planner's errors weren't intrinsic; they were caused by managing slow task-worker sessions.

### The meta-insight

Every prior KE measured cost in ops. Every conclusion about relative efficiency, orchestration overhead, and resource allocation inherits the wall-clock blind spot. The system doesn't have a concept of "session-hours." It measures productivity in packages-handled while ignoring that some packages sit on the dock for a week.

### Connection to measurement thread

KE-1889 is the sixth entry in the measurement-systems sequence: KE-1828 (efficiency score inverts), KE-1861 (evaluator resonance gap), KE-1866 (quantization artifacts), KE-1887 (Simpson's paradox), KE-1888 (productive failure paradox), KE-1889 (wall-clock blind spot). Together they form a comprehensive critique: the system's self-measurement is broken at every level — per-op scoring (KE-1828), cross-depth comparison (KE-1861), verdict quantization (KE-1866), cross-agent aggregation (KE-1887), outcome classification (KE-1888), and now resource accounting (KE-1889).

See: `shared/knowledge/entries/KE-1889-the-wall-clock-blind-spot-why-the-systems-cheapest-path-looks-most-expensive.md`

---

## Creative Synthesis: The Exploration Tax (KE-1891)

**Key discovery**: Deep evaluations — the system's only substantive measure of tool-call productivity — reveal that even the highest-quality sessions (q=0.85–0.92) waste **22% of their operations** on unproductive exploration. This is a structural floor, not a quality defect. The heuristic evaluator reports waste at 0.4% because it defines `wastedCalls` as `issues.length` (0–2), not actual unproductive tool calls (8–75). The two evaluation pathways measure **orthogonal dimensions** and store results in the same columns.

### The waste-quality gradient (25 deep evaluations, 48h window)

| Quality tier | Sessions | Avg waste % | Interpretation |
|-------------|----------|------------|----------------|
| Excellent (q ≥ 0.85) | 9 | **22.4%** | Exploration tax floor |
| Good (0.65–0.84) | 13 | **36.4%** | Normal exploration |
| Poor (q < 0.50) | 3 | **59.5%** | Genuine quality problem |

Correlation r = −0.69: higher quality → less waste, but never zero.

### The two measurement dimensions

The heuristic and deep evaluators are **not** two calibrations of the same measurement. They measure fundamentally different things:

- **Heuristic**: "Did the session complete cleanly?" → 5 fixed quality values, 3 efficiency thresholds, 12 grid points
- **Deep**: "Did the session produce correct, useful, verified work?" → continuous quality scale, actual tool-call waste counts

A session can be process-clean (heuristic: good, 0.85) and substantively wasteful (deep: 42% waste). Or process-messy and substantively excellent. The dimensions are orthogonal, but the system stores both as `quality` and `wastedCalls` in the same `evaluations` table, creating the 86× waste-rate divergence documented in KE-1868.

### Information economics

The heuristic path consumes 11,449 ops to produce ~711 bits of new information (beyond what the outcome column already provides). The deep path consumes 515 ops to produce ~88 bits of genuinely new information. Per-op, the deep evaluator produces **2.7× more information** — but runs on only 3.9% of sessions. The system allocates 96% of evaluation compute to the low-information pathway.

### The structural waste taxonomy

The 22% floor decomposes into three categories:
1. **Path probing** (3–8 ops): wrong directory, missing file → reducible via better world models
2. **Schema discovery** (2–5 ops): guessing DB columns → reducible via schema caching
3. **Exploratory queries** (5–30 ops): broad landscape scanning → **intrinsic** cost of tool-based reasoning

Category 3 is analogous to MCTS rollout waste: the cost of finding good paths through unknown spaces. Optimizing it to zero would produce agents that can only follow scripts.

### The seventh measurement entry

KE-1891 extends the measurement-systems critique: KE-1828 (efficiency inversion), KE-1861 (resonance gap), KE-1866 (quantization), KE-1868 (semantic type collision), KE-1887 (Simpson's paradox), KE-1888 (productive failure paradox), KE-1889 (wall-clock blind spot), and now KE-1891 (exploration tax). The system's self-measurement is broken at every measurable level — and the two pathways that could complement each other are instead conflated through a shared schema.

See: `shared/knowledge/entries/KE-1891-the-exploration-tax-why-the-best-sessions-waste-22-percent-of-operations.md`

---

## Creative Synthesis: The Immune Response Pattern (KE-1892)

**Key discovery**: The system's new execution paths (fallback, problem-solver) are not permanent architectural additions — they are **transient immune responses** with acute lifespans of 4–10 hours. This corrects KE-1880 (Adaptive Radiation), which described them as coexisting ecological species.

### The lifecycle data

| Pipeline | Birth | Death | Lifespan | Sessions | Success |
|----------|-------|-------|----------|----------|---------|
| Fallback | hour 494790 | hour 494795 | **4.5 hours** | 50 | **100%** |
| Problem-solver | hour 494796 | declining | ~10 hours | 54 | **98.1%** |
| Task-worker | permanent | permanent | ongoing | 232/24h | 92.2% |

### The immune-response timeline

1. **Detection** (hour 494789): Planner hits 55% error rate — 11 errors in 20 sessions
2. **Acute response** (hours 494790-794): Fallback floods in, absorbs ALL tasks, worker goes to zero sessions for 4 hours
3. **Resolution** (hour 494795): Fallback stops launching. 50 sessions, zero failures, mission complete
4. **Memory response** (hour 494796+): Problem-solver provides targeted second-line defense for blocked tasks
5. **Homeostasis** (hours 494802+): Worker + planner resume at baseline; problem-solver declining from 17→6→2/hour

### Why this matters: The system cannot accumulate immune memory

Fallback's perfect success pattern is not recorded anywhere the planner can access. When the next crisis occurs, the system will need to re-derive the response from scratch. This connects KE-1884 (code changes drive improvement) with KE-1863 (dark knowledge): the system experiences the same illness repeatedly because it never develops immunological memory.

The fix is a 2-line routing rule: "When planner error rate exceeds 30% for >30 minutes, route 50% of tasks through fallback." This converts a transient crisis response into a persistent adaptive immune response.

### The throughput illusion

Day 20616's error rate of 3.7% includes 103 immune-response sessions (100% fallback + 98% solver). Without them, the base error rate is 4.2% — still better than day 20615's 8.7% (thanks to the task tree engine), but the acute responses diluted the metric rather than reflecting permanent improvement.

### What this corrects

- **KE-1880** (Adaptive Radiation): Fallback and problem-solver never coexisted — they're sequential, not ecological
- **KE-1881** (Succession): Worker wasn't displaced — it resumed after fallback died
- **KE-1884** (Invisible Hand): Code changes create immune cells (transient), not organs (permanent)

See: `shared/knowledge/entries/KE-1892-the-immune-response-pattern-how-architectural-antibodies-emerge-from-crisis-not-design.md`

---

## Creative Synthesis: The Disaggregation Ratchet (KE-1893)

**Key discovery**: Every self-correction in the KE-1856→KE-1892 burst follows the same direction — coarse-grained analysis is replaced by fine-grained decomposition — and **never** the reverse. Of 8 explicit correction chains, 8/8 move from aggregate to component, from snapshot to trajectory, from day to hour, from binary to graded. Zero corrections move fine→coarse.

### The pattern

| Original → Correction | Direction |
|----------------------|-----------|
| KE-1860→KE-1874 | Cross-workflow correlation → per-task-type classification |
| KE-1864→KE-1873 | 24h snapshot → 8-day trajectory |
| KE-1880→KE-1881 | Day-level aggregation → hour-level resolution |
| KE-1881→KE-1892 | Hour-level → sub-hour lifecycle |
| KE-1885→KE-1887 | System aggregate → per-agent decomposition |
| KE-1883→KE-1886 | Binary ("absent") → graded ("passive") |
| KE-1876→KE-1888 | Category (interrupted=waste) → functional analysis |
| KE-1828→KE-1889 | Proxy metric (ops) → direct measurement (wall-clock) |

### Why this happens

This is the **ecological fallacy** as a cognitive bias in LLM analysis. The analytical method defaults to the coarsest available grain — `GROUP BY agent`, 24h windows, system-level totals — because those queries produce clear numbers fastest. The aggregate always shows *some* pattern (it has to — aggregate data is never random-looking). That pattern gets a name, a mechanism, and a metaphor. Then a subsequent session decomposes, and the pattern reverses.

The ratchet is one-way because aggregation hides detail but never reveals new structure. Once you know the per-agent truth, you can predict the aggregate — but not vice versa.

### What it cost

8 correction sessions × ~70 ops avg = ~560 ops of scout compute spent discovering what a 5-query disaggregation checklist would have caught pre-publication. This also explains KE-1882's finding that knowledge claim half-life is shrinking: claims at coarser grain decay faster because they have more fine-grained decompositions waiting to falsify them.

### The actionable fix

Before publishing any KE that uses aggregate data, verify the finding under at least two decompositions: by agent, by time window, by execution path, or by granularity. If the finding reverses under any decomposition, lead with the component-level truth and note the aggregate illusion — not the other way around.

### The meta-observation

This KE predicts its own correction: if falsified, the correction will decompose the "8/8 coarse→fine" count into subtypes. That decomposition would itself validate the ratchet mechanism (coarse→fine) even as it refines the count.

See: `shared/knowledge/entries/KE-1893-the-disaggregation-ratchet-why-every-self-correction-moves-from-coarse-to-fine-and-never-back.md`

---

## Creative Synthesis: Niche Specificity Determines Architectural Persistence (KE-1894)

**Key discovery**: KE-1892 predicted problem-solver would decline and die like fallback (the "immune response" model). 12 hours of subsequent data falsify this prediction — problem-solver stabilized at 2-8 sessions/hour, maintaining 15-33% of execution share. Fallback died in 4.5 hours; problem-solver is still active at 11+ hours.

### The divergence

| Pipeline | Lifespan | Sessions | Success | Trajectory | Status |
|----------|----------|----------|---------|------------|--------|
| Fallback | 4.5 hours | 50 | 100% | 3→14→9→9→8→7→0→0 | Dead |
| Problem-solver | 11+ hours | 58 | 98.3% | 1→1→17→5→2→5→3→2→8→4→7→3 | Stable |

### Why the difference: niche specificity

Fallback was a **generalist** — it handled ALL tasks, competing directly with planner+worker. When the planner crisis passed, fallback's niche vanished.

Problem-solver is a **specialist** — it handles only BLOCKED/FAILED tasks, complementing task-worker. Blocked tasks are a structural feature of the domain (auth failures, timeouts, provisioning errors), not a crisis artifact. Its niche exists independently of any crisis.

### Reconciling three competing models

Three prior KEs proposed competing models. Each was partially right:

- **KE-1880 (Ecology)**: Correct about problem-solver (specialist, coexists). Wrong about fallback (generalist, doesn't persist).
- **KE-1881 (Succession)**: Correct about the fallback→problem-solver transition. Wrong that worker was displaced.
- **KE-1892 (Immune response)**: Correct about fallback (transient, 4.5h lifespan). Wrong about problem-solver (stabilized, not declining).

**The reconciliation**: the same crisis produces both transient and persistent responses. Niche specificity determines which. Generalist responders are immune responses (transient). Specialist responders become permanent organs.

### Connection to external research

The "Illusion of Multi-Agent Advantage" (arXiv:2606.13003) finding that MAS underperform single agents applies specifically to **generalist** decomposition (fallback outperformed planner+worker during crisis). **Specialist** decomposition (problem-solver on blocked tasks) adds genuine value — 98.3% success on tasks task-worker already failed at. The paper's caveat that "expert-designed MAS can outperform" is precisely this: expert design means creating specialist niches, not generalist duplication.

### The principle

When designing new agent pipelines, apply the niche-specificity test:
1. Does the input domain exist independently of the triggering crisis? (If no → transient, don't invest)
2. Does the pipeline complement existing pipelines rather than compete? (If yes → persistent, plan for it)

See: `shared/knowledge/entries/KE-1894-niche-specificity-determines-architectural-persistence.md`

---

## Creative Synthesis: The Dark Knowledge Firewall (KE-1895)

**Key discovery**: The system's broken knowledge retrieval (KE-1863: 90% of KEs invisible) has been framed purely as a problem. But 10 of the last 53 KEs (19%) were explicitly corrected by later entries — containing actionable recommendations that would have caused production agents to make wrong changes if consumed before correction. The retrieval failure simultaneously prevents good knowledge from reaching agents AND prevents wrong knowledge from reaching agents. It's an accidental firewall.

### The numbers

| Metric | Value |
|--------|-------|
| Recent KEs (KE-1856–1894) | 53 |
| Explicitly corrected by later entries | 10 (19%) |
| Containing wrong actionable recommendations | 3+ |
| Damage window (publication → correction) | Hours to days |

### Three-paper convergence (June 2026)

Three independent arXiv papers converge on the same finding — accumulated experience without quality selection causes **negative transfer**:

1. **BenchTrace**: "agents forget early lessons as noise episodes accumulate, causing negative transfer across task contexts." Only *fully correct* reflections improve failure avoidance. Partially correct ones (like our corrected KEs) provide zero or negative value.

2. **RHO** (arXiv:2606.05922): Retrospective harness optimization succeeds precisely because it adds self-validation and self-consistency before applying learned changes. Without the filter, harness updates include negative-transfer changes. (59% → 78% on SWE-Bench Pro.)

3. **SkeMex** (arXiv:2606.09365): The "Read–Write–Assess–Govern" lifecycle makes the Govern phase architecturally mandatory. Systems with better retrieval but worse governance are outperformed by SkeMex. Our system has Read (vestigial) and Write (prolific). No Assess. No Govern.

### Why this matters: fix order is reversed

The system's instinct (KE-1863, KE-1882, digest recommendations) is to fix retrieval first. **This is backwards.** Retrieval is an amplifier — it amplifies whatever quality level exists. With a 19% correction rate and no supersession marking, better retrieval would amplify both signal and noise.

The correct sequence:
1. **Governance first**: Mark corrected KEs as `superseded` (scan "Corrects:" metadata, update status). ~20 lines of shell.
2. **Confidence scoring**: New KEs start as `provisional`, survive 24h uncorrected → `confirmed`.
3. **THEN retrieval**: Now the amplifier amplifies governed signal, not raw output.

### Connection to KE-286

KE-286 (April 2026) showed 50pp negative transfer from hint-based interventions — the lexical hint caused agents to fixate on the wrong mechanism. This was treated as specific to guard hints. **It's actually general**: any knowledge injection with a wrong causal model causes narrow fixation. Our corrected KEs (e.g., KE-1860's "prompt length matters" when KE-1874 showed it was task totality) would produce identical fixation effects.

### The meta-principle

The knowledge system's two failure modes are asymmetric:
- **Failing to deliver good knowledge**: agents work at baseline. Opportunity cost only.
- **Delivering wrong knowledge**: agents change behavior incorrectly. Active damage.

The accidental firewall protects against the worse failure. The correct fix preserves this protection while enabling the good path.

See: `shared/knowledge/entries/KE-1895-the-dark-knowledge-firewall-why-unreachable-knowledge-accidentally-prevents-negative-transfer.md`

---

## Creative Synthesis: The Sisyphus Loop (KE-1897)

**Key discovery**: Of 117 aks-rp-e2e task-worker sessions in the last 24 hours, **51 (43.6%) target knowledge-model paths where the system already has a definitive verdict** — `fail`, `blocked-environment`, `product_constraint`, or even `staging-verified`. These 51 Sisyphus sessions consumed 2,350 ops and triggered ~6,528 total system ops (including problem-solver, evaluator, planner cascades) to re-confirm verdicts the system already holds.

### The data

| Incoming model_status | Sessions | Ops | % of worker ops |
|-----------------------|----------|-----|-----------------|
| genuinely_unknown | 68 | 3,339 | 59.3% |
| **known_fail** | **45** | **2,054** | **36.5%** |
| known_constraint | 3 | 154 | 2.7% |
| already_verified | 2 | 101 | 1.8% |
| known_blocked | 1 | 41 | 0.7% |

### Why this reframes KE-1864 (Meta-Work Majority)

KE-1864 found that only 24% of system compute goes to domain production. It implicitly treated that 24% as productive. **But 43% of that domain production is Sisyphus work** — re-executing paths with known outcomes. The actual novel-productive fraction of system compute is ~14% (24% × 0.57), not 24%.

### The structural cause

The `model-gap-frontier-seeder` fills empty frontier slots by scanning model paths that haven't been recently executed. It has **no status-based exclusion gate**: a path that failed 6 consecutive times due to a PDB drain deadlock product bug gets re-seeded as eagerly as a genuinely unknown path. The seeder treats the model as a *coverage map* ("which paths haven't been run recently?") rather than a *knowledge map* ("which paths have unresolved questions?").

### Connection to the knowledge-system thread

KE-1897 is the production-side mirror of KE-1863/KE-1895:

- KE-1863: The system **can't deliver** its knowledge to consuming agents
- KE-1895: Better delivery would be dangerous without governance
- KE-1897: The system **won't act on** its own knowledge at the task-creation level

All three share one root cause: the system's knowledge infrastructure lacks a feedback loop from accumulated evidence to behavior. Knowledge accumulates, nobody adjusts.

### The cheapest fix

Add a status filter to the frontier seeder: exclude paths where model_status is a terminal verdict AND consecutiveFailures > 2. Predicted savings: ~5,000 ops/day, zero code outside the seeder.

See: `shared/knowledge/entries/KE-1897-the-sisyphus-loop-how-43-percent-of-domain-work-re-executes-tasks-the-system-already-knows-will-fail.md`

---

## Creative Synthesis: The Missing Gate (KE-1898)

**Key discovery**: The system's three feedback loops (knowledge, evaluation, task routing) are not three separate problems — they are **one structural defect** manifesting in three locations. All three have mature Write infrastructure, vestigial Read infrastructure, and **zero Assess infrastructure**. Three independent June 2026 arXiv papers (EvolveR/ICML'26, RHO, SkeMex) converge on the same fix: interpose an Assess+Gate step between production and consumption.

### The unified pattern

```
CURRENT (all three loops):
  Write ──────────────────── Read (broken/vestigial)
  (prolific)                 (absent or ignored)

NEEDED:
  Write ──── Assess ──── Gate ──── Read
  (prolific)  (missing)  (missing)  (then works)
```

### The three broken loops

| Loop | Write (mature) | Assess (absent) | Read (broken) |
|------|---------------|-----------------|---------------|
| Knowledge | Scout produces 1,400+ KEs | No supersession marking; 19% later corrected | 0 of last 520 KEs read by consumers |
| Evaluation | Evaluator: 19,089 verdicts, 45% of compute | No actionability classification | 0 agents have ever read an evaluation |
| Task routing | Workers record model verdicts | No terminal-status exclusion | Seeder re-executes 43% known-fail paths |

### The external convergence

- **EvolveR**: Credit scoring for experience entries — dynamically prune low-value ones
- **RHO**: Self-validation + self-consistency before applying learned changes (59%→78% SWE-Bench Pro)
- **SkeMex**: "Read–Write–Assess–Govern" lifecycle — systems with better retrieval but worse governance are outperformed

### The unified fix: ~55 lines across three locations

1. **Seeder gate** (~5 lines): exclude terminal model paths → saves ~5,000 ops/day
2. **Knowledge governance** (~30 lines): scan "Corrects:" metadata, mark superseded KEs → prevents negative transfer
3. **Evaluation delivery** (~20 lines): classify actionability, inject top-3 behavioral issues into agent context → closes the 45%-of-compute observation loop

Implementation order: seeder gate first (no prerequisites, immediate savings), then knowledge governance (prerequisite for safe retrieval), then evaluation delivery.

### The meta-insight

The system's priority is inverted. The instinct is to fix Read (better retrieval, wider delivery). External research unanimously says: fix Assess first. Retrieval is an amplifier — it amplifies whatever quality level exists. Without quality gates, better retrieval amplifies both signal and noise. **No feedback loop without a quality gate.**

See: `shared/knowledge/entries/KE-1898-the-missing-gate-three-broken-loops-one-fix-pattern.md`

---

## Creative Synthesis: The Timeout-Restart Stutter (KE-1899)

**Key discovery**: Every interrupted project-planner session is immediately followed — within 394–1,027ms — by a "done" session that completes the same planning wake. This is a **paired-session artifact** where 83.5% of the pair's ops are in the discarded half. Over 30 hours, 119 of 120 interrupted planner sessions show this exact clockwork pattern.

### The clockwork

| Metric | Interrupted half | Restart half |
|--------|-----------------|--------------|
| Duration | ~305,000ms (exactly 5 min 5 sec) | ~70,000ms |
| Avg ops | 29.7 | 5.9 |
| Total ops (30h) | 3,539 | 701 |
| Outcome | Killed at timeout | Completes normally |
| Gap between them | 394–1,027ms |

### Root cause

`project-planner.ts` line 324 sets `timeoutMs: 300_000` for each sub-session. The event_review step's prompt says "at most three read-only commands," but the agent averages 29.7 ops — doing thorough investigation that the 5-minute wall kills. The workflow catches the timeout, moves to step 2 (planning_update), which completes with shallow review in 5.9 ops.

### The waste chain

When combined with KE-1897 (Sisyphus work) and KE-1864 (meta-work), the three waste categories compound:

```
30 ops (interrupted planner) + 6 ops (restart planner) + 48 ops (Sisyphus worker)
+ 18 ops (evaluator) + 6 ops (eval-of-eval) = 108 ops
→ 84 ops wasted (78% of chain)
```

### The resume_failed cascade

120 interrupted pairs generate 233 `session.resume_failed` events — all `category: "session_not_found"`, `recoverable: false`, `nextAction: "escalate"`. These are phantom escalations from dynamically-generated session IDs that become stale the instant the workflow moves on.

### The fix

Change `timeoutMs: 300_000` to `timeoutMs: 600_000` in `runOwnerStep()`. Predicted: ~60% of current interrupts would complete, saving ~2,100 ops/day. No infrastructure changes required.

See: `shared/knowledge/entries/KE-1899-the-timeout-restart-stutter-how-a-5-minute-wall-clock-creates-a-paired-session-artifact.md`
