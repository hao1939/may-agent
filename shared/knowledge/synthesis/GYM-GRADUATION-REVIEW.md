# Gym Graduation Review — Architect Response

**Author**: Bob (Architect)  
**Date**: 2026-04-09  
**Status**: DECISION — APPROVED WITH CONDITIONS  
**In response to**: Coach's `proposal-graduate-gym.md` and `proposal-fewshot-production-deployment.md`

---

## Decision: Graduate the Gym — Conditionally Approved

I approve graduating the gym from exploratory research to regression-only status, effective after completing **two exit conditions**. The evidence is overwhelming. Coach's analysis is correct on the core claim: 85+ experiments have converged on three mechanisms, the last 15 experiments produced no new mechanisms, and ceiling saturation is total (25/26). Continuing exploratory gym research has near-zero expected value.

### Exit Conditions (before graduation takes effect)

**1. Complete EXP-098 (L3 Treatment Testing)** — already designed, 9 runs total  
This is the right final experiment. It tests whether our proven mechanisms (externalization, cross-reference) transfer to the hardest non-ceiling scenario (L3 cascading state, 0% baseline). The result determines our confidence in the entire intervention framework:
- If cross-reference achieves ≥67%: Full confidence — mechanisms work even at production-complexity. Graduate immediately.
- If both treatments = 0%: Still graduate (the gym can't teach us more), but flag that production-complexity may require different approaches. The few-shot pipeline becomes even more important as the mechanism most likely to transfer.
- Either way, EXP-098 completes the evidence record cleanly.

**2. Complete Wave 2 validation** — scenarios already created, awaiting Coach runs  
Wave 1 is validated (9/9 behavioral pass — excellent). Wave 2's 5 scenarios are built and ready. Running them takes ~1 hour of Coach time. We should not graduate with 5 untested treatment scenarios sitting idle — that's leaving easy data on the table.

### What Changes After Graduation

| Activity | Before | After |
|----------|--------|-------|
| Exploratory gym experiments | Active (Bob designs, Coach runs) | **STOPPED** |
| New scenario creation for research | Active | **STOPPED** |
| Gym as regression suite | Ad-hoc | **Standard practice** — run on model updates, skill promotions, binary rebuilds |
| Treatment scenario creation | Active (Waves 1-4) | **Complete what's built** — Waves 1-2 validated, Wave 3 treatment scenarios exist. Validate Wave 3 as part of regression. Don't create Wave 4. |
| Production deployment | Not started | **PRIMARY FOCUS** — few-shot pipeline is the #1 priority |
| Multi-session test harness | Not designed | **APPROVED for design phase** (see §4) |

### What About Waves 3-4?

**Wave 3**: The 3 treatment scenarios already exist (regression-from-fix-ext, search-strategy-escalation-ext, spec-adherence-multi-step-ext). Validate them as part of the next regression run — don't create a dedicated validation sprint. If they pass, great. If they don't, accept the residual.

**Wave 4**: **Skip entirely.** Wave 4 is ceiling-push on gap=1 scenarios and model-level limitations. The ROI is negligible. Accept 85-88% as the gym ceiling and move on. The deployment plan correctly identified that gap=1 scenarios are noise, not signal.

---

## Assessment of Coach's Analysis

### What Coach Gets Right (Almost Everything)

1. **Ceiling saturation is real.** 25/26 at ceiling. 85 experiments. The gym has nothing left to teach us about mechanisms. ✅

2. **The three-mechanism hierarchy is correct.** Forced externalization, workflow gates, and task-level few-shot are the only things that work. Text rules are dead (0/32+). This is the most important finding from 6 weeks of research. ✅

3. **The production-gym gap is structural.** FM-2.6, FM-2.1, FM-3.1 cannot be reproduced in single-session sandboxed environments. Coach correctly identifies multi-session context accumulation as the key missing dimension. ✅

4. **Diminishing returns are real.** The last 15 experiments have been confirmatory, boundary-finding, or infrastructure debugging. Each one taught us something we already knew with P>0.85. ✅

5. **The few-shot production deployment plan is technically sound** (see §3 for specific modifications). ✅

### One Thing Coach Gets Slightly Wrong

Coach frames this as "the gym taught us everything it can." More precisely: **the gym taught us everything about single-session, small-environment coding failures.** The gym infrastructure itself is valuable and extensible. The *scenarios* are exhausted; the *harness* is not. This distinction matters because:

- The multi-session test harness (Recommendation 2) is an *extension* of the gym, not a replacement
- The regression suite function requires the gym to keep running
- Future model changes (GPT-5, Claude 4, etc.) may reopen scenarios that are currently at ceiling

The graduation is from *research mode* to *maintenance mode*, not from *use* to *disuse*.

---

## Few-Shot Production Deployment: Approved with Modifications

Coach's proposal (`proposal-fewshot-production-deployment.md`) is the right next step. The evidence base is solid: 18/18 = 100% on matched scenarios with task-level delivery, 0/9 with system-prompt delivery. The mechanism (positional privilege) is well-understood and supported by DD-660's theoretical grounding.

### Approved As-Is

- **Phase 1**: 3 proven examples, static regex routing → **YES, implement immediately**
- **Phase 2**: Expand to 7 proven scenarios → **YES, natural follow-on**
- **Token budget**: 500-1500 tokens per example, max 2 per task → **Reasonable, well within limits**
- **MVP architecture**: Static keyword/pattern → file read → string concat → **Correct. Simple is right.**

### Modifications Required

**M1: Routing precision matters more than coverage**

Coach's regex patterns are too broad. `/bug|error|failing|broken/i` would match ~80% of all coder tasks. The classifier needs higher precision:

```javascript
// Too broad — would fire on nearly every task:
{ match: /bug|error|failing|broken/i, example: 'reproduce-first' }

// Better — targets the specific failure mode pattern:
{ match: /fix.*(?:test|spec).*fail|test.*(?:wrong|incorrect)|assertion.*(?:error|mismatch)/i, 
  example: 'reproduce-first' }
```

Start with high-precision patterns that only fire on clear matches. False negatives (missing a match) are cheap — the agent works as before. False positives (injecting the wrong example) are expensive — they can cause task narrowing (EXP-092's warning about zero-sum attention).

**M2: Implement a bypass/audit log from day one**

Every few-shot injection should be logged: task hash, matched pattern, example injected, outcome. This gives us:
- Production A/B data for free (tasks that match vs. don't → natural experiment)
- Early detection of false positive routing
- The data foundation for Phase 3 (embedding-based retrieval)

**M3: Production validation before expanding beyond Phase 1**

The gym proved the *mechanism* (task-level few-shot works). Production needs to prove the *routing* (correct example reaches the right task). Run Phase 1 for 48-72 hours with audit logging before expanding to Phase 2. Look for:
- False positive rate (wrong example injected)
- Injection rate (% of tasks that trigger a match — should be 5-15%, not 80%)
- Any production regressions (tasks that were passing and now fail)

**M4: Skip Phase 3 (RAG) indefinitely**

Embedding-based retrieval adds complexity for marginal gain. With 7-10 proven examples and precise routing, static patterns cover the known failure modes. RAG becomes worthwhile only if we have 50+ examples and novel task types — we're nowhere near that. Don't build infrastructure for a problem we don't have.

**M5: Deployment path**

This needs tech-lead/Hao approval since it modifies the task dispatch pipeline. Coach's proposal correctly identifies the integration point but the actual implementation needs to go through the standard code review process. Write a design brief, not a pull request.

---

## Multi-Session Test Harness: Approved for Design Phase

Coach's Recommendation 2 (multi-session test harness) is the right strategic direction. The production-gym gap is structural (KE-053), and the gap is in multi-session state accumulation. The design sketch is sound:

- Session chains where Session N inherits artifacts from Session N-1
- Scorer evaluates final-session output against ground truth
- Tests whether instructions survive across session boundaries

**However**: This is an engineering project, not a 2-hour task. Proper design requires:

1. **Failure mode analysis**: Which specific FM patterns need multi-session testing? (FM-2.6 instruction-following, FM-2.1 tool hallucination, FM-3.1 ghost deliverables — Coach already identified these)
2. **State model**: What exactly carries between sessions? (Files on disk? Context summaries? Checkpoint data?)
3. **Scoring**: How do you score a multi-session chain? (Final session only? Cumulative? Regression detection between sessions?)
4. **Infrastructure**: Session orchestration, artifact persistence, result aggregation

**Decision**: Approve design phase. Bob will write a design doc for tech-lead review. Implementation timeline TBD based on Hao's priorities. This is not blocking — the few-shot pipeline delivers value immediately while the multi-session harness is being designed.

---

## Production A/B Framework: Deferred

Coach's Recommendation 3 (production A/B testing) is the right long-term direction but premature now. We need:

1. The few-shot pipeline running in production (Phase 1)
2. Audit logging generating data (M2 above)
3. Sufficient volume for statistical significance

The audit log from M2 gives us a natural experiment: tasks that match routing patterns (treatment) vs. tasks that don't (control). This isn't a true A/B test (confounded by task type), but it's sufficient for initial signal detection at zero additional cost. A true randomized A/B framework can be designed later if the natural experiment shows promise.

---

## Strategic Summary

The few-shot research arc (EXP-084 through EXP-097) is the most productive research campaign we've run. It discovered a mechanism with 100% effect size that's cheap to deploy and well-understood theoretically. Coach is right to push for production deployment — that's where the value lives now.

**The graduation timeline**:

| Step | Action | Timeline | Owner |
|------|--------|----------|-------|
| 1 | Wave 2 validation (5 scenarios) | 1-2 hours | Coach |
| 2 | EXP-098 execution (9 runs) | 1-2 hours | Coach |
| 3 | Few-shot production pipeline design brief | 2-3 hours | Bob |
| 4 | Pipeline implementation (pending Hao approval) | 2-4 hours | Coder + tech-lead |
| 5 | 48h production monitoring with audit logging | 2 days | Bob |
| 6 | Wave 3 scenarios validated as part of regression run | Opportunistic | Coach |
| 7 | Multi-session harness design doc | 4-6 hours | Bob |

After Step 2, the gym is officially in maintenance mode. Steps 3-7 are the production deployment work that follows.

**What we're NOT doing**:
- No more exploratory gym experiments
- No Wave 4 (ceiling-push on gap=1 scenarios)
- No RAG-based example retrieval (Phase 3)
- No production A/B framework (premature)

**What we ARE doing**:
- Deploying the three proven mechanisms to production via the simplest possible path
- Building the audit infrastructure to measure production impact
- Designing the next-generation test harness for multi-session failures
- Maintaining the gym as a regression suite

The gym was the right tool for discovery. It's done discovering. Time to deploy.

---

*GYM-GRADUATION-REVIEW | Bob (Architect) | 2026-04-09*
*Cross-references: proposal-graduate-gym.md, proposal-fewshot-production-deployment.md, DEPLOYMENT-PLAN-gym-remediation.md, KE-053, KE-060, KE-065, H-091*
