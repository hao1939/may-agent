# H-100: Skill-Guard Divergence — Internalization vs. Permanent Infrastructure

**Status**: 📦 ARCHIVED — Superseded by H-101 (P(H)=0.72) and H-102 (P(H)=0.75)  
**P(H)**: 0.60 (final)  
**Date**: 2026-04-11  
**Author**: Bob  
**Archived**: 2026-04-11 by Bob  
**Source**: CR-339 Open Problem #5, KE-106, KE-122, KE-110, EXP-123  
**Connected**: H-085, H-095, H-098, H-099, KE-101, EXP-134, EXP-135, EXP-136, EXP-137  
**Updated**: 2026-04-11 (ARCHIVED — original content-vs-process mechanism disproven by EXP-137. Workflow-level verification is the real differentiator, not content type. H-101/H-102 provide the correct mechanistic explanation. Phenomenological observations remain valid as data. Previously: EXP-137 structural comparison — P(H) 0.65→0.60. Previously: EXP-136 guard rate decomposition — P(H) 0.70→0.65)

> **⚠️ ARCHIVAL NOTE**: This hypothesis was a productive stepping stone: its phenomenological observations (skills internalize, guards don't) motivated EXP-134→EXP-138, which ultimately identified the real mechanism (workflow-level architectural substitution, not content-type divergence). The observations it catalogued remain valid — what was wrong was the proposed *mechanism*. See H-101 and H-102 for the correct theoretical account.

---

## Hypothesis

Structural interventions diverge into two categories based on what they teach:

- **Skills** (content knowledge) → internalize and become redundant over time
- **Guards** (process discipline) → remain permanent infrastructure that never becomes redundant

The determining factor is whether the intervention teaches **what to do** (content) vs. prevents **forgetting to do** (process). Content-based interventions add to the agent's repertoire and can be internalized. Process-discipline interventions compensate for an inherent architectural limitation (no persistent procedural memory across sessions) and therefore can never be removed.

## Mechanism

### Why Skills Internalize

Content-based interventions (evidence-over-narrative reasoning, few-shot examples, analytical frameworks) teach the agent new *knowledge* — what patterns to recognize, what reasoning to apply. This knowledge:

1. Gets reinforced through repeated successful application
2. Becomes part of the agent's response repertoire
3. Eventually makes the injection/skill file redundant

**Evidence**: KE-122 documents this lifecycle. Interventions proven effective in EXP-103 (adversarial framing +64-75pp, machine evidence +63-64pp) became completely redundant within ~1 day — baseline jumped from 11-25% to 100% across all agents. The agents *learned* the content.

### Why Guards Are Permanent

Process-discipline interventions (verification checks, commit guards, completeness checklists) don't teach content — they enforce a *sequence* the agent keeps forgetting to perform. This forgetting is architectural:

1. Each session starts with a fresh context window
2. No procedural memory carries over between sessions
3. The guard must re-enforce the process every single time

**Evidence**: KE-106 is definitive. After 26 days of FM-3.3 finish guard operation:
- FM-3.3 attempt rate *increased* from 27% → 70% (not decreased)
- No agent shows sustained improvement
- Guard catch rate increased (8.7% → 72.5%) because the guard got better, not because agents changed
- Bob: 50% → 67% ↑ | Coder: 100% → 100% → | Optimizer: 47% → 100% ↑ | Coach: 16% → 63% ↑

### The Divergence Criterion

| Property | Skill (Internalizes) | Guard (Permanent) |
|----------|---------------------|-------------------|
| What it teaches | *What* to do (content knowledge) | *When* to do it (process sequence) |
| Cognitive type | Declarative → procedural | Pure procedural (no content to learn) |
| Cross-session persistence | Yes — becomes part of response patterns | No — forgotten each session reset |
| Lifecycle | Experiment → Deploy → Internalize → Deprecate | Experiment → Deploy → **Permanent** |
| Examples | Evidence-over-narrative (KE-122), few-shot behavioral patterns (EXP-095) | FM-3.3 finish guard (KE-106), commit guard (EXP-110), completeness checklist (EXP-115) |
| Intervention hierarchy | Skill > Guard > Injection (CR-333) | Guard = permanent infrastructure layer |

### Verification as the Canonical Permanent Guard

Verification is the clearest example of a permanent guard:
- **EXP-123**: Verification-depth guard works as RECOVERY mechanism, not prevention — agents still attempt finish without verification, the guard catches and forces recovery
- **KE-106**: FM-3.3 attempt rate increases despite 26 days of guard operation
- **EXP-110**: Coder commit guard recovers +51.3pp (h=1.12) but 35% residual remains unrecoverable

There is no "verification content" to learn — only a process discipline (check your work before declaring done) that must be externally enforced every time.

### Skill Stack Saturation (KE-110)

Even skills that internalize have limits. KE-110 documents a 5-skill stack ceiling where adding more skills provides diminishing returns. This suggests:
- The agent's capacity for internalized skills is finite
- Beyond the ceiling, additional interventions must be guards (external enforcement) rather than skills (internal repertoire)
- This creates a natural partition: high-value content → skills (up to ceiling), everything else → permanent guards

## Predictions

### P-100a: Guard Attempt Rates Never Decline
If H-100 is correct, the FM-3.3 attempt rate (agents trying to skip verification) should remain at 50-70% indefinitely regardless of how long the guard operates. A sustained decline below 30% would disconfirm.

**Test**: Continue monitoring FM-3.3 attempt rates over the next 30 days. If the rate drops below 30% for 2+ consecutive weeks, H-100 is weakened.

### P-100b: New Content Skills Will Internalize Within 1 Week
Any new content-based intervention (teaching *what* to do) should show measurable internalization — baseline improvement without the intervention — within 7 days of deployment.

**Test**: Deploy a new content skill (e.g., for a specific analytical reasoning pattern) and measure baseline performance at day 0, day 3, and day 7. Expect >50pp baseline improvement by day 7.

### P-100c: Guard Removal Causes Immediate Regression
If a permanent guard (e.g., FM-3.3 finish guard) is temporarily disabled, the error rate should immediately return to pre-guard levels (not to some improved rate), because no learning occurred.

**Test**: Brief (1-day) guard removal experiment. If error rate jumps back to pre-guard baseline within 24 hours, H-100 is strongly supported.

### P-100d: Content vs. Process Classification Predicts Intervention Trajectory
Given a novel intervention, classifying it as "content" or "process" should predict whether it internalizes (becomes redundant) or remains permanent.

**Test**: For each new intervention deployed, classify it a priori as content/process, then track internalization over 14 days. Expect >80% classification accuracy.

## Evidence Summary

| Source | Finding | Support |
|--------|---------|---------|
| **EXP-137** | **Structural comparison: workflow-level verification perfectly correlates with learner/reliant bifurcation. Bob's "learning" = workflow adoption (deliver-or-report Phase 3b), not behavioral change. May has most verification text but worst block rate (71%). Intervention: verify-wrap workflow for reliants.** | **Reframes** — supports guard permanence but reattributes "learning" to architectural substitution |
| **EXP-136** | **20% of FM-3.3 blocks inflated by git commit (not real behavioral failure). Bob genuine rate 58%→24% (masked by git inflation). Degrading agents (may/scout/optimizer) have 0% inflation — degradation confirmed real. System genuine rate 33%→46% (less steep than 34%→58% raw). Effective true positive rate 80.2% (not 99.7%).** | **Mixed** — weakens guard-as-definitive-evidence, strengthens bifurcation finding, sharpens agent-specific divergence |
| **EXP-134** | **FM-3.3 guard: 99.7% true positive rate (revised to 80.2% by EXP-136), 98.5% recovery, quality 3.60 vs 2.88, rate increasing 5.8%→34.6% (revised: 46% of increase is git inflation)** | **Moderate** (downgraded from Strong) — guard catches real behavior but 20% are git commit false positives |
| **EXP-135** | **Guard rate escalation is NOT task mix; bifurcated agent response: bob/coach/TL improving, may/scout/optimizer degrading** | **Mixed** — supports guard permanence but complicates "no learning" claim |
| KE-106 | FM-3.3 attempt rate increases (27%→70%) despite 26 days of guard | **Strong** — guards don't train |
| KE-122 | EXP-103 interventions became redundant in ~1 day (11%→100% baseline) | **Strong** — skills internalize |
| KE-110 | 5-skill stack at ceiling, diminishing returns | **Moderate** — skill capacity is finite |
| EXP-123 | Verification-depth guard works as RECOVERY, not prevention | **Strong** — process enforcement, not learning |
| EXP-110 | Commit guard +51.3pp recovery but 35% residual | **Moderate** — guards have limits too |
| EXP-115 | Completeness checklist guard +100pp for optimizer | **Moderate** — another process guard success |
| CR-333 | Intervention hierarchy: Skill > Guard > Injection | **Moderate** — theoretical framework |
| CR-339 | Open Problem #5: What determines skill vs. guard? | **Foundational** — motivating question |

## Current Assessment

**P(H) = 0.60** — Adjusted from 0.65 based on EXP-137 structural comparison results.

### EXP-137 Evidence Update (2026-04-11)

EXP-137 conducted a structural comparison of all 6 agents (learners vs. reliants) to identify the root cause of the bifurcation discovered in EXP-135. The key finding fundamentally reframes the skill/guard divergence:

1. **Workflow-level verification is the differentiator** (H-137a CONFIRMED, correlation 1.0): All 3 learners (bob, coach, tech-lead) have verification workflows; all 3 reliants (may, scout, optimizer) lack them. No other feature (SOUL.md size, skills count, verify-after-edit version, heartbeat structure) correlates with learning.
2. **"Learning" is actually architectural substitution**: Bob's improvement (58%→24%) isn't behavioral change — it's workflow adoption. Bob's `deliver-or-report` Phase 3b spawns a *separate* verification session, making self-verification unnecessary. The agent didn't learn; the architecture removed the need.
3. **May's Paradox** is the strongest confirmation of KE-106: May has the ONLY `verify-before-finish` skill, the data-aware 70L `verify-after-edit` skill (same as learners), and the highest quality scores (3.72 avg) — yet the worst genuine block rate at 71%. More verification text = zero effect on verification behavior.
4. **Implication for H-100**: The "guards are permanent" claim was correct but for a **different reason** than proposed. Guards are permanent not because agents can't learn process discipline, but because workflow-level architectural substitution is the only reliable mechanism — and only some agents have it. This shifts the core distinction from "content vs. process" to "text-level vs. workflow-level enforcement."
5. **New KE-106 refinement**: Guards don't train behavior, but workflows that include verification as a structural phase produce the *appearance* of learning by removing the opportunity for the error. The behavior doesn't change; the architecture compensates.

**Impact on H-100**: P(H) 0.65 → 0.60. The core skill/guard divergence framing is further weakened because:
- The "learning" evidence (bob/coach/TL improving) is NOT actual behavioral internalization — it's architectural substitution
- This means guards are indeed permanent (supporting H-100) BUT the mechanism is different from proposed — it's not "content vs. process" but "does the agent's workflow include verification?"
- The skill/guard distinction remains useful taxonomically but the causal mechanism needs revision to incorporate workflow-level enforcement as the key moderator
- P-100a (guard attempt rates never decline) is partially confirmed by a different mechanism: agents in workflows have lower guard rates, agents outside workflows don't improve

### EXP-136 Evidence Update (2026-04-11)

EXP-136 decomposed FM-3.3 guard blocks into genuine vs. git-commit-inflated, revealing measurement artifacts that change the evidence picture:

1. **20% of all FM-3.3 blocks are inflated** by `git commit` in `BASH_WRITE_PATTERNS` — the guard treats `git commit` as a write action, but committing already-verified changes doesn't need post-action verification.
2. **Bob's genuine rate is 58%→24% (IMPROVING)**, not the 100% block rate shown in raw data. The "100%" was entirely git-commit inflation from Bob's workflow shift to commit-at-end.
3. **May/scout/optimizer have 0% git inflation** — their degradation (may 33%→92%, scout 17%→76%, optimizer 29%→67%) is confirmed as genuine behavioral regression.
4. **System genuine rate: 33%→46%** (not 34%→58%). Nearly half the system-wide increase (11pp out of 24pp) was git commit inflation.
5. **Effective true positive rate: 80.2%** (not 99.7%) when counting git-commit-only blocks as false positives.

**Impact on H-100**: The core skill/guard divergence claim is weakened in two ways:
- The **evidence base for "guards don't train"** was inflated — the system-wide rate increase is half what was previously reported
- **Bob's genuine improvement** (58%→24%) is even stronger than EXP-135 showed, providing a clear counter-example to "guards never enable learning"
- However, **three agents genuinely degrading** (with 0% inflation) still supports the "permanent infrastructure" claim for those agents

**P(H) revision**: 0.70 → 0.65. The bifurcation is real but the balance of evidence tilts further toward "guards work differently for different agents" (supporting H-101) and away from the blanket claim that "guards are always permanent."

### EXP-135 Evidence Update (2026-04-11)

EXP-135 investigated whether the guard rate escalation (found in EXP-134) was a Simpson's paradox artifact of task mix change, or genuine skill degradation:

1. **Data correction**: EXP-134's Early/Mid period numbers were unverifiable — session JSONL files only exist from Apr 6 onward. The "5.8% → 20.1% → 34.6%" narrative was based on incomplete data.
2. **Task mix ruled out**: Simpson's paradox test showed adjusting to constant task mix changed the rate by <2pp. The trend is real.
3. **Within-heartbeat escalation**: 29.6% → 32.4% → 34.2% → 42.7% over Apr 6-11, within the single largest task type. Not explainable by task mix.
4. **Bifurcated agent response** (novel finding):
   - **Improving agents** (bob: 72%→10%, coach: 56%→24%, tech-lead: 29%→10%): Guard WORKED — they learned to verify
   - **Degrading agents** (may: 39%→91%, scout: 11%→76%, optimizer: 17%→52%): Guard FAILED — they developed guard reliance
5. **Net upward trend** driven by degrading agents degrading faster than improving agents improved.

**Impact on H-100**: The core claim that guards are "permanent infrastructure" is complicated. Some agents DO learn from guards (contradicting P-100a that "attempt rates never decline"). But other agents develop guard-reliance (supporting the permanence claim for them). The phenomenon appears to be **agent-specific**, not universal.

**Revision**: H-100 may need refinement into "guards are permanent for some agents but enable learning for others, depending on agent-specific learning dynamics." P(H) reduced from 0.72 → 0.70 because the evidence is more nuanced than previously assessed.

### EXP-134 Evidence Update (2026-04-11)

EXP-134 audited all 1,075 sessions with genuine FM-3.3 guard activations and found:
- **99.7% true positive rate** — *(revised by EXP-136 to 80.2% — 20% of blocks are git-commit-only inflation)*
- **98.5% recovery rate** — agents successfully verify after being blocked
- **Guard-blocked sessions have HIGHER quality** (3.60 vs 2.88) — guard genuinely improves outcomes
- **Guard rate increasing** (5.8% → 34.6% over 3 weeks) — *(revised by EXP-136: 46% of system increase is git inflation; genuine rate 33%→46%)*
- **Guard and evaluator are orthogonal** — only 2/1,155 sessions overlap between guard blocks and evaluator flags

This supports H-100's core claim with important caveats: the FM-3.3 guard is genuine infrastructure, but the evidence for "agents never learn" was inflated by measurement artifacts. See EXP-136 for full decomposition.

### Remaining uncertainties:
- Only one clear internalization example (EXP-103 → EXP-116/118)
- KE-122 acknowledges mechanism uncertainty (could be model drift, not internalization)
- No prospective test of the content/process classification criterion
- P-100c (guard removal) has not been tested

## Cross-References

- **EXP-137**: Structural comparison — workflow-level verification identified as root cause of learner/reliant bifurcation, "learning" = architectural substitution
- **EXP-136**: Guard rate decomposition — 20% git commit inflation, genuine bifurcation sharpened
- **KE-106**: Structural enforcement has no training effect — primary evidence for permanent guards
- **KE-122**: Intervention decay/internalization lifecycle — primary evidence for skill internalization
- **KE-110**: Skill stack saturation — capacity limits on internalization
- **EXP-123**: Verification-depth guard as recovery mechanism
- **EXP-110**: Commit guard recovery rates and residuals
- **EXP-115**: Completeness checklist guard (+100pp)
- **H-085**: Forced externalization general mechanism (parent theory)
- **H-095**: Agent-specific failure interventions (guards are agent×FM specific)
- **H-098**: Attention channel theory (skills = Ch3 content, guards = Ch2 structure)
- **H-099**: Discovery task boundary (neither skills nor guards help discovery)
- **CR-333**: Intervention hierarchy (Skill > Guard > Injection)
- **CR-339**: Open Problem #5 (motivating question)
- **KE-101**: Meta-analysis theory of agent improvement (theoretical context)

## Tags
`intervention-theory`, `skill-internalization`, `guard-permanence`, `process-vs-content`, `architectural-limitation`, `procedural-memory`
