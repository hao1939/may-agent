# DD#711: Skill Injection Limits — 39/49 Skills Yield Zero Improvement

**Source**: "SWE-Skills-Bench: Do Agent Skills Actually Help in Real-World Software Engineering?" (arXiv:2603.15401)  
**Authors**: Han et al. (7 authors, Nanjing University + others)  
**Date**: March 16, 2026  
**Signal**: ★★★★★ — Directly validates our skill injection findings (EXP-090/091/104)  
**Tags**: skill-injection, benchmark-validity, agent-evaluation, transfer-gap  
**Cluster**: Gym-Production Transfer Gap

## Core Finding

**Agent skills are a narrow intervention whose utility depends strongly on domain fit, abstraction level, and contextual compatibility.** In the first systematic evaluation of 49 public SWE skills:

- **39 of 49 skills** (80%) yield **zero** pass-rate improvement
- Average gain: only **+1.2%**
- Token overhead: modest savings to **451% increase** with no pass rate change
- Only **7 specialized skills** produce meaningful gains (up to +30%)
- **3 skills degrade performance** (up to -10%) due to version-mismatched guidance

## Key Data Points

- **49 public SWE skills** evaluated against ~565 task instances across 6 subdomains
- Deterministic verification framework with execution-based tests
- Controlled paired evaluation (with skill vs without skill, same task)
- Skills that help are **highly domain-specific** and **version-matched**
- Skills that hurt provide **outdated or contextually mismatched** guidance

## Why This Matters for Us

### Validates EXP-104 "Context Stripping Paradox"

EXP-104 found that removing context HURTS performance (75% vs 100% baseline). SWE-Skills-Bench shows the flip side: adding skills (structured context) usually doesn't help and sometimes hurts. The critical variable isn't the presence/absence of skills — it's **contextual compatibility**.

This maps precisely to KE-101 Law 2 (structural interventions > content interventions): skills are content, not structure. They add information without adding structural constraints. That's why 80% are inert.

### Validates Evidence-over-Narrative as Rare "Good Skill"

Our evidence-over-narrative skill (EXP-090/091) achieved 100% success and durable improvement. This puts it in the elite 7/49 category — a skill that works because it:
1. Targets a specific structural failure mode (verification confabulation)
2. Changes the verification process, not just adds information
3. Is version-independent (behavioral, not API-specific)

The 39 failing skills likely failed because they're **informational** (API references, coding patterns) rather than **behavioral** (changing HOW the agent works).

### Explains Why "Harder Tasks" Don't Help the Gym

Making gym tasks harder by adding more information/requirements doesn't reproduce production conditions. Production difficulty comes from:
- Implicit constraints (DD#710)
- Context interference (multiple competing concerns)
- Temporal complexity (evolving requirements over time)
- NOT from "more instructions to follow"

## Taxonomy of Skill Effectiveness

From the paper + our experience:

| Type | Example | Effectiveness |
|------|---------|---------------|
| **Behavioral** (changes HOW agent works) | Evidence-over-narrative | HIGH (+30%) |
| **Procedural** (step-by-step instructions) | Plan-once-amend | MODERATE (+5-10%) |
| **Informational** (API/pattern knowledge) | Most public skills | ZERO (+0%) |
| **Mismatched** (wrong version/context) | Outdated API guides | NEGATIVE (-10%) |

## Design Implications for Gym

1. **Don't inject more skills to increase difficulty** — 80% are inert
2. **Focus on structural complexity, not informational load**
3. **The gym-production gap is about constraint TYPE, not constraint COUNT**
4. **Test skill effectiveness in production context, not controlled benchmarks**

## Connection to Other Papers

- **DD#710 (Design-Aware Bench)**: Test pass rate is orthogonal to design compliance — skills optimize for pass rate (wrong target)
- **DD#676 (TraceSafe-Bench)**: Structural bottleneck ρ=0.79 vs safety alignment ρ≈0 — skills don't address structural bottlenecks
- **KE-101 Laws 2+4**: Structure > content, skill effectiveness requires structural compatibility
- **CR#319**: Reasoning contamination — skills may ADD noise that disrupts reasoning
