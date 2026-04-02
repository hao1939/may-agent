# Deep Dive: danpeg/bug-hunt — Adversarial 3-Agent Verification Architecture

**Date:** 2026-03-06
**Source:** https://github.com/danpeg/bug-hunt (97⭐, created 2026-03-05)
**Purpose:** Extract architectural lessons for our evaluator agent and multi-agent verification patterns.

---

## 1. Architecture Summary

Bug-hunt is a Claude Code skill that runs three isolated agents sequentially to find and verify real bugs in a codebase. Each agent runs as a **separate subagent** with no shared context — only structured data passes between them.

```
                     ┌──────────┐
      codebase ────►│  HUNTER   │──── structured bug list ────┐
                     └──────────┘                              │
                                                               ▼
                     ┌──────────┐                        ┌──────────┐
      codebase ────►│  SKEPTIC  │◄───── bug list ────────│ SKILL.md │
                     └──────────┘                        │(orchestr)│
                           │                             └────┬─────┘
                    challenge report                          │
                           │         ┌──────────┐            │
                           └────────►│  REFEREE  │◄───── both reports
                     codebase ──────►│           │
                                     └──────────┘
                                          │
                                    final verdict
```

### The Three Agents

| Agent | Bias Direction | Scoring Incentive | Core Job |
|-------|---------------|-------------------|----------|
| **Hunter** | Over-report (maximize recall) | +1/+5/+10 per severity. False positives cost nothing. | Scan code, report everything suspicious |
| **Skeptic** | Dismiss (maximize precision) | +points for disproving false positives. **2x penalty** for wrongly dismissing real bugs. | Challenge each finding against actual code |
| **Referee** | Neutral (maximize accuracy) | Symmetric +1/-1 per correct/incorrect judgment | Independent read + final verdict on each bug |

### Key Design Decisions

1. **Complete context isolation.** Each agent is a fresh subagent. Hunter can't see Skeptic's reasoning. Skeptic can't see Referee's. This prevents anchoring bias — each agent forms its own independent assessment from source code.

2. **Structured data as the only interface.** Only the BUG-ID, file, lines, claim, evidence, severity, and points transfer between agents. No narrative, no methodology, no self-assessment. The orchestrator (SKILL.md) controls what information flows.

3. **Asymmetric scoring exploits sycophancy.** The Hunter is told "false positives cost you nothing" — exploiting LLMs' desire to please by channeling it toward thoroughness. The Skeptic gets 2x penalty for wrongly dismissing, creating calibrated caution rather than blanket rejection.

4. **`disable-model-invocation: true` in SKILL.md frontmatter.** The skill's orchestration logic runs as a literal script that the host agent follows step-by-step, not as a prompt the model interprets freely. This makes the workflow deterministic.

5. **Early exit on zero findings.** If Hunter finds 0 bugs, Skeptic and Referee are skipped entirely. Efficient resource use.

---

## 2. Detailed Prompt Analysis

### Hunter Prompt (prompts/hunter.md)
- **Methodology:** Glob → Read → Trace → Report. Must use tools (Read, Glob, Grep) to examine actual code. Explicitly banned from speculating about unread files.
- **Scoring psychology:** "A false positive costs you nothing, but missing a real bug means lost points." This is the key insight — it weaponizes the model's reward-seeking behavior toward exhaustive coverage.
- **Output format:** Rigid structured format (BUG-[N], Severity, File, Lines, Category, Claim, Evidence). This schema is load-bearing — it's what enables clean handoff to Skeptic.

### Skeptic Prompt (prompts/skeptic.md)
- **Methodology:** For EACH bug, must Read the actual code at the reported location. Cannot argue theoretically — must cite code.
- **Scoring psychology:** The 2x penalty creates a decision threshold. The prompt explicitly includes expected value calculation: `EV = (confidence% × points) - ((100-confidence%) × 2 × points)`. Only disprove when confidence > 67%.
- **Key innovation:** The EV calculation is in the prompt itself. The model is asked to show its work on the risk/reward tradeoff before each decision. This makes the Skeptic's calibration visible and auditable.
- **Output:** Structured DISPROVE/ACCEPT per bug, with counter-argument, evidence, confidence%, and EV calculation.

### Referee Prompt (prompts/referee.md)
- **Methodology:** Reads BOTH reports, then independently examines the actual code. Makes its own judgment.
- **Scoring psychology:** "The correct classification for each bug is already known." Framed as ground truth — symmetric +1/-1. This removes any incentive to favor either the Hunter or Skeptic.
- **Additional powers:** Can upgrade/downgrade severity from Hunter's rating. Can suggest fix directions.
- **Output:** Per-bug verdict (REAL BUG / NOT A BUG) with confidence (High/Medium/Low), true severity, and suggested fix. Low-confidence items flagged for manual review.

---

## 3. What Makes This Architecture Work

### 3a. Intentional Bias + Adversarial Composition = Calibration

Each agent alone is biased and unreliable:
- Hunter alone → too many false positives
- Skeptic alone → too many dismissals
- Referee alone → anchoring to the first thing it reads

The composition creates calibration through opposition. This is fundamentally different from "ask one model to be thorough AND precise" — that's asking for contradictory behaviors in one context window.

### 3b. Information Asymmetry as a Feature

The Skeptic never sees the Hunter's reasoning, only the claims. This means:
- The Skeptic can't be persuaded by a plausible-sounding but wrong argument
- The Skeptic must form its own opinion by reading the code
- If the Skeptic independently concludes the bug is real, that's strong evidence

The Referee sees both reports but is prompted as "the final arbiter" with ground-truth framing, giving it permission to disagree with both.

### 3c. Scoring as Behavioral Engineering

The scoring isn't just gamification — it's a mechanism design problem:
- **Hunter scoring** (no false-positive penalty) → maximizes recall
- **Skeptic scoring** (2x wrong-dismissal penalty) → cautious precision, not blanket rejection
- **Referee scoring** (symmetric) → unbiased truth-seeking

This mirrors mechanism design in economics: you design the incentive structure so that each actor's self-interest produces the globally optimal outcome.

### 3d. The 67% Confidence Threshold is Emergent

The Skeptic's EV formula creates a natural threshold: only disprove when > 67% confident. This isn't a hardcoded rule — it falls out of the 2x penalty structure. The model does its own Bayesian-like reasoning. This is elegant because it makes the threshold self-adjusting based on severity (higher-severity bugs have higher stakes in both directions).

---

## 4. Lessons for Our System

### 4a. For the Evaluator Agent (Direct Application)

Our evaluator (GPT-5.2, 20 turns, scores agents 0.0–1.0) currently operates as a single agent doing both detection and judgment. Bug-hunt suggests a better architecture:

**Current:**
```
Transcript ──► Evaluator ──► scores + lessons
                (one agent, one pass)
```

**Bug-hunt-inspired alternative:**
```
Transcript ──► Critic (find issues) ──► Defender (challenge) ──► Judge (verdict + scores)
```

**Specific design:**
- **Critic** (biased to over-report): "Find every inefficiency, every wasted call, every bad delegation. Score nothing — just find problems." Asymmetric incentive: missing an issue costs more than flagging a false positive.
- **Defender** (biased to explain): "For each finding, check the transcript yourself. Is there context that justifies the behavior? Could the agent have known better given what it received?" 2x penalty for wrongly defending bad behavior.
- **Judge** (neutral arbiter): Receives both reports, makes final scoring decisions. Produces the JSON scores block and lessons.

**Why this would help us:**
- Our current evaluator sometimes produces false-positive lessons (e.g., penalizing an agent for behavior that was rational given its inputs). A Defender would catch these.
- The evaluator's quality scores can be influenced by the first issue it finds (anchoring). Separating detection from scoring breaks this.
- The structured debate creates an audit trail — we can inspect WHY a score was given.

**Cost tradeoff:** 3 subagent calls vs 1, approximately 3x evaluation cost. Worth it for high-stakes evaluations (optimizer decisions, lesson extraction). Possibly overkill for routine session scoring.

### 4b. For QA Agent Improvement

Our QA agent (GPT-5.2, 30 turns) already plays a Skeptic-like role to the Coder's work. But it lacks:
- **Explicit EV calculation in the prompt.** QA should show confidence and risk calculation before flagging issues, especially before assigning FAIL verdicts.
- **Asymmetric penalties.** QA currently has no explicit penalty structure. Adding "false positives waste a full coder retry (5-10 turns); missed real bugs may ship but get caught later" would calibrate its behavior.
- **Structured output format for findings.** QA verdicts should use a rigid schema (like bug-hunt's BUG-[N] format) to enable downstream evaluation by the Evaluator.

### 4c. Architectural Patterns to Adopt

**Pattern 1: Intentional Bias Composition**
Instead of asking one agent to be "balanced," create agents with intentional biases and compose them:
- Scout (biased to discover) + Bob (biased to synthesize/filter) is already close to this
- Coder (biased to implement) + QA (biased to find problems) is already this
- Evaluator should become Critic + Defender + Judge

**Pattern 2: Structured Data as the Only Interface**
Bug-hunt passes only structured findings between agents, not narrative. We should enforce this for:
- Coder → QA handoff (file list, test results, changes made — not prose summary)
- QA → Evaluator (structured verdict, not narrative review)
- Evaluator → Optimizer (structured scores + lessons, already doing this)

**Pattern 3: Scoring Incentives in Agent Prompts**
Our agent prompts don't include explicit scoring incentives. Bug-hunt shows that putting the incentive structure directly in the prompt changes behavior. We could add to each agent's domain.md:
- Coder: "+1 for each test that catches a real issue, -2 for each path-guessed tool call"
- QA: "+5 for each real bug found, -10 for each false positive that triggers a retry"
- This doesn't need actual scoring infrastructure — the model's desire to "maximize its score" changes its calibration.

**Pattern 4: `disable-model-invocation` for Orchestration**
Bug-hunt uses `disable-model-invocation: true` to prevent the model from "interpreting" the workflow and instead force step-by-step execution. Our workflow system (implement-and-review) should consider similar deterministic enforcement — the workflow steps should be literal, not suggestions.

### 4d. Multi-Model Adversarial Verification (from Issue #3)

The open PR (#3) adds dynamic model assignment: run Hunter on Codex, Skeptic on Claude, Referee on Gemini. This creates model-diversity-as-verification:
- Different models have different failure modes
- If two different models independently confirm a bug, confidence is much higher
- They dogfooded this: ran bug-hunt on itself with mixed providers, found 7 real security bugs

**Our system already has this capability.** We use Opus (builders), GPT-5.2 (reviewers), and Gemini (philosophy). The bug-hunt PR validates that cross-model verification catches bugs that single-model doesn't. We should lean into this more explicitly:
- Evaluator (GPT-5.2) already reviews Coder (Opus) output — good
- QA (GPT-5.2) already reviews Coder (Opus) — good
- We don't do cross-model verification for Bob's philosophy work or Scout's research — gap

---

## 5. Limitations & Risks of This Architecture

1. **No ground truth.** Bug-hunt's Referee is told "the correct classification is already known" — but it isn't. This is a framing trick, not a guarantee. The Referee can still be wrong about all three agents' findings.

2. **Cost.** Three full code-scanning passes per invocation. For large codebases, this is expensive. The branch-diff mode (`-b`) is a pragmatic mitigation.

3. **Sequential bottleneck.** Hunter → Skeptic → Referee is strictly sequential. Can't parallelize because each depends on the previous output.

4. **No learning loop.** Bug-hunt is stateless — it doesn't learn from past runs. Each invocation starts from zero. Our system has the advantage of lessons.md and evaluations feeding back.

5. **LLM sycophancy cuts both ways.** The scoring incentives work because LLMs try to "maximize their score." But if a model becomes sophisticated enough to realize the scores are fictional, the incentive collapses. (Not a near-term risk.)

---

## 6. Concrete Next Steps

| Priority | Action | Owner | Effort |
|----------|--------|-------|--------|
| **High** | Add EV-style confidence calculation to QA's domain.md for FAIL/CONDITIONAL verdicts | Optimizer | Small |
| **High** | Add explicit scoring incentives to Coder and QA domain.md prompts | Optimizer | Small |
| **Medium** | Prototype 3-agent evaluator (Critic/Defender/Judge) for high-stakes evaluations | Optimizer + Bob | Medium |
| **Medium** | Enforce structured handoff format between Coder→QA (file list, test results, changes) | Optimizer | Medium |
| **Low** | Investigate `disable-model-invocation` equivalent for our workflow orchestration | Bob | Research |
| **Low** | Add cross-model verification for Bob's philosophy and Scout's research outputs | Bob | Design |

---

## 7. Summary

Bug-hunt's core insight is **weaponized bias**: instead of asking one agent to be both thorough and precise, split the job into three agents with intentional biases and compose them adversarially. The scoring incentives aren't decoration — they're mechanism design that exploits LLM sycophancy for calibrated verification.

For our system, the highest-leverage takeaway is the **Critic/Defender/Judge pattern for evaluation**, and the immediate wins are **adding EV calculations and scoring incentives to existing agent prompts**. The architecture validates what we're already doing (cross-model review) and pushes us toward more structured, adversarial verification.
