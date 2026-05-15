# Proposal: Task-Level Few-Shot Injection for Production Agents

**Author**: Coach  
**Date**: 2026-04-09  
**Status**: PROPOSAL — for tech-lead / Bob review  
**Evidence base**: 13 experiments (EXP-084 through EXP-096), 100+ gym runs  
**Full findings**: See [KE-065](../../shared/knowledge/entries/KE-065-fewshot-comprehensive-findings.md)

---

## 1. The Problem

Production agents fail repeatedly on judgment, process-discipline, and escalation tasks. Skills deployed via SKILL.md (loaded into the system prompt) produce **0% improvement** on these failure patterns. We now know why — and how to fix it.

**Current failure modes addressable by few-shot:**

| Failure Mode | Description | Production Impact |
|---|---|---|
| FM-1.3 | Path-guessing / looping on unfamiliar directories | Wasted tool calls, session timeouts |
| FM-2.6 | Reasoning-action mismatch (does wrong thing despite knowing right thing) | Task failures on judgment tasks |
| FM-3.1 | Ghost deliverables (claims success without producing output) | Silent quality failures |

## 2. The Evidence

Twelve experiments isolate the mechanism. Here's the chain:

| Experiment | Question | Key Finding |
|---|---|---|
| EXP-084 | Do any lightweight methods beat text rules? | Few-shot = +2.3 score on contradictory-requirements (text rules = 0%) |
| EXP-085 | Does few-shot generalize across scenarios? | Matched example → 100% on escalation-judgment (N=3) |
| EXP-086 | Does a mismatched example still help? | Partially: 67% on moderate tasks, but worse than matched |
| EXP-087 | Does few-shot work on sycophants-dilemma? | Yes: 100% (N=3) vs 67% baseline |
| EXP-088 | Can we put few-shot IN the skill text? | **No: 0% — regression.** System-prompt delivery kills few-shot |
| EXP-089 | Does few-shot + checklist combine? | Yes: 67% combined > 33% + 0% separately |
| EXP-090 | Sprint 1: know-when-blocked, evidence-over-narrative | Both: 0% → 100% (N=3+3). Judgment skills converted |
| EXP-091 | Sprint 2: investigate-and-fix (process discipline) | 0% → 100% (N=3). Few-shot works beyond judgment |
| EXP-092 | Can instructions fix documentation gaps? | **No: task narrowing.** Instructions have opportunity cost |
| EXP-093 | Sprint 3: verify-after-edit (temporal discipline) | **Boundary found.** Validation +40pp, but read-after-write −20pp |
| EXP-094 | Cross-domain transfer on hardest scenario | Domain match required: 0% cross-domain, 100% matched (N=3+3) |
| EXP-095 | Delivery mechanism: task msg vs system prompt | **Position is everything.** Task-level = 100%, system prompt = 0% |
| EXP-096 | System prompt length threshold | **Attention dilution REJECTED.** 11KB prompt = same 0% as 48KB. Mechanism is positional privilege, not length. |

### Summary statistics
- **Matched few-shot at task level**: 18/18 (100%) across 7 scenarios
- **Few-shot in system prompt (SKILL.md)**: 0/9 (0%) across 3 experiments
- **Text rules alone**: 0/32+ (0%) historically

### The position effect (EXP-095, definitive)

| Delivery Position | Pass Rate | N |
|---|---|---|
| Task message (injected_context.md prefix) | **100%** | 6 |
| Task message (inline in task.md body) | **100%** | 3 |
| System prompt (SKILL.md v2.0, domain-matched) | **0%** | 3 |
| No intervention | **0%** | 15+ |

Content quality doesn't matter if delivery position is wrong. v2.0 skill had binary-specific examples, three-call rules, anti-patterns — still 0% from system prompt. EXP-096 confirmed this is NOT about prompt length: a minimal 11KB system prompt produced the same 0% as a full 48KB prompt. The mechanism is **positional privilege** — the model treats system prompt as "general rules" and task message as "what to do NOW."

## 3. What Needs to Change

**Current flow (broken):**
```
Task arrives → Agent reads system prompt (SKILL.md skills) → Agent reads task → Works on task
                    ↑ skills are here (treated as "general rules", not actionable guidance)
                      = 0% effective on hard judgment tasks (even with minimal prompt — EXP-096)
```

**Required flow:**
```
Task arrives → Classify task → Retrieve matched example → Prepend to task message → Agent works
                                                            ↑ examples are here (adjacent to task)
                                                              = 100% effective
```

## 4. Technical Design

### Architecture: Task-Level Example Injection

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│ Task Router   │ ──→ │ Classifier   │ ──→ │ Example Store│
│ (existing)    │     │ (new)        │     │ (new)        │
└──────────────┘     └──────────────┘     └──────────────┘
                            │                     │
                            ↓                     ↓
                     ┌──────────────────────────────┐
                     │ Task Message = example + task │
                     └──────────────────────────────┘
                                    │
                                    ↓
                            ┌──────────────┐
                            │ Agent works   │
                            └──────────────┘
```

### Components

**A. Example Store** — `agents/shared/knowledge/fewshot-examples/`
```
fewshot-examples/
  INDEX.md                    # Maps domain classes to example files
  binary-file-escalation.md   # "Fix binary.bin" → recognize + escalate
  credentials-missing.md      # Missing env vars → recognize + escalate
  multi-module-impact.md      # Payment bug → check all consumers
  reproduce-first.md          # Bug report → run tests before editing
  ...
```

Each file is a standalone worked example (500-1500 tokens) showing the reasoning process for one domain class.

**B. Task Classifier** — Pattern matching on task content

MVP: Static keyword/pattern routing. No LLM call needed.

```javascript
function classifyTask(taskContent) {
  const patterns = [
    { match: /binary|\.bin|compiled|executable/i, example: 'binary-file-escalation' },
    { match: /credentials|api.key|env.var|secret/i, example: 'credentials-missing' },
    { match: /bug|error|failing|broken/i,          example: 'reproduce-first' },
    { match: /multiple.*(file|module)|impact/i,    example: 'multi-module-impact' },
  ];
  return patterns.filter(p => p.match.test(taskContent)).map(p => p.example);
}
```

**C. Task Message Assembly** — Prepend matched examples to task

```javascript
function assembleTaskMessage(task, matchedExamples) {
  if (matchedExamples.length === 0) return task;
  
  const exampleContent = matchedExamples
    .map(name => readFile(`agents/shared/knowledge/fewshot-examples/${name}.md`))
    .join('\n\n---\n\n');
  
  return `## Reference: How a similar task was handled\n\n${exampleContent}\n\n---\n\n## Your Task\n\n${task}`;
}
```

## 5. Implementation Options

| Option | Complexity | Coverage | Latency | Recommended? |
|---|---|---|---|---|
| **A. Static routing** (regex patterns) | Low | Known scenarios only | 0ms | **MVP — start here** |
| **B. Embedding similarity** (RAG) | Medium | Novel tasks too | 50-100ms | Phase 2 |
| **C. LLM classifier** | High | Best coverage | 500ms+ | Overkill for now |

**Recommendation**: Start with Option A. We have proven examples for 7 scenarios. Static routing covers the known failure modes with zero latency. Move to Option B when we have 20+ examples and need to handle novel task types.

## 6. Constraints and Boundaries

### What few-shot CAN fix (deploy these)
- ✅ Judgment skills (know-when-blocked, evidence-over-narrative)
- ✅ Process discipline (investigate-and-fix / reproduce-first)
- ✅ Validation knowledge (convention-verify-edit)

### What few-shot CANNOT fix (don't attempt)
- ❌ Temporal discipline / tool-call sequencing (read-after-write) → needs workflow enforcement
- ❌ Cross-domain on hard tasks (credentials example won't fix binary-file task) → need domain-matched examples
- ❌ Multi-requirement tasks (instructions cause task narrowing) → needs structural enforcement

### Token budget
- Each worked example: 500-1500 tokens
- Max 2 examples per task: ~3000 tokens added to task message
- Well within context limits; no truncation risk

### Domain matching requirement
- Examples must match the **domain class** of the target task (Level 2 match minimum)
- A credentials example won't fix a binary-file task (0% at Level 2.5 on hard scenarios)
- Each domain class needs its own example — can't use one generic example

## 7. Minimum Viable Version

**Deploy immediately with the 3 proven, highest-impact scenarios:**

| Scenario | Example Source | Trigger Pattern | Expected Impact |
|---|---|---|---|
| Binary file escalation | EXP-094/095 injected_context | `/binary\|\.bin\|compiled/i` | FM-2.6 elimination on binary tasks |
| Reproduce-first debugging | EXP-091 injected_context | `/bug\|error\|failing\|test.*fail/i` | FM-2.6 reduction on debugging tasks |
| Multi-module impact check | EXP-085 injected_context | `/multiple\|impact\|consumer/i` | FM-2.6/3.1 reduction on multi-file tasks |

**Files to create:**
1. `agents/shared/knowledge/fewshot-examples/` — directory with 3 example files
2. Task assembly logic in the dispatch/routing layer
3. Classification patterns (hardcoded regex for MVP)

**Effort estimate**: ~2 hours to extract examples from gym scenarios, wire up static routing, and test.

**Validation**: Run the gym scenarios with the production injection path (not gym's injected_context.md) and confirm 100% pass rate matches experimental results.

## 8. Expected Impact

Based on experimental evidence:

| Metric | Before (system prompt skills) | After (task-level injection) | Evidence |
|---|---|---|---|
| Judgment task pass rate | 0% on hard scenarios | ~100% on matched scenarios | 18/18 across 7 scenarios |
| Binary-file escalation | 0% (0/15+) | 100% (9/9 in experiments) | EXP-094, EXP-095 |
| Reproduce-first compliance | 0% (0/7) | 100% (3/3) | EXP-091 |
| FM-2.6 (reasoning-action mismatch) | Recurring | Eliminated for matched domains | Direct mechanism match |
| Token overhead | 0 | +1000-3000 per task | Negligible vs 128K context |

### What this does NOT solve
- Tasks with no matching example in the store (need Option B / RAG for coverage)
- Temporal discipline failures (need workflow enforcement)
- Novel failure modes without prior experimental validation

## 9. Rollout Plan

| Phase | Scope | Timeline | Success Metric |
|---|---|---|---|
| **Phase 1** | 3 proven examples, static routing | Week 1 | Gym pass rate matches experiments |
| **Phase 2** | Extract examples from all 7 proven scenarios | Week 2 | 7 scenarios covered |
| **Phase 3** | Embedding-based retrieval (RAG) | Week 3-4 | Novel tasks get relevant examples |
| **Phase 4** | Auto-example generation from gym results | Month 2 | Example store grows with experiments |

## 10. Decision Required

**Do we implement Phase 1 (static routing, 3 examples)?**

- **Cost**: ~2 hours of implementation
- **Risk**: Low — mechanism proven across 100+ gym runs with 100% hit rate on matched scenarios
- **Benefit**: Eliminates known FM-2.6 failures on binary, debugging, and multi-module tasks
- **Alternative**: Continue with system-prompt skills (proven 0% effective on these failure modes)
