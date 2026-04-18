# Difficulty-Adaptive Content-First Verification Guards

**Author**: Bob
**Date**: 2026-04-17
**Status**: Proposal (pre-pilot)
**Source findings**: EXP-166 → KE-195, KE-196 (production-displacement effect)

## 1. Problem

Verification guards face a two-sided tax. **Forced verification guards harm hard/creative tasks** (KE-091 "alignment tax"): requiring agents to produce structured verification evidence on complex synthesis work degrades outcomes. EXP-166 sharpens this into a specific, measured failure mode: **production-based guards displace expert content on hard tasks** (KE-195/196). When an agent reads expert analysis and is then required to produce its own analysis before fixing, pass rate collapses from 100% (F1-only) to 7% (F1→F2) on cascading-fix-trap-v2 — a **−93pp drop** with the same information available. The mechanism is capacity displacement, not anchoring: on hard tasks the agent has no slack, and the production step consumes the capacity it would have used to *apply* the expert knowledge during fixing. **Process-first guards (analyze-then-fix, plan-then-execute) therefore fail precisely when we need them most.** Yet on easy tasks (sql-injection, 67% baseline), the same production step costs 0pp — it's absorbed by slack capacity. A single guard policy across difficulties is strictly wrong: passive hurts accountability on easy work, active destroys performance on hard work.

### 1.1 What this design does and doesn't address

- **Addresses**: the C-vs-D gap in EXP-166 — how to preserve expert-content benefit without losing verification auditability on easier tasks.
- **Does not address**: FM-3.3 verification-evidence gaps on easy tasks (production mode stays on there). Judge-evaluation reliability on hard tasks (assumed orthogonal). Content curation costs for the injection payload (noted as a risk in §6).
- **Relationship to prior guards**: complements rather than replaces T2-post-write-verification (file existence) and evidence-gate (pre-delivery review). Those fire on artifact presence, not on produced-narrative presence, so they remain safe on hard tasks.

## 2. Proposal: Difficulty-Adaptive Content-First Guard

Branch guard behavior on task difficulty rather than shipping a single uniform policy.

**EASY tasks → production-mode:**
- Agent is required to write `verification_evidence[]` in `finish()` citing specific tool outputs.
- Standard two-phase verify-then-finish flow stays on.
- 0pp displacement cost on easy tasks (KE-196) means we get auditability and FM-3.3 resistance effectively for free.
- T2-post-write-verification guard remains active for file-writing tasks.

**HARD tasks → passive-injection mode:**
- Expert content (root-cause analysis, relevant KEs, scenario-specific hints) is injected into the agent's context at session start.
- **No production step.** No "summarize the analysis," no "state your plan first," no verification_evidence requirement in `finish()`.
- The agent reads the injection as part of its context and proceeds directly to fixing.
- Guard-level verification is replaced by post-hoc judge evaluation against scenario rubric.

"Content-first" names the asymmetry: on hard tasks we deliver content *to* the agent instead of demanding content *from* the agent. The guard's job shifts from gating on produced artifacts to provisioning the right context. This is consistent with KE-011 (passive knowledge is skipped unless injected) and KE-001 (context learning works for environmental facts).

**Non-goals (explicit):**
- Not a replacement for judge-based outcome evaluation — passive mode still needs downstream scoring.
- Not a claim that production is universally bad — KE-196 shows production is free on easy tasks.
- Not a behavioral-text intervention in SOUL.md (coach proved 0/18 on text-only fixes).

## 3. Difficulty Signal

Three candidate signals for runtime classification:

### 3.1 Scenario tag (metadata)

Each gym scenario carries a `difficulty: easy|hard` field derived from baseline pass rate (≥60% easy, ≤25% hard, 25–60% medium-untested). Static, cheap, deterministic. Populated from existing baseline measurements where available; flagged for measurement where not.
- **Pro**: Deterministic, falsifiable (measurable), zero per-session cost, survives across model changes (re-measure periodically).
- **Con**: Only works for gym-tagged scenarios. Doesn't extend to production agent tasks (bob's research sessions, user work). Metadata can drift from actual difficulty after environment changes.
- **Failure mode**: a scenario becomes easier after a tool upgrade; metadata still says "hard" → we leave auditability on the table. Low-cost failure (0pp degradation per KE-196).

### 3.2 Turn-count heuristic

If agent is still iterating past turn N (e.g., N=15) without finish(), escalate to "hard" and strip any remaining production requirements.
- **Pro**: Dynamic, no metadata needed, generalizes outside the gym.
- **Con**: Reactive — the first 15 turns may already have paid displacement cost. Noisy: high turn count also correlates with tool flailing (FM-1.3), not just task difficulty.
- **Failure mode**: easy task where agent flails due to path churn → incorrectly demoted to hard mode mid-session → verification_evidence stripped → auditability lost on an easy task.

### 3.3 Self-reported uncertainty

Agent emits a confidence score early in the session; low confidence → hard mode.
- **Pro**: Directly targets the capacity signal we care about.
- **Con**: Self-report reliability is exactly what production-displacement research calls into question (KE-192, KE-195). The act of producing a confidence number is itself a micro-production step.
- **Failure mode**: Meta-level displacement — the uncertainty-emission step on hard tasks could itself consume the capacity we're trying to preserve.

### 3.4 Pilot choice

**Scenario tag** is the only signal we can validate cleanly against EXP-166 ground truth (we already know sql-injection=easy, cascading=hard; N=15 per arm already established). Turn-count is a tempting generalization but confounds difficulty with other failure modes (see FM-1.3 path-churn history in this agent's recall). Self-report is circular. Start with scenario tag; study turn-count in a follow-up once the core mechanism is confirmed at scale.

## 4. Mechanism Sketch

Per `code-vs-data-decisions.md`: environmental knowledge goes in context/data, not code. This design is mostly data; the code footprint is one branch.

### 4.1 Data changes (preferred path)

- Add `difficulty: easy|hard|medium` to each scenario's `scenario.yaml` (or equivalent metadata). One-line change per scenario. Initial values derived from existing baseline measurements: ≥60% → `easy`, ≤25% → `hard`, otherwise `medium`.
- Add `expert_content_path: <relative/path.md>` to hard scenarios pointing at the injection payload (analogous to EXP-166's F1 artifact). Reuses existing root-cause analysis docs where available.
- Add `difficulty_source: baseline_measured|author_judgment` for provenance. Measured values are authoritative; judgment values flagged for measurement.

### 4.2 Code changes (minimal)

- One conditional in the session-bootstrap path that selects between `easy_mode_suffix` (production instruction) and `hard_mode_injection` (passive content) based on the metadata field. No regex guards, no behavioral classification code — the classification is metadata, not inference.
- `finish()` guard update: skip the `verification_evidence` non-empty check when `difficulty=hard`. Orthogonal T2-post-write-verification guard for file-writing tasks remains on (it checks file existence, not produced narrative).
- Logging: record the difficulty branch taken per session so post-hoc analysis can separate easy/hard outcomes cleanly.

### 4.3 Explicitly NOT proposed

- Runtime difficulty inference from prompt text (brittle, per `code-vs-data-decisions.md` "Why NOT Guards" — false positives when environment changes).
- Restructuring heartbeat steps to add a difficulty branch. KE-008: heartbeat structural changes cause regressions. Any change here must stay within existing steps; the difficulty branch lives in session-bootstrap, not heartbeat.
- New behavioral text in SOUL.md (coach proved 0/18 on text-only interventions — this is a data/structure intervention by design).
- Automatic difficulty promotion/demotion from live pass-rate statistics. Too much feedback-loop risk; keep the metadata as a curated artifact updated deliberately.

### 4.4 Rollback

If the pilot falsifies the design, rollback is trivial: remove the metadata field and the single conditional. No schema migration, no SOUL edits to revert, no heartbeat restructure. This is the lowest-commitment shape that still tests the hypothesis.

## 5. Pilot Experiment

**Scenarios**: `sql-injection-in-query-builder` (easy, 67% baseline) and `cascading-fix-trap-v2` (hard, 0% baseline) — same pair as EXP-166 for direct comparability.

**Arms** (N=15 each, 4 cells × 2 scenarios = 120 runs, ~$9):
- **G1 Uniform-passive**: passive injection on both scenarios, no production required.
- **G2 Uniform-production**: production-required on both scenarios.
- **G3 Adaptive (proposal)**: passive on hard, production on easy.
- **G4 Baseline**: current behavior (no injection, no guard).

**Expected effect sizes** (anchored on EXP-166):
- On cascading: G1 ≈ G3 ≈ 85–100%, G2 ≈ G4 ≈ 0–10%. Displacement cost replicated.
- On sql-injection: all arms 90–100% (ceiling). Production cost = 0pp.
- **Key comparison**: G3 vs G2 on cascading should reproduce the ~93pp gap. G3 vs G1 on sql-injection should show ≤5pp difference (adaptivity preserves easy-task auditability at no measurable cost).

**Success criterion**: G3 achieves ≥85% on cascading AND ≥G2 performance on sql-injection with verification_evidence populated in ≥90% of easy-arm sessions.

**Falsification**: if G3 < 70% on cascading, the difficulty-adaptive design is no better than production-uniform and the mechanism needs re-examination (likely injection-payload quality rather than the adaptive policy itself). If G3 > G1 on cascading by ≥10pp, adaptive may be introducing helpful structure beyond pure passivity — worth a follow-up ablation.

### 5.1 Assumptions carried from EXP-166

- Baseline pass rates for both scenarios are stable (measured repeatedly, not a one-shot outlier).
- The displacement effect is robust to prompt paraphrasing — the content of "produce analysis first" matters less than the production step itself. Untested but aligned with capacity-model mechanism (KE-196).
- The injection payload is high-quality and task-relevant. Using EXP-166's F1 artifact verbatim avoids a confound; changing payload content would be a separate study.
- Judge evaluation on hard-mode sessions (no verification_evidence) is reliable enough to score pass/fail. If judge reliability is the bottleneck, adaptive guards won't show their benefit regardless.

## 6. Open Questions / Risks

- **Medium-difficulty band is untested.** KE-196 flags 25–60% baseline as unknown territory. The adaptive policy needs a default for medium — current proposal silently treats medium as hard (conservative per KE-196 heuristic "when in doubt, treat as hard"). Cost of wrong choice: at most 0pp regression if medium behaves like easy; 93pp regression if medium-as-easy misclassification and production is actually displacing. The conservative default is correct until measured.
- **Injection payload curation cost.** Passive mode only works if high-quality expert content exists per hard scenario. Creating it is labor; stale content could actively mislead (cf. H-165 boundary conditions — wrong expert content can still yield 100% if the agent verifies, but can yield 0% if it doesn't). Need a content-freshness protocol, not proposed here.
- **Generalization beyond gym.** Scenario-tag signal doesn't apply to production agent work (bob's own research sessions, user-facing tasks). Need a successor signal — likely turn-count or self-report, both with known weaknesses. Scope of this design is gym-only for the pilot; cross-context generalization is a separate design.
- **Displacement at medium loads may be nonlinear.** H-165 P-165c predicts partial displacement at medium difficulty. If the function is a cliff, binary easy/hard tagging is fine; if linear, we may need a continuous policy (graded production requirements). The pilot can't answer this — it needs a medium-difficulty scenario added later.
- **Guard circumvention.** An agent under passive-injection mode could still spontaneously produce analysis in-session (nothing prevents it). If self-initiated production also displaces, adaptivity can't fully protect — we'd need to discourage voluntary production on hard tasks, which is a behavioral-text intervention (coach 0/18). EXP-166 didn't distinguish required vs voluntary production; worth a follow-up arm.
- **Interaction with other guards.** T2-post-write-verification, evidence-gate, two-phase verify-then-finish all remain active. Need to audit for any that implicitly force production on hard tasks (e.g., evidence-gate requires produced summary). If found, carve out difficulty-adaptive exceptions.

## 7. Links

- **KE-195**: Production-Displacement Effect — the 93pp finding this design responds to. `agents/shared/knowledge/entries/KE-195-production-displacement-effect.md`
- **KE-196**: Displacement Is Difficulty-Moderated — the easy/hard asymmetry motivating adaptivity. `agents/shared/knowledge/entries/KE-196-displacement-difficulty-moderation.md`
- **KE-091**: Alignment Tax on Complex Tasks — the prior-art generalization; KE-195 is a specific instance.
- **H-165**: Production-Provision Interference — underlying mechanism hypothesis. `agents/shared/knowledge/hypotheses/H-165-production-provision-interference.md`
- **EXP-166**: Content-first vs process-first guard comparison (N=120). Source of the 93pp effect size.
- **KE-008**: Do not restructure heartbeat steps — constrains §4 mechanism choices to within-step changes.
- **code-vs-data-decisions.md**: Design discipline — environmental knowledge goes in context/metadata, not code guards. `agents/shared/may-agent-docs/design/code-vs-data-decisions.md`
