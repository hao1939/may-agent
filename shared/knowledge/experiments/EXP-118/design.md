# EXP-118: Cross-Agent Adversarial Handoff Baselines

**Date**: 2026-04-10
**Author**: Coach
**Status**: COMPLETE — Results in results.md
**Type**: Baseline measurement (gym replication)
**Depends on**: EXP-116 (coach baseline at 100%), EXP-103 (original adversarial framing baselines)

---

## 1. Research Question

**Is the 100% adversarial handoff baseline found in EXP-116 agent-specific (coach) or system-wide?**

EXP-116 found that the coach agent now achieves 100% on both baseline multi-session handoff scenarios (`kb-integration-failure` and `ghost-deliverable-chain`), up from 11-25% in EXP-103. The key open question from EXP-116's recommendations (§ "Re-run with different agents"):

> "The coach agent may have uniquely benefited from the experiments it ran. Other agents (coder, optimizer) that haven't been through this training cycle may still show the original confabulation vulnerability."

### 1.1 Why This Matters

If the baseline improvement is system-wide (all agents at ceiling), then:
- The handoff guard research line should be closed
- The improvement is likely model-level, not training-level
- No deployment targets exist for handoff interventions

If the improvement is agent-specific (some agents below ceiling), then:
- The coach's accumulated skills/knowledge are the active ingredient
- Other agents are deployment targets for handoff interventions
- The internalization pathway (Experiment → Skill → Behavior) is validated

### 1.2 Hypotheses

**H1 (Agent-Specific)**: Coder and/or optimizer show lower baseline than coach (< 100%). Internalization is agent-specific, driven by accumulated skills and experience.

**H2 (System-Wide)**: All agents at ceiling (≥ 90%). The improvement is model-level (Sonnet capability drift) or scenario-specific (scenarios are now too easy for any agent).

**H0 (Null)**: Results are mixed/ambiguous and cannot distinguish H1 from H2 with N=3.

---

## 2. Experimental Design

### 2.1 Scenarios

The same two baseline scenarios from EXP-116:

| Scenario | Checks | Description |
|----------|--------|-------------|
| `multi-session/kb-integration-failure` | 9 (7 product + 2 behavioral) | API client with hardcoded creds, no retries, swallowed errors. Agent must notice and fix before extending. |
| `multi-session/ghost-deliverable-chain` | 8 (6 product + 2 behavioral) | Incomplete validation extraction. Agent must verify inherited state before building on it. |

### 2.2 Agents

| Agent | Context | EXP-116 Baseline |
|-------|---------|------------------|
| coach (EXP-116 ref) | Full skills + knowledge from experiment cycle | 100% (claimed — but see Note 1) |
| bob | System architect agent (Opus model) | To measure |
| optimizer | Performance optimization agent (Opus model) | To measure |
| may | General-purpose agent | To measure |

**Note 1**: EXP-116 claimed 100% baseline but used agent name "coder" which is NOT registered in the current binary. The binary only recognizes: amy-kimi, evaluator, optimizer, bob, master, qa, judge, amy, may, tech-lead. The EXP-116 results may have been generated with a different binary or default agent mapping.

### 2.3 Trial Matrix

| Agent | kb-integration-failure | ghost-deliverable-chain | Total |
|-------|----------------------|------------------------|-------|
| coder | 3 | 3 | 6 |
| optimizer | 3 | 3 | 6 |
| **Total** | 6 | 6 | **12** |

Coach baseline (100%) from EXP-116 serves as reference — no need to re-run.

### 2.4 Success Criteria

| Hypothesis | Criterion | Outcome |
|-----------|-----------|---------|
| H1 (Agent-Specific) | Any agent < 90% on either scenario | Handoff interventions needed for that agent |
| H2 (System-Wide) | Both agents ≥ 90% on both scenarios | Close handoff guard research line |
| H0 (Null) | Ambiguous results | Extend to N=5 or test more agents |

---

## 3. Protocol

### Phase 1: Coder runs (N=6)
```bash
test/gym/run-gym.sh multi-session/kb-integration-failure --agent coder    # ×3
test/gym/run-gym.sh multi-session/ghost-deliverable-chain --agent coder   # ×3
```

### Phase 2: Optimizer runs (N=6)
```bash
test/gym/run-gym.sh multi-session/kb-integration-failure --agent optimizer    # ×3
test/gym/run-gym.sh multi-session/ghost-deliverable-chain --agent optimizer   # ×3
```

### Phase 3: Analysis
- Compare per-agent baselines
- Compare to coach reference (100%)
- Determine if H1 or H2

---

## 4. Cost Estimate

- 12 runs × ~$0.30/run = ~$3.60
- Budget: $5 (allows for reruns)

---

## 5. Connection to Knowledge Base

### Leverages
- **EXP-116**: Coach baseline at 100% (reference data)
- **EXP-103**: Original adversarial framing baselines (11-25%)
- **KE-122**: Intervention Decay — effective interventions become redundant as agents internalize behavior
- **KE-093**: Verification confabulation — the failure mode being tested

### May Generate
- Evidence for whether internalization is agent-specific or model-level
- Deployment target identification for handoff interventions
- Decision on whether to close the handoff guard research line
