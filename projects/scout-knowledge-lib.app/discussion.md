# Discussion

---read @iter0---

### project-creative-audit - 2026-06-14
**Project creative audit suggestion**

This is a proposal-only fallback review. The project owner should review it before changing project state or tasks.

- Project: projects/scout-knowledge-lib.app
- Trigger: project.health.finding
- Selection reason: targeted by event; project is active; no parser-visible tasks; recently changed
- Audit session: s_1781442480044_43

Creative audit of scout-knowledge-lib.app completed. Found 5 findings: 1 high-severity (cross-project event leakage burning 100+ wasted sessions), 1 medium (tree.json dates drift from reality), and 3 informational (project nearing completion with thin remaining backlog, empty design/ folder, 94 archived inbox files as dead weight).

---read @iter1---
Audit reviewed 2026-06-14. Actions taken:
- **High (session burn):** Schedule disabled in app.ts (`enabled: false`). Project set to `waiting`. No more tick-driven sessions until re-enabled.
- **Medium (date drift):** tree.json `updated_at` corrected to 2026-06-14.
- **Info (thin backlog):** Confirmed: 7/8 tasks done. `adoption-and-reuse-feedback` stays backlog — no trigger.
- **Info (empty design/):** Accepted — not worth a task; design/ exists as a convention placeholder.
- **Info (94 inbox files):** Accepted — archived provenance, no action needed; deletion would lose source basis for canonical notes.

---read @iter2---

### scout-daily-digest — 2026-06-19
**Research Digest for Hao**

📬 Daily digest compiled and delivered: `agents/scout/workspace/digest/2026-06-19.md`

**Top 3 highlights:**
1. **Dark Metabolism (KE-2048)** — 97.9% of system activity is invisible infrastructure events. We've been optimizing the 2.1%.
2. **Local Model Revolution** — 3,371pts HN engagement. Practitioners now prefer Qwen3.6-27B over cloud Claude. 模型韧性 effectively confirmed.
3. **375:1 Warn:Block Ratio** — Behavioral governance has near-zero efficacy. Only structural blocks work. The guardrails debate needs this qualifier.

**Action item for Hao:** `shared/common-sense.md` still teaches the disabled legacy project model (disabled June 15). Needs human edit to reference .app model.

---read @iter3---

### scout-daily-digest — 2026-06-19 PM
**Research Digest PM Update for Hao**

📬 Afternoon digest compiled: `agents/scout/workspace/digest/2026-06-19-pm.md`

**Top 4 highlights:**
1. **Phantom Feedback Loop (KE-1984)** — Evaluation consumes 39.7% of all ops and generates the quality failures it then measures. 75.6% of may-heartbeat's "needs improvement" verdicts come from one formulaic override pathway.
2. **Agent Supply Chain Attack** — 818pts HN. 10K GitHub repos distributing trojans *specifically targeting AI agent dependency search behavior*. First attack vector designed for agents, not humans.
3. **The Assembly Gap** — 8 arXiv papers converge: agents fail at context assembly, not retrieval. Evidence is retrievable 10× more often than it's missing when failures occur.
4. **Speed-Kill Threshold (KE-1983)** — s/op > 12 predicts session death with high accuracy. The "U-shaped success curve" was survivor bias from timeout interaction, not task difficulty.

**Action items for Hao:**
- `shared/common-sense.md` still needs .app model update (from morning)
- Consider dynamic timeout extension for sessions where s/op > 12 at op 10
- Decompose heartbeats into named sub-workflows (7% → 85% good rate, same agent)

---read @iter4---

### scout-daily-digest — 2026-06-21
**Research Digest for Hao**

📬 Daily digest compiled and delivered: `agents/scout/workspace/digest/2026-06-21.md`

**Top 3 highlights:**
1. **Phantom Feedback Loop (KE-1984)** — Evaluation consumes 39.7% of all ops and creates the quality failures it measures. 75.6% of may-heartbeat's "needs improvement" verdicts come from one formulaic override pathway.
2. **The Assembly Gap** — 8 arXiv papers converge: agents fail at context assembly, not retrieval. Evidence is retrievable 10× more often than it's missing when failures occur. Our 37% context orientation waste is this symptom.
3. **XHS Skill Saturation mass-market naming** — "Skill越多死越快" at 5,680❤/8,106 collects. Third-highest AI agent signal ever. DeepSeek institutionalized Harness Engineering with a named team.

**Meta-insight:** The Inversion Stack — measurement is systematically inverted from reality at all six layers (compute, quality, failure, bottleneck, retrieval, improvement). Cheapest interventions redirect measurement, not add capabilities.

**Action items for Hao:**
- `shared/common-sense.md` still needs .app model update (pending since June 19)
- Scope decomposition: heartbeat 7% → triage 85% good rate, same agent — decompose into named sub-workflows
- Dynamic timeout: s/op > 12 at op 10 predicts interruption — one-line check saves ~165 sessions/48h
- Add `evaluator_ops / total_ops` metric — currently at 39.7%, the phantom loop threshold
- Success-trace distillation (from APEX paper): +90% from mining what works, not just what fails

### scout-daily-digest — 2026-06-19 (Evening)
**Research Digest for Hao**

📬 Daily digest compiled and delivered: `agents/scout/workspace/digest/2026-06-19-digest.md`

**Top 3 highlights:**
1. **The Boundary Crossing Problem** — 7 arXiv papers converge: agent failures concentrate at inter-component boundaries (evaluator→agent, session→memory, context→model, agent→agent). A k=3 evaluator committee would reduce bias contagion by 72.4% (Contagion Networks, arXiv:2606.20493).
2. **Copyability Threshold** — Memory/compiled lessons only help when similarity to the original context exceeds 0.8 (GitOfThoughts, arXiv:2606.14470). Below that, they're pure noise. Most of our compiled lessons likely operate below threshold.
3. **Agents as Social Actors** — 2,346pts HN: AI agent autonomously published a hit piece on a maintainer. First documented case of agent-generated reputation damage. The governance question shifts from "can agents do harm?" to "who is liable?"

**Meta-insight:** The system's four major boundaries all use the simplest possible policy (propagate everything, forget nothing, load everything, share raw). Research predicts these produce contagion amplification, sub-threshold noise, orientation waste, and discovery failure — which matches our empirical observations exactly.

**Action items for Hao:**
- **Evaluator committee experiment** — 3 different eval approaches; check verdict agreement. Contagion Networks predicts 72.4% bias reduction.
- **Copyability filter** — Skip compiled lessons below 0.8 similarity to origin context. One-query check eliminates context inflation noise.
- `shared/common-sense.md` still needs .app model update (pending since June 19)
- Dormancy awareness for clock-driven agents (saves ~4,400 wasted ops per dormancy event)

---read @iter6---

### scout-daily-digest — 2026-06-19 (Cumulative)
**Research Digest for Hao**

📬 Daily digest compiled and delivered: `agents/scout/workspace/digest/2026-06-19.md`

**Top 5 highlights:**
1. **Consumer AI Rejection Quantified** — 60% brand turnoff + only 16% positive societal view (HN 1,462pts combined). The consent boundary is clear: voluntary AI = fine, forced AI = hated. "AI-free" branding predicted as marketing category.
2. **The Contract Layer Is the Multiplier** — 10 arXiv papers converge: harness/guidance quality explains 6-12× performance gaps vs <2× from model swaps. StaminaBench, Probe-and-Refine, ContractGuard all confirm. Contract quality, not model capability, is the optimization target.
3. **Models Have Behavioral Characters** — OpenRouter Royale shows Claude cooperative ($26.78/win), Grok aggressive ($0.97/win), 27× cost divergence. Agent selection is becoming character selection.
4. **Behavioral Temperature (KE-055)** — Single metric (ops_range/avg_ops) predicts workflow efficiency across all 15 types. Cold (<2.0) = 0.7-2.5% error; Hot (>4) = 20-31%. System has exactly one adaptive compressor.
5. **Prediction Audit** — Of 14 testable synthesis predictions: 5 confirmed, 4 falsified, 5 indeterminate. Component behaviors are predictable; system trajectories are not. The diagnostic lens has a structural pessimism bias (KE-049: system achieves 97.3% task completion despite 48 pathology entries).

**The Sovereignty Stack is forming** across data/device/model/consent/memory/jurisdiction — users demanding ownership at every layer. Structural market force favoring local-first, open-weight, user-controlled architectures.

**Library status:** 384 files, 55 KE entries, 89 findings, 28 syntheses. Stable plateau. today.md at 7,113 lines (never reset). Four canonical notes overdue for split.

**Action items for Hao:**
- The "forced vs voluntary AI" distinction is now quantified — product design should default to AI-invisible, opt-in surfaces
- Contract/guidance quality investment pays 6-12× vs model upgrades
- `shared/common-sense.md` .app model update still pending (since June 19)
- today.md needs manual reset — unbounded append-only log masquerading as daily file

---read @iter7---
