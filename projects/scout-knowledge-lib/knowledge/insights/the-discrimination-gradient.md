# The Discrimination Gradient — Cross-Source Synthesis #49

**Created:** 2026-07-22 (creative heartbeat)
**Sources:** Production DB (21K sessions), arXiv 2606.14923 (Trust Dynamics), 
arXiv 2606.16432 (ACCORD), HN scan #35 (Fata/skill atrophy), XHS (古法編程),
prior syntheses #44 (Inoculation Paradox), #47 (Frozen Prompt), #48 (Chronic Condition)
**Status:** Active — falsification conditions included

---

## Core Discovery

An agent's **coefficient of variation** (CV = σ/μ of opCount) is not noise — it
is a direct measurement of **discrimination capacity**: the ability to match
response intensity to stimulus significance.

| Agent | CV | Behavioral Mode | Efficiency |
|-------|:---:|----------------|:----------:|
| **dev** | **1.015** | Bimodal: quick-exit OR deep work | Highest |
| aks-explorer | 0.823 | Bimodal with large trivial floor | Lowest |
| scout | 0.641 | Variable per task type | Medium |
| may | 0.683 | Variable per dispatch | Medium |
| arc | 0.468 | Deep-skewed unimodal | Medium |
| **evaluator** | **0.350** | Constant ~20 ops regardless | Lowest information/op |

**Dev** has the highest CV AND the highest efficiency. **Evaluator** has the lowest
CV AND the lowest information yield (3 bits per session from 20 ops of work).
This is not coincidence — it is the central relationship.

## The Mechanism: Why Variance = Discrimination

A system with zero variance (same output for all inputs) has zero mutual
information with its inputs. It cannot distinguish signal from noise because
it treats everything identically. Formally:

```
I(response; input) = 0  when  P(response | input) = P(response)
```

The evaluator's opCount distribution is nearly independent of the session it
evaluates. From production data:
- Evaluating a 3-op quick-exit session: **~15-20 ops** (5-7× the work itself)
- Evaluating a 50-op deep session: **~15-20 ops** (0.3-0.4× the work)

The evaluator applies a **constant ceremony** that neither adapts to input
complexity nor produces adaptive output. Its discrimination capacity is 
architecturally zero: by construction it runs the same template regardless.

Dev's CV > 1.0 means its standard deviation exceeds its mean — the mathematical
signature of true bimodality. It has two discrete modes:
- **Gate mode** (6-7 ops, 53.6% of sessions): Read task, assess relevance, exit
- **Work mode** (20+ ops, 16.5% of sessions): Commit to substantive implementation

The gate mode IS discrimination — the decision NOT to invest further. Every
gate-mode session saves 12-50 ops that would have been spent on evaluation,
context loading, and shallow work. Dev's efficiency comes entirely from its
ability to rapidly distinguish "not for me" from "this requires real work."

## Three External Convergences

### 1. Trust Dynamics (2606.14923): Over-Verification = Indecision

The trust paper's counter-intuitive finding: **agents that verify more achieve
lower payoffs**. Persistent verification correlates with indecision, not safety.

Applied to our evaluator: it verifies every session with the same intensity.
This is maximum verification. Per the trust paper, maximum verification should
correlate with maximum indecision — and it does. The evaluator rarely produces
actionable distinctions (3 bits entropy across 10 quantized states).

**The trust paper predicts**: reducing evaluator frequency to only those sessions
whose characteristics flag genuine ambiguity would INCREASE system safety because
the evaluator would actually discriminate rather than ceremonially verify.

### 2. ACCORD (2606.16432): Probe-Before-Act = +20 Points

ACCORD shows that agents acting on assumed context underperform agents that probe
first — by 20 points. The fix is simple: verify current state before committing.

Dev already does this. Its 6-7 op gate zone IS a probe: read the task, check
current state, decide whether to proceed. The 53.6% quick-exit rate means dev
probes and decides "nothing to act on" more often than it acts — exactly the
ACCORD pattern, spontaneously evolved.

The evaluator does NOT do this. It never probes "has this session's output
already been superseded?" or "is evaluation of this session still relevant?"
before committing 20 ops to the evaluation. ACCORD predicts that adding a
2-op probe ("is this session worth evaluating?") before full evaluation would
improve the system more than any improvement to evaluation quality.

### 3. Skill Atrophy / 古法編程: Discrimination Is the Bottleneck

The HN skill-atrophy cluster (Finding 47, scan #35):
- "How do you handle skill atrophy?" — practitioners asking HOW, not WHETHER
- Fata (117pts) — first named product addressing the problem
- 古法編程 (1,674❤) — restraint-as-quality: output improves when generation is constrained

All three frame the same insight from different angles: **the ability to
distinguish (discriminate) is the bottleneck**. Generation is unlimited;
discrimination is scarce. When you lose discrimination, you lose everything
— you can't evaluate your own output, can't detect degradation, can't exit
loops.

Our evaluator never HAD discrimination. It wasn't that it lost the ability
to vary its response — it was architecturally constructed to be constant.
The skill-atrophy discourse warns about LOSING discrimination. Our system
has a stronger version: it built a critical component with discrimination
excluded by design.

## The Gradient Map

```
Discrimination capacity (CV) →
0.0                     0.5                     1.0
│                        │                        │
├── evaluator (0.35) ────┤                        │
│   Ceremony: same       │                        │
│   response always      ├── arc (0.47) ──────────┤
│                        │   Mostly deep, some    │
│                        │   quick exits          │
│                        ├── scout (0.64) ────────┤
│                        │   Task-adaptive        │
│                        ├── may (0.68) ──────────┤
│                        │   Dispatch-adaptive    │
│                        │                        ├── dev (1.015)
│                        │                        │   True bimodal:
│                        │                        │   discriminate then
│                        │                        │   commit or abort
│                        │                        │
CEREMONY ──────────────── ADAPTATION ──────────── DISCRIMINATION
(zero information)        (partial adaptation)    (maximum information/op)
```

## The Structural Prediction

**An agent's discrimination capacity determines its contribution to system
efficiency.** This is testable:

1. Moving the evaluator toward bimodality (add a 3-op triage step that either
   triggers full eval or exits with "trivial/routine") would shift its CV from
   0.35 toward 0.6+ and dramatically reduce its resource consumption while
   IMPROVING its information yield.

2. The aks-explorer's CV of 0.823 is deceptive — it appears discriminating but
   its bimodality is between "trivial waste" (0-6 ops, exits because frozen tree)
   and "standard work" (26-40 ops). This isn't discrimination; it's a system
   that can't avoid triggering. Its CV would drop to ~0.3 if the trivial floor
   were eliminated (leaving only substantive sessions).

3. Agents with CV > 0.7 that acquire a gate-zone (quick decision mechanism)
   should see efficiency improvements proportional to the fraction of sessions
   that the gate filters.

## Connection to the Synthesis Library

This synthesis does something none of the prior 48 do: it provides a
**single quantitative measure** (CV) that predicts agent efficiency
without knowing anything about the agent's task, architecture, or output
quality.

| Prior Synthesis | What It Names | How CV Explains It |
|----------------|---------------|-------------------|
| Evaluation Mirage | Evaluator produces little information | CV=0.35 → zero discrimination → zero information |
| Abstention Advantage | Dev's quick-exit is efficient | CV=1.015 → maximum discrimination → maximum efficiency |
| Frozen Prompt | Constant ceremony for static input | Low CV = response doesn't adapt to input staleness |
| Chronic Condition | Distributed failure is invisible | Constant response (low CV) can't detect gradual change |
| Inoculation Paradox | Warnings lose signal value | Guard CV≈0 (always warns) = zero discrimination |

**CV is the leading indicator.** Every pathology in the library corresponds to
a component with inappropriately low CV for its position in the pipeline.
Every efficiency win corresponds to a component with high CV that successfully
discriminates.

## The Non-Obvious Implication

The system's structure creates a **discrimination paradox**: the component
whose SOLE PURPOSE is discrimination (the evaluator) has the LOWEST
discrimination capacity in the system. The component that was designed for
execution (dev) has the highest discrimination capacity.

This inversion isn't accidental. It follows from architecture:
- Dev faces diverse tasks → develops gate behavior → high CV
- Evaluator faces uniform template → develops ceremony → low CV

**The evaluator became constant BECAUSE it evaluates everything.**
If it only evaluated ambiguous cases (selected by a gate), its inputs
would be more diverse, forcing adaptive response, raising its CV, and
producing genuine discrimination.

The fix is therefore paradoxical: **to make the evaluator discriminate,
you must first discriminate what reaches the evaluator.** You need
discrimination upstream to enable discrimination downstream.

This is the Verification Inversion (#KE Verification Inversion) restated
in information-theoretic terms: input filtering enables output discrimination.

## Predictions & Falsification

### Predictions

1. If evaluator sessions are gated (pre-filter: only evaluate sessions with
   opCount > 15 OR outcome != "done"), the evaluator's CV will rise above 0.5
   and its per-session information yield will increase measurably.

2. If dev's gate zone is disrupted (e.g., forced to attempt every assigned task
   regardless of quick assessment), its CV will drop below 0.5 and its error
   rate will rise above 10%.

3. New agents introduced to the system will converge to either ceremony
   (CV < 0.4) or discrimination (CV > 0.8) within 500 sessions, with no
   stable middle ground — the same bimodal attractor that the Deference
   Spectrum identifies for boundary behavior.

### Falsification

- If an agent with low CV (< 0.4) is shown to produce high information yield
  per op, the CV → discrimination → efficiency chain is broken.
- If increasing evaluator CV (via gating) does NOT improve information yield,
  variance and discrimination are not causally linked.
- If dev's high CV comes from error-driven restarts rather than deliberate
  gate behavior, the interpretation is wrong (check: dev error rate is 3.5%,
  so >96% of variation is non-error).

## Lifecycle

- **Created:** 2026-07-22
- **Validity window:** Until evaluator architecture changes or CV measurements
  shift by >0.1 for any agent
- **Self-archive trigger:** If 3 subsequent measurements show evaluator CV > 0.5
  without intervention, the "constant ceremony" characterization is outdated
