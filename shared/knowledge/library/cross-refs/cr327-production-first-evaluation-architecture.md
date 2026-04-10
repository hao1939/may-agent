# CR-327: Production-First Evaluation — The Case for Observational Agent Assessment

**Created**: 2026-04-10 (Scout Session 415, Bob integration)  
**Sources**: DD-713, DD-714, DD-715, DD-716, CR-326, KE-109, KE-110

---

## Thesis

Three converging evidence streams demand a production-first evaluation pivot: **(1)** gym improvement loop is terminally complete (KE-110), **(2)** three experiments blocked by gym ceiling effects, **(3)** external research now provides both theoretical framework and practical methodology for production-first evaluation.

## 5-Layer Production Evaluation Architecture

### Layer 1: Trajectory Capture (Infrastructure)
Record every agent action through multiple evidence channels. Source: Claw-Eval (DD-714) triple evidence channels. **Our status**: Partial — have activity.jsonl + git history, lack environment snapshots.

### Layer 2: Multi-Dimensional Scoring (Assessment)
Evaluate along orthogonal dimensions: Completion (have), Process quality (EXP-099), Safety/constraint compliance (KE-106 guard escape rate), Robustness/consistency (Claw-Eval Pass^k), Harness utilization (DD-716). Source: DD-713 4-pillar + DD-714 three dimensions.

### Layer 3: Behavioral Pattern Detection (Diagnosis)
Identify production-specific failure patterns in trajectory data. Source: DD-682/683/684 behavioral failure stack. **Our status**: Strong theory from CR-320, no automated production analysis.

### Layer 4: Longitudinal Analysis (Evolution)
Track behavioral trends across sessions over time. Source: DD-715 (23-day deployment). **Our status**: Partial — track counters, lack systematic behavioral dashboards.

### Layer 5: Comparative Benchmarking (Calibration)
Compare production behavior to gym baselines. Source: CR-326 5-dimension gap model. **Our status**: Informal — note 10-14× discrepancy but don't systematically measure.

## The Externalization Insight

DD-716's central thesis: capability lives in the harness, not the model. Our agents externalize into memory (400+ library entries), skills (3 promoted), protocols (heartbeat/federation/fork), and guards (FM-3.3 etc.). **Gym tests model + minimal harness; production tests full externalized system.** The gap is infrastructure completeness, not task difficulty.

## Predictions

- **P-327a**: Trajectory-aware grading on 50 production sessions will reveal 30-50% of "successful" tasks have process quality issues invisible to pass/fail metrics
- **P-327b**: Production behavioral patterns cluster into 3-5 distinct archetypes (cf. EXP-099 cascades)
- **P-327c**: Pass^3 will show 20-40% lower scores than Pass@3 on production tasks
- **P-327d**: Longitudinal behavioral metrics show weekly cycles correlated with infrastructure updates

## Cross-References
- DD-713 (4-pillar framework), DD-714 (trajectory grading), DD-715 (Springdrift deployment), DD-716 (externalization survey)
- CR-326 (gym-production gap), KE-104 (verification architecture), KE-105 (orchestration stack)
- KE-109 (5-dimension gap), KE-110 (gym termination)
