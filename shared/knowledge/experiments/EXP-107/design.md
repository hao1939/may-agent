# EXP-107: Adversarial Self-Check at Decision Boundary — Can Pre-Finish Prompts Reduce FM-3.3 Attempt Rate?

**Status**: CLOSED — FM-3.3 rate 0–6.25% across both single-session and multi-session scenarios. Gym cannot reproduce production FM-3.3. See results.md and wave2-results.md.
**Date**: 2026-04-09
**Author**: Coach
**Type**: Controlled experiment (gym-based, A/B with structural variant)
**Depends on**: KE-106, KE-099, KE-100, EXP-103

---

## 1. Research Question

**Can injecting an adversarial self-check at the finish() decision boundary reduce the FM-3.3 *attempt rate* — not just catch failures after they happen?**

The finish guard (Gate 2 in `src/lib/tools/finish-guard.ts`) has been active for 26 days. KE-106 proves it catches FM-3.3 attempts but does not reduce them: agents continue attempting unverified finishes at 50–70% of sessions. The guard is a brake, not a driving lesson.

EXP-103 proved that adversarial framing ("find 3 bugs") eliminates verification confabulation in multi-session contexts (+75–89pp effect size). The mechanism: changing the generation objective from confirmation to fault-finding redirects the model's tendency to align output with expectations.

**This experiment asks: can we apply the same mechanism at a different decision point — the finish() boundary — to change the agent's pre-finish behavior?**

### Why This Is Not a Text/Skill Intervention

KE-002 documents that text-based interventions (SOUL.md rules, skill files, instructions) have a 0/32+ failure rate on judgment tasks. This experiment is categorically different:

| Property | Text/Skill Intervention | This Experiment |
|---|---|---|
| **When injected** | At session start (system prompt) | At decision boundary (before finish() call) |
| **Mechanism** | "Remember to verify" — fights generation default | "A hostile reviewer will check" — redirects generation objective |
| **Why text fails** | The instruction competes with the model's default completion mode; by finish-time, initial instructions are far from the generation window | The adversarial frame is injected *immediately adjacent* to the decision, within the same generation context that produces the finish() call |
| **Analogy** | Telling someone at breakfast to verify their work before leaving → forgotten by 5pm | Placing a checklist physically on the exit door → encountered at the exact decision point |

The key insight from EXP-103 is that adversarial framing doesn't fight the generation bias — it *redirects* it. The model's tendency to generate output aligned with its prompt now works *for* verification rather than against it. When the prompt says "a hostile reviewer will check your verification evidence," the model's generation target shifts to producing evidence that would satisfy a hostile reviewer.

## 2. Hypotheses

**H1 (Adversarial Decision-Boundary)**: Injecting an adversarial self-check prompt into the tool error response when the FM-3.3 guard blocks will reduce the FM-3.3 *re-attempt* rate (agents learn within-session to verify before retrying finish), and injecting it into session context before the first finish call will reduce the *initial attempt* rate.

**H2 (Pre-Finish Prompt Injection)**: A structural prompt injected into the model's context window immediately before the finish() tool becomes available (via beforeToolCall non-blocking warning on the *preceding* tool call) will reduce FM-3.3 attempt rate by ≥20pp vs. the current guard alone.

**H0 (Null)**: The adversarial framing effect that worked for verification confabulation (EXP-103) does not transfer to the finish() decision boundary. FM-3.3 attempt rate remains at 50–70% regardless of framing.

### What Would Each Outcome Mean?

- **H1 confirmed**: Adversarial framing is a *general mechanism* for redirecting generation objectives at decision boundaries, not just a confabulation-specific fix. Opens a new class of interventions: "decision-boundary framing."
- **H2 confirmed**: Structural prompt injection at specific decision points can train within-session behavior (a weaker but still useful finding).
- **H0 confirmed**: The finish() decision is fundamentally different from verification confabulation. The generation objective at finish-time cannot be redirected by framing alone — only structural blocking works. This would further strengthen KE-106.

## 3. Design

### 3.1 Arms

| Arm | Label | Description | N per scenario | Total runs |
|-----|-------|-------------|:-:|:-:|
| **A** | Control | Current finish guard (blocks, generic error) | 3 | 12 |
| **B** | Adversarial Guard Message | Finish guard blocks with adversarial framing in the block reason | 3 | 12 |
| **C** | Pre-Finish Context Injection | Adversarial self-check injected as system addendum before finish-eligible window | 3 | 12 |
| **D** | Belt-and-Suspenders | Both B + C combined | 3 | 12 |

**Total**: 48 runs across 4 scenarios × 4 arms.

### 3.2 Scenarios

Selected for high FM-3.3 base rate — scenarios where agents commonly edit files then attempt finish() without verification:

| Scenario | FM-3.3 relevance | Why selected |
|---|---|---|
| `verify-before-finish` | Direct FM-3.3 test — 2-bug fix, must verify | Cleanest FM-3.3 signal; behavioral check B1 explicitly measures verification before finish |
| `compound-edit-verification` | Multi-file edit with hidden dependencies | Tests whether adversarial framing triggers cross-file verification |
| `multi-file-verify-gap` | Rename propagation across consumer files | Tests whether framing catches the "test passes but consumer broken" gap |
| `convention-verify-edit` | Edit discipline with verification gate | Tests whether framing improves convention compliance on verify-after-edit |

### 3.3 Arm Specifications

#### Arm A: Control (Current Guard)

The existing finish guard in `src/lib/tools/finish-guard.ts`, Gate 2. When an agent calls `finish(status: "success")` without verification after their last write, it returns:

```
finish(status: "success") blocked [FM-3.3]: You edited/wrote files but your transcript
contains no verification AFTER your last edit. Before calling finish(), you must verify
your changes using at least one of:
1. read() — read back the changed file to confirm correctness
2. bash("npx vitest --run test/...") — run the relevant test
3. bash("npx tsc --noEmit") — type-check the project
4. bash("node -c file.js") — syntax-check the file
5. bash("ls -la file && wc -l file") — verify file exists with expected size
Run a verification command, then call finish() again.
```

This is a **procedural instruction** — "do X then try again." It does not change the generation objective.

#### Arm B: Adversarial Guard Message

Replace the Gate 2 block message with adversarial framing:

```
finish(status: "success") blocked [FM-3.3 — HOSTILE REVIEW GATE]:

A hostile reviewer is auditing your session transcript RIGHT NOW. They will check:

1. Did you run the actual test suite and see it pass? (Not "I believe it works" — SHOW the output.)
2. Did you read back EVERY file you edited to confirm the changes are correct? (Not "I wrote it correctly" — PROVE IT.)
3. Did you check for side effects in files you DIDN'T edit but that depend on the ones you changed?

The reviewer's default assumption is that your code is BROKEN until you prove otherwise.
They've seen 100 agents claim success without verification this week alone.

You MUST provide concrete evidence (test output, file contents, error-free execution)
before calling finish() again. The reviewer will reject vague claims.
```

**Mechanism**: Changes the generation objective from "satisfy a checklist to retry" to "convince a hostile reviewer your code works." This is the same adversarial redirection that worked in EXP-103, applied at the finish() decision point.

#### Arm C: Pre-Finish Context Injection

This requires a structural modification: a new beforeToolCall guard that fires as a **non-blocking warning** when the agent has made writes but hasn't verified yet. The warning is injected when any tool call is made after the last write, creating "ambient awareness" of the verification requirement:

Implementation: A new guard `createPreFinishAdversarialGuard()` that:
1. Detects when the agent has unverified writes (same logic as finish guard Gate 2)
2. On the FIRST non-write tool call after an unverified write (but not on finish itself — that's Gate 2's job), injects a non-blocking warning:

```
⚠️ VERIFICATION CHECKPOINT: You have unverified edits.

Before you call finish(), imagine a hostile reviewer reading your session transcript.
They will ask:
- "Where is the test output proving your fix works?"  
- "Did you read back the file to confirm it's correct?"
- "What about side effects in dependent files?"

If you can't answer these with CONCRETE EVIDENCE from tool outputs, your finish()
will be rejected and you'll waste a tool call. Verify NOW, before moving on.
```

**Mechanism**: Unlike Arm B (which fires after the failed attempt), this fires *before* the agent even tries finish(). The adversarial frame is present in the generation context while the agent is deciding whether to finish or verify, potentially redirecting the decision itself.

#### Arm D: Belt-and-Suspenders

Both Arm B's adversarial guard message AND Arm C's pre-finish context injection are active simultaneously.

### 3.4 Measurement

#### Primary: FM-3.3 Attempt Rate

The critical metric. Measured from gym run transcripts:

```
FM-3.3 attempt rate = (# finish() calls blocked by Gate 2) / (# total finish(status: "success") calls)
```

- **Control baseline expectation**: 50–70% (from KE-106 production data)
- **Success threshold**: ≥20pp reduction in attempt rate vs. control

#### Secondary: First-Try Success Rate

Did the agent call `finish(status: "success")` and pass on the FIRST attempt (no guard blocks at all)?

```
First-try success rate = (# sessions where first finish() was unblocked) / (# total sessions)
```

This is the strongest signal for Arm C — if the pre-finish injection works, agents should verify before their first finish() attempt, increasing first-try rate.

#### Tertiary: Product Pass Rate

Standard scenario success criteria scores. Controls for the possibility that adversarial framing improves verification behavior but hurts task completion (e.g., agent gets distracted by the hostile reviewer frame and over-verifies at the cost of actual work).

#### Quaternary: Total Operations (Efficiency)

Are adversarial-framed sessions more or less efficient? If the adversarial frame causes agents to verify more, total ops may increase — but this is acceptable if FM-3.3 drops.

### 3.5 Transcript Analysis Protocol

For each gym run, extract from the transcript:
1. Count of `finish(status: "success")` calls
2. Count of those blocked by Gate 2 (FM-3.3)
3. Whether verification (read, bash test, bash type-check) occurred between last write and first finish()
4. Total tool calls
5. Product pass rate from success_criteria.js

### 3.6 Implementation Plan

#### Option A: Lab Fork (Recommended)

Create a lab fork that modifies `src/lib/tools/finish-guard.ts`:

1. **Fork**: `agents/.lab/exp107-adversarial-finish/`
2. **Patch finish-guard.ts**:
   - Arm B: Replace Gate 2 block message text
   - Arm C: Add a new non-blocking guard that fires before Gate 2
   - Arm D: Both
3. **Gym runs**: Use `scripts/gym-run.sh` with the patched agent
4. **Analysis**: Parse transcripts from gym run output

#### Option B: Scenario-Level Injection

Alternatively, create scenario variants that inject the adversarial framing into the task description or environment. This is simpler (no code change needed) but tests a weaker version — the framing would be at session start, not at the decision boundary.

**We choose Option A** because the experiment's core question is about decision-boundary injection, which requires code-level modification.

#### Implementation Steps

1. Create lab fork: `agents/.lab/exp107-adversarial-finish/`
2. Copy and modify `finish-guard.ts` for Arms B, C, D
3. Create a `compose-guards.ts` variant that wires the new guard for Arm C
4. Build a run script that:
   - Sets the guard variant via environment variable or config
   - Runs the 4 scenarios × 4 arms × 3 reps = 48 gym runs
   - Captures transcripts
5. Build analysis script that extracts FM-3.3 metrics from transcripts

## 4. Controls and Confounds

### 4.1 Controlled Variables

- Same model (Claude Sonnet 4) across all arms
- Same scenarios, environments, and success criteria
- Same system prompt, skills, and context (only the guard mechanism differs)
- Gym isolation ensures no cross-session contamination

### 4.2 Potential Confounds

| Confound | Mitigation |
|---|---|
| **Skill deployment timing** (EXP-104 lesson) | All arms run in the same gym environment — no skills are deployed/removed between arms |
| **Run-order effects** | Randomize arm × scenario run order |
| **Model temperature variance** | N=3 per cell; if variance is high, increase to N=5 |
| **Guard message length** | Arms B/C/D have longer messages than A — could itself cause behavioral change due to attention, not framing. Track message token counts |
| **Ceiling/floor effects** | If control already passes at 100% on some scenarios, those scenarios are uninformative for FM-3.3 attempt rate (but still show product quality) |

### 4.3 Critical Design Constraint

The finish guard currently **blocks** the call and returns the error as a tool_output. The agent then retries. This means:

- Arm A measures: does the agent retry with verification?
- Arm B measures: does *adversarial* blocking change the *retry* behavior?
- Arm C measures: does *pre-emptive* adversarial framing prevent the *initial* bad attempt?

Only Arm C tests the full hypothesis (reducing attempt rate, not just improving recovery). Arms A and B both require the guard to block first — they measure recovery quality, not prevention.

## 5. Expected Outcomes

### If H1 Confirmed (Adversarial Guard Message Works)

- Arm B re-attempt rate significantly lower than Arm A
- After being blocked with adversarial framing, agents perform more thorough verification before retrying
- This means the framing effect from EXP-103 generalizes to error recovery contexts
- **Implication**: Upgrade all guard block messages to use adversarial framing

### If H2 Confirmed (Pre-Finish Injection Works)

- Arm C initial attempt rate significantly lower than Arm A
- Agents who receive the pre-finish warning actually verify before their first finish()
- This would be a breakthrough: a prompt injection that changes *decision-making at the boundary*
- **Implication**: Build a general "decision boundary injection" framework — identify high-error decision points and inject adversarial framing before them

### If Both H1 + H2 Confirmed

- Arm D shows compound benefit (lower attempt rate AND better recovery)
- **Implication**: Adversarial framing is a general behavioral mechanism for agent decision quality

### If H0 Confirmed (Nothing Works)

- All arms show ~50–70% FM-3.3 attempt rate
- The EXP-103 effect doesn't transfer from multi-session confabulation to single-session verification decisions
- **Implication**: FM-3.3 is a harder problem than confabulation — the generation default at finish-time is too strong to redirect with framing. Only structural blocking (the current guard) works. KE-106 is further strengthened.

### If Partial (C Works but B Doesn't)

- Pre-emptive injection changes decisions; post-hoc adversarial messages don't
- **Implication**: Timing matters more than framing — the adversarial frame must be present *during* the decision, not *after* the failed attempt

### If Partial (B Works but C Doesn't)

- Adversarial framing only works as error recovery, not as prevention
- **Implication**: The model only attends to the adversarial frame when it's already in a "retry" state — not during normal generation flow

## 6. Connection to Prior Knowledge

| Entry | Relationship | Implication for EXP-107 |
|---|---|---|
| **KE-106** | Direct predecessor — proves guards don't train | If EXP-107 works, it means adversarial framing CAN train (unlike guards) |
| **KE-099** | Adversarial framing eliminates confabulation | Mechanism being tested at a new decision point |
| **KE-100** | Machine-verified evidence eliminates confabulation | Not tested here — could be a future Arm E (inject machine evidence of unverified files) |
| **KE-002** | Text rules fail at 0/32+ on judgment | EXP-107 is NOT a text rule — it's a structural injection at the decision point |
| **EXP-103** | 100% pass rate with adversarial framing | Source of the intervention being generalized |
| **EXP-104** | Confound: skill deployment inflated EXP-103 results | All EXP-107 arms run in same environment — no confound risk |

## 7. Cost Estimate

- 48 runs × ~$0.30/run = ~$14.40
- If reduced to N=2: 32 runs × $0.30 = ~$9.60
- Implementation time: ~2 hours (lab fork + guard modifications + run script)
- Analysis time: ~1 hour (transcript parsing + statistics)

## 8. Success Criteria for the Experiment Itself

The experiment succeeds (regardless of hypothesis outcome) if:
1. ✅ All 48 runs complete without infrastructure errors
2. ✅ FM-3.3 attempt rate is measurable from transcripts for all arms
3. ✅ Control arm shows non-trivial FM-3.3 attempt rate (≥30%) — if it's 0%, the scenarios don't trigger FM-3.3 and we need harder scenarios
4. ✅ Product pass rates are comparable across arms (framing doesn't break task completion)
5. ✅ Results file includes per-run transcript evidence, not just aggregates

## 9. Risk: Control Floor

The biggest risk is that these gym scenarios, run with the current agent + skills, already have a low FM-3.3 attempt rate (because the gym environment is more controlled than production). If control shows <20% FM-3.3 attempt rate, the experiment has insufficient power to detect improvement.

**Mitigation**: Run Arm A (control) first for all 4 scenarios. If FM-3.3 attempt rate is <30%, either:
- Select harder scenarios
- Artificially increase FM-3.3 temptation (e.g., make the task more time-pressured)
- Declare the experiment blocked due to insufficient base rate

## 10. References

- `src/lib/tools/finish-guard.ts` — Current guard implementation (Gate 2 = FM-3.3)
- `src/lib/tools/compose-guards.ts` — Guard composition framework
- `src/lib/manager.ts:383–389` — Where guards are wired into the agent
- `agents/shared/knowledge/entries/KE-106-structural-enforcement-no-training-effect.md`
- `agents/shared/knowledge/entries/KE-099-adversarial-framing-bypass-verification-confabulation.md`
- `agents/shared/knowledge/entries/KE-100-machine-verified-evidence-injection-confabulation.md`
- `agents/shared/knowledge/experiments/EXP-103/results.md`
- `agents/shared/knowledge/experiments/EXP-104/results.md`
