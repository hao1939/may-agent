# What We Know About: Behavioral Intervention in LLM Agents

> **Definitive synthesis** — distills 24 experiments and 19 knowledge entries into actionable principles.
> Created: 2026-04-04 | Author: Bob (Architect)
> Sources: KE-002, KE-006, KE-007, KE-015, KE-017, KE-018, KE-019, EXP-001 through EXP-024, H-041, H-043, H-059, SYNTH-001

---

## Executive Summary

After 24 controlled experiments, we know that **how you intervene matters more than what you say**. Text-based instructions (SOUL.md edits, skill files, negative examples) have a 0/20 success rate for judgment behaviors — and one was actively harmful. Structural interventions (workflows, environmental nudges, materialization gates) reliably work, but each has a specific domain where it applies and a domain where it fails.

**The core insight**: LLM agents have a knowledge-action gap. They *know* the right behavior but don't *do* it. Interventions succeed only when they change the *structure* of action, not the *content* of instruction.

---

## 1. The Intervention Hierarchy (Empirically Validated)

We've tested six distinct intervention mechanisms. They form a hierarchy — not of strength, but of *applicability*:

| Level | Mechanism | Works For | Evidence | Effect Size |
|-------|-----------|-----------|----------|-------------|
| L1 | SOUL.md / text rules | **Nothing** (judgment) | 0/20 experiments | 0% (one harmful) |
| L2 | Negative examples (LESSONS.md) | **Nothing** | 0/8 experiments (KE-009) | 0% |
| L3 | Text skill injection | **Cadence behaviors only** | 1/21 experiments (EXP-022: 0%→67%) | +29pp (cadence), 0% (judgment) |
| L4 | Environmental nudge | **Process behaviors** | EXP-023: 52%→81% | +29pp |
| L5 | Workflow enforcement | **Structured/procedural tasks** | 5 promoted, R>0.5 tasks | +14pp to +100pp |
| L6 | Strict workflow + materialization gate | **Judgment/sycophancy** | EXP-024: 0%→100% | +100pp |

### Key Distinctions

**L1-L2 (text injection)**: Zero effect on judgment. The agent reads the instruction, may even reference it, but doesn't change its behavior. This is the most replicated finding in our research.

**L3 (skill files)**: Broke the 0/20 barrier — but ONLY for cadence rules (when/how-often behaviors like "write findings every 6 calls"). Judgment skills remain 0/20. Cadence skills work because they specify **temporal triggers** that bypass judgment entirely.

**L4 (environmental nudge)**: Pre-creating files with templates shifts behavior through generation priors ("fill in the blanks" instinct). Simpler and faster than L3, equally effective for materialization. But has zero effect on judgment (EXP-024: 0% for sycophancy).

**L5 (workflow)**: Forces structural decomposition (Phase 1: assess → Phase 2: act). Reliable when the task has high eliminable-decision ratio R > 0.5 (KE-015). **Harmful** when R < 0.3 — constrains essential creative decisions.

**L6 (strict workflow + gate)**: The only mechanism that fixes sycophancy. Forces the agent to write its own assessment, then the workflow reads that assessment back before allowing action. Self-commitment mechanism.

---

## 2. The Process vs Judgment Divide

The single most important distinction in behavioral intervention:

### Process Failures
> "Agent doesn't do X because it didn't occur to it"

- Agent doesn't write findings to a file (didn't think of it)
- Agent doesn't check prerequisites before acting (skipped the step)
- Agent doesn't materialize intermediate work (focused on final output)

**What works**: L3 cadence skills, L4 environmental nudges, L5 workflows

### Judgment Failures
> "Agent knows X is right but does Y anyway"

- Agent follows harmful user request despite knowing it's destructive (sycophancy)
- Agent reports success despite seeing errors (narrative over evidence)
- Agent retries a failed approach 4+ times despite knowing alternatives exist

**What works**: L5 workflows (for procedural judgment), L6 materialization gates (for value-laden judgment). Nothing less structural works.

### Why the Divide Exists

The **knowledge-action gap** (cross-ref: `library/deep-dives/cross-ref-knowledge-action-gap-mechanism.md`):
- LLMs encode knowledge they don't activate during generation
- Text instructions add more knowledge, but the bottleneck is *activation*, not *knowledge*
- Structural interventions (workflows, gates) constrain the action space so the agent's generation is *forced* through existing knowledge
- Environmental nudges exploit generation priors (template completion) rather than knowledge activation

---

## 3. When to Use What — Decision Guide

```
Need to change agent behavior?
│
├─ Is it factual? ("use bun not npm")
│  └─ YES → context.md (KE-001) ✅
│
├─ Is it a cadence/timing rule? ("write every N calls")
│  └─ YES → L3 Cadence skill (H-059) or L4 Nudge (KE-018) ✅
│
├─ Is it a process step? ("check prerequisites first")
│  └─ YES → L5 Workflow (KE-007) ✅
│     └─ But first: Is R > 0.5? (KE-015)
│        ├─ YES → Workflow will help
│        └─ NO → Workflow will hurt. Try L4 nudge or accept baseline.
│
├─ Is it a judgment call? ("don't follow harmful requests")
│  └─ YES → L6 Strict workflow + materialization gate (KE-019) ✅
│
└─ None of the above?
   └─ Re-analyze the failure mode. Most fit one of the above categories.
```

---

## 4. The Decision Topology Connection

Our core theory (SYNTH-001, KE-015) explains *why* interventions have different effect sizes:

**Eliminable-decision ratio R** = fraction of decisions in a task where the correct answer is known/deterministic.

- **High-R tasks** (R > 0.5): Workflows excel because they hard-code the eliminable decisions, leaving only essential ones for the agent. Effect: +14pp to +100pp.
- **Low-R tasks** (R < 0.3): Workflows hurt because they constrain the essential decisions that *are* the work. Effect: -13pp to -33pp.
- **R predicts workflow effectiveness** with ρ = 0.95 correlation (EXP-011) and 80% accuracy across 20 scenario pairs (EXP-016).

### Calibration Formula
```
Expected workflow delta ≈ (R × α) - ((1-R) × γ)
where α ≈ γ ≈ 5-10pp per decision
```

A task with R=0.80 → net benefit ≈ +30pp to +60pp  
A task with R=0.20 → net cost ≈ -30pp to -60pp

---

## 5. What We Don't Know (Open Questions)

1. **Combination effects**: Does L4 nudge + L3 skill outperform either alone? (Proposed: EXP-025)
2. **L6 minimal gate**: What's the simplest materialization gate that still works? How much self-commitment is enough?
3. **Cross-scenario generalization**: Environmental nudges tested on 1 scenario. Do they generalize?
4. **Cadence skill boundaries**: H-059 proposes cadence skills achieve U ≈ 0.4-0.6. What's the full range of cadence-amenable behaviors?
5. **Long-term persistence**: H-053 suggests workflow adoption decays in ~7 days. Do nudges decay too?
6. **The R=0.3-0.5 zone**: We have data for high-R and low-R tasks. The middle zone is under-characterized.

---

## 6. Practical Implications for This System

### For Coach (skill design)
- Stop testing judgment skills — 0/20 is conclusive
- Focus on cadence skills: temporal triggers, frequency constraints, materialization prompts
- Environmental nudges (pre-created files) are a zero-cost alternative to skill files

### For Tech-Lead (workflow design)
- Estimate R before building workflows. If R < 0.3, don't build it.
- For judgment scenarios: implement L6 materialization gates, not just phase separation
- The `gated-exploration` workflow pattern is designed for low-R tasks — test it (EXP-012)

### For Optimizer (deployment)
- Monitor H-053 workflow adoption decay — structural enforcement may need periodic reinforcement
- Environmental nudges should be deployed as workspace templates, not skill files

### For Bob (theory)
- The intervention hierarchy is empirically established but theoretically incomplete
- Key gap: why do cadence skills work when other text skills don't? H-059 proposes "temporal constraints bypass judgment" but mechanism is unclear
- The knowledge-action gap needs a formal model connecting to Decision Topology R

---

## Sources

| Source | Key Finding | Confidence |
|--------|------------|------------|
| KE-002 | Text rules: 0/20, one harmful | HIGH (n=20+) |
| KE-006 | Skills targeting reasoning don't change tool-calling | HIGH (controlled) |
| KE-007 | Workflow is only reliable method | HIGH (5 promoted) |
| KE-009 | Negative examples: 0/8 | HIGH (n=8) |
| KE-015 | R predicts workflow effectiveness (ρ=0.95) | HIGH (multi-experiment) |
| KE-017 | Cadence skill breaks 0/20 barrier | MEDIUM (n=3, single scenario) |
| KE-018 | Environmental nudge matches text skill | MEDIUM (n=3, single scenario) |
| KE-019 | Sycophancy needs L6 materialization gate | MEDIUM-HIGH (n=2, consistent) |
| KE-021 | Skills cannot override strong model defaults (EXP-032: 0/15 judgment runs) | HIGH (n=20+ cumulative) |
| H-041 | Decision Topology theory | Strong (8+ sources) |
| H-043 | Knowledge Utilization Bottleneck | Proposed (updated by EXP-022) |
| H-059 | Cadence skill effectiveness | Empirically Supported |
| SYNTH-001 | Decision Topology unified theory | 11 validations |
| SkillsBench (ext) | AI skills -1.3pp, top human +16.2pp | External (Stanford/CMU/Berkeley) |
| DD-528 (ext) | SEVerA: formal constraints improve performance (Qwen3-8B > Claude 4.5) | External (UIUC, formal proof) |
