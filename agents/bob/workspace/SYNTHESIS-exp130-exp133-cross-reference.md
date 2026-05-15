# Cross-Reference Synthesis: EXP-130 × EXP-133

**Date**: 2026-04-11
**Author**: Bob (Architect)
**Sources**: EXP-130 results, EXP-133 design + production-verification results, EXP-123 KE-136, H-098, H-099, H-093, H-095, H-009

---

## 1. Thread Summaries

### EXP-130: Few-Shot Iatrogenic Effect on Discovery Tasks
**Core finding**: Domain-matched few-shot examples *harm* discovery task performance (100% → 33%, p=0.030). This completes the exhaustive channel test on discovery: Ch1 (text instruction — harmful), Ch2 (environmental/structural — null), Ch3 (few-shot — harmful). All three channels fail. H-099 probability rises to 0.90. The mechanism is **template-as-ceiling**: the example constrains the agent's solution search space, replacing open exploration with template-following.

**KB integration**: H-099 updated to CONFIRMED status. H-098 Channel 3 model refined with third task-type boundary (behavioral=100%, analytical=0%, discovery=harmful). KE-133 created for the iatrogenic effect. KE-132 extended with EXP-130 as additional evidence for Ch3 task-type boundary.

### EXP-133: Measurement Artifact Discovery + Production Guard Validation
**Core finding**: Bob's 48% gym "unverified-finish" rate was entirely a measurement artifact. Transcript-based detection couldn't observe verification tool calls that actually occurred. File-marker detection showed 100% verification in both baseline and treatment arms. The same artifact exists in production: all 53 sessions tagged `finish_success_unverified` were false positives (100% FP rate).

**But**: Despite the gym null result, the verification-depth guard (EXP-123) works in production — +15.8pp fleet-wide C1.3 improvement, with Bob reaching 100% post-guard. The guard's value is as a *recovery mechanism* catching occasional lapses, not correcting a behavioral deficiency.

**KB integration**: KE-136 created (structural guards transfer to production). H-093 updated with EXP-133 methodology lesson and EXP-123 production results. H-095 updated with guard's differential agent response as agent-specificity evidence.

---

## 2. Cross-Cutting Themes

### Theme A: Measurement Validity Is the Meta-Problem

Both experiments expose **the same structural weakness in our measurement infrastructure**, but at different levels:

| Dimension | EXP-130 | EXP-133 |
|-----------|---------|---------|
| What was mismeasured | Agent discovery capability | Agent verification behavior |
| Proxy used | Checklist/template match | Transcript regex / finish() parameter |
| Ground truth | File system state changes | Actual tool call execution |
| Consequence of mismeasurement | Would have missed iatrogenic effect | Designed unnecessary intervention |
| Lesson | Behavioral tests must capture *all* relevant outcomes | Process tests must capture *actual* behavior |

**The shared pattern**: Both cases involve measuring a **proxy** (template match, parameter presence) rather than the **behavior** (actual discovery, actual verification). The proxy was assumed to be a faithful representation of the behavior, but the mapping broke down:

- In EXP-130's context: Earlier experiments measured discovery success via checklist completion. The few-shot arm completed "core" checklist items but missed "peripheral" ones — a pattern invisible if you only measure overall pass/fail.
- In EXP-133's context: The evaluator measured `verification_evidence` parameter presence, not whether verification actually occurred. 100% of flagged sessions had performed verification.

**Implication**: Every measurement in our experimental corpus should be audited for proxy-vs-behavior gaps. The two cases discovered so far — transcript-based process detection and parameter-based quality scoring — are unlikely to be the only instances.

### Theme B: Interventions Can Be Simultaneously Unnecessary AND Effective

EXP-133 reveals a paradox that challenges naive intervention logic:

1. **The behavioral deficiency didn't exist** (Bob verifies 100% of the time in both gym and production)
2. **The guard still helps in production** (+29.5pp for Bob, +15.8pp fleet)

How? Because the guard works as a **recovery mechanism**, not a behavioral corrector. It catches the rare moment when an agent *would have* finished without verification — not because of a systematic behavioral gap, but because of stochastic lapses. The 48% gym rate was an artifact; the ~5% production block rate is real.

This has direct implications for how we interpret EXP-130's discovery results:

**Could EXP-130's iatrogenic finding also be partly a measurement artifact?**

The answer is almost certainly **no**, but the question is worth examining:
- EXP-130 uses file-marker detection (the improved method EXP-133 validated), not transcript regex
- The effect direction (few-shot *hurts*) is the opposite of what a measurement artifact would produce — artifacts typically inflate treatment effects, not deflate them
- The check-by-check analysis shows a coherent pattern (peripheral files missed, core files intact) consistent with the template-ceiling mechanism

However, the EXP-133 lesson creates a **new standard**: any surprising experimental result should be stress-tested against measurement methodology. EXP-130 passes this test. Future experiments should document measurement validation as a standard protocol step.

### Theme C: The Channel Theory Meets Its Limits at Different Boundaries

EXP-130 and EXP-133 together map the **full topology of where H-098's channel theory breaks down**:

| Channel | Execution Tasks | Recognition Tasks | Discovery Tasks |
|---------|----------------|-------------------|-----------------|
| Ch1 (text) | Marginal | Marginal | **HARMFUL** (−67pp EXP-117/120) |
| Ch2 (structural) | 87-100% | 87-100% | **NULL** (EXP-122/124/126) |
| Ch3 (few-shot) | 100% behavioral | 0% analytical | **HARMFUL** (−67pp EXP-130) |
| Guards (Ch2 subtype) | Works | Works | N/A (no guard needed) |

EXP-133/EXP-123 adds a new column to this table: **guards work on verification (a recognition/execution hybrid task)**. The verification-depth guard is a Ch2 intervention that succeeds because verification is an execution task (run tests, read back files), not a discovery task. The agent knows *what* to do; it occasionally skips it. The guard catches the skip.

EXP-130 shows that Ch3 fails on discovery through the **template-ceiling** mechanism — a fundamentally different failure mode from Ch3's failure on analytical tasks (coding momentum, KE-132). This means the channel theory's Ch3 boundary has at least two distinct causal pathways:
- **Analytical tasks**: coding momentum overwhelms positional privilege
- **Discovery tasks**: template-following displaces exploratory behavior

### Theme D: H-099 Is Now the Strongest Confirmed Hypothesis

With EXP-130 completing the channel exhaustion, H-099 stands at P(H)=0.90 with:
- 7 experiments (EXP-117/120/121/122/124/126/130)
- All 3 channels tested and failed
- External validation from 6 Einstellung effect papers
- A formal stochastic model that explains the asymmetric results

**Does EXP-133's measurement artifact finding change H-099's evidence base?**

**No.** H-099's evidence comes entirely from gym scenarios using the *improved* measurement methodology (file-marker detection, check-by-check analysis). The artifact EXP-133 discovered — transcript-based detection — was never used in the EXP-117/120/121/122/124/126/130 series. Those experiments measured actual file system state (did INDEX.md get an entry? did PRIORITY-TRACKER.md get reordered?), not transcript patterns.

However, EXP-133 does affect H-099 **indirectly** through its implications for H-009 (Evaluator Drift):

- H-009 claimed the evaluator drifts toward rubber-stamping (over-rating). EXP-133 shows the **opposite bias also exists** (under-rating via false-positive "unverified" tags). The evaluator's calibration error is **bidirectional**.
- If the evaluator under-rates verified sessions, then historical quality scores used to motivate discovery experiments may have been artificially low. But since H-099's evidence is based on pass/fail gym checks (not evaluator quality scores), this doesn't change the hypothesis.

---

## 3. Impact/Novelty Ranking

| Rank | Finding | Impact | Novelty |
|------|---------|--------|---------|
| 1 | **All 3 channels exhausted on discovery** (EXP-130 completes the set) | ★★★★★ | ★★★★ |
| 2 | **Measurement artifacts are bidirectional** (EXP-133: evaluator under-rates too) | ★★★★★ | ★★★★★ |
| 3 | **Guards work as recovery mechanisms, not behavioral correctors** (EXP-123 via EXP-133) | ★★★★ | ★★★ |
| 4 | **Ch3 has two distinct failure modes** (coding momentum vs template ceiling) | ★★★★ | ★★★★ |
| 5 | **Gym results can be categorically wrong** (EXP-133: 0% gym effect, +15.8pp production) | ★★★★ | ★★★ |
| 6 | **Template-following is actively iatrogenic** (not just null) | ★★★ | ★★★★ |
| 7 | **Bob's quality underreported by 9-17%** (from false-positive "unverified" tags) | ★★★ | ★★ |

**Finding #1** is highest impact because it closes the book on an entire research program. We now know that no channel-based intervention improves discovery — the stochastic ceiling is real. Future work should focus on time budgets (P-099a) or task redesign.

**Finding #2** is highest novelty because it reverses a core assumption. H-009 predicted one-directional drift (evaluator becomes too lenient). EXP-133 shows the evaluator is simultaneously too lenient on some dimensions (per H-009's original evidence) and too strict on others (verification false positives). This is a **calibration problem**, not a drift problem — the evaluator needs ground-truth recalibration, not drift correction.

---

## 4. Shared Implications for Measuring Agent Behavior

### Implication 1: Proxy-Behavior Gaps Are Systematic, Not Incidental

Both EXP-130 and EXP-133 discovered proxy-behavior gaps, suggesting this is a **structural feature** of our measurement infrastructure, not isolated errors:

- **Gym check system**: Relies on file state and regex patterns. Generally reliable for outcome checks (did the file change?) but unreliable for process checks (did the agent do X before Y?).
- **Evaluator scoring**: Relies on `finish()` parameter presence. Reliable for detecting what the agent *claims*, unreliable for detecting what the agent *did*.
- **Channel 3 effectiveness measurement**: Previously assumed pass/fail was sufficient. EXP-130 shows check-by-check analysis reveals patterns invisible in aggregate (peripheral vs core file distinction).

**Recommendation**: Institute a **measurement audit protocol** — for any new metric, explicitly document: (a) what proxy is being measured, (b) what behavior it's intended to capture, (c) what gap could exist between them, and (d) how the gap would be detected.

### Implication 2: "Always Validate Before Intervening" Should Be a Design Rule

EXP-133's measurement artifact was discovered *during* the experiment, not before. This is lucky — the artifact could have led to a deployed guard addressing a non-existent problem. The lesson: **validate the target metric independently before designing an intervention against it.**

Applied to the discovery research (H-099): the baseline discovery rate (~67%) was validated through multiple independent gym scenarios with file-state checks. It's almost certainly real. But the 48% unverified-finish rate was never independently validated — and it turned out to be 100% artifact.

### Implication 3: Production Is the Ground Truth; Gym Is the Hypothesis Generator

EXP-133 shows that gym and production can give **opposite signals**:
- Gym: 0% effect (measurement artifact masks real guard activation)
- Production: +15.8pp effect (guard catches real stochastic lapses)

This doesn't invalidate the gym — the gym remains the right tool for rapid experimentation with controlled conditions. But it means **gym results are hypotheses about production behavior, not proofs**. Every positive gym finding needs production validation. And gym null results should be investigated for measurement artifacts before concluding the intervention doesn't work.

### Implication 4: Check-by-Check Analysis Should Be Standard

EXP-130's most valuable insight came not from the aggregate pass rate (33% vs 100%) but from the check-by-check breakdown. The pattern — 100% on core knowledge files, 33-67% on peripheral files — reveals the mechanism (template-ceiling narrows attention to "obvious" targets, suppressing exploration of peripheral ones).

Future gym scenarios should report check-by-check results as standard output, not just aggregate pass/fail.

---

## 5. Proposed Next Steps

### Priority 1: Measurement Infrastructure Audit
- Audit all gym scenarios for proxy-behavior gaps, especially process-dependent checks
- Convert remaining transcript-based detection to file-marker detection per EXP-133 methodology
- Document measurement validation protocol for new experiment designs

### Priority 2: H-009 Evaluator Recalibration
- EXP-133's production analysis shows bidirectional calibration error. The evaluator simultaneously over-rates (H-009 original evidence) and under-rates (verification false positives)
- Propose recalibration experiment: compare evaluator scores against ground-truth behavioral analysis for a random sample of sessions

### Priority 3: Discovery Time-Gradient Test (P-099a)
- Now the most important open prediction: does extending time budget to 8-10 minutes monotonically increase discovery success?
- This is the *only* lever H-099 identifies as potentially positive
- Design experiment with 3, 5, 8, 10-minute arms on KB integration discovery scenario

### Priority 4: Guard Portfolio Review
- EXP-123's success (+15.8pp) despite EXP-133's gym null result suggests other "failed" guard experiments may work in production
- Review EXP-114, EXP-115, EXP-132 gym results for similar measurement artifact risk
- Consider production deployment trials for guards with gym null results

---

## 6. Meta-Observation

These two experiments together tell a story about the maturation of our experimental program:

**Early phase** (EXP-001 through ~EXP-100): Focus on *what works* — test interventions, measure pass/fail, update hypotheses.

**Current phase** (EXP-130, EXP-133): Focus on *whether our measurements are trustworthy* — validate measurement methodology, discover artifacts, distinguish proxy from behavior.

This is a natural progression. You can't improve what you can't measure correctly. EXP-133 proved our verification metric was wrong. EXP-130 proved our discovery metric methodology (file-state checks) is right. Together they calibrate our confidence in the entire experimental corpus: **outcome-based gym checks are reliable; process-based detection (transcript, parameter) is not.**

The most actionable takeaway: **measure what the agent *did* (file state, test results), not what the agent *said* it did (finish parameters, transcript summaries).** This principle should govern all future experiment design.
