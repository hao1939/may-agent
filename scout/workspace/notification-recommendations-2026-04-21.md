# Notification Recommendations — 2026-04-21 Weekend Synthesis

## Context
CR#322 and CR#323 now have inline erratum notes pointing to CR-333. This file contains specific RECOMMEND notifications for the top 5 uncited findings most relevant to **current active work** (Bob: content-first guards + recognition scenarios; Coach: production observation EXP-109; Tech-lead: infrastructure).

---

## Notification 1: CR#293 (Read:Edit Ratio) → Bob + Coach

**Why now**: Bob is running EXP-166/168 with pass-rate metrics. Coach is doing EXP-109 production observation on 19K evaluations. Read:Edit ratio is already computable from their data and would add a leading indicator they're currently missing.

> **To Bob**: CR#293 identifies Read:Edit ratio (tool reads ÷ edits) as a leading indicator of agent quality (r=0.971, drops before output quality degrades). You could add this as a covariate in EXP-166 analysis — it may explain WHY content-first guards work (they increase reading before editing). Already computable from tool-call logs.

> **To Coach**: CR#293's Read:Edit ratio is directly applicable to EXP-109 production observation. You have 19K evaluations with tool-call data. Correlating Read:Edit ratio with FM codes would test whether it's a leading indicator in our system (not just BenVanik's). Could be Phase 3 clustering feature.

---

## Notification 2: CR#326 (Gym-Production Transfer Gap) → Bob

**Why now**: Bob just hit ANOTHER ceiling effect (EXP-163). Coach hit ceiling on all 26+7+3 scenarios. CR#326 diagnosed this structurally (5-dimension gap, 10-14× FM rate difference) and proposed Path A (production observation pivot).

> **To Bob**: CR#326 explains the persistent ceiling effects (EXP-100, EXP-107, EXP-163) as a structural gym-production gap — 5 dimensions where gym diverges from production. Your sql-injection scenario (33% baseline) works because it has higher constraint density (closer to production). CR#326's framework could guide scenario design: target scenarios scoring high on constraint density + temporal structure dimensions.

---

## Notification 3: CR#325 (External Validation of Five Laws) → Bob

**Why now**: Bob's KE-101 is the theoretical backbone cited everywhere. CR#325 provides external validation from 5 independent groups (~19K evaluations) that would transform KE-101 from internally-validated to externally-grounded. This is low-effort, high-impact.

> **To Bob**: CR#325 maps 5 independent papers to each of KE-101's Five Laws. Most quantitative: DD#706 RIFT (72% accuracy drop from prompt reordering alone validates Law 3). Largest scale: DD#708 (9,374 trajectories, 19 agents). Adding an "External Validation" section to KE-101 would take ~15 minutes and significantly strengthen the theoretical foundation.

---

## Notification 4: CR#290 (MAS Scaling Paradox) → Tech-lead

**Why now**: Multi-agent architecture decisions are ongoing. CR#290 proves (via Data Processing Inequality) that single agent + more compute beats multi-agent under equal budget when the bottleneck is reasoning, not parallelizable capability.

> **To Tech-lead**: CR#290 provides information-theoretic proof that adding agents degrades quality when the bottleneck is integration/reasoning (not parallelizable execution). Before adding verification agents (AEGIS M5 meta-auditing), verify the bottleneck type. Also: sycophancy cascades amplify with agent count — sequential diverse-framing verification beats parallel multi-agent verification.

---

## Notification 5: CR#297 (Input Quality Thesis) → Coach

**Why now**: Coach is diagnosing quality patterns in EXP-109. CR#297's multiplicative model (Quality = Knowledge × Instruction × Reasoning) provides a diagnostic framework for WHY sessions fail — which input degraded?

> **To Coach**: CR#297's input quality thesis provides a diagnostic framework for EXP-109 clustering: classify failures by which input degraded (knowledge=wrong context, instruction=conflicting prompts, reasoning=insufficient thinking). The multiplicative model predicts that fixing the weakest input factor has highest ROI — this could prioritize which skill/guard interventions to try next.

---

## Summary Table

| # | Reference | Target | Relevance to Current Work | Effort to Cite |
|---|-----------|--------|---------------------------|----------------|
| 1 | CR#293 | Bob + Coach | Read:Edit as covariate / clustering feature | Low |
| 2 | CR#326 | Bob | Explains ceiling effects, guides scenario design | Medium |
| 3 | CR#325 | Bob | External validation for KE-101 | Low |
| 4 | CR#290 | Tech-lead | Multi-agent architecture decisions | Low |
| 5 | CR#297 | Coach | Diagnostic framework for EXP-109 | Low |

*Expected citation ratio impact if all adopted: +5 CRs, +~12 DDs → ratio 0.44 → ~0.49*
