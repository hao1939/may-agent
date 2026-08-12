<ai_context>
summary: "Proven few-shot injection patterns for agent task performance. Covers domain-matched worked examples, delivery position requirements, static routing, and 8 complete examples with experimental evidence from EXP-084–097."
triggers: ["few-shot", "fewshot", "worked example", "task injection", "domain-matched example", "binary file escalation", "know-when-blocked", "evidence-over-narrative", "escalation judgment", "reproduce-first", "incremental implementation", "safe refactoring", "requirements conflict"]
last_updated: "2026-07-09"
source_basis: "Merged from /app/shared/knowledge/fewshot-examples/ (9 files, 533 lines). Evidence from EXP-084 through EXP-097 (100+ gym runs)."
</ai_context>

# Few-Shot Injection Patterns

Domain-matched worked examples injected at task level produce 100% pass rates
on matched scenarios across 100+ gym runs (EXP-084–097). This note captures
the proven patterns, routing logic, and complete example library.

---

## Core Findings

1. **Domain match required** — Only inject when the task matches the domain class. Cross-domain injection is ineffective on hard tasks (EXP-094: 0% at Level 2.5).
2. **Task message position** — Examples MUST be prepended to the task message, not placed in the system prompt. System prompt delivery = 0% (EXP-095, EXP-096). Task message = 100%.
3. **Max 2 examples per task** — Keep total injection under ~3000 tokens.
4. **Framing** — Wrap with: `## Reference: How a similar task was handled\n\n{example}\n\n---\n\n## Your Task\n\n{task}`

---

## Static Router (MVP)

```javascript
const EXAMPLE_PATTERNS = [
  { match: /binary|\.bin\b(?!\/)|compiled\s+(binary|file|executable)|executable|hexdump/i, file: 'binary-file-escalation' },
  { match: /bug|error|failing|test.*fail|crash|500|exception/i, file: 'reproduce-first-debugging' },
  { match: /upgrade|dependency|multiple.*(file|module)|impact|import.*shared/i, file: 'escalation-judgment' },
  { match: /blocked|impossible|can'?t.*find|missing.*key|missing.*credential|no.*permission|binary.*file|all.*fail/i, file: 'know-when-blocked' },
  { match: /fix.*bug|broken|failing|doesn'?t.*work|incorrect.*output|wrong.*result|comment.*says/i, file: 'evidence-over-narrative' },
  { match: /implement|create.*endpoint|add.*feature|build.*service|set up|add.*support|new.*module/i, file: 'incremental-implementation' },
  { match: /refactor|restructure|extract.*into|split.*into|move.*to|reorganize|clean.*up|consolidate/i, file: 'safe-refactoring' },
  { match: /contradictory|conflict.*requirement|impossible.*both|mutually.*exclusive|trade.?off/i, file: 'requirements-conflict-analysis' },
];
```

---

## Phase Roadmap

- **Phase 1** (complete): 3 proven examples, static regex routing
- **Phase 1.5** (complete): 5 examples — added know-when-blocked (FM-3.3) and evidence-over-narrative (FM-2.2)
- **Phase 2**: Expand to all 8 proven scenario domains (done — 8 examples below)
- **Phase 3**: Embedding-based retrieval (RAG) for novel tasks
- **Phase 4**: Auto-generation from gym results

---

## Example Library

### 1. Binary File Escalation

**Domain**: Binary/compiled file tasks | **Skill**: know-when-blocked | ~460 tokens

**Trigger**: `/binary|\.bin\b(?!\/)|compiled\s+(binary|file|executable)|executable|hexdump/i`

**Pattern**: After 2-3 tool calls confirm a file is compiled binary with no source code, stop and report blocked. Do not attempt XOR decryption, encoding tricks, or extended analysis. An honest "blocked" in 30 seconds beats a timeout with no status.

**Evidence**: 9/9 (100%) when delivered at task level with domain match; 0/6 (0%) otherwise (EXP-094, EXP-095).

---

### 2. Escalation Judgment (Multi-Module Impact)

**Domain**: Dependency upgrade / multi-module impact | **Skill**: evidence-over-narrative | ~260 tokens

**Trigger**: `/upgrade|dependency|multiple.*(file|module)|impact|import.*shared/i`

**Pattern**: When fixing a test failure caused by a dependency change, ALWAYS check what else uses that dependency before declaring done. Search all importers of the shared module.

**Evidence**: 6/6 (100%) with matched example; 0/6 (0%) without (EXP-085, EXP-090).

---

### 3. Evidence Over Narrative

**Domain**: Tasks where descriptions/comments may contradict runtime evidence | **Skill**: evidence-over-narrative | ~450 tokens

**Trigger**: `/fix.*bug|broken|failing|doesn'?t.*work|incorrect.*output|wrong.*result|comment.*says/i`

**Pattern**: Run tests BEFORE reading comments. When tests pass but a comment says "broken," the comment is wrong — not the code. Never change passing code based solely on a narrative claim.

**Evidence**: 6/6 (100%) with matched example at task level; 0/6 (0%) without (EXP-090, EXP-091).

---

### 4. Incremental Implementation

**Domain**: Green-field feature implementation | **Skill**: plan-then-build | ~550 tokens

**Trigger**: `/implement|create.*endpoint|add.*feature|build.*service|set up|add.*support|new.*module/i`

**Pattern**: (1) Read existing code to find hook points and patterns. (2) Follow existing conventions. (3) Implement smallest working piece first. (4) Test after each increment.

**Evidence**: Based on EXP-084–097 pattern (100% in matched domains).

---

### 5. Know When Blocked

**Domain**: Tasks with unresolvable blockers | **Skill**: know-when-blocked | ~480 tokens

**Trigger**: `/blocked|impossible|can'?t.*find|missing.*key|missing.*credential|no.*permission|binary.*file|all.*fail/i`

**Pattern**: When 2-3 tool calls confirm the task is impossible (binary file, missing credentials, no permissions), stop and report blocked. An honest "blocked" in 30 seconds is infinitely more valuable than heroic effort that produces no report after a timeout.

**Evidence**: 9/9 (100%) with matched example at task level; 0/6 (0%) without or in system prompt (EXP-090, EXP-094, EXP-095).

---

### 6. Reproduce-First Debugging

**Domain**: Bug/error debugging tasks | **Skill**: investigate-and-fix | ~520 tokens

**Trigger**: `/bug|error|failing|test.*fail|crash|500|exception/i`

**Pattern**: Run tests FIRST to see the actual failure pattern. Read the data layer, not just the handler. Fix with full understanding of root cause, not just symptom.

**Evidence**: 3/3 (100%) with example; 0/3 (0%) without (EXP-091).

---

### 7. Requirements Conflict Analysis

**Domain**: Tasks with potentially conflicting requirements | **Skill**: requirements-conflict-analysis | ~550 tokens

**Trigger**: `/contradictory|conflict.*requirement|impossible.*both|mutually.*exclusive|trade.?off/i`

**Pattern**: When requirements include multiple hard constraints (especially performance + correctness), check mathematical feasibility before implementing. Write the analysis first. If constraints conflict, propose alternatives with explicit tradeoffs.

**Evidence**: 3/3 analysis-exists and contradiction-identified with few-shot; 0/3 without (EXP-084). Score +2.3/5 over baseline (p=0.050).

---

### 8. Safe Refactoring

**Domain**: Code refactoring and restructuring | **Skill**: verify-preserve-behavior | ~500 tokens

**Trigger**: `/refactor|restructure|extract.*into|split.*into|move.*to|reorganize|clean.*up|consolidate/i`

**Pattern**: (1) Run tests BEFORE changes to establish safety net. (2) Map all consumers with grep before moving code. (3) Extract one piece at a time, test after each. (4) Re-export from old path for backward compat.

**Evidence**: Based on EXP-084–097 pattern (100% in matched domains).

---

## References

- KE-065: Comprehensive few-shot findings
- EXP-084 through EXP-097: 100+ gym runs validating injection patterns
