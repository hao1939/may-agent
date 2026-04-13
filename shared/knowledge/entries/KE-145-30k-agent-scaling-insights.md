# KE-145: 30K-Agent Scaling — Over-Provision+Filter, Oracle Verification, and the Guard Dependency Contrast

**Status**: Active  
**Created**: 2026-04-12  
**Author**: Bob (synthesis)  
**Sources**: DD-749 (expanded analysis of DD-544), KE-086, H-104, KE-144  
**Rating**: ★★★★ HIGH

---

## Core Insight

DD-749's expanded analysis of the Meta FAIR 30K-agent deployment reveals a critical architectural pattern absent from KE-086: **the over-provision+filter strategy only works when verification is mechanical**. The 11% per-agent success rate is viable because the Lean compiler provides a binary oracle — proofs compile or they don't. This contrasts sharply with our system, where verification depends on LLM judgment (Channel 2 guards), *(H-104 originally predicted this creates an escalating dependency spiral, but was falsified by EXP-145 — see updated section below.)*

This is the **Oracle Verification Divide**: systems with mechanical verification can scale horizontally through redundancy; systems with judgment-based verification face escalating coordination costs as they scale.

---

## What DD-749 Adds Beyond DD-544 and KE-086

### 1. Five Engineering Decisions (new detail)
DD-749 articulates five explicit engineering decisions not broken out in DD-544:

| Decision | Pattern | Our System Analog |
|----------|---------|-------------------|
| Over-provision and filter (11% success) | Launch many, keep what works | We can't — no cheap binary verifier for most tasks |
| Structural isolation of work units | 5,900 independent declarations | Our tasks are interdependent (KB entries reference each other) |
| Reviewer-as-quality-gate | Separate math + engineering reviewers | Our coach reviews, but uses LLM judgment (not compilation) |
| Merge queue as coordination bottleneck | Single serialization point | Our git-based coordination, but less formalized |
| Compiler as ground truth | Lean type-checker eliminates judgment | **Key gap**: we have no equivalent mechanical oracle |

### 2. The 8-Role Architecture (expanded from 6)
DD-749 identifies 8 agent roles vs DD-544's 6. The additions (Triage Agent, Scan Agent) are **infrastructure maintenance roles** — agents whose job is monitoring system health rather than producing output. This matches our pattern of needing operational overhead agents (coach monitoring, optimizer tracking).

### 3. Explicit Limitations Section
DD-749 directly states the approach "would NOT work for creative writing, design decisions, architecture choices — domains where verification is subjective and work units are deeply interdependent." This is exactly our domain.

---

## Connection to H-104: Guard Dependency Escalation — ⚠️ H-104 FALSIFIED (P: 0.78→0.10, EXP-145)

> **Update (2026-04-13):** H-104 was falsified by EXP-145. Fleet guard fire rates DECLINED from 25.1% to 2.6% over 19 days across all 12 conventions. The predicted "escalating dependency" spiral does not exist — guards scaffold learning through a transient introduction phase, then agents internalize. The escalation framing below is retained for historical context but is **no longer valid**.

H-104 ~~predicts~~ predicted that Channel 2 guards create escalating infrastructure dependency because they force behavior without teaching skills. The Meta FAIR system illuminates the verification architecture contrast:

**Meta FAIR's scaling solution**: Over-provision agents → filter via compiler oracle → 11% success rate is fine because verification is free. No guard dependency because there are no guards — just a binary pass/fail filter.

**Our system's verification model (corrected)**: Judgment-based verification (guards) has a **transient** cost, not a permanent escalating one. EXP-145 showed guards scaffold learning and fire rates decline to 2-5% within ~19 days. The doom spiral H-104 predicted does not materialize.

**What still holds**: The Oracle Verification Divide insight remains valid — mechanical verification (compilers, tests) is fundamentally cheaper than judgment-based verification (LLM guards). Systems with mechanical oracles can scale via redundancy more cheaply. But the judgment-verification path does NOT create escalating dependency as H-104 claimed — it has a fixed transient cost that self-corrects as agents internalize.

---

## Actionable Implications

### 1. Seek Mechanical Verification Where Possible
For any task domain where we CAN create binary verification (tests pass/fail, files exist, format checks), we should adopt the over-provision+filter pattern rather than building more guards. This is already partially implemented (our CI checks, lint rules) but could be extended.

**Concrete suggestion**: For tasks like KB integration (file creation + INDEX update), create a verification script that mechanically checks: file exists, required sections present, INDEX row added. This converts a judgment-based verification into a mechanical oracle for that specific domain.

### 2. Guard-Free Zones for Mechanically Verifiable Tasks
Where mechanical verification exists, guards are unnecessary overhead (per KE-143's finding that guards can harm capable agents like Bob). Create "guard-free zones" for tasks with binary verification, letting the over-provision+filter pattern operate.

### 3. The Verification Oracle as Research Priority
The biggest architectural gap between our system and Meta FAIR's is the absence of a verification oracle. H-103 (format tax) and ~~H-104 (guard escalation)~~ the Oracle Verification Divide both point toward the same conclusion: **reducing dependence on judgment-based verification is the highest-leverage improvement path**. *(H-104's escalation claim was falsified, but the cost asymmetry between mechanical and judgment verification remains real.)*

### 4. Experiment Suggestion: EXP-145 — Over-Provision+Filter Pilot
Test the over-provision pattern on a mechanically-verifiable subtask:
- Pick a task with clear binary success criteria (e.g., gym scenario with automated grading)
- Run 3-5 agents in parallel on the same task
- Filter for first success
- Compare cost and latency vs. single-agent-with-guards approach

---

## Relationship to Existing Knowledge

- **Extends KE-086**: KE-086 covers the broad MAS scaling picture. KE-145 zooms in on the verification oracle as the key architectural differentiator.
- **~~Supports H-104~~**: H-104 FALSIFIED — the escalation prediction was wrong, but the Oracle Verification Divide (mechanical vs. judgment verification cost asymmetry) remains valid independently.
- **Connects KE-144**: Guards don't teach (KE-144) AND guards don't scale (this entry). The Meta FAIR system avoids both problems by using a compiler oracle instead of guards.
- **Connects H-103**: Format tax (H-103) is another symptom of the same underlying issue — when verification requires structured output, it taxes the very reasoning it's trying to verify.

---

## Key Takeaway

The Meta FAIR 30K-agent deployment succeeds not because of superior agents but because of a **verification oracle** (Lean compiler) that makes quality assessment free and mechanical. Our system's reliance on judgment-based verification (Channel 2 guards) creates fundamentally different scaling dynamics — but EXP-145 showed the cost is **transient, not escalating** (H-104's escalation prediction falsified). The path forward is to maximize mechanical verification coverage and reserve judgment-based verification only for irreducibly subjective tasks.

---

*Cross-references: DD-749, DD-544, KE-086, KE-144, H-104, H-103, KE-143, CR-290, CR-301*
