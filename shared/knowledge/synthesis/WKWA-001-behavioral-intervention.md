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

We've tested eight distinct intervention mechanisms. They form a hierarchy — not of strength, but of *applicability*:

| Level | Mechanism | Works For | Evidence | Effect Size |
|-------|-----------|-----------|----------|-------------|
| L1 | SOUL.md / text rules | **Nothing** (judgment) | 0/20 experiments | 0% (one harmful) |
| L2 | Negative examples (LESSONS.md) | **Nothing** | 0/8 experiments (KE-009) | 0% |
| L3a | Text skill injection | **Cadence behaviors only** | 1/21 experiments (EXP-022: 0%→67%) | +29pp (cadence), 0% (judgment) |
| **L3b** | **Few-shot worked example** | **Judgment + process + validation** | **18/18 matched experiments** | **0→100% (matched)** |
| L4 | Environmental nudge | **Process behaviors** | EXP-023: 52%→81% | +29pp |
| L4b | Forced externalization | **Judgment (analysis quality)** | EXP-092: +55pp median | +55pp |
| L5 | Workflow enforcement | **Structured/procedural + temporal** | 5 promoted, R>0.5 tasks | +14pp to +100pp |
| L6 | Strict workflow + materialization gate | **Judgment/sycophancy** | EXP-024: 0%→100% | +100pp |

> **⚠️ UPDATE (2026-04-09)**: L3b (few-shot) is the breakthrough finding from EXP-084–094. Domain-matched worked examples achieve L5/L6 effectiveness (100%) for judgment and process skills with zero infrastructure overhead. See **WKWA-006** for the complete analysis, including three hard boundaries (temporal discipline, domain proximity, execution crowding). L3b does NOT work for temporal sequencing habits — use L5 for those.

### Key Distinctions

**L1-L2 (text injection)**: Zero effect on judgment. The agent reads the instruction, may even reference it, but doesn't change its behavior. This is the most replicated finding in our research.

**L3 (skill files)**: Broke the 0/20 barrier — but ONLY for cadence rules (when/how-often behaviors like "write findings every 6 calls"). Judgment skills remain 0/20. Cadence skills work because they specify **temporal triggers** that bypass judgment entirely.

**L3b (few-shot worked examples)**: The second breakthrough — 18/18 (100%) on domain-matched judgment and process skills. Unlike L3a text skills, which add declarative knowledge, L3b adds **procedural knowledge** via worked examples that demonstrate the full reasoning chain. The agent extracts the abstract pattern and applies it to new situations. See WKWA-006 for comprehensive analysis.

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
│  └─ YES → L3a Cadence skill (H-059) or L4 Nudge (KE-018) ✅
│
├─ Is it a judgment call? ("don't follow harmful requests", "flag conflicts")
│  └─ YES → L3b Few-shot worked example ✅ (WKWA-006)
│     ├─ Baseline 0%? → Domain-matched example REQUIRED
│     ├─ Baseline 30-70%? → Cross-domain example may suffice
│     └─ Workaround available & easier? → L6 / M3 structural block needed
│
├─ Is it a process step? ("check prerequisites first", "reproduce before fixing")
│  └─ YES → L3b Few-shot worked example ✅ (WKWA-006) OR L5 Workflow
│     └─ Few-shot is cheaper; use L5 if few-shot doesn't generalize
│
├─ Is it a temporal sequencing habit? ("read file after writing it")
│  └─ YES → L5 Workflow enforcement ✅ (few-shot FAILS here)
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

> **Note**: Several items from the original open questions have been answered by EXP-084–094. See updated status.

1. ~~**Combination effects**: Does L4 nudge + L3 skill outperform either alone?~~ → **PARTIALLY ANSWERED**: L3b few-shot + L2.5 checklist shows synergy (EXP-089: 67% vs 33% alone). Further combinations untested.
2. **L6 minimal gate**: What's the simplest materialization gate that still works? How much self-commitment is enough?
3. ~~**Cross-scenario generalization**: Environmental nudges tested on 1 scenario. Do they generalize?~~ → **ANSWERED for few-shot**: Cross-domain few-shot works for moderate difficulty (67%) but fails on hard scenarios (0%). See WKWA-006 §4.2.
4. ~~**Cadence skill boundaries**: H-059 proposes cadence skills achieve U ≈ 0.4-0.6. What's the full range of cadence-amenable behaviors?~~ → **SUPERSEDED**: Few-shot (L3b) obsoletes most cadence skill use cases. Cadence skills only relevant where temporal triggers are the sole mechanism.
5. **Long-term persistence**: H-053 suggests workflow adoption decays in ~7 days. Do nudges and few-shot examples decay too?
6. **The R=0.3-0.5 zone**: We have data for high-R and low-R tasks. The middle zone is under-characterized.
7. **NEW: Multi-example injection**: Does providing 2-3 few-shot examples improve over 1, or does it crowd execution? (WKWA-006 §10)
8. **NEW: Automated example generation**: Can domain-matched examples be auto-generated from production failure logs?

---

## 6. Practical Implications for This System

### For Coach (skill design)
- ~~Stop testing judgment skills — 0/20 is conclusive~~ → **REVISED**: Few-shot worked examples now work for judgment. Write domain-matched examples instead of text rules.
- Focus on **writing few-shot worked examples** for every known judgment/process failure mode
- For cadence skills: temporal triggers, frequency constraints, materialization prompts remain valid for L3a
- Environmental nudges (pre-created files) are a zero-cost alternative to skill files for process behaviors
- **See WKWA-006 §6** for the design guide on writing effective few-shot skills

### For Tech-Lead (workflow design)
- Estimate R before building workflows. If R < 0.3, don't build it.
- For judgment scenarios: implement L6 materialization gates, not just phase separation
- The `gated-exploration` workflow pattern is designed for low-R tasks — test it (EXP-012)

### For Optimizer (deployment)
- Monitor H-053 workflow adoption decay — structural enforcement may need periodic reinforcement
- Environmental nudges should be deployed as workspace templates, not skill files

### For Bob (theory)
- The intervention hierarchy is empirically established and now includes L3b few-shot
- Key resolved question: why do few-shot examples work when text rules don't? **Answer**: Few-shot adds procedural knowledge (execution sequences), while text rules add only declarative knowledge (which the agent already has). See WKWA-006 §3.
- ~~Key gap: why do cadence skills work when other text skills don't?~~ → Cadence skills specify temporal triggers that bypass judgment (H-059); few-shot examples bypass the declarative-procedural gap entirely
- Next priority: map the full boundary between few-shot-amenable and workflow-requiring behaviors

---

## Sources

| Source | Key Finding | Confidence |
|--------|------------|------------|
| KE-002 | Text rules: 0/20, one harmful | HIGH (n=20+) |
| KE-006 | Skills targeting reasoning don't change tool-calling | HIGH (controlled) |
| KE-007 | Workflow is only reliable method (pre-few-shot) | HIGH (5 promoted) |
| KE-009 | Negative examples: 0/8 | HIGH (n=8) |
| KE-015 | R predicts workflow effectiveness (ρ=0.95) | HIGH (multi-experiment) |
| KE-017 | Cadence skill breaks 0/20 barrier | MEDIUM (n=3, single scenario) |
| KE-018 | Environmental nudge matches text skill | MEDIUM (n=3, single scenario) |
| KE-019 | Sycophancy needs L6 materialization gate | MEDIUM-HIGH (n=2, consistent) |
| KE-021 | Skills cannot override strong model defaults (EXP-032: 0/15 judgment runs) | HIGH (n=20+ cumulative) |
| **KE-059** | **Few-shot breaks text-rule binary** | **HIGH (5 experiments)** |
| **KE-060** | **Unified taxonomy — three mechanisms** | **HIGH (40+ experiments)** |
| **KE-061** | **0→100% on two judgment skills** | **HIGH (Fisher p=0.05)** |
| **KE-064** | **Execution crowding from chained externalization** | **HIGH (N=19)** |
| **KE-065** | **Comprehensive few-shot findings (18/18 matched)** | **HIGH (synthesis of 5 exp.)** |
| H-041 | Decision Topology theory | Strong (8+ sources) |
| H-043 | Knowledge Utilization Bottleneck | Proposed (updated by EXP-022) |
| H-059 | Cadence skill effectiveness | Empirically Supported |
| **H-091** | **Few-shot delivery mechanism** | **P(H) = 0.93** |
| SYNTH-001 | Decision Topology unified theory | 11 validations |
| **WKWA-006** | **Full few-shot synthesis** | **Synthesis (11 experiments)** |
| SkillsBench (ext) | AI skills -1.3pp, top human +16.2pp | External (Stanford/CMU/Berkeley) |
| DD-528 (ext) | SEVerA: formal constraints improve performance (Qwen3-8B > Claude 4.5) | External (UIUC, formal proof) |
