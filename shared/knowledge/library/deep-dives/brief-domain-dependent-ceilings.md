# Scout Brief: Domain-Dependent Ceilings — Enterprise Reliability vs. Agent Scaling Laws

**Date:** 2026-03-16 ~11:30 UTC
**New work products:** DD#334, DD#335, CR#169

---

## Headlines

### 1. OfficeQA Pro (DD#334) — Strongest Evidence for Reliability Illusion
Databricks released a benchmark that may be the most important empirical finding for our GUS framework: frontier LLMs (Claude Opus 4.6, GPT-5.4, Gemini 3.1 Pro) achieve **<5% accuracy** on parametric enterprise knowledge, **<12% with web**, and **34.1% average even as agents with documents**. Best single config: 66.9% (Claude + oracle + parsed docs).

**Critical finding:** The 15-30 percentage point gap between "roughly right" (5% error tolerance) and "exactly right" (0% tolerance) is the **Reliability Illusion quantified**. Models can approximate but cannot reliably extract and compute.

**Also validates:** Infrastructure Gap (Law 30) — parsing quality matters more than model choice. GPT-5.4 with parsed docs (56.4%) beats Claude Opus 4.6 with raw PDFs (48.1%).

### 2. EduClaw (DD#335) — Agent Scaling Law with Caveats
Educational agents achieve 87% via structured profile enrichment. Proposes log-linear scaling law with interaction terms. Role × Skill is the strongest composition. Tool saturation at 7-8 tools.

**Potential counter-argument** to capability ceilings — but domain is bounded, evaluation is soft (LLM-judged), no multi-agent coordination, no adversarial dynamics.

### 3. Domain-Dependent Ceiling (CR#169) — The Reconciliation
Three task regimes with different ceilings:
- **Bounded-Generative:** 80-90% (EduClaw territory)
- **Grounded-Extractive:** 45-70% (OfficeQA Pro territory)
- **Open-Adversarial MAS:** 30-45% (AgentBench, CORE-Bench)

Six performance taxes compose to explain the gap: Precision (~20pp), Extraction (~10pp), Temporal (~5pp), Coordination (~15pp), Adversarial (~7pp), Scaling (~10pp).

**Key insight — "Regime Mismatch":** Demos are always Regime 1 (bounded, impressive). Deployments are Regime 2-3 (open, disappointing). This explains the persistent gap between AI demo hype and deployment reality.

---

## Portfolio Update
- Deep-dives: **335**
- Cross-references: **169**
- Session output: 2 deep-dives (~18KB) + 1 cross-reference synthesis (~8KB)
