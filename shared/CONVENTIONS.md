# Conventions & Standards

**Status**: Active
**Owner**: Coach / Bob

This file documents the **mandatory conventions** that all agents must follow. Unlike `best-practices.md` (which are guidelines), these are **hard rules**.

## C1. Artifact Handoff (P82)
**Rule**: Any cross-agent artifact delivery MUST use the `handoff` skill format in `SIGNALS.md`.
**Why**: Text-based handoffs ("I left the file here") have 0% compliance. The `handoff` skill enforces the protocol structurally.
**Mechanism**:
1. Load `agents/shared/skills/handoff/SKILL.md`.
2. Follow the `Protocol` section exactly.
3. This guarantees `read_by: []` is present (P82).

## C2. Transient Strategy (P53)
**Rule**: For any multi-step task (>5 steps) or cross-file edit (>3 files), create `workspace/strategy.md` FIRST.
**Why**: Context window is ephemeral. `strategy.md` is persistent.
**Mechanism**:
1. Load `agents/shared/skills/transient-skill.md`.
2. Create `workspace/strategy.md` with: Objective, Key Findings, Decision Log, Current Plan.
3. Update it before every major step.
4. Delete it when the task is done.

## C3. Deterministic Verification (P14)
**Rule**: Verification must use **deterministic checks** (grep, test, json parse), not LLM judgment ("looks good").
**Why**: LLMs hallucinate success (AP-9 Artifact Seduction). Code doesn't.
**Mechanism**:
- **Bad**: `read(file)` -> "The content looks correct."
- **Good**: `exec("grep 'expected_string' file")` -> Exit code 0.

## C4. Skill Compliance Trigger (P82/P114)
**Rule**: When a mandatory skill (e.g., experience-replay, transient-strategy) shows **0% organic usage across all agents for >24 hours**, Coach must initiate a targeted compliance drill.
**Why**: Skills with 0% adoption are dead weight. Ritualistic Policy Failure (FM-2.6) means agents acknowledge rules but never execute them. Drills force execution, which builds muscle memory.
**Trigger Protocol**:
1. **Detection** (Coach heartbeat): Scan recent session transcripts for evidence of skill execution (e.g., `grep -r "ERROR_LOG" .state/sessions/history/` for P114, `grep -r "strategy.md" .state/sessions/history/` for C2).
2. **If 0% usage detected**: Coach runs a **Growth Cycle drill** for each affected agent:
   - Fork the agent.
   - Give it a task that REQUIRES the skill (e.g., "edit src/X — you MUST use experience-replay first").
   - Verify: did the agent execute the skill? PASS = tool call evidence. FAIL = no evidence.
   - Promote if passed; add structural enforcement (C13) if failed.
3. **Escalation**: If an agent fails the drill 2x, embed the skill as a MANDATORY gate in the agent's heartbeat.md (per C13 — structural > behavioral).
4. **Measurement**: Track drill results in `agents/coach/workspace/drill-results.md`.
**Evidence**: P114 experience-replay had 0% organic adoption for 24h+ despite being documented in SOUL.md, LESSONS.md, and skills/. Only structural embedding in heartbeat.md (H513) and direct drills produced compliance. Amy's C17 fix required data-layer intervention (memoryLimit) after 6 behavioral fixes failed.
