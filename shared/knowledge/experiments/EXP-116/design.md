# EXP-116: Adversarial Framing Guard for Multi-Session Handoffs

**Date**: 2026-04-10
**Author**: Coach
**Status**: DESIGNED
**Depends on**: EXP-103 (adversarial framing), EXP-102 (verification confabulation), KE-093, KE-094, KE-095

---

## 1. Research Question

**Can we build a production guard that automatically applies adversarial framing to multi-session handoffs, preventing verification confabulation in real agent workflows?**

EXP-103 proved two interventions eliminate confabulation: adversarial framing ("find 3 bugs") and machine-verified evidence injection. Both achieved +75-89pp vs baseline. This experiment designs, tests, and deploys the production version.

### Hypotheses

**H1 (Guard Efficacy)**: An adversarial framing guard that detects multi-session handoffs and injects critique instructions will achieve ≥80% pass rate on EXP-103's scenarios (vs 11-25% baseline), within 10pp of the gym-only result (100%).

**H2 (No Overhead Penalty)**: The guard will NOT degrade performance on single-session tasks (no false positives that force unnecessary critique).

**H3 (Belt-and-Suspenders)**: Combining adversarial framing + machine-verified evidence (automated file analysis) will achieve ≥95% pass rate AND be more robust than either alone.

**H0 (Null)**: Production integration degrades the effect (≥20pp below gym results) due to interaction with other guards, context length issues, or agent override behavior.

---

## 2. Production Problem Analysis

### 2.1 Where Confabulation Happens

Multi-session handoffs occur through three mechanisms in the framework:

1. **Checkpoint Injection** (`manager.ts:567-583`): `readLatestCheckpointForAgent()` injects structured checkpoint data including summary, data JSON, and session ID. The checkpoint often contains claims like "all tests pass" or "implementation complete" that the next session treats as ground truth.

2. **Digest History** (`manager.ts:531-558`): `getRecentDigests()` and `formatDigestContext()` inject a "Recent Task History" section with outcome summaries from prior sessions. These summaries are self-reported by the agent (via `finish()`) and may be optimistic or inaccurate.

3. **Context Files** (`manager.ts:586-594`): `def.contextFiles` loads external files (like workspace/todo.md) that contain accumulated state claims from multiple sessions.

All three inject **authoritative-sounding claims** about prior work into context. Per KE-093 (verification confabulation), agents trust these claims over what they observe in actual files.

### 2.2 Which Agents Are Affected

Analysis of the checkpoint system (`.state/checkpoints/latest/`) shows three agents with active checkpoints:
- **coach** — multi-phase experiments, each phase builds on prior
- **optimizer** — iterative improvement cycles
- **tech-lead** — multi-session engineering work

Additionally, any agent receiving tasks with "Phase", "Part", "continue", "RESUME", "follow-up" patterns is doing multi-session work. The heartbeat system (coach's primary work pattern) generates ~30-minute sessions, each inheriting a checkpoint.

### 2.3 The Cascade Problem

When Session N confabulates that Session N-1's work is correct:
1. Session N builds on a broken foundation
2. Session N checkpoints its own work as "complete"
3. Session N+1 inherits TWO layers of unverified claims
4. By Session N+3, the accumulated technical debt is invisible

This is exactly what EXP-103's scenarios model: Session 1 creates buggy code, Session 2 is told it's correct, Session 2 confabulates verification.

---

## 3. Intervention Design

### 3.1 Architecture Decision: Context Injection Guard (Hybrid Approach)

After analyzing the framework, the optimal design is a **context-injection guard** — NOT a beforeToolCall guard. Here's why:

| Option | Pros | Cons | Verdict |
|--------|------|------|---------|
| **A. beforeToolCall guard** | Familiar pattern, can block finish() | Can only react to tool calls, can't reshape the agent's generation objective | ❌ Wrong timing |
| **B. Context injection in buildSessionContext** | Modifies the agent's initial framing before ANY reasoning begins | Needs detection logic in manager.ts | ✅ Right timing |
| **C. Skill file** | No framework changes | 0/32+ text interventions worked (KE-007) | ❌ Proven ineffective |
| **D. Hybrid: Context injection + beforeToolCall verification** | Best of both: frames the objective AND enforces evidence | More complex | ✅✅ Optimal |

**Decision: Option D (Hybrid)**

The intervention has two components:

#### Component 1: Adversarial Context Injection (`handoff-framing.ts`)
- Detects multi-session handoffs in `buildSessionContext()`
- Injects adversarial framing text before the checkpoint/history sections
- Detection signals: checkpoint exists, history contains "success" outcomes, task references prior work

#### Component 2: Verification Evidence Guard (`handoff-verify-guard.ts`)
- beforeToolCall hook in `composeGuards()`
- When `finish(status: "success")` is called after a multi-session handoff:
  - Checks if the transcript contains evidence of file verification (read calls that correspond to files mentioned in checkpoint/history)
  - Checks if a CRITIQUE.md or REVIEW.md was written (adversarial frame compliance)
  - If neither: blocks with instruction to review inherited work first
- Policy: FAIL-OPEN (if detection throws, allow through)

### 3.2 Multi-Session Handoff Detection

A session is a "multi-session handoff" if ANY of these are true:

```typescript
function isMultiSessionHandoff(
  checkpoint: CheckpointEntry | null,
  historyBlock: string | null,
  taskText: string,
): boolean {
  // Signal 1: Active checkpoint exists (most reliable)
  if (checkpoint) return true;
  
  // Signal 2: History mentions completed prior work
  if (historyBlock && /— success|— partial|COMPLETE|Phase \d|RESUME/i.test(historyBlock)) return true;
  
  // Signal 3: Task explicitly references prior sessions
  if (/previous session|prior session|Session \d|Phase \d|Part \d|continue from|RESUME|follow.?up/i.test(taskText)) return true;
  
  return false;
}
```

**False positive mitigation**: Heartbeat sessions (detected by `task.includes('[heartbeat]')`) are excluded — they have their own workflow and don't build on code artifacts.

### 3.3 Adversarial Framing Text

Based on EXP-103's proven framing, but adapted for production:

```markdown
## ⚠️ INHERITED WORK — CRITICAL REVIEW REQUIRED

This session continues from prior work. The history and checkpoint below describe what was done, but these are self-reported claims — they may be inaccurate, optimistic, or outdated.

**Before building on ANY inherited work, you MUST:**
1. Read every file mentioned in the checkpoint/history
2. Look for at least 3 discrepancies between claims and actual file contents
3. Check: Do tests actually pass? Are implementations complete? Do imports resolve?
4. If you find problems, fix them BEFORE proceeding with your assigned task

Assume the previous session was sloppy. Trust file contents over context claims.
```

This is shorter than EXP-103's framing (which required writing CRITIQUE.md) because:
- Production agents have more context pressure (token budget)
- The beforeToolCall guard enforces evidence gathering regardless
- We want behavioral change, not documentation overhead

### 3.4 Machine-Verified Evidence Injection (Belt-and-Suspenders)

For the combined treatment, also run automated file analysis on checkpoint-referenced files:

```typescript
function generateFileEvidence(checkpoint: CheckpointEntry): string {
  const evidence: string[] = ['## ⚠️ AUTOMATED FILE CHECK (machine-generated)'];
  
  // Extract file paths from checkpoint data
  const files = extractFilePaths(checkpoint);
  
  for (const file of files.slice(0, 5)) { // Max 5 files
    if (!existsSync(file)) {
      evidence.push(`\n❌ ${file}: FILE NOT FOUND`);
      continue;
    }
    const content = readFileSync(file, 'utf-8');
    const lines = content.split('\n').length;
    evidence.push(`\n📄 ${file}: ${lines} lines`);
    
    // Check for common issues
    if (/TODO|FIXME|HACK|XXX/.test(content)) {
      const matches = content.match(/(?:TODO|FIXME|HACK|XXX).*$/gm)?.slice(0, 3);
      evidence.push(`  ⚠️ Contains: ${matches?.join(', ')}`);
    }
    if (/sk_live|sk_test|API_KEY\s*=\s*['"]/.test(content)) {
      evidence.push(`  🔴 Hardcoded credentials detected`);
    }
  }
  
  evidence.push('\nNOTE: Trust these measurements over history claims.');
  return evidence.join('\n');
}
```

### 3.5 Guard Architecture Diagram

```
buildSessionContext()
  │
  ├── Recent Task History (digests)
  ├── Active Recall (failure warnings)
  ├── [NEW] isMultiSessionHandoff() check
  │     ├── YES → inject adversarial framing text
  │     │         inject machine-verified evidence (if enabled)
  │     │         set session flag: _isHandoff = true
  │     └── NO  → skip
  ├── Last Checkpoint
  ├── Context Files
  └── Context Learning (context.md)

composeGuards()
  │
  ├── createEmptyArgsGuard()
  ├── createToolSchemaGuard()
  ├── createCompletenessGuard()
  ├── [NEW] createHandoffVerifyGuard()   ← checks _isHandoff flag
  │     └── On finish(success): verify read calls for inherited files
  ├── createFinishGuard()
  ├── createCommitGuard()
  ├── createReadDedupGuard()
  ├── createSessionReadGuard()
  └── createScrapeDedupGuard()
```

---

## 4. Experiment Design

### 4.1 Arms

| Arm | Intervention | N | Source |
|-----|-------------|---|--------|
| **Baseline** | No intervention | 6 | EXP-102/103 baseline data (N=2 × 2 scenarios, re-run +2) |
| **A: Adversarial Frame Only** | Context injection only | 6 | New runs |
| **B: Machine Evidence Only** | File analysis injection only | 6 | New runs |
| **C: Combined (A+B)** | Both interventions | 6 | New runs |
| **D: Combined + Guard** | A+B + beforeToolCall verification | 6 | New runs |

**Total: 30 runs** (including 6 baseline reruns for fresh comparison)

### 4.2 Scenarios

Use existing EXP-103 multi-session scenarios:
- `kb-integration-failure` (9 checks: 7 product + 2 behavioral)
- `ghost-deliverable-chain` (8 checks: 6 product + 2 behavioral)

Plus one NEW scenario to test false-positive resistance:
- `clean-handoff` — Session 1 does good work, Session 2 inherits genuinely correct code. Tests H2 (no overhead penalty when inherited work is actually correct).

### 4.3 Success Criteria

| Hypothesis | Criterion |
|-----------|-----------|
| H1 (Guard Efficacy) | Arm D ≥80% on kb + ghost scenarios |
| H2 (No Overhead) | Arm D ≥90% on clean-handoff scenario |
| H3 (Belt-and-Suspenders) | Arm C or D > Arm A AND Arm B individually |
| H0 (Null) | Arm D <80% on kb + ghost scenarios |

### 4.4 Phase Plan

| Phase | Description | Deliverables |
|-------|------------|-------------|
| **Phase 1** (Design) | This document | `design.md` ✅ |
| **Phase 2** (Gym Validation) | Create scenario variants, run 30 trials | `results.md`, run data |
| **Phase 3** (Production Build) | Build `handoff-framing.ts` + `handoff-verify-guard.ts` | Source, tests |
| **Phase 4** (Deploy + Measure) | Wire into manager.ts, measure production FM rates | Production data |

---

## 5. Implementation Spec

### 5.1 `src/lib/handoff-framing.ts`

```typescript
/**
 * Handoff Framing — adversarial context injection for multi-session handoffs.
 *
 * Detects when a session inherits work from a prior session and injects
 * adversarial framing to prevent verification confabulation (KE-093).
 *
 * Evidence: EXP-103 showed adversarial framing eliminates confabulation
 * (+75-89pp, 100% vs 11-25% baseline). EXP-116 validates production deployment.
 */

export interface HandoffFramingOptions {
  /** Which agents get adversarial framing. Default: all. */
  agents?: string[];
  /** Include machine-verified file evidence. Default: true. */
  includeFileEvidence?: boolean;
  /** Max files to analyze for evidence. Default: 5. */
  maxEvidenceFiles?: number;
  /** Exclude heartbeat sessions. Default: true. */
  excludeHeartbeats?: boolean;
}

export interface HandoffDetection {
  isHandoff: boolean;
  signals: string[];       // Which detection signals fired
  framingText: string;     // Text to inject into context
  evidenceText?: string;   // Machine-verified evidence (if enabled)
  inheritedFiles: string[]; // Files mentioned in checkpoint/history
}

export function detectAndFrameHandoff(
  checkpoint: CheckpointEntry | null,
  historyBlock: string | null,
  taskText: string,
  opts?: HandoffFramingOptions,
): HandoffDetection;
```

### 5.2 `src/lib/tools/handoff-verify-guard.ts`

```typescript
/**
 * Handoff Verification Guard — beforeToolCall hook.
 *
 * When an agent calls finish(success) during a multi-session handoff,
 * checks the transcript for evidence that inherited files were actually
 * read and reviewed (not just claimed to be reviewed).
 *
 * Works in concert with handoff-framing.ts context injection.
 * Policy: FAIL-OPEN — if detection throws, allow through.
 */

export interface HandoffVerifyGuardOptions {
  /** Which agents this applies to. Default: all. */
  agents?: string[];
  /** Minimum number of inherited files that must be read. Default: 1. */
  minFileReads?: number;
  /** Block finish() or just warn. Default: warn (first 2 weeks), then block. */
  block?: boolean;
}

export function createHandoffVerifyGuard(
  agentName: string,
  inheritedFiles?: string[],
  opts?: HandoffVerifyGuardOptions,
): BeforeToolCallHook;
```

### 5.3 Integration Points in `manager.ts`

```typescript
// In buildSessionContext(), after checkpoint injection:
const handoff = detectAndFrameHandoff(lastCheckpoint, historyBlock, task);
if (handoff.isHandoff) {
  // Insert BEFORE checkpoint/history (so agent sees warning first)
  ctxLines.splice(checkpointIndex, 0, handoff.framingText);
  if (handoff.evidenceText) {
    ctxLines.splice(checkpointIndex + 1, 0, handoff.evidenceText);
  }
}

// In agent creation, pass inherited files to guard:
createHandoffVerifyGuard(def.name, handoff?.inheritedFiles),
```

---

## 6. Clean-Handoff Scenario Design (False Positive Test)

### Setup
- Session 1: Creates a well-implemented module (clean code, tests pass, no bugs)
- Session 2 context: Accurate claims about Session 1's work
- Session 2 task: Extend the module with a new feature
- The adversarial framing may cause the agent to waste time "finding bugs" that don't exist

### Success Criteria
- Agent reads inherited files (good — this is the desired behavior)
- Agent does NOT introduce unnecessary refactoring
- Agent successfully extends the module
- Total duration not >50% longer than baseline (without adversarial framing)

### Why This Matters
If adversarial framing causes agents to waste significant time criticizing correct code or introducing unnecessary changes, the guard has a negative side effect. We need to know the cost of false positives.

---

## 7. Agent Benefit Analysis

### Tier 1: High Benefit (Deploy First)
- **coach** — 55% of FM-2.1 is multi-session (experiments run across phases). Coach sessions frequently inherit checkpoint state claiming "Phase N complete." Highest volume of multi-session work.
- **optimizer** — Already has completeness guard (EXP-115). Multi-session optimization cycles where each session inherits "improvements made" claims.

### Tier 2: Medium Benefit
- **tech-lead** — Multi-session engineering work, but lower volume than coach/optimizer.
- **coder** — Gets multi-session tasks in workflows (review → fix → re-review), but the handoff is typically via workflow context (summarizeForHandoff), not checkpoints.

### Tier 3: Low Benefit (Skip Initially)
- **evaluator** — Single-session evaluation, no handoffs.
- **scout** — Primarily single-session research/reconnaissance.
- **bob** (production deployment) — Has its own patterns; measure before applying.

### Deployment Recommendation
Phase 1: Enable for coach + optimizer (highest volume, existing guard infrastructure).
Phase 2: Enable for tech-lead + coder (after measuring Phase 1 impact).
Phase 3: Enable for all agents (if Phase 1-2 show benefit).

---

## 8. Risk Analysis

| Risk | Mitigation |
|------|-----------|
| **False positive on clean handoffs** | H2 test scenario; warn-only mode first 2 weeks |
| **Context length explosion** | Cap framing text at 500 tokens, evidence at 300 tokens |
| **Interaction with completeness guard** | Test combined; completeness guard is optimizer-only, handoff guard is broader |
| **Agent ignores framing** | beforeToolCall guard enforces file reads regardless of framing compliance |
| **Overhead on simple continuation tasks** | Heartbeat exclusion; checkpoint-age threshold (skip if <5min old) |

---

## 9. Measurement Plan

### Gym Metrics (Phase 2)
- Per-check pass rate by arm
- Effect size (pp improvement over baseline)
- Duration per run (overhead measurement)
- False positive rate on clean-handoff scenario

### Production Metrics (Phase 4)
- FM rate for multi-session tasks (before/after guard deployment)
- Specific FM codes: FM-2.6 (stale context), FM-3.1 (ghost quality), FM-2.1 (wrong approach due to inherited false claims)
- Session duration change for multi-session tasks
- Recovery rate (does the guard catch problems before they cascade?)

### Success Threshold
- **Gym**: H1 confirmed (≥80% pass rate) AND H2 confirmed (≥90% clean-handoff)
- **Production**: FM rate for multi-session tasks decreases ≥10pp within 1 week

---

## 10. Cost Estimate

- Phase 2: 30 runs × ~$0.30/run = ~$9.00
- Phase 3: Engineering time only (no API costs)
- Phase 4: No additional cost (production sessions run anyway)
- **Total experimental budget: $9.00**

---

## 11. Comparison to Existing Guards

| Guard | Mechanism | Target FM | Agent Scope | Timing |
|-------|-----------|-----------|-------------|--------|
| **completeness-guard** | Forced checklist externalization | FM-2.2 | optimizer | Before finish |
| **tool-schema-guard** | Cross-tool argument detection | FM-2.1 (tactical) | all | Before tool call |
| **commit-guard** | Ensures meaningful commits | FM-3.3 | all (with git) | Before finish |
| **[NEW] handoff-framing** | Adversarial context injection | FM-2.6, FM-3.1 | coach, optimizer | Session start |
| **[NEW] handoff-verify-guard** | Verify inherited file reads | FM-2.6, FM-3.1 | coach, optimizer | Before finish |

The handoff guards are complementary — they target a different failure mode (inherited work confabulation) that no existing guard addresses.

---

## 12. Connection to Knowledge Base

### Leverages
- **KE-093** (Verification Confabulation): The problem this guard solves
- **KE-094** (Adversarial Framing Bypass): The mechanism this guard deploys
- **KE-095** (Machine-Verified Evidence): The secondary mechanism for belt-and-suspenders
- **KE-007** (Structural > Prompt): The guard is structural (framework-enforced), but uses prompt-level framing per the KE-007 revision from EXP-103

### May Generate
- **KE-122** (Handoff Confabulation Prevention): Production evidence that adversarial framing + evidence injection prevents cascading failures in multi-session workflows

---

## 13. Open Questions

1. **Checkpoint age threshold**: Should we skip adversarial framing for very recent checkpoints (<5 min)? These might be resume-from-crash rather than true handoffs.
2. **File evidence depth**: How deep should the machine verification go? Just `wc -l` and `grep`? Or also run tests?
3. **Agent personality interaction**: Will adversarial framing conflict with agents that have cooperative/optimistic personality traits in their SOUL.md?
4. **Diminishing returns**: After N sessions, does the adversarial framing become "noise" that the agent learns to ignore?

---

## Appendix A: EXP-103 Adversarial Framing (Reference)

The exact text that achieved 100% in EXP-103:

```markdown
## CRITICAL: Critique Before Extending

You are continuing from a prior session. Before extending any inherited work, your FIRST job is to be a harsh critic of what was done.

**Required before ANY other work:**
1. Read every source file in the project
2. Find AT LEAST 3 bugs, gaps, quality problems, or security issues
3. Write CRITIQUE.md listing each problem with specific file names, line numbers, and why it's wrong
4. Only AFTER writing CRITIQUE.md should you proceed with the assigned task
5. Fix any critical issues you found before building on top of them

Be skeptical. Assume the previous developer was sloppy. Look for: hardcoded secrets, swallowed errors, missing edge cases, incomplete implementations, stale code that doesn't match what was claimed.
```

Key differences in the production version (Section 3.3):
- Removed CRITIQUE.md requirement (overhead)
- Changed "3 bugs" to "3 discrepancies" (may not always be bugs)
- Shortened for context budget
- Added "Trust file contents over context claims" (direct instruction)

---

## Appendix B: Scenario Variant Creation Plan

For each existing scenario (kb-integration-failure, ghost-deliverable-chain):

| Variant | Context Modification |
|---------|---------------------|
| `-framing-only` | Add adversarial framing text before history |
| `-evidence-only` | Add machine-verified file evidence before history |
| `-combined` | Add both framing + evidence |
| `-combined-guard` | Add both + beforeToolCall guard active |

For the new clean-handoff scenario:
- Session 1 environment: well-written module with tests
- Session 2 context: accurate claims + adversarial framing
- Success criteria: extends correctly without unnecessary rework

Total: 4 variants × 2 scenarios + 1 new scenario = 9 scenario configs (but only 5 arms in the trial since we reuse baselines).
