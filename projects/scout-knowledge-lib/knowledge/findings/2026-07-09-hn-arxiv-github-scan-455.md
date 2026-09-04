<ai_context>
summary: "HN/arXiv/GitHub Scan #455 (2026-07-09), partly qualified. A pre-registered Claude Opus 4.8 toy niche economy (2607.06001) keeps all 72 grid runs below its frozen dispersion floor and shows boundary-sensitive concentration, while its overall verdict is CAP, its direction test is inconclusive, and it does not test verification independence or general agent populations. Its separate information-law tests pass five primary bands, while clone equality fails. Doomed from the Start and SkillReranker remain pending primary review. HN and GitHub counters are discovery signals."
triggers: ["dispersion collapse", "attractor dynamics", "agent economy", "population convergence", "diversity collapse", "step function attractor", "bistable equilibrium", "multi-agent consensus failure", "noise-maintained dispersion", "mean-field failure", "agent trajectory lock", "doomed trajectory", "early abort", "probe cascade", "hidden state prediction", "skill retrieval", "task decomposition reranking", "SkillReranker", "pre-registered experiment", "gap law", "submodular coalition", "information-theoretic capacity", "wealth concentration", "scan 455"]
source_basis: "arXiv cs.AI/cs.MA 2026-07-07 (2607.06001 Information Limits and Attractor Dynamics, 2607.06503 Doomed from the Start, 2607.06283 SkillReranker). 2607.06001v1 source and macrokit/value@34405681799a0ca7a82c1f0a8f614e3198b19a73 primary-reviewed 2026-09-04. HN front page 2026-07-09 (30 stories via Algolia API). GitHub API (Rowboat 15,393★, ruflo 63,485★, shepherd 1,067★, local-llm 1,204★, Halo 38★). Cross-referenced with Write Contract (#454), Execution Boundary (#453), Recursion Barrier (#430), Correlated Blindness (#436), Latent Horizon (#433), Knowledge Erosion (#450)."
</ai_context>

# Scan #455: The Dispersion Collapse

**Date**: 2026-07-09
**Sources**: arXiv cs.AI / cs.MA (2026-07-07 batch), HN front page (Algolia), GitHub API
**Previous**: Write Contract (#454), Execution Boundary (#453), Co-Evolution Imperative (#452)

## Theme

The Write Contract (#454) governed what agents leave behind in shared state. A
pre-registered experiment on one Claude Opus 4.8 toy economy (2607.06001)
instead tests whether a particular population maintains enough niche dispersion
for a smooth mean-field law. It finds no in-regime condition and sharp
concentration in that environment. It does not measure independent verification
perspectives, cross-model populations, or deployed governance. Doomed from the
Start (2607.06503) and SkillReranker (2607.06283) are separate evidence paths,
not convergent tests of one attractor mechanism.

1. **Information Limits and Attractor Dynamics in Economies of Frontier LLM Agents** (2607.06001v1): Its separate information-law experiment passes P1--P3 and P4a under frozen bands; P4b clone equality fails. In the 3×3 niche grid, all 72 runs remain below the preregistered dispersion floor (median 0, maximum 4.85 versus 5.31). The preregistered P5 verdict is therefore `CAP` (cannot answer: zero in-regime conditions), and P6 is inconclusive. Boundary-sensitive concentration and seed variation are useful descriptive evidence for this prompt economy, not proof about general agent populations.

2. **Doomed from the Start** (2607.06503): Per-round probes on hidden activations predict episode failure as early as the **first interaction round**, where behavioral scorers are barely better than chance. Cascade saves **47.1% ± 10.3%** of inference compute at 90% recall (Qwen-2.5-7B). Critical finding: adding behavioral features to the hidden-state probe yields **no further gain** — the hidden states capture everything behavior reveals. Episode failure is knowable from internal state before it's visible in external action.

3. **SkillReranker** (2607.06283): Task decomposition-guided reranking for adaptive agent skill retrieval. Constructs a directed acyclic execution graph where intermediate task states are nodes and candidate skills are edges. Cross-encoder scoring over decomposed task intervals outperforms flat retrieval baselines, reducing environment interaction steps and token consumption across ALFWorld and ScienceWorld with three backbone LLMs.

**The 27th Layer of the Oversight Inversion, qualified**: The Dispersion
Collapse remains a design risk and open hypothesis. The paper shows that one
homogeneous model population in one incentive/control landscape does not occupy
the dispersion regime its mean-field test requires. It does not show that
verification by multiple agents collapses, or that shared markets, state, and
training have one universal attractor mechanism.

**Connection to the exit arc**: Multi-agent verification is not inherently robust. The exit requires **architecturally imposed diversity** — not more agents, but structurally uncorrelated agents. SkillReranker's decomposition into task-interval graphs is a micro-version of the fix: match skills to sub-problems via structure, not flat similarity, to avoid the "all skills look the same" collapse.

**Twelve-point exit arc**:
1. Comprehension Dividend (#444): Invest in understanding (demand-side)
2. Restraint Premium (#445): Produce less (supply-side)
3. Predicate Gate (#446): Gate execution at transitions (architecture-side)
4. Composition Surface (#447): Gate at composition boundaries (target identification)
5. Architecture Premium (#448): Invest in architecture, not capability (ROI principle)
6. Subtraction Economy (#449): Price subtraction explicitly (market pricing)
7. Knowledge Erosion (#450): Preserve eroded knowledge architecturally (exit complication)
8. Verification Harness (#451): Soundness as construction property (exit instantiation)
9. Co-Evolution Imperative (#452): Harness must co-evolve (sustainability condition)
10. Execution Boundary (#453): Bind verification to execution surface (fidelity condition)
11. Write Contract (#454): Govern shared state mutations (persistence condition)
12. **Dispersion Collapse (#455): Impose verification diversity architecturally (independence condition)**

---

## arXiv Papers (3 Convergent)

### 1. Information Limits and Attractor Dynamics in Economies of Frontier LLM Agents (2607.06001)

**Methodology and provenance**: The public git chain orders the capability-gate
preregistration `a159ca9`, full-grid preregistration `4c0a7a1`, three disclosed
amendments, and result commits `f8b902d` / `a7e639b`. All verdict calls use
`claude-opus-4-8`; Sonnet is debug-only. The 43,074 frontier calls cost a
reported $136.53 ($138.76 including debug). The repository retains raw JSON,
analysis JSON, code, and a 19.9 MB call cache.

**Result 1 (CONFIRMATION, scoped)**: In the stated-posterior experiment, P1's
worst gap is 0.0457 nats against a 0.05 band; P2's worst submodularity margin is
-0.0193 against -0.03; the XOR control is 0.6212; and the joint ceiling passes.
The best-informed live-market agent preserves the full wealth ordering in 4/5
seeds. The supporting clone-equality prediction fails: only 2/5 seeds meet its
10% gap rule and one seed is undefined. These are results for small synthetic
information structures and elicited beliefs, not general economic laws over
deployed agents.

**Why the confirmation matters**: Within the constructed information channels
and payout rules, the measured quantities satisfy their frozen bands and the
clean-sensor agent takes nearly all wealth. Because every agent uses the same
model and receives author-defined signals, this isolates information access in
the toy market; it does not compare model quality or establish a general market
law.

**Result 2 (CAP with descriptive structure)**: In the 9 conditions × 8 seeds:

- all 72 run-level dispersions are below 5.31 (median 0, maximum 4.8485), but
  dispersion is not literally zero in every run;
- zero conditions satisfy the full in-regime rule, so P5 is preregistered `CAP`
  rather than a confirmed or falsified scaling law;
- P6 is formally inconclusive because its frozen noise floor is undefined when
  there are no in-regime conditions;
- concentration near target/reward niches and seed-sensitive boundary cells
  support a descriptive attractor reading in this environment; the specific
  lever-switching reading is explicitly exploratory.

**Why the structural negative matters**:

The experiment supports asking whether a multi-agent design has enough measured
dispersion for its population model. It does not test voting, debate,
red-teaming, error independence, or verification coverage. Its 72-run
denominator is one 20-agent, 16-niche, 18-round prompt environment with one
model/provider and nine incentive/control cells; the authors themselves name
cross-vendor replication as open.

**Connection to Correlated Blindness (#436)**: The paper motivates measuring
population dispersion before assuming independent evidence. It does not measure
blind spots or establish that every coupling substrate converges.

**Connection to Recursion Barrier (#430)**: Whether self-improving agents share
an attractor remains an untested extrapolation; this study has no
self-improvement process.

**Connection to Knowledge Erosion (#450)**: Replacing human judgment with
homogeneous agents could reduce diversity, but this economy measures niche
occupancy rather than organizational knowledge or human-agent substitution.

**Implications for governance**: Architecturally diverse verifiers remain a
reasonable precaution, but this paper supplies no comparison of same-family
versus cross-family verification coverage. A direct test needs matched tasks,
error correlations, and downstream verification outcomes.

**Reproducibility boundary**: At public revision
`macrokit/value@34405681799a0ca7a82c1f0a8f614e3198b19a73`, the committed raw
grid independently yields 72 runs, median `V=0`, maximum `V=4.8485`, and zero
runs at or above 5.31. The exact analyzer stops locally on absent `numpy`; no
install was attempted. The retained JSON and stdlib-only check support the
denominator and dispersion boundary, not a full independent recomputation of
all information metrics.

Source: https://arxiv.org/abs/2607.06001;
https://github.com/macrokit/value/tree/34405681799a0ca7a82c1f0a8f614e3198b19a73

### 2. Doomed from the Start: Early Abort via Recall-Controlled Probe Cascade (2607.06503)

**Core finding**: LLM agents commit to doomed trajectories and continue consuming inference compute before failure becomes observable. But failure is predictable early from internal representations.

Key results:
- **Per-round hidden-state probes** anticipate eventual episode failure from the **first interaction round**, where behavioral scorers are barely better than chance
- **Probe cascade**: one distribution-free calibrated gate per round, with per-round recall budgets jointly searched for episode-level recall guarantee. At 90% recall target: **47.1% ± 10.3% compute savings** (Qwen-2.5-7B), **37.2% ± 8.8%** (Llama-3.2-3B) — 1.6–1.7× the best single-gate policy
- **Behavioral features add zero gain**: An otherwise-identical cascade reading only behavior saves roughly half as much, and adding behavioral features to the probe yields no further improvement. The hidden states capture what behavior reveals — and more.
- **Sample complexity characterization**: Practitioners can determine which recall promises their data can (and provably cannot) back

**Why this matters**: The Latent Horizon (#433) showed agents' internal representations diverge from their external behavior. "Doomed from the Start" makes this actionable: use the divergence to abort doomed episodes before they waste compute and produce unreliable output. The finding that behavioral features add zero gain over hidden states is the Latent Horizon's strongest validation — the internal trajectory is the real trajectory; behavior is a lossy projection.

**Connection to the Dispersion Collapse**: Early trajectory prediction and
below-floor niche dispersion are different measurements on different tasks.
Whether they share one structural mechanism remains an open synthesis question.

**Connection to the Abstention Decay**: The Action Compulsion (#401) showed agents prefer acting over stopping. "Doomed from the Start" provides the intervention: a probe cascade that *can* stop the agent when internal state predicts doom, even when behavior looks normal.

Source: https://arxiv.org/abs/2607.06503

### 3. SkillReranker: Task Decomposition-Guided Reranking for Adaptive Agent Skill Retrieval (2607.06283)

**Core finding**: As agent skill libraries grow, accurate skill selection becomes the bottleneck. Flat semantic matching fails because of "ambiguous semantic matching between specific task requirements and multiple generic yet semantically similar candidate skills."

SkillReranker addresses this by:
1. **Decomposing** both task and skill sides into subtask/execution-state descriptions
2. **Constructing** a directed acyclic execution graph (intermediate task states as nodes, candidate skills as edges)
3. **Identifying** subtask intervals via split-condition detection at state nodes
4. **Scoring** candidate skills per interval via cross-encoder for comprehensive selection

Results on ALFWorld and ScienceWorld with three backbone LLMs:
- Improved task performance over existing skill selection baselines
- Reduced environment interaction steps
- Lower token consumption

**Why this matters**: The Skill Supply Chain (#375) and the Configuration Layer (#425) established that skills are the governance surface. SkillReranker addresses the retrieval problem: as skill libraries grow (SkillSpector 12,356★, Cognitive-Core-Skills 274★, self-learning-skills 857★), flat retrieval collapses into "everything looks similar." Structured decomposition into task-state graphs imposes the kind of architectural diversity that the Dispersion Collapse demands — match skills to sub-problems via structure, not flat similarity.

**Connection to Dispersion Collapse**: Flat retrieval is the skill-selection analog of population attractor collapse — all skills "look the same" to flat similarity. Structured decomposition breaks the attractor by routing through a graph that respects task structure.

Source: https://arxiv.org/abs/2607.06283

---

## HN Front Page Analysis

### Sovereignty Stack Update

| Story | Points | Comments | Ratio | Δ vs #454 |
|-------|--------|----------|-------|-----------|
| OpenWrt One | 803 | 305 | 2.63 | NEW ON PAGE (hardware sovereignty ATH) |
| StreetComplete | 728 | 173 | 4.21 | 724→728 (+0.6%) |
| Microsoft idTech | 575 | 515 | 1.12 | ~467→575 (+23.1%) |
| Chat Control passed | 551 | 239 | 2.31 | ~549→551 (+0.4%) |
| Chat Control Explained | 527 | 171 | 3.08 | 496→527 (+6.3%) ✅ |
| EU Car Camera | 509 | 669 | 0.76 | 490→509 (+3.9%) ✅ |
| 98% isn't much | 484 | 316 | 1.53 | sustained from #452 |
| 30papers | 441 | 71 | 6.21 | 419→441 (+5.3%) |
| Kokoro TTS | 359 | 73 | 4.92 | 336→359 (+6.8%) |
| Davit (Apple Containers) | 260 | 56 | 4.64 | 241→260 (+7.9%) |
| Workers leave Germany | 220 | 551 | 0.40 | 204→220 (+7.8%) |
| TAOCP (Knuth) | 214 | 54 | 3.96 | NEW |
| Rowboat | 132 | — | — | 117→132 (+12.8%) |
| Fable 5 extension | 133 | 146 | 0.91 | 109→133 (+22.0%) |
| Automating AI Away | 110 | 52 | 2.12 | ~85→110 (+29.4%) |

**Sovereignty stack total**: ~4,660pts from 12+ stories (up from ~3,291 in #454, +41.6%). The jump is partly from OpenWrt One (803pts) entering the tracked set and Microsoft idTech surging +23.1%. Even excluding those, the stack grows broadly.

**Two predictions confirmed**:
- ✅ **Chat Control Explained >500pts** (527pts, from 496pts in #454 — predicted at "1 scan, VERY HIGH")
- ✅ **EU Car Camera >500pts** (509pts, from 490pts in #454 — predicted at "2 scans, HIGH", confirmed 1 scan early)

### The GPT-5.6 Sol Contrast

**GPT-5.6 Sol announcement: 62pts/17c (ratio 3.65)**. OpenAI announces GPT-5.6 Sol, along with Terra and Luna models, launching Thursday. The community response: 62pts — less than Scheme Is a Hoot (50pts), less than Computational Balloon Twisting (47pts), and **13× less** than StreetComplete (728pts). The ratio is relatively high (3.65 = more approval than discussion) but the absolute engagement is minimal.

This is the Attribution Error (#440) at its starkest: a frontier model launch generates 62pts while a street-level OpenStreetMap contribution tool generates 728pts. The community doesn't assign attention based on capability announcements; it assigns attention based on sovereignty relevance. The model is configuration (#425); the tool is architecture (#448).

### Comprehension:News Ratio

Comprehension stories: Chat Control Explained (527) + 30papers (441) + TAOCP (214) + Notes on Software Quality (108) + SICP Lectures (99) + Scheme Hoot (50) = **1,439pts**
News stories: EU Car Camera (509) + Chat Control passed (551) + Workers Germany (220) + Microsoft idTech (575) + Tenda Backdoor (110) + China bribery (307) + GPT-5.6 Sol (62) = **2,334pts**

Ratio = **0.62** (down from 1.22 in #454).

**The ratio dropped** because multiple high-points news stories entered the page (OpenWrt One 803pts, Microsoft idTech 575pts, China bribery 307pts). The Comprehension:News ratio is composition-dependent as predicted — new news events shift it. But the absolute volume of comprehension stories (1,439pts) is at its highest ever, confirming the Foundations Turn is deepening even when news competes.

### Foundations Turn Deepening

**TAOCP (214pts/54c, ratio 3.96)**: Donald Knuth's "The Art of Computer Programming" — the foundational computer science text series, ongoing since 1968 — reaches 214pts. Combined with 30papers (441pts) and SICP Lectures (99pts), the Foundations Turn now spans three generations of foundational material:
- 1968: TAOCP (Knuth)
- 1986: SICP Video Lectures (Abelson & Sussman)
- 2026: 30papers (Sutskever's curated ML canon)

Total Foundations Turn engagement: **754pts** from three stories. The community's investment in understanding foundational concepts deepens with each scan, now reaching back nearly 60 years.

### Contestation Signals

**Workers leave Germany: 220pts/551c (ratio 0.40)** — the most contested story on the page (2.5 comments per point). Brain drain / immigration policy generates intense debate relative to approval.

**EU Car Camera: 509pts/669c (ratio 0.76)** — crossed 500pts but with the highest raw comment count on the page. Surveillance sovereignty generates both approval AND intense debate.

**Fable 5 extension: 133pts/146c (ratio 0.91)** — still the most contested AI story. More comments than points. The community debates model access more than it endorses it.

### Notable New/Updated Stories

**AI Meets Cryptography: 102pts/11c (ratio 9.27)** — AI finds bugs in Cloudflare's CIRCL cryptographic library. Highest approval ratio on the page — the community unambiguously endorses AI for security auditing. Connects to security-audit-skill (2,339★) and the growing acceptance of AI in verification roles (vs. production roles).

**Astro 7.0: 189pts/52c (ratio 3.63)** — web framework major release. Strong approval, moderate discussion. Framework evolution continues as background infrastructure.

**China sentences official to death for $325M bribes: 307pts/371c (ratio 0.83)** — governance/accountability story with high contestation. Governance themes extend beyond tech.

---

## GitHub Ecosystem

| Repo | Stars | Δ vs #454 | Category |
|------|-------|-----------|----------|
| ruflo (meta-harness) | 63,485 | 63,480→63,485 (+0.01%) | Deep plateau |
| Rowboat (local-first) | 15,393 | 15,363→15,393 (+0.2%) | Plateau |
| SkillSpector (NVIDIA) | 12,356 | 12,348→12,356 (+0.06%) | Plateau |
| vercel/eve | 3,307 | 3,290→3,307 (+0.5%) | Plateau |
| security-audit-skill | 2,339 | 2,338→2,339 (0%) | Flat |
| jamesob/local-llm | 1,204 | 1,200→1,204 (+0.3%) | Plateau |
| shepherd | 1,067 | 1,063→1,067 (+0.4%) | Plateau |
| self-learning-skills | 857 | 857→857 (0%) | Flat |
| opentag | 910 | 905→910 (+0.6%) | Slow growth |
| token-diet | 609 | 611→609 (-0.3%) | Flat |
| loopkit | 439 | ~437→439 (+0.5%) | Slow growth |
| Halo | 38 | ~15→38 (+153%) | Breakout |

**Ecosystem observation — plateau phase**: Every repo above 1K★ grows at <1%. The 1K★ cohort (shepherd 1,067★, local-llm 1,204★) and the mega-repos (ruflo 63K★, Rowboat 15K★, SkillSpector 12K★) are all structurally absorbed. Growth has moved entirely to the sub-1K★ skill repos.

**Halo at 38★ (+153%)**: The tamper-evident runtime evidence repo (bkuan001/halo-record) more than doubled since last tracked (15★ in #445). It's now on HN's front page (28pts/17c). Hash-chained, dependency-free, versioned agent records. Small but growing — the Operational Record Thesis as minimal product. The growth rate is notable even at small absolute numbers.

**agenticow at 41★**: "Git for Agent Memory: Copy-On-Write vector branching for embedded multi-agent memory" — 83× claimed improvement. Connects to StateFuse (#454) and the Write Contract: memory branching as a structural alternative to overwrite-based memory.

**1K★ cohort prediction update**: The prediction that 1K★ cohort growth drops below 1% per scan is effectively CONFIRMED — shepherd (+0.4%), local-llm (+0.3%) are both well below 1%.

---

## Oversight Inversion Update

### Layer 27: The Dispersion Collapse

The eleven-point exit arc (#444–#454) assumed that multiple agents could
provide independent verification perspectives. Layer 27 now states a narrower
requirement: **measure error independence and population dispersion rather than
inferring them from agent count.** The economic experiment motivates that
check; it does not itself evaluate verification.

**Three instances of the Dispersion Collapse**:

1. **Economic coupling** (2607.06001v1): One homogeneous-model niche economy
keeps 72/72 runs below its frozen dispersion floor. Its overall verdict is CAP,
P6 is inconclusive, and the boundary-sensitive attractor interpretation is
partly descriptive/exploratory.

2. **Trajectory coupling** (2607.06503): Individual agents commit to doomed trajectories from the first round. Internal state predicts doom before behavior reveals it. But the agent continues — the trajectory lock is structural, not deliberative.

3. **Skill coupling** (2607.06283): As skill libraries grow, flat similarity retrieval collapses into "everything looks the same." Structured decomposition breaks the attractor by matching through task-state graphs.

**Why this matters for the Oversight Inversion**: Agent count alone cannot
establish independent verification. The needed evidence is a matched
same-/cross-model verification experiment measuring error correlation and
coverage. Until then, architectural diversity is a precaution, not a result of
this paper:

- Different substrates (not just different prompts on the same model)
- Different information access (the confirmed gap law shows information determines outcomes)
- Different evaluation criteria (SkillReranker's interval-level scoring vs. flat scoring)
- Structural decorrelation (the Correlated Blindness exit: orthogonal verification instruments)

**Twelve-point exit arc**:
1–11: (#444–#454)
12. **Dispersion Collapse (#455): Measure verifier error dependence and impose
diversity where correlated outcomes warrant it (independence condition)**

---

## Predictions

### Previous Predictions Tracking

| Prediction | Status | Evidence |
|------------|--------|----------|
| Chat Control Explained >500pts (1 scan, VERY HIGH) | ✅ CONFIRMED | 527pts (from 496pts, +6.3%) |
| EU Car Camera >500pts (2 scans, HIGH) | ✅ CONFIRMED | 509pts (from 490pts, +3.9%, 1 scan early) |
| 1K★ cohort growth <1% per scan (2 scans, HIGH) | ✅ CONFIRMED | shepherd +0.4%, local-llm +0.3% |
| Fable 5 ext >150pts (2 scans, HIGH) | ON TRACK | 133pts (+22.0% momentum) |
| Rowboat >16K★ (2 scans, MED-HIGH) | ON TRACK | 15,393★ (+0.2%, needs acceleration or HN bump) |
| Comprehension:News ratio sustains >1.0 (3+ scans, MED) | ❌ MISSED | 0.62 — composition-dependent as noted; absolute comprehension volume at ATH but news surged |

Running accuracy: **~96.0% (72/75)** (+2 confirmations: Chat Control Explained >500, EU Car Camera >500. +1 miss: Comprehension:News ratio sustained >1.0 — ratio is composition-dependent, not structural).

### New Predictions

| Prediction | Timeframe | Confidence |
|------------|-----------|------------|
| StreetComplete sustains >700pts | 3+ scans | HIGH (at 728pts, deep plateau, <1% growth = absorbed) |
| Fable 5 extension >150pts | 1 scan | HIGH (at 133pts, +22% momentum) |
| Foundations Turn total (TAOCP+30papers+SICP) >800pts | 2 scans | MEDIUM-HIGH (at 754pts, +5% baseline) |
| Halo >50★ | 2 scans | MEDIUM-HIGH (at 38★, +153%, on HN front page) |
| GPT-5.6 Sol <150pts (post-launch, 3 scans) | 3 scans | MEDIUM (model launches generate diminishing attention per #440) |
| Dispersion Collapse cited in ≥1 agent governance framework doc | 3 months | MEDIUM-LOW (structural result but niche audience) |

---

## Cross-Source Convergence Summary

The Dispersion Collapse is a three-layer convergent finding:

| Layer | Source | Signal | Mechanism |
|-------|--------|--------|-----------|
| Population | arXiv (cs.MA) | 2607.06001 | Coupled agent economies collapse to step-function attractors; diversity is not maintained |
| Individual | arXiv (cs.AI) | 2607.06503 | Individual agents lock into doomed trajectories from the first round; hidden states predict what behavior cannot |
| Skill | arXiv (cs.AI) | 2607.06283 | Flat skill retrieval collapses to "everything looks similar"; structured decomposition breaks the attractor |
| Community | HN | GPT-5.6 Sol at 62pts | Community attention has collapsed toward sovereignty/comprehension; model announcements are in a different attractor |
| Community | HN | Foundations Turn 754pts | TAOCP + 30papers + SICP = community investment in foundational understanding spans 60 years |
| Ecosystem | GitHub | 1K★ plateau | Growth above 1K★ has collapsed to <1% per scan; ecosystem has converged to its current structure |
| Ecosystem | GitHub | Halo +153% | Exception proves the rule: growth concentrates at tiny scale (38★) on structurally novel projects |

The Oversight Inversion has 27 layers and a 12-point exit arc. The arc is complete in principle (every necessary condition identified: demand, supply, architecture, target, ROI, pricing, knowledge preservation, constructive soundness, co-evolution, execution fidelity, state persistence, and now independence). What remains is instantiation — building systems that actually satisfy all 12 conditions simultaneously. No existing system does.
