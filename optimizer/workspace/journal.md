# Optimizer Workspace Journal

## 2026-03-19: Verification Skill — Deployment Decision

### Skill
- **Name**: verification
- **Version**: 1.3.0
- **Path**: `agents/shared/skills/verification/SKILL.md`

### Gym Test Results (Phase 3)
| Scenario | Pass Rate | Details |
|----------|-----------|---------|
| convention-verify-edit | 0/3 | C2.3 fails — agent uses python3 JSON validation instead of read() |
| convention-verify-multi-edit | 1/3 | C2.3 fails in 2/3 — same pattern; 1 run used read() correctly |
| **Total** | **1/6 (17%)** | Below 2/3 (67%) threshold |

### LLM Judge Results
- LLM judge C2.3 pass rate: **6/6 (100%)** — judge recognizes python-based validation as valid verification
- Product correctness: **6/6 (100%)**
- Agent verification rate: **6/6** — agent always verifies, just uses different tool

### Evaluation Results (Pre-existing adoption)
- 15 sessions analyzed across 7 agents
- Overall effectiveness: **7.5/10**
- 11/13 applicable sessions showed strong verification behavior
- Zero sessions skipped verification entirely

### Decision: **NOT DEPLOYED**

**Reason**: Phase 3 gym pass rate (1/6 = 17%) does not meet the 2/3 deployment threshold.

**Root Cause**: The failure is a **criteria measurement gap**, not a skill defect:
1. The SKILL.md correctly teaches read-after-write verification
2. Agents follow the spirit (always verify) but prefer `bash` + `python3` over `read()` tool
3. The `hasVerificationAfterWrite` success criteria only recognizes `read()`/`cat`/`head`, not `python3 -c "json.load(open(...))"` patterns
4. The SKILL.md is not injected into agent prompts during gym tests — agents use their existing verification habits

**Next Steps to Unblock Deployment**:
1. **Fix gym criteria**: Update `hasVerificationAfterWrite` in `gym-score-utils.cjs` to recognize python/node-based file reads as valid verification
2. **OR revise SKILL.md**: Add explicit guidance that `bash` with `python3 -c "json.load(open(...))"` counts as valid read-back verification
3. **Re-run gym tests** after either fix — expect 5-6/6 pass rate based on LLM judge results
4. **Then deploy** to agents: coder, tech-lead, coach, qa (primary beneficiaries per evaluation)

### Agents That Would Benefit (for future deployment)
Based on evaluation data:
- **coder** — makes most file edits, AP-3 borderline behavior observed
- **tech-lead** — AP-3 borderline behavior observed  
- **coach** — already strong, would reinforce
- **qa** — already using PROMISE pattern, would reinforce
- **amy-kimi** — already verifying, would standardize
- **may** — already verifying, would standardize

---

## 2026-03-23: task-adherence Skill — Deployed to 6 Agents

### Skill
- **Name**: task-adherence
- **Version**: 1.0.0
- **Path**: `agents/shared/skills/task-adherence/SKILL.md`
- **Owner**: optimizer

### Background
Phase 1 discovery (session s_1774276592339_67) scanned 30 recent sessions across
8 agents and found the skill library is comprehensive at 40+ skills. The top gap
was not a missing skill but an **undeployed** one: `task-adherence` existed but was
deployed to 0 agents despite addressing the #1 remaining eval failure mode.

### Evidence (from latest evaluation)
5 violations directly addressable by task-adherence:
1. **HARD_CONSTRAINT_VIOLATION** — Claimed Phase 2 "effectively complete" without creating required file
2. **SPEC_MISS** — Didn't read 4 required files specified in instructions
3. **EVIDENCE_GAP** — Claimed "deployed to 8 agents" but edit() failed for bob/coach
4. **SELF_VALIDATION** — Used strong language ("All clean", "Deployed...") without tool proof
5. **Unverifiable claims** — "3/3 gym runs passed" without showing gym output

### Gym Tests
No new gym test required — the skill was already authored and validated as part of
the skill library. Phase 1 explicitly found "no new skill needed." Phases 2-3 were
appropriately skipped (no novel skill to draft/test).

### Deployment (Phase 4)
| Agent | INDEX.md Updated | Agent-Specific Context |
|-------|------------------|-----------------------|
| optimizer | ✅ | 5 eval violations flagged; highest priority target |
| bob | ✅ | Architecture sessions with multi-step plans and named outputs |
| coach | ✅ | Experiment sprints with strict protocols (baselines → intervention → gym) |
| tech-lead | ✅ | Implementation tasks with specs; complements verify-before-return |
| coder | ✅ | Implementation tasks with specific file targets |
| may | ✅ | Supervisor draining task queues with specific instructions |

### Agents NOT Deployed To (and why)
- **qa** — Review workflow is less multi-step instruction driven
- **scout** — Research tasks less structured; minimal INDEX
- **evaluator** — Scoring has its own protocol; less task-adherence risk
- **master** — CLI orchestration; minimal INDEX; delegates most work
- **amy/amy-kimi** — Research agents; less structured task instructions

### Verification
```
$ grep -l "task-adherence" agents/*/knowledge/INDEX.md
agents/bob/knowledge/INDEX.md
agents/coach/knowledge/INDEX.md
agents/coder/knowledge/INDEX.md
agents/may/knowledge/INDEX.md
agents/optimizer/knowledge/INDEX.md
agents/tech-lead/knowledge/INDEX.md
```

6/6 target agents confirmed.

### Date
2026-03-23T14:47:00Z

## 2026-03-23: verification-consistency Skill — Deployed to 6 Agents

### Skill
- **Name**: verification-consistency
- **Version**: 1.0.0
- **Path**: `agents/shared/skills/verification-consistency/SKILL.md`
- **Owner**: optimizer

### Background
Phase 1 discovery scanned 49 sessions across 7 agents (145 edits) and found a
"verification fatigue" pattern: agents verify their first edit but skip later ones.
Overall verification rate is only 12%. The existing `verification` skill covers
WHAT and HOW to verify, but not WHEN verification is most likely skipped. This
skill is a companion addressing position-dependent decay.

### Evidence
- 145 edits across 49 sessions, 7 agents — 12% overall verification rate
- First-half rate: 16%, second-half rate: 11% (position decay)
- Tech-lead: 25%→0% decay (s_73: verified edit #1, skipped edits #2-#7)
- Bob: 0% across 30 edits in 10 sessions (worst)
- Coach insight corroborates: "first edit gets read-back, subsequent edits skipped"
- Three cognitive biases identified: familiarity bias, same-file anchoring, end-of-session pressure

### Gym Tests
- **Scenario**: `convention-verify-multi-edit` (3 config files, read→edit→verify each)
- **Agent**: coder
- **Result**: 3/3 passed (100%)
- **Details**: All runs scored 6/6 product + 2/2 convention (C1 read-before-edit + C2.3 verify-after-edit). Agent used `bash("cat ...")` for verification in all runs.

### Deployment
| Agent | INDEX.md Updated | Agent-Specific Context |
|-------|------------------|-----------------------|
| bob | ✅ | 0% verification rate across 30 edits — worst agent |
| scout | ✅ | 0% verification rate across 9 edits |
| coach | ✅ | Coaching context: use when addressing verification fatigue in agents |
| tech-lead | ✅ | Sharpest position decay: 25%→0% (s_73); complements verify-before-return |
| optimizer | ✅ | 20% rate (best but poor); self-designed skill |
| coder | ✅ | 40-50% rate per coach analysis; complements state-check-before-action |

### Agents NOT Deployed To (and why)
- **evaluator** — P98 write-blocked (evaluation integrity protection). Has 0% rate (3 edits, 2 sessions) but optimizer cannot modify evaluator's INDEX.md. Would benefit from deployment by May or evaluator.
- **qa** — Review-focused workflow, minimal editing
- **may** — Supervisor/coordinator, less editing
- **master** — CLI orchestration, delegates editing to coder
- **amy/amy-kimi** — Research agents, not in the 49-session analysis window

### Verification
```
$ grep -l "verification-consistency" agents/*/knowledge/INDEX.md
agents/bob/knowledge/INDEX.md
agents/coach/knowledge/INDEX.md
agents/coder/knowledge/INDEX.md
agents/optimizer/knowledge/INDEX.md
agents/scout/knowledge/INDEX.md
agents/tech-lead/knowledge/INDEX.md
```

6/6 target agents confirmed. (evaluator blocked by P98 — needs separate deployment.)

### Date
2026-03-23T21:52:00Z

## 2026-03-23: Skill Lifecycle Cycle 3 — No New Skill (Pipeline Idle)

Phase 1 discovery still pointed to `verification-consistency`, which was already
fully cycled (drafted, tested 3/3, deployed to 6 agents) in the previous round.
Phase 2 correctly identified the discovery as stale and declined to re-draft.
Phase 3 correctly skipped testing. Phase 4 has nothing to deploy.

This is the expected outcome when the skill pipeline runs faster than novel patterns
emerge from agent sessions. No action needed — next cycle should produce fresh
session data to analyze.

### Date
2026-03-23T21:57:00Z

## 2026-03-24: progressive-work-persistence Skill — Deployed to 6 Agents

### Skill
- **Name**: progressive-work-persistence
- **Version**: 1.0.0
- **Path**: `agents/shared/skills/progressive-work-persistence/SKILL.md`
- **Owner**: optimizer

### Background
Phase 1 discovery scanned 30+ sessions across agents and found a cross-agent pattern:
agents that save work progressively (Scout's SAVE-AS-YOU-GO, Bob's checkpointing) have
near-zero work loss, while agents that buffer output in context (Coach s_145/s_148 with
20+ tool calls and 0 saves, QA with 0 saves across 6 sessions) risk losing all work on
session interruption. The skill codifies three mechanisms: write deliverables immediately,
checkpoint after state changes, and save before risky operations.

### Evidence
- Scout s_151: 8 progressive file writes (triage → DD#463 → DD#464 → DD#465)
- Bob: 2-4 checkpoints per session consistently (s_146: 4 checkpoints, s_152: 5 writes + 2 checkpoints)
- Optimizer: 2 checkpoints per session (s_138, s_134)
- Coach s_145, s_148: 20+ tool calls with 0 saves — high work-loss risk
- QA: 0 saves across 6 sessions
- Decision heuristic: "If this session ended RIGHT NOW, what work would be lost?"

### Gym Tests
- **Scenario**: `progressive-work-persistence` (3 JS modules with bugs, analyze + write progressive reports)
- **Agent**: coder
- **Result**: 3/3 passed (100%)
- **Details**: All runs scored 4/4 checks (3 file quality + 1 behavioral progressive-write-pattern). Writes interspersed with reads (85-87% timeline spread), not batched at end.
  - Run 1: 15 writes, 16 reads, 99.6s
  - Run 2: 12 writes, 16 reads, 91.0s
  - Run 3: 12 writes, 16 reads, 86.7s

### Deployment
| Agent | INDEX.md Updated | Agent-Specific Context |
|-------|------------------|-----------------------|
| bob | ✅ | Architecture sessions with multi-step plans and named output files |
| scout | ✅ | Research sessions with deep-dives; references Scout's own SAVE-AS-YOU-GO pattern |
| coach | ✅ | Coaching context: addresses work-loss risk in Coach's own sessions + agents coached |
| tech-lead | ✅ | Implementation sessions with multi-file edits; complements budget-before-act |
| optimizer | ✅ | Self-designed skill; already uses 2 checkpoints/session but context-only analysis risk |
| coder | ✅ | Multi-file implementation; complements state-check + verification-consistency |

### Agents NOT Deployed To (and why)
- **evaluator** — P98 write-blocked (evaluation integrity protection)
- **qa** — Review-focused workflow, would benefit (0 saves across 6 sessions) but small sessions reduce risk
- **may** — Supervisor/coordinator, tiny sessions (2-8 tool calls)
- **master** — CLI orchestration, delegates most work
- **amy/amy-kimi** — Research agents, not in analysis window

### Verification
```
$ grep -l "progressive-work-persistence" agents/*/knowledge/INDEX.md
agents/bob/knowledge/INDEX.md
agents/coach/knowledge/INDEX.md
agents/coder/knowledge/INDEX.md
agents/optimizer/knowledge/INDEX.md
agents/scout/knowledge/INDEX.md
agents/tech-lead/knowledge/INDEX.md
```

6/6 target agents confirmed.

### Date
2026-03-24T06:32:00Z
