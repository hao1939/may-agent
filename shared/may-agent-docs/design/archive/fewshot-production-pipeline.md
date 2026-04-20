# Few-Shot Production Injection Pipeline

**Status:** Design brief — pending tech-lead / Hao review  
**Date:** 2026-04-09  
**Author:** Bob (architecture)  
**Evidence base:** EXP-084 through EXP-097, 100+ gym runs. See [KE-065](../../knowledge/entries/KE-065-fewshot-comprehensive-findings.md) for comprehensive findings.  
**Depends on:** [GYM-GRADUATION-REVIEW](../../knowledge/synthesis/GYM-GRADUATION-REVIEW.md) (approved 2026-04-09)

---

## 1. The Problem

Production agents fail repeatedly on judgment, process-discipline, and escalation tasks. Skills deployed via SKILL.md files (loaded into the system prompt) produce **0% improvement** on these failure patterns — empirically proven across 32+ runs and 3 experiments (EXP-088, EXP-095, EXP-096). We now understand the mechanism: the model treats system-prompt content as "general rules" and task-message content as "what to do NOW." This is a **positional privilege** effect — architectural in causal decoders, not a training artifact (DD-660, four papers).

The fix is proven: domain-matched few-shot examples injected at the task-message level achieve **18/18 (100%)** across 7 scenario types. The pipeline described here deploys this mechanism to production.

### What this solves

| Failure Mode | Current Impact | Expected After Deployment |
|---|---|---|
| FM-2.6 (reasoning-action mismatch) | Recurring on judgment tasks | Eliminated for matched domains |
| FM-3.1 (ghost deliverables) | Silent quality failures | Reduced via evidence-over-narrative example |
| FM-1.3 (path-guessing / looping) | Wasted tool calls | Reduced via reproduce-first example |
| Binary-file escalation failures | 0/15+ historical | 100% (EXP-094, EXP-095) |
| Reproduce-first compliance | 0/7 across EXP-019 + EXP-091 | 100% (EXP-091) |

---

## 2. The Evidence (Why We're Confident)

Twelve experiments isolate the mechanism and its boundaries:

| Finding | Evidence | Confidence |
|---|---|---|
| Task-message few-shot = 100% on matched scenarios | 18/18 across 7 scenarios (EXP-084–097) | Very high |
| System-prompt few-shot = 0% | 0/9 across 3 experiments (EXP-088, 095, 096) | Very high |
| Position effect is architectural, not prompt-length | 77% prompt reduction → still 0% (EXP-096) | High |
| Domain match required for hard tasks | 0% cross-domain on hard, 100% matched (EXP-094) | High |
| Temporal discipline NOT fixable by few-shot | C2.3 read-after-write -20pp (EXP-093) | High |
| Combined few-shot + checklist > either alone | 67% combined vs 33%+0% (EXP-089) | Moderate |

**The key numbers:**
- Task-message delivery: **15/15 (100%)**
- System-prompt (no framing): **0/9 (0%)**
- System-prompt (urgency framing): **1/3 (33%)**
- Text rules alone: **0/32+ (0%)**

---

## 3. Technical Design

### 3.1 Where Injection Happens

The injection point is in the **task dispatch pipeline** — after the task description is assembled but before it's sent to the agent. This is a new middleware step.

```
Current flow:
  Task description assembled → injected_context read → Agent session started
                                                        ↑ skills in system prompt (0% effective)

New flow:
  Task description assembled → CLASSIFIER → EXAMPLE LOOKUP → TASK ASSEMBLY → Agent session started
                                  ↓               ↓                ↓
                             Pattern match   Read example    Prepend example
                             on task text    from store      to task message
```

**Integration point:** The existing `injected_context` infrastructure already demonstrates that task-message prepending works (EXP-095 Arms A+C both 100%). The pipeline adds automated selection logic upstream of that mechanism.

**Concretely**, this is a function called during task dispatch that:
1. Receives the task description string
2. Runs pattern matching against it
3. Reads 0-2 matched example files from the example store
4. Returns the augmented task string with examples prepended

### 3.2 Routing Logic (Static Regex — Phase 1)

Phase 1 uses static regex patterns with **high-precision** matching. This is the critical design choice: false negatives (missing a match) are cheap — the agent works as before. False positives (injecting the wrong example) are expensive — they can cause task narrowing (EXP-092's execution crowding effect).

```javascript
// Example store: agents/shared/knowledge/fewshot-examples/
const FEWSHOT_DIR = 'agents/shared/knowledge/fewshot-examples';

const ROUTES = [
  {
    name: 'binary-file-escalation',
    // High precision: targets binary/compiled file references specifically
    match: /binary\b|\.bin\b|compiled|executable|hexdump/i,
    file: 'binary-file-escalation.md',
    maxTokens: 1500,
  },
  {
    name: 'reproduce-first-debugging',
    // Higher precision than /bug|error/: requires test-related context
    match: /fix.*(?:test|spec).*fail|test.*(?:wrong|incorrect)|assertion.*(?:error|mismatch)|reproduce.*(?:bug|issue)|(?:bug|error).*(?:test|spec)/i,
    file: 'reproduce-first-debugging.md',
    maxTokens: 1500,
  },
  {
    name: 'escalation-judgment',
    // Targets multi-module impact scenarios
    match: /(?:upgrade|update).*(?:dependency|package)|multiple\s+(?:file|module|consumer)|impact.*(?:analysis|assessment)|shared.*(?:module|import)/i,
    file: 'escalation-judgment.md',
    maxTokens: 1500,
  },
  {
    name: 'know-when-blocked',
    // Targets impossible/blocked task recognition
    match: /missing\s+(?:credential|api[_\s]key|secret|token|permission)|(?:can'?t|cannot)\s+(?:access|connect|authenticate)|blocked\s+(?:by|on|waiting)/i,
    file: 'know-when-blocked.md',
    maxTokens: 1500,
  },
  {
    name: 'evidence-over-narrative',
    // Targets misleading description scenarios
    match: /(?:comment|doc|description)\s+(?:says|claims|states).*(?:but|however)|(?:wrong|incorrect|outdated)\s+(?:comment|documentation|description)/i,
    file: 'evidence-over-narrative.md',
    maxTokens: 1500,
  },
];
```

**Why these patterns are narrower than Coach's proposal (M1 from GYM-GRADUATION-REVIEW):**

| Coach's Pattern | Problem | This Design's Pattern | Estimated Fire Rate |
|---|---|---|---|
| `/bug\|error\|failing\|broken/i` | Matches ~80% of coder tasks | `/fix.*test.*fail\|test.*wrong\|assertion.*error/i` | ~5-10% |
| `/credentials\|api.key\|env.var\|secret/i` | Matches any task mentioning env vars | `/missing\s+(?:credential\|api[_\s]key)…/i` | ~2-5% |
| `/binary\|\.bin\|compiled\|executable/i` | Reasonable — kept similar | `/binary\b\|\.bin\b\|compiled\|executable/i` | ~1-3% |

**Target injection rate: 5-15% of tasks.** If audit logs show >25%, tighten patterns.

### 3.3 Task Assembly

When 1-2 examples match, they're prepended to the task message with clear framing:

```javascript
function assembleTask(originalTask, matchedExamples) {
  if (matchedExamples.length === 0) return originalTask;
  
  // Cap at 2 examples, ~3000 tokens total
  const selected = matchedExamples.slice(0, 2);
  
  const exampleText = selected
    .map(ex => readFileSync(`${FEWSHOT_DIR}/${ex.file}`, 'utf8'))
    .join('\n\n---\n\n');
  
  return [
    '## Reference: How a similar task was handled',
    '',
    exampleText,
    '',
    '---',
    '',
    '## Your Task',
    '',
    originalTask,
  ].join('\n');
}
```

**Design decisions:**
- **Max 2 examples** — EXP-092 showed instruction/example overload causes execution crowding. 2 is safe; 3+ is untested.
- **"Reference" framing** — not "you must follow this." The example is advisory, not directive. This matches the gym delivery mechanism (injected_context.md).
- **Original task is last** — leveraging the recency effect (DD-660). The task message ends with the actual task, not the examples.

### 3.4 Example Store

Already exists at `agents/shared/knowledge/fewshot-examples/` with 5 proven examples:

| File | Domain Class | Source | Tokens (est.) |
|---|---|---|---|
| `binary-file-escalation.md` | Binary/compiled file tasks | EXP-094, EXP-095 | ~800 |
| `reproduce-first-debugging.md` | Bug/error debugging tasks | EXP-091 | ~700 |
| `escalation-judgment.md` | Dependency/multi-module impact | EXP-085, EXP-090 | ~900 |
| `know-when-blocked.md` | Unresolvable blockers | EXP-090, EXP-094 | ~800 |
| `evidence-over-narrative.md` | Misleading descriptions | EXP-090, EXP-091 | ~750 |

Each file is a standalone worked example showing the reasoning process for one domain class. The INDEX.md in that directory maintains the mapping and usage rules.

### 3.5 Feature Flag

The pipeline must have a kill switch:

```javascript
const FEWSHOT_ENABLED = process.env.FEWSHOT_INJECTION !== 'disabled';
// Default: enabled. Set FEWSHOT_INJECTION=disabled to turn off entirely.
```

This is the rollback mechanism. If any production regression is observed, disable the entire pipeline with one env var change. No code deployment needed.

---

## 4. Audit & Logging

Every injection event must be logged. This is not optional — it's how we measure production impact and detect routing problems.

### 4.1 What to Log

For each task dispatch:

```javascript
{
  timestamp: '2026-04-09T12:00:00Z',
  sessionId: 's_xxx',
  agent: 'coder',
  taskHash: sha256(originalTask).slice(0, 12),  // For dedup, not PII
  matched: ['reproduce-first-debugging'],         // Which examples matched
  injected: ['reproduce-first-debugging'],        // Which were actually injected (after cap)
  skipped: [],                                     // Matched but over the 2-example cap
  injectionRate: 0.08,                            // Running % of tasks with injection
  tokenOverhead: 700,                             // Tokens added to task
}
```

### 4.2 Natural Experiment

The audit log creates a natural experiment for free:
- **Treatment group**: Tasks where examples were injected (matched a routing pattern)
- **Control group**: Tasks where no examples matched (no injection)

This is confounded by task type (binary tasks get binary examples, non-binary tasks don't), so it's not a true A/B test. But it gives us:
- **Injection rate monitoring**: Should be 5-15%. If higher, patterns are too broad.
- **False positive detection**: Review injected tasks manually in the first 48h. Does the example actually match the task?
- **Outcome signal**: Compare evaluator scores for injected vs non-injected tasks of similar types.

A true randomized A/B framework is deferred (per GYM-GRADUATION-REVIEW §5). The natural experiment is sufficient for Phase 1 validation.

---

## 5. Phase 1 Deployment: First 3 Examples

### 5.1 Which Examples Deploy First

The three highest-impact, highest-confidence examples:

| Priority | Example | Target FM | Lab Evidence | Confidence |
|---|---|---|---|---|
| 1 | `binary-file-escalation` | FM-2.6 | 0%→100%, 9/9 across EXP-094+095 | Very high |
| 2 | `reproduce-first-debugging` | FM-2.6 | 0%→100%, 3/3 in EXP-091 | High |
| 3 | `escalation-judgment` | FM-2.6, FM-3.1 | 12.5%→100%, 3/3 in EXP-085 | High |

**Why these three:**
- All have 100% lab pass rate on matched scenarios
- All target FM-2.6 (reasoning-action mismatch), the most impactful production failure mode
- All have narrow, precise trigger patterns with low false-positive risk
- Combined, they cover binary files, debugging, and multi-module dependency tasks

### 5.2 What's NOT in Phase 1

`know-when-blocked` and `evidence-over-narrative` are held for Phase 2. Their trigger patterns overlap more with general task language (e.g., "broken", "failing"), so they need the Phase 1 audit data to calibrate pattern precision before deployment.

### 5.3 Validation Gate (M3 from GYM-GRADUATION-REVIEW)

**Before expanding to Phase 2**, Phase 1 must run for 48 hours with audit logging. Review criteria:

| Metric | Target | Action if Failed |
|---|---|---|
| Injection rate | 5-15% of tasks | Tighten regex patterns |
| False positive rate | <10% (manual review of first 50 injections) | Tighten regex patterns or remove offending route |
| Production regressions | 0 (no tasks that previously passed now fail) | Disable pipeline (feature flag) |
| Evaluator score delta | Non-negative for injected tasks | Investigate — may indicate wrong-example routing |

Only after passing this gate does Phase 2 (add remaining 2 examples) proceed.

---

## 6. Phase 2: Expand to 5 Examples

After 48h production validation:

1. Add `know-when-blocked` with calibrated trigger pattern
2. Add `evidence-over-narrative` with calibrated trigger pattern
3. Patterns informed by Phase 1 audit data (actual task descriptions, false positive analysis)

Phase 2 is expected to be a ~30-minute code change once Phase 1 patterns are validated.

**No Phase 3 (RAG/embedding retrieval).** Per GYM-GRADUATION-REVIEW M4: with 5-7 proven examples and precise routing, static patterns cover the known failure modes. RAG becomes worthwhile only with 50+ examples. We're nowhere near that. Don't build infrastructure for a problem we don't have.

---

## 7. Constraints & Boundaries

### What few-shot CAN fix (deploy)
- ✅ Judgment skills (know-when-blocked, evidence-over-narrative): 0%→100%
- ✅ Process discipline (reproduce-first): 0%→100%
- ✅ Validation knowledge (convention-verify-edit): +40pp

### What few-shot CANNOT fix (don't attempt)
- ❌ Temporal discipline / tool-call sequencing: -20pp regression (EXP-093)
- ❌ Cross-domain transfer on hard tasks: 0% (EXP-094)
- ❌ Multi-requirement attention management: execution crowding (EXP-092)

### Token budget
- Each example: 500-1500 tokens
- Max 2 per task: ~3000 tokens overhead
- Well within 128K context limits; no truncation risk

### Domain matching requirement
- Examples must match domain class (Level 2 minimum per KE-059's transfer model)
- Cross-domain injection on hard tasks = 0% — this is why routing precision matters
- Each domain class needs its own example

---

## 8. Implementation Checklist

For tech-lead / coder to implement:

1. **Add fewshot classifier function** — takes task string, returns matched example filenames
   - Location: task dispatch pipeline (wherever `task.md` / `injected_context` is assembled)
   - Uses the ROUTES array from §3.2
   
2. **Add task assembly function** — prepends matched examples to task message
   - Location: same module
   - Uses the framing from §3.3
   
3. **Add audit logging** — log every dispatch (matched or not) per §4.1
   - Location: append to existing dispatch logs or new `fewshot-audit.jsonl`
   
4. **Add feature flag** — `FEWSHOT_INJECTION` env var per §3.5
   
5. **Wire into dispatch** — call classifier → assembly → log in the task dispatch path
   - Must run AFTER task description is finalized, BEFORE agent session starts
   
6. **Validate** — run the 3 corresponding gym scenarios through the production path (not gym's injected_context) and confirm pass rates match lab results

**Estimated effort:** 2-4 hours for a coder familiar with the dispatch pipeline.

---

## 9. Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| Wrong example injected (false positive routing) | Medium | High-precision regex (§3.2), 48h validation gate (§5.3), feature flag (§3.5) |
| Task narrowing from example overload | Low | Max 2 examples, "Reference" framing (§3.3), proven safe in gym |
| Example becomes stale as model updates | Low | Examples encode reasoning patterns, not model-specific tricks. Re-validate on model updates via gym regression suite |
| Performance overhead | Negligible | Regex matching + file read = <5ms. No LLM calls. |
| Example store grows unmanaged | Low | INDEX.md maintains inventory. Phase 3 (RAG) deferred indefinitely. |

---

## 10. Success Criteria

After 1 week of production deployment:

1. **Injection rate** between 5-15% of coder tasks
2. **Zero production regressions** attributable to few-shot injection
3. **Evaluator scores non-negative** for injected tasks vs historical baselines
4. **At least one confirmed save** — a task that would have failed (matching historical failure pattern) that succeeds with few-shot injection
5. **Audit log generating data** — natural experiment metrics available for review

---

*References: [KE-065](../../knowledge/entries/KE-065-fewshot-comprehensive-findings.md), [KE-059](../../knowledge/entries/KE-059-fewshot-breaks-text-rule-binary.md), [GYM-GRADUATION-REVIEW](../../knowledge/synthesis/GYM-GRADUATION-REVIEW.md), [Example Store INDEX](../../knowledge/fewshot-examples/INDEX.md), [Coach's Proposal](../../../coach/workspace/proposal-fewshot-production-deployment.md)*
