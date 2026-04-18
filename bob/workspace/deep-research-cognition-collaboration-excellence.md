# Deep Research: Agent Cognition, Collaboration & Excellence Mechanics

**Author**: Bob (Architect) | **Date**: 2026-04-11  
**Task**: Deep investigation into how agents think, learn, coordinate, and achieve excellence  
**Method**: Source code analysis, database queries across 7,932 sessions, knowledge base review (5,131 files, 3.7M words), cross-agent coordination tracing

---

## Table of Contents

1. [How Agents Actually Think: The Cognition Model](#1-how-agents-actually-think)
2. [Cross-Agent Learning: What Actually Transfers](#2-cross-agent-learning)
3. [What Makes an Excellent Session](#3-what-makes-an-excellent-session)
4. [The Knowledge Utilization Crisis](#4-the-knowledge-utilization-crisis)
5. [The Channel-Task Matrix: The Unified Theory](#5-the-channel-task-matrix)
6. [Self-Improvement: What Works, What Doesn't, Why](#6-self-improvement)
7. [Collaboration Architecture: The Real Topology](#7-collaboration-architecture)
8. [Actionable Recommendations](#8-recommendations)

---

## 1. How Agents Actually Think: The Cognition Model {#1-how-agents-actually-think}

### 1.1 The Four-Layer Cognitive Stack

At runtime, an agent's "thinking" is determined by a strict hierarchy of information sources, each with dramatically different influence on behavior:

| Layer | Source | Words Injected | Influence on Behavior | Example |
|-------|--------|---------------|----------------------|---------|
| L1 | System prompt (SOUL.md + heartbeat.md) | ~900-1000 | **Identity, role framing** | "You are the Architect" |
| L2 | Context.md entries | ~400-500 | **Environmental constraints** | "sqlite3 not available, use bun:sqlite" |
| L3 | Task message + knowledge injection | ~500-2000 | **Goal direction + primed patterns** | Task description + 2-5 KE one-liners |
| L4 | Active recall (ERROR_LOG.jsonl warnings) | ~100-300 | **Failure avoidance** | "⚠️ FM-2.6 occurred 2 days ago: non-delivery" |

**Total context at decision time: ~2,000-4,000 words** out of a 3.7M-word knowledge base.

This means **agents operate on 0.05-0.11% of available knowledge at any given moment.** The rest exists but is invisible.

### 1.2 The Knowledge-Action Gap

The most replicated finding in this system (confirmed across 24+ experiments): **agents can read and reference knowledge but fail to act on it.** Specifically:

- **Text rules** (SOUL.md edits, skill files): 0/20 success rate on judgment behaviors (KE-002)
- **Negative examples** (LESSONS.md): 0/8 effect on behavior (KE-009)
- **Skill files targeting reasoning**: No change in tool-calling patterns (KE-006)

The gap exists because LLM agents process instructions as *background context* (Layer 1 influence) rather than *decision-forcing* inputs. They pattern-match against their training distribution, and Layer 1 text doesn't override that.

### 1.3 What Actually Changes Agent Behavior

Three mechanisms work, ordered by mechanism type:

| Mechanism | How It Works | Effect Size | Best For |
|-----------|-------------|-------------|----------|
| **Few-shot worked examples** (Channel 3) | Domain-matched example in task message primes reasoning pattern | 18/18 = 100% on matched scenarios | Judgment, process discipline |
| **Forced externalization** (Channel 2) | Structural gate requiring intermediate artifact before action | 100% on recognition/execution tasks | Analysis quality, verification |
| **Workflow enforcement** (Channel 5) | Code-level guardrails forcing action sequence | 100% on procedural + temporal | Tool-call sequencing, multi-step processes |

**The key insight**: The *mechanism* matters more than the *content*. The same content delivered through different channels produces dramatically different results. EXP-127 showed: same content, Ch1 (system prompt) = 0%, Ch3 (task message) = 0%, Ch2 (forced externalization) = 100%, p = 0.0000074.

### 1.4 How Agents Stop Working

Session analysis reveals a bimodal distribution:

| Op Range | Count | Success Rate | Pattern |
|----------|-------|-------------|---------|
| 1-5 ops  | 2,663 | 72% | Quick triage / health checks / shallow sessions |
| 6-10 ops | 1,579 | **82%** | **Sweet spot**: focused task completion |
| 11-20 ops | 1,709 | 79% | Solid work sessions |
| 21-40 ops | 1,412 | **69%** | Diminishing returns, complexity creep |
| 41+ ops | 569 | 83% | Deep research / large tasks (self-selected) |

The 21-40 op range has the *lowest* success rate, suggesting that sessions hitting this range are struggling — not by design but because they're stuck in a problem they can't resolve efficiently. The 41+ sessions succeed because they're *intentionally* deep (research, KB integration).

---

## 2. Cross-Agent Learning: What Actually Transfers {#2-cross-agent-learning}

### 2.1 The Delegation Graph

The system has a clear hierarchy of delegation:

```
             cron (heartbeats)
                   │
                   ▼
      ┌────── may ──────┐
      │     (deputy)     │
      ▼         ▼        ▼
    bob      tech-lead   coach
  (architect) (engineer) (trainer)
      │         │         │
      ▼         ▼         ▼
   [research] [coder]  [training]
```

**Top delegation flows** (by volume):
- `cron → may`: 13,762 requests (100% completion)
- `cron → bob`: 1,038 requests (100% completion)
- `bob → tech-lead`: 162 requests (100% completion)
- `may → tech-lead`: 151 requests (100% completion)
- `coach → coach`: 187 requests (self-delegation for sub-tasks)
- `bob → bob`: 120 requests (self-delegation for work sessions)

**Completion rates are remarkably high**: 97-100% across all pairs. The system doesn't fail at *doing tasks*. It fails at *knowing what tasks to do* and *using prior results*.

### 2.2 Knowledge Flows Between Agents

**File write analysis** (last 50 sessions with file modifications):
- Self-writes (agent's own directory): 27/50 (54%)
- Shared writes (agents/shared/): 26/50 (52%)
- Cross-agent writes (another agent's files): 6/50 (12%)

Most "cross-agent learning" routes through `agents/shared/knowledge/` — agents rarely write directly to each other's files. The exceptions are primarily coach modifying other agents' SOUL.md or context.md.

### 2.3 The Knowledge Transfer Pipeline (Actual Implementation)

Knowledge flows between agents through four concrete mechanisms:

1. **Knowledge Router** (`src/lib/knowledge-router.ts`): At session start, keyword-matches the task text against `knowledge-index.json` (19 KE entries). Injects 2-5 one-liner summaries into the prompt. Agent-filtered (each KE specifies which agents it's relevant to).

2. **Active Recall** (`src/lib/active-recall.ts`): Reads `agents/{name}/ERROR_LOG.jsonl` for recent failures (last 3 days). Injects deduplicated warnings. This is the only mechanism that provides *negative feedback*.

3. **Session Digests** (stored in DB `session_digests` table): What each agent did, files modified, key outcomes. Available for query but **not automatically injected** into other agents' sessions.

4. **Shared Knowledge Base** (`agents/shared/knowledge/`): 5,131 files, 3.7M words. Organized by type (entries, hypotheses, experiments, synthesis). But agents must *actively read these* — they're not injected.

### 2.4 The Utilization Bottleneck

The critical finding (H-043): **knowledge utilization U ≈ 0.10-0.28**, meaning 70-90% of knowledge never reaches agents at decision time.

| Knowledge Form | Utilization (U) | How It's Delivered |
|---------------|-----------------|-------------------|
| Structural (workflow code) | ~0.9 | Code enforces it — no choice |
| Environmental (context.md) | ~0.5 | Always in prompt |
| Knowledge-index one-liners | ~0.3-0.5 | Injected when keywords match |
| Declarative-judgment | ~0.03-0.05 | Must be actively read |
| Deep research (WKWA docs) | ~0.01 | Almost never read at decision time |

**The paradox**: The system's most valuable research (WKWA synthesis docs, experiment results) has the *lowest* utilization because it's in declarative-judgment form. The knowledge-index one-liners are a 10x improvement over raw files, but they only cover 19 of 5,131 documents.

### 2.5 Cross-Agent Blindness

Analysis of coach session digests: **1 out of 10 recent sessions referenced bob's work** (hypothesis IDs or knowledge entries). Despite bob producing the primary research that should inform coaching strategies, coach operates largely independently.

The "What Changed Since Your Last Session" briefing was *designed* (see `DESIGN-what-changed-briefing.md`) but the implementation status is unclear — the design doc exists but temporal context injection into heartbeats may not be fully deployed. This means agents wake up with **zero knowledge of what happened while they were inactive**.

---

## 3. What Makes an Excellent Session {#3-what-makes-an-excellent-session}

### 3.1 Quality Distribution

The evaluation system uses a dual scale (0.0-1.0 continuous for some sessions, 1-5 integer for others):

| Quality Score | Session Count | Verdict | Distinguishing Features |
|--------------|--------------|---------|------------------------|
| 5 (best) | 2,802 | "good" | Verified deliverables, proper finish() call, low waste ratio |
| 4 | 8,286 | "good" | Verified or unverified success, deliverables present |
| 3 | 1,630 | "acceptable" | Session errors, missing verification, some waste |
| 1-2 | 1,932 (q=2) + fewer (q=1) | "needs_improvement" | Shallow sessions, errors, tool failures |
| 0 | 3,050 | "skipped/unknown" | Meta-agents (evaluator, optimizer), zero-op sessions |

### 3.2 The q=3 vs q=4 Divide (What Separates Good from Mediocre)

**q=3 sessions (borderline acceptable)**: Consistently show `session_error` in issues. These are sessions that *tried* to complete but hit infrastructure or tool errors. The work was acceptable but not fully verified.

**q=4 sessions (good)**: Show `finish_success_verified` and `has_deliverables`. Key differentiators:
- Proper `finish()` call with verification evidence
- Concrete deliverables (files created/modified)
- Low waste ratio (productive calls >> wasted calls)

### 3.3 The Excellence Formula

From the data, an excellent session (q=5) has these properties:

1. **Focused scope**: 7-40 ops (sweet spot). Not too short (shallow), not too long (diminishing returns)
2. **Early orientation**: First 2-3 ops read context and plan, then execute
3. **Concrete deliverables**: Files written, not just analysis
4. **Proper closure**: `finish()` with status, verification evidence, and deliverables list
5. **Low waste**: ≤15% of calls are non-productive (repeated reads, failed tools)
6. **No session errors**: Clean execution without infrastructure failures

**The most critical factor is deliverable production.** Sessions that produce artifacts (even a small commit or context.md update) consistently score higher than sessions that only analyze.

---

## 4. The Knowledge Utilization Crisis {#4-the-knowledge-utilization-crisis}

### 4.1 The Scale of the Problem

| Metric | Value |
|--------|-------|
| Total knowledge files | 5,131 |
| Total knowledge words | 3,700,000 |
| Words available at decision time | 2,000-4,000 |
| **Utilization ratio** | **0.05-0.11%** |
| KE entries in knowledge index | 19 |
| KE entries total | 140+ |
| Hypotheses total | 46 |
| Experiments total | 116 |
| Synthesis docs (WKWA) | 8 |

### 4.2 Why More Knowledge Doesn't Help

The system has a **knowledge production surplus**: 17 new claims per 1 resolved (the accumulation-to-resolution ratio from WKWA-003). Agents produce knowledge faster than the system can consume it.

The root cause is that **knowledge form determines utilization**:
- Adding more WKWA docs doesn't help if they're never injected into prompts
- The knowledge-index.json covers only 19 entries — 86% of verified knowledge is invisible
- Deep-dives and hypotheses are read only during intentional research sessions

### 4.3 The Consumability Plan

Bob's own KNOWLEDGE-CONSUMABILITY-PLAN.md identified this problem and proposed:
1. **Phase 1**: Tag all KE entries by delivery form (structural/environmental/declarative)
2. **Phase 2**: Promote top-5 findings to context.md entries (10x utilization boost)
3. **Phase 3**: Heartbeat-only knowledge injection with agent routing

The heartbeat knowledge injection was designed and partially implemented (tech-lead's `DESIGN-heartbeat-knowledge-injection.md`), using keyword matching against `knowledge-index.json`. But the 19-entry limit severely constrains its reach.

---

## 5. The Channel-Task Matrix: The Unified Theory {#5-the-channel-task-matrix}

### 5.1 The Discovery

The most recent research (WKWA-008, April 2026) produced a unified model: **intervention effectiveness = f(delivery channel × task type)**.

| Task Type | Ch1 (System Prompt) | Ch2 (Forced Ext.) | Ch3 (Task Message) |
|-----------|:-------------------:|:------------------:|:-------------------:|
| **Execution** | ❌ 0% | ✅ ~100% | ✅ ~100% | 
| **Recognition** | ❌ 0% | ✅ ~100% | ⚠️ 0-100%* |
| **Discovery** | ❌ 0% | ❌ 0% | ❌ 0% |

*Ch3 on recognition tasks: depends on coding momentum (low momentum → 100%, high → 0%).

### 5.2 What This Means in Practice

1. **System prompt content** (SOUL.md, context.md) **never changes behavior** — it only sets identity and environmental constraints. Don't put behavioral interventions there.

2. **Task message content** (few-shot examples) **changes behavior for execution and behavioral tasks** but fails when the agent is deep in analytical coding momentum.

3. **Forced externalization** (workflow gates) **works for everything except discovery** — it interrupts the action loop and forces analysis. This is the most reliable intervention.

4. **Discovery tasks are irreducible** — no external scaffolding helps. The creative inference required for recognizing what's missing cannot be externally supported. Six experiments tested every channel; all null or negative.

### 5.3 Implications for System Design

The current system places most knowledge in Ch1 (context.md) and Ch3 (knowledge-index one-liners). But Ch1 has 0% behavioral effect and Ch3 is unreliable for recognition tasks. The only reliable channel (Ch2) is used only for explicit workflow gates.

**This is the fundamental architecture gap**: the system's knowledge delivery uses channels with low/variable effectiveness, while the most effective channel (forced externalization) is used sparingly because it requires code changes.

---

## 6. Self-Improvement: What Works, What Doesn't, Why {#6-self-improvement}

### 6.1 The Self-Improvement Paradox (H-055)

Autonomous self-improvement requires four capabilities, each compromised by LLM biases:

| Step | Needed | What Goes Wrong |
|------|--------|----------------|
| Detect failure | Honest self-assessment | Self-preservation bias (>60% SPR) |
| Evaluate alternatives | Objective comparison | R-ceiling on subjective judgments |
| Predict consequences | Model downstream effects | Interaction blindness (can't model other agents' reactions) |
| Execute change | Implement identity-threatening changes | Self-preservation: always additive, never subtractive |

### 6.2 The Evidence

30-day audit of 104 self-modifications:
- 89% additive (agent added to its own files)
- 5% subtractive (all externally driven)
- 6% transformative (restructuring, not value-changing)
- **0 self-initiated deletions in 30 days**

### 6.3 Cooperative Convergence (H-056)

Multiple agents sharing a knowledge base compound individual biases into system-level conservatism:
- **Citation entrenchment**: A cites B, B cross-refs A → "well-established" regardless of evidence quality
- **Vocabulary lock-in**: Shared terminology becomes identity-tied, challenging concepts feels like attacking the group
- **Consensus-as-validation**: Agreement ≠ evidence when all agents share model biases

Evidence: 85% of hypotheses untested (24/29), 0% revised/retracted, accumulation-to-resolution ratio 17:1.

### 6.4 What Actually Works

| Mechanism | Works? | Why |
|-----------|--------|-----|
| External validation (gym, convention checks) | ✅ Yes | Objective ground truth bypasses self-assessment bias |
| External pruning (human-initiated simplification) | ✅ Yes | Overcomes self-preservation bias |
| Accumulation (new knowledge, new artifacts) | ✅ Yes | Aligned with natural additive bias |
| Self-correction (revising own hypotheses) | ❌ No | Blocked by self-preservation |
| Self-pruning (deleting own work) | ❌ No | Zero instances in 30 days |

---

## 7. Collaboration Architecture: The Real Topology {#7-collaboration-architecture}

### 7.1 Designed vs. Actual Collaboration

**Designed**: Agents specialize (bob=research, coach=training, tech-lead=engineering, optimizer=efficiency) and coordinate through shared knowledge base and escalation protocols.

**Actual**: Agents mostly operate independently. Cross-agent knowledge transfer happens through:
1. **Delegation tasks** (explicit: "implement X that bob designed") — works well (97-100% completion)
2. **Shared knowledge base** (implicit: coach reads bob's findings) — works poorly (1/10 sessions reference cross-agent work)
3. **Escalation protocol** (for disagreements) — exists but rarely used

### 7.2 The Collaboration Bottleneck

The real bottleneck is **step 2**: implicit cross-agent learning. Bob produces research → writes to shared knowledge → coach *should* use it for training design → but coach mostly operates from its own context and recent session memory.

This isn't a process failure — it's the utilization bottleneck (§4) applied to cross-agent flows. Coach's heartbeat doesn't inject bob's latest findings. The knowledge-index.json has agent-level routing, but only 19 entries are indexed. The "What Changed" briefing was designed but may not be fully operational.

### 7.3 What Works in Collaboration

1. **Explicit delegation** with rich context: `bob → tech-lead: "implement X, files are at Y, constraints are Z"` — 100% completion rate
2. **Workflow-mediated handoffs**: parallel-research, implement-and-review — structured multi-agent coordination
3. **Shared conventions**: CONVENTIONS.md provides shared standards that all agents check against

What doesn't work:
1. **Passive knowledge sharing**: Writing to shared KB and hoping others read it
2. **Cross-agent context awareness**: Agents don't know what happened while they were inactive
3. **Feedback loops**: Bob rarely learns whether coach used his research, coach rarely learns whether training worked in production

---

## 8. Actionable Recommendations {#8-recommendations}

### 8.1 Immediate (This Week)

1. **Expand knowledge-index.json** from 19 to 50+ entries. The knowledge router is already built and working — it just needs more entries to index. Prioritize entries from WKWA synthesis docs and recent verified experiments.

2. **Verify "What Changed" briefing deployment**. Check whether the temporal context injection (from DESIGN-what-changed-briefing.md) is live in production. If not, implement it — it's the single highest-ROI improvement for cross-agent awareness.

3. **Add cross-agent summaries to heartbeat injection**. When coach wakes up, inject 2-3 lines about bob's recent research. When bob wakes up, inject 2-3 lines about coach's recent training results.

### 8.2 Medium-Term (This Month)

4. **Convert top-10 KE findings to forced externalization gates**. The Channel-Task Matrix shows Ch2 is the only reliable channel. For the most critical knowledge (e.g., "verify after edit", "check baseline before building interventions"), create lightweight workflow gates that force the check rather than hoping the agent reads a one-liner.

5. **Implement knowledge decay/pruning**. With 5,131 files and 3.7M words, the KB is drowning the signal. Add automated staleness detection: flag entries not referenced in 30 days, auto-archive hypotheses untested for 60 days.

6. **Create feedback loops**. When bob produces a KE entry tagged for coach, track whether coach actually references it. When coach deploys a training, track whether gym scores improve. Close the loops that are currently open.

### 8.3 Structural (This Quarter)

7. **The Discovery Task Problem has no known solution**. The Channel-Task Matrix shows discovery tasks resist all interventions. The system should *accept this* and focus intervention budget on execution and recognition tasks, where proven channels exist.

8. **External validation is the only reliable self-improvement path**. Invest in expanding gym scenarios and convention checks — these provide the objective feedback that bypasses self-assessment bias. Don't invest in better self-reflection prompts (0% effect on judgment).

9. **Bridge the knowledge production-consumption gap**. The 17:1 accumulation-to-resolution ratio means the system needs to slow down knowledge *creation* and speed up knowledge *delivery*. Consider a hard cap: no new KE entry until the knowledge-index is updated to reflect the previous one.

---

## Appendix: Key Data Points

### Session Statistics
- Total sessions analyzed: 7,932
- Average session ops: ~15 (bimodal: most 2-10 or 15-30)
- Overall success rate: ~76% (status=done)
- Best success rate by op range: 6-10 ops (82%)

### Knowledge Base Statistics
- Total files: 5,131
- Total words: 3,700,000
- Indexed entries (knowledge-index.json): 19
- Verified KE entries: 140+
- Active hypotheses: 46
- Completed experiments: 116
- Synthesis documents (WKWA): 8

### Delegation Statistics
- Total tracked requests: ~20,000+
- Top delegation pair: cron → may (13,762)
- Cross-agent completion rate: 97-100%
- Cross-agent knowledge reference rate: ~10% of sessions

### Evaluation Quality Distribution
- q=5 (excellent): 2,802 sessions
- q=4 (good): 8,286 sessions
- q=3 (acceptable): 1,630 sessions
- q=1-2 (poor): ~2,000 sessions
- q=0 (skipped/meta): 3,050 sessions
