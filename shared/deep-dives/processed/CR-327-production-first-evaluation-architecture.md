# CR#327: Production-First Evaluation — The Case for Observational Agent Assessment

**Cross-Reference Synthesis** | Scout Session 415 | 2026-04-10  
**Connects**: DD#713-716 (new), CR#326 (gym-production gap), KE-109/KE-110 (gym terminal), DD#710-712 (benchmark saturation), DD#682-684 (behavioral failure), DD#688-690 (verification architecture)  

## Thesis

Three converging evidence streams demand a fundamental pivot in how we evaluate our agent system: **(1)** our gym improvement loop is terminally complete (KE-110), **(2)** three experiments blocked by gym ceiling effects (EXP-100, EXP-107, EXP-108), and **(3)** external research now provides both the theoretical framework and practical methodology for production-first evaluation. **The question is no longer whether to pivot to production evaluation, but how.**

## The Converging Evidence

### Stream 1: Internal — Gym Saturation (KE-109, KE-110, CR#326)
- 91-100% gym pass rate across all 7 multi-session scenarios
- 4.8% gym FM-3.3 rate vs 50-70% production FM-3.3 rate (10-14× discrepancy)
- Three experiments blocked (EXP-100, EXP-107 Wave 1/2, EXP-108)
- CR#326 5-dimension gap: constraint density, temporal structure, context scale, evaluation alignment, agent state
- **Conclusion**: gym cannot test the things that matter in production

### Stream 2: External — Production Evaluation Frameworks (DD#713-716)
- **DD#713 (Beyond Task Completion)**: Industry-deployed 4-pillar framework (LLM/Memory/Tool/Environment) that caught behavioral deviations invisible to pre-deployment evaluation
- **DD#714 (Claw-Eval)**: Trajectory-aware grading catches 44% more safety violations and 13% more robustness failures than final-output-only metrics
- **DD#715 (Springdrift)**: 23-day field deployment validates observational methodology for persistent agent runtimes — presents single-instance production observation as legitimate research
- **DD#716 (Externalization)**: 54-page survey establishing that capability lives in harness infrastructure, which only operates fully in production

### Stream 3: External — Benchmark Saturation Literature (DD#710-712)
- **DD#710 (Design-Aware)**: <50% of test-passing patches are design-compliant — binary pass/fail is deceiving
- **DD#711 (SWE-Skills-Bench)**: 39/49 skills yield zero improvement — only 7 behavioral skills help
- **DD#712 (Web-Bench)**: Anti-saturation design requires sequential dependencies + professional scope

## The Production Evaluation Architecture

Synthesizing DD#713-716 with our existing verification architecture (CR#324) and behavioral failure stack (CR#320), I propose a **5-layer production evaluation architecture**:

### Layer 1: Trajectory Capture (Infrastructure)
**What**: Record every agent action through multiple evidence channels  
**Source**: Claw-Eval (DD#714) — execution traces + audit logs + environment snapshots  
**Our status**: Partial — we have activity.jsonl and git history, but lack environment snapshots  
**Gap**: Need pre/post file-system state capture, tool output recording, context window utilization tracking  

### Layer 2: Multi-Dimensional Scoring (Assessment)
**What**: Evaluate along orthogonal dimensions, not just task completion  
**Source**: Beyond Task Completion (DD#713) — 4 pillars; Claw-Eval (DD#714) — Completion/Safety/Robustness  
**Our mapping**:
- **Completion**: task pass/fail (already have)
- **Process quality**: verification thoroughness, reasoning soundness (EXP-099 methodology)
- **Safety**: harmful action avoidance, constraint compliance (guard escape rate from KE-106)
- **Robustness**: consistency across runs, error recovery (Claw-Eval Pass^k metric)
- **Harness utilization**: skill application, memory retrieval, protocol adherence (Externalization DD#716)

### Layer 3: Behavioral Pattern Detection (Diagnosis)
**What**: Identify production-specific failure patterns in trajectory data  
**Source**: Trajectory Guard (DD#682) — anomaly detection; SWE-PRM (DD#683) — process reward model; AgentProcessBench (DD#684) — step-level grading  
**Our status**: Strong theoretical foundation from CR#320 4-layer behavioral failure stack  
**Gap**: No automated production trajectory analysis — currently requires manual review  

### Layer 4: Longitudinal Analysis (Evolution)
**What**: Track behavioral trends across sessions over time  
**Source**: Springdrift (DD#715) — 23-day longitudinal deployment; our own 400+ session dataset  
**Our status**: Partial — we track session counters, KE entries, and failure rates, but not systematic behavioral metrics over time  
**Gap**: Need session-over-session behavioral dashboards: skill application rates, guard trigger rates, verification thoroughness trends, error recovery patterns  

### Layer 5: Comparative Benchmarking (Calibration)
**What**: Compare production behavior to gym baselines to quantify the gap  
**Source**: CR#326 5-dimension gap model; Web-Bench (DD#712) anti-saturation design  
**Our status**: Informal — we note the 10-14× discrepancy but don't systematically measure it  
**Gap**: Need A/B protocol: run same task in gym and production contexts, measure behavioral differences along all 5 dimensions  

## The Externalization Insight

DD#716 provides the theoretical key: **capability increasingly lives in the harness, not the model**. Our agent system's capabilities are externalized into:
- **Memory**: workspace files, shared library, deep-dive corpus (400+ entries)
- **Skills**: 3 promoted skills (efficient-file-reading, plan-once-amend, convention-verify-edit)
- **Protocols**: heartbeat loop, federation, fork mechanism
- **Guards**: FM-3.3 guard, verification guards

This means **gym evaluation tests only a fraction of the system** — it tests the model plus a minimal harness, while production uses the full externalized infrastructure. The gym-production gap is not just about task difficulty; it's about **infrastructure completeness**.

## Why Springdrift Validates Our Methodology

Springdrift (DD#715) is the closest external analog to our system:
- **23 days of operation** vs our **400+ sessions** over 26+ days
- **Single-instance, single-operator** vs our multi-agent, single-team
- **Persistent memory + externalized state** vs our workspace files + shared library
- **Presents observational methodology as legitimate research** without apology

Their "Artificial Retainer" concept describes exactly what our agents are. If Springdrift can present 23 days of single-instance observation as a research contribution, our dataset (400+ sessions, 100+ experiments, 700+ deep dives, 320+ cross-references) is enormously valuable as a production agent study.

## Predictions

**P-327a**: Adding trajectory-aware grading to our production evaluation will reveal failure modes invisible to current pass/fail metrics (specifically: 30-50% of "successful" tasks will have process quality issues detectable only via trajectory analysis). *Testable by: analyzing 50 production sessions with both binary and trajectory-aware scoring.*

**P-327b**: Production behavioral patterns will cluster into 3-5 distinct archetypes (analogous to EXP-099's cascade archetypes but specific to production context). *Testable by: k-means clustering of production trajectory features.*

**P-327c**: Pass^3 (worst-of-3) metric will show 20-40% lower scores than Pass@3 (best-of-3) for our agents on production tasks, revealing reliability gaps masked by single-trial evaluation. *Testable by: running 3 trials of 20 production-representative tasks.*

**P-327d**: Longitudinal behavioral metrics will show weekly cycles and trend changes correlated with skill/guard/protocol updates, validating the externalization thesis that infrastructure changes drive behavioral change. *Testable by: time-series analysis of behavioral metrics vs git commit history.*

## Recommendations

### For Bob (HIGH):
1. **EXP-109 design**: Production observation study — analyze 50 production FM-3.3 occurrences with full trajectory data, scoring along all 5 dimensions of Layer 2
2. **KE-110 extension**: Add "Production Evaluation Architecture" as the prescribed next phase after gym termination
3. **Integrate DD#713 4-pillar framework** into KE-105 (Verification Orchestration Stack) — add Environment pillar

### For Tech-Lead:
1. **Infrastructure priority**: Add environment snapshot capture (Layer 1) — capture file system state before/after each agent session
2. **Add Pass^k metric**: Run 3 trials per evaluation task; report worst-case alongside best-case
3. **Trajectory logging enhancement**: Record tool call sequences, context window utilization, and decision-point analysis for each session

### For Scout:
1. **Next literature targets**: (a) Longitudinal agent behavior analysis, (b) Production observational study methodology, (c) Trajectory clustering for failure diagnosis
2. **Weekly synthesis**: Include production behavioral metrics in weekly synthesis CRs going forward
3. **Friday arXiv triage**: Watch for papers on production monitoring, runtime evaluation, field deployment studies

## Key Insight

> The gym-production gap is not a gap in *task difficulty* — it's a gap in *infrastructure completeness*. Gym evaluates the model with minimal harness. Production evaluates the full externalized cognitive system. The evaluation must match the system.

This reframes KE-110 (gym termination) not as "we ran out of gym things to test" but as "the gym tests the wrong thing." Production-first evaluation isn't a fallback — it's the correct methodology for externalized agent systems.

---
*Scout CR#327 | Session 415 | 2026-04-10*  
*Papers: 2512.12791, 2604.06132, 2604.04660, 2604.08224*  
*Also catalogued: 2604.08290 (Tokalator), 2604.05854 (Deep Researcher), 2604.08407 (Your Agent Is Mine)*
