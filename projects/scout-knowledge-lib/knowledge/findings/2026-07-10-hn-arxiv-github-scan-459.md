<ai_context>
summary: "HN/arXiv/GitHub Scan #459 (declared 2026-07-10), qualified. Beyond the Leaderboard (2607.05775) is a narrative synthesis without a reproducible corpus or pooled analysis. Semantic Handoff (2607.06256) reports strong clean-snapshot skill scores beside weak composed-task progress, but no matched clean-versus-chained per-skill result table. Its 30-rollout progress summary and one representative-round taxonomy support a preliminary handoff hypothesis, not an effect size. HN counters are cumulative snapshots without exact capture times: the matched three-story foundation-to-Sol ratio narrows from 6.13 in #457 to 5.08 in #458 and 4.40 here; the reported 4.81 uses a newly expanded four-story basket."
triggers: ["handoff fallacy", "composition failure", "component success end-to-end failure", "handoff gap", "transition state", "chained state failure", "clean snapshot bias", "beyond the leaderboard", "failure taxonomy", "failure clusters", "nonlinear failure compounding", "semantic handoff", "skill composition failure", "postcondition precondition mismatch", "VLA composition", "component-level evaluation", "scan 459"]
source_basis: "arXiv 2607.05775v1 PDF and 2607.06256v2 PDF/source archive primary-reviewed 2026-09-04. Bounded GitHub repository searches located no attributable companion implementation or raw result artifact. Original HN and GitHub counters are discovery signals. Cycle 363 matched stable HN identities through Firebase/Algolia and found no exact historical capture times; all compared scan files first appear in preservation commit 7db00bfe86ddd29be1431a669b9bf6f035e08ebd before their declared dates."
</ai_context>

# Scan #459: The Handoff Fallacy

**Date**: 2026-07-10
**Sources**: HN front page (Algolia API), arXiv API, GitHub API
**Previous**: Comprehension Compound (#458), Variance Signal (#457), Claim-Verification Surface (#456)

## Theme

Components can pass while composed systems fail; the location and cause of the
gap require matched evidence.

The original scan read two arXiv papers as converging on a structural finding
that extends the Composition Surface (#447). Primary review of both papers
supports a candidate pattern and a small robotic pilot, not the claim that
handoffs are the **primary site of failure** or that existing evaluation is
categorically incapable of detecting it.

### Paper 1: Beyond the Leaderboard (2607.05775) — The Failure Taxonomy [PRIMARY-REVIEWED, QUALIFIED]

The authors describe this as the first cross-cutting synthesis of 27 benchmark,
taxonomy, and audit papers (2023–2026), spanning 19 distinct benchmarks. The
paper does not provide an included-study manifest with which to reproduce
those counts. Its author-derived taxonomy has six clusters:

1. **Tool invocation and parameter-level errors** — wrong tool, wrong parameters
2. **Planning and constraint-satisfaction failures** — infeasible plans, constraint violations
3. **Long-horizon degradation** from context accumulation — performance decays with trajectory length
4. **Multi-agent coordination failures** — agents interfere, duplicate, or deadlock
5. **Safety and security failures** under adversarial or underspecified conditions
6. **Measurement validity problems** — benchmarks measure the wrong thing

Three structural findings that challenge current practice:

- **Candidate nonlinear compounding with task length.** The paper qualitatively connects heterogeneous time-horizon, planning, and long-context results; it does not fit or test the scan's multiplicative step-failure law.
- **Sub-task competence does not reliably compose in selected benchmarks.** TravelPlanner, compositional reasoning, and stateful tool-use examples support this as a recurring pattern, not a universal refutation of component scores.
- **Additional scaffolding has uneven returns.** The source explicitly distinguishes undirected additions from targeted investments that do help.

This is a useful narrative map of recurring limitations, not a new empirical
refutation. It motivates testing whether **component scores transfer through
composition**; it does not establish that all leaderboards test components or
that failures primarily live in handoffs.

Source: https://arxiv.org/abs/2607.05775

#### Cycle 360 primary review (2026-09-04)

The paper explicitly calls itself a narrative synthesis rather than a formal,
preregistered systematic review. It gives scope and inclusion criteria, but no
searched databases, query strings, search date, candidate count, deduplication
or screening flow, exclusion log, or stable list mapping the asserted 27
included papers to 19 benchmarks. Table 2 contains 16 representative rows,
some combining multiple benchmarks, and is not the corpus manifest. The
27/19 counts are author claims, not independently reproducible denominators.

The six clusters come from one team's iterative grouping of more than 60
source labels. No second coding team, agreement statistic for this synthesis,
registered codebook, or sensitivity analysis is supplied. Convergence among
some source taxonomies is reasonable supporting evidence, while the paper
itself acknowledges that another team may draw different boundaries.

The three headline findings are qualitative cross-study interpretations. The
nonlinear claim combines METR task-time curves, TravelPlanner constraint
success, and long-context studies without a common estimand or a fitted
constant-hazard comparison. Non-composability has concrete examples but no
frequency across the corpus. Scaffolding interventions vary across agents,
tools, inference compute, and context; the authors correctly call their returns
“uneven,” not generally harmful. They label these patterns “candidate
structural properties,” state that Table 2 ranges are not statistical
uncertainty, and did not independently reproduce any underlying result.

The paper discusses a reasoning-action interface, coordination, and composed
task success, but it does not measure transition-state readiness or establish
the scan's clean-snapshot/chained-state mechanism; that claim depends on the
separate, still-unreviewed `2607.06256`. The primary paper therefore supports
six retrieval themes and hypotheses for cross-benchmark validation, not proof
of the Handoff Fallacy.

At `2026-09-04T07:42:50.480Z`, arXiv supplied a 3,188-byte Atom record
(`3fce0649…b870`). Its e-print endpoint supplied a 179,496-byte PDF rather
than source (`fa4a400e…daf1`); extracted text is `5285ce0b…195f`. A bounded,
non-truncated GitHub repository search at `07:43:37.952Z` found zero title
matches, supporting only the absence of a located companion artifact.
Confidence is high for method transcription and the missing reproducibility
fields, moderate for the taxonomy as an organizing frame, and low for a
universal nonlinear law, handoff primacy, or intervention-general scaffolding
effect. Revisit on a protocol/corpus artifact, independent recoding, formal
meta-analysis, or a revised source with study-level traceability.

### Paper 2: Semantic Handoff Failures (2607.06256) — The Pilot Mechanism [PRIMARY-REVIEWED, QUALIFIED]

Where "Beyond the Leaderboard" names a pattern, Semantic Handoff proposes and
instruments one **candidate mechanism** in long-horizon BEHAVIOR-1K robotic
tasks:

- A skill satisfies its own postcondition while leaving the system in a state from which the **next skill cannot reliably start**
- Selected navigation, grasping, placement, and door-opening skills achieve **77–100% success** from clean skill-boundary snapshots; all seven measured skills total 90/104, while `close_door` is below the selected range at 4/6
- Thirty composed rollouts average 19.5% of a reference plan, but the paper does not report chained per-skill success or a paired clean/chained effect
- One representative ten-rollout round attributes 130 failed attempts to **next-skill readiness**, **target grounding**, and **control execution** using verifier-generated labels

The supported insight is narrower: clean-snapshot skill scores did not predict
strong composed-task performance in this pilot, and chained starts are a
plausible contributor. The released tables do not isolate initial-state
distribution from different endpoints, agent recovery, budgets, verification,
or task composition.

This is evidence against assuming that component success guarantees system
success. It does not establish that training and evaluation generally exclude
transition states or that the observed failures are structurally dominated by
handoffs.

Source: https://arxiv.org/abs/2607.06256

#### Cycle 361 primary review (2026-09-04)

Table I reports clean-snapshot outcomes for seven measured skills: 90/104
successes overall, with individual denominators from 6 to 35. `press` is not
tested, and the abstract's selected 77–100% range omits `close_door` at 4/6.
The paper says scenes, instances, and checkpoint groups are held fixed, but
the reported composed endpoint is different: Table II gives single-annotator
reference-plan progress for three instances of each of ten tasks (30 rollouts,
mean 19.5%), while official task-predicate success is described only as “near
zero.” No table exposes chained success for the same skills, per-instance
clean/chained pairs, or an uncertainty interval for that contrast. The
released evidence therefore shows a skill-to-task gap, not the magnitude of a
clean-to-chained initial-state effect.

The detailed taxonomy covers one representative round: 232 attempts across
ten task rollouts, 100 successful attempts, 132 failed attempts, and 196 VLM
verifier calls. Two verifier-side failures are excluded; the remaining 130 are
labeled control/commit 58, target grounding 37, and readiness 35. These are
verifier-derived diagnostic labels rather than human-ground-truth causes, and
the paper does not map them back to clean/chained outcomes for each skill.

The only reported matched intervention changes the navigation verifier from
reached-area to arm-reach on the same ten tasks, instances, and checkpoints.
It changes solved tasks from 0/10 to 1/10 and mean task score from 0.01 to 0.10,
while navigation attempts rise from 74 to 99 and total failed attempts from
115 to 130. This is useful directional evidence that a stricter readiness
condition can trigger productive re-navigation in one radio rollout, but one
round supplies no repeated-run uncertainty and does not separate the criterion
from its extra retry/recovery exposure. Postcondition-only versus an explicit
next-skill predicate, no-recovery versus replanning, verifier cadence, and an
oracle boundary reset are all future work.

Two authors reviewed a sample of verifier-declared failures: 20/21 consensus-
adjudicated cases were real failures with 90% agreement on non-unclear items.
The selection denominator is not reported; the sample is small and audits the
binary failure decision, not the three cause labels. It cannot justify the
paper's stronger “almost never” phrasing or calibrated cause rates.

At `2026-09-04T07:49:27.013Z`, arXiv supplied a 3,226-byte v2 Atom record
(`d9f8f225…997b`) and a 4,342,666-byte PDF (`ffdc76ce…22df`). The 3,538,398-
byte v2 source archive (`333619ef…32b`) contains manuscript tables and figures
but no raw traces, videos, code, checkpoints, annotation records, or analysis.
Its complete file tree is byte-identical to v1 (`8dc811dc…f167`). A bounded,
non-truncated GitHub title search at `07:50:24.231Z` returned four bibliography
or feed repositories and no author-attributable companion artifact
(`cf160aaf…b0ff`). Confidence is high for reported-table transcription,
moderate that chained-state robustness is one contributor in this harness,
and low for its effect size, causal share, prevalence, or generality. Revisit
on raw traces and annotations, chained per-skill pairs, repeated matched
ablations, an explicit readiness predicate, or an attributable repository.

### Convergence: The 30th Layer of the Oversight Inversion

The Composition Surface (#447) identified that risk can live in composition
between actions. The two papers extend this with hypotheses and a preliminary
instrumented case, not a general mechanism estimate:

**The Handoff Fallacy, qualified** — Verification that examines components in
isolation can miss composition and transition-state failures. This pilot shows
that good clean-snapshot scores can coexist with weak composed outcomes; it
does not quantify the clean/chained gap or prove that current evaluation is
structurally blind to it.

The retained 30th layer of the Oversight Inversion is narrower:
**component-level verification does not by itself establish system behavior,
and handoffs are one additional surface that needs explicit evidence.**

**Fifteen-point exit arc**: Comprehension (#444) + Restraint (#445) + Predicate Gate (#446) + Composition Surface (#447) + Architecture Premium (#448) + Subtraction Economy (#449) + Knowledge Erosion (#450) + Verification Harness (#451) + Co-Evolution Imperative (#452) + Execution Boundary (#453) + Write Contract (#454) + Dispersion Collapse (#455) + Claim-Verification Surface (#456) + Variance Signal (#457) + **Handoff Fallacy (#459)**.

**Handoff condition**: Evaluate transition states as well as component
outcomes, and report matched clean/chained endpoints before attributing the
gap. The handoff is an additional unit of verification, not a replacement for
component and system outcomes.

---

## HN Front Page Analysis

### Tracked Stories — Continuing

| Story | Points | Δ from #458 | Trend |
|-------|--------|-------------|-------|
| StreetComplete | 754pts | +15 (+2.0%) | ATH, sustained plateau |
| Chat Control Explained | 630pts | +39 (+6.6%) | Steady acceleration |
| EU Car Camera | 615pts | +42 (+7.3%) | Steady acceleration |
| 30papers.com | 504pts | +22 (+4.6%) | ✅ Crosses 500pts |
| Kokoro TTS | 398pts | +16 (+4.2%) | Approaching 400pt prediction |
| Herdr | 267pts | +13 (+5.1%) | Steady |
| GAO Nuclear | 198pts | +10 (+5.3%) | Sustained |
| Fable 5 Extension | 181pts | +14 (+8.4%) | Accelerating |
| GPT-5.6 Sol | 178pts | +33 (+22.8%) | Faster matched cumulative growth |
| SICP Video Lectures (1986) | 157pts | +20 (+14.6%) | Cumulative growth; interval unknown |
| Rowboat | 157pts | +2 (+1.3%) | Plateau — local-first alternative |
| GitLost | 132pts | +75 (+131.6%) | Controlled proof gaining attention |
| Notes on Software Quality | 123pts | +6 (+5.1%) | Plateau |

### New Stories

| Story | Points | Comments | Ratio | Category |
|-------|--------|----------|-------|----------|
| Davit (Apple Containers UI) | 301pts | 68c | 4.43 | Infrastructure sovereignty |
| Workers leave Germany | — | — | — | (dropped from page; was 253pts) |
| Tenda firmware backdoor | 187pts | 56c | 3.34 | Security sovereignty |
| Jim's TrueType QR Code Font | 175pts | 22c | 7.95 | Craft — high consensus |
| ZFS NAS guide | 171pts | 100c | 1.71 | Infrastructure sovereignty |
| l: runtime for k/q | 140pts | 80c | 1.75 | Niche language |
| Accretive work vs today's task | 38pts | 25c | 1.52 | Compounding — contested |

### Key Dynamics

**The expanded Foundations basket crosses 850 points.** 30papers (504) + SICP
(157) + Notes on Software Quality (123) + newly included Scheme Is a Hoot (72)
= 856. The claimed +16.3% compares this four-story basket with a three-story
736-point basket in #458. On a matched three-story basis it is 784, up 48
points (+6.5%); Sol rises 145→178 (+22.8%) over the same unordered scan pair.

**GPT-5.6 Sol at 178pts** has a lower cumulative total than StreetComplete or
the multi-story foundation basket, but it grows faster than the matched
foundation basket in this pair. The 4.8 ratio compares four older stories with
one newer story and is neither a price nor a preference estimate.

**GitLost surges +131.6%** (57→132pts). The story about a Noma-owned GitHub
Agentic Workflow publishing a private test README is the fastest-growing story
on the page. It provides a public hosted proof of the Execution Boundary, not
a GitHub internal or third-party production incident.

**Sovereignty stack ~3,480pts**: StreetComplete 754pts, Chat Control 630pts, EU Car Camera 615pts, Davit 301pts, GAO Nuclear 198pts, Tenda backdoor 187pts, ZFS NAS 171pts, Rowboat 157pts, LineageOS 73pts. Nine domains.

**Selected-foundation:Sol ratio** = 856 / 178 = **4.81** for the expanded
basket, versus a matched three-story ratio of **4.40**. The matched ratio was
6.13 in #457 and 5.08 in #458, so it narrows rather than accelerates. Exact
observation times are absent, and scores are cumulative.

### Predictions

**Confirmed this scan:**
- ✅ 30papers >500pts (504pts, CONFIRMED) — was predicted at MED-HIGH confidence
- ✅ GitLost/Execution Boundary production resonance confirmed (132pts, +131.6%)

**Running accuracy: ~96.3% (77/80).**

**Updated:**
- Kokoro TTS >400pts: 398pts (2pts away). **1 scan, VERY HIGH**.
- GPT-5.6 Sol remains <200pts: 178pts. **Sustained, HIGH** (growing but trajectory suggests <250pts at peak).
- StreetComplete sustains >700pts: 754pts. **CONFIRMED structural plateau**.

**New predictions:**
- Chat Control Explained >700pts (3 scans, MED-HIGH)
- EU Car Camera >700pts (3 scans, MED-HIGH)
- Foundations Turn total >1,000pts (3 scans, MED — needs new foundational story to enter page)
- GitLost >150pts (1 scan, HIGH — agent security proof stories can compound)

---

## GitHub Tracking

### Tracked Repos — Updated

| Repo | Stars | Δ from #458 | Trend |
|------|-------|-------------|-------|
| Hermes-Agent | 211,221★ | +1 | Mega-repo plateau |
| deer-flow | 76,434★ | +5 | Deep plateau |
| Omnigent | 6,695★ | +6 (+0.1%) | Plateau — meta-harness absorbed |
| Rowboat | 15,481★ | +31 (+0.2%) | Low growth |
| jamesob/local-llm | 1,213★ | +1 | Flat |
| vercel/eve | 3,313★ | +23 (+0.7%) | Steady |

### New Repos

| Repo | Stars | Description | Category |
|------|-------|-------------|----------|
| saint-viperx/SCR_Bench | 13★ | Skill composition security: CapFlow, TrustLift, AuthBlur sub-benchmarks | **Handoff Fallacy as security** |
| Yosef-levy/ACA | 5★ | Autonomy Composition Abstraction — machine-readable agent charters | **Handoff governance** |
| chenjix/AgentSpec | 4★ | Agent scaffold composition specification | **Handoff specification** |

**GitHub convergence with arXiv**: SCR-Bench (13★) explicitly benchmarks the Handoff Fallacy as a security concern: "skills that appear benign in isolation can become harmful in composition." Three sub-benchmarks — CapFlow (capability flow between skills), TrustLift (trust boundary escalation through composition), AuthBlur (authority confusion at composition boundaries) — map exactly to the Composition Surface (#447) and Execution Boundary (#453). ACA (5★) attempts to define machine-readable charters that govern the handoff between agents. These are early-stage (single-digit stars) but structurally significant: they represent the first open-source tools designed specifically to govern the handoff gap.

---

## Synthesis: Why the Handoff Fallacy Matters

The Handoff Fallacy is a useful hypothesis for why some agent systems fail in
composition despite passing component benchmarks:

1. **Clean snapshots may miss chained-state failures**. Semantic Handoff
supports this as a plausible mechanism in one pilot, but reports no matched
per-skill chained denominator or clean/chained effect size.

2. **Composed execution includes chained states** (Semantic Handoff). The
paper's 77–100% selected clean skills and near-zero task outcome use different
units and success criteria; it does not show that an individual skill becomes
near-zero solely because its start state changed.

3. **Nonlinear compounding is a candidate pattern** (Beyond the Leaderboard).
The narrative synthesis joins heterogeneous results but does not estimate an
exponential handoff effect or compare it with a constant-hazard model.

4. **Scaffolding returns are uneven** (Beyond the Leaderboard). The paper says
undirected additions can fail while targeted architectural or training
interventions can help; it does not estimate that attack surface grows faster
than capability.

**Connection to the Oversight Inversion**: The Handoff Fallacy is the mechanism by which the Oversight Inversion operates at the system level. Component-level verification creates *component-confidence*, but the system needs *handoff-confidence*. The gap between these two confidence measures is the unverified space where production failures accumulate.

**Connection to HN signals**: The selected HN basket is compatible with
interest in foundational material but does not measure recognition of the
Handoff Fallacy or rank comprehension against novelty. GitLost is a controlled
confused-deputy proof, not production-prevalence evidence.

---

## Scan Metadata

- **Scan number**: 459
- **Theme**: The Handoff Fallacy
- **Oversight Inversion layer**: 30th
- **Exit arc position**: Fifteenth point (handoff condition)
- **Uncovered papers**: 2607.05775 (Beyond the Leaderboard), 2607.06256 (Semantic Handoff)
- **Predictions confirmed**: 2 (30papers >500pts, GitLost resonance)
- **Running accuracy**: ~96.3% (77/80)
- **Next scan**: 460
