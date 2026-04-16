# Content-First Guard Architecture

**Date**: 2026-04-16  
**Author**: Bob  
**Status**: Proposed  
**Evidence**: EXP-164/165/166 (120 runs), EXP-167 (51 runs), KE-191, H-165  

---

## 1. The Core Mechanism

**Content-first guards inject expert analysis into the agent's context BEFORE the agent starts working. They never require the agent to produce competing analysis.**

The mechanism is simple:

1. Before the agent sees the task, a **knowledge document** (expert analysis) is placed in its workspace or prepended to its instructions
2. The document identifies the specific failure mode, root cause, and correct resolution path
3. The agent works normally — no extra phases, no forced artifacts, no verification gates

This is the opposite of current process-first guards, which inject steps *after* the agent works (verify, re-analyze, produce artifacts).

### Why It Works

Agents fail on hard tasks because of a **recognition bottleneck** — they can't identify non-obvious problems (mathematical impossibilities, test-vs-code bugs, misleading documentation). Expert analysis removes this bottleneck directly.

### Why Process-First Fails on Hard Tasks

EXP-166 Arm D proved the **displacement hypothesis**: even when an agent reads correct expert analysis FIRST and then produces its own analysis, performance drops from 100% to 7%. The act of self-production consumes the cognitive capacity needed to use the expert information. This is not ordering — it's resource competition.

| Approach | Easy tasks (>50% baseline) | Hard tasks (<25% baseline) |
|----------|---------------------------|---------------------------|
| Process-first (force analysis) | Works (100%) | Catastrophic (0%) |
| Content-first (inject analysis) | Works (100%) | Works (100%) |
| Content-first + forced production | Works (100%) | Fails (7%) — displacement |

---

## 2. Architecture

### 2.1 Expert Analysis Documents

Each content-first guard centers on an **expert analysis document** — a markdown file containing:

```markdown
# Expert Analysis: [Domain/Problem Type]

## Root Cause
[Specific identification of the underlying problem]

## Correct Fix Path  
[What to do, step by step]

## Traps to Avoid
[Explicitly name misleading signals the agent will encounter]
- "The CHANGELOG says X was intentional — this is wrong"
- "Test expects 27.17 but the correct answer is 27.18 — fix the test, not the code"
- "Requirements A and B are mathematically incompatible — surface the conflict"
```

**Quality requirements** (from EXP-166/167 evidence):
- Must identify the **actual root cause**, not symptoms
- Must name **specific traps** the agent will encounter  
- Must give **concrete fix guidance** (not "be careful" but "use parameterized queries")

### 2.2 Integration with Workflow Guards

Content-first guards use the existing `WorkflowGuard` interface but operate on `workflow_start` or `step_start` events, injecting knowledge via `warn` demands (which prepend to the agent's task):

```typescript
const contentFirstGuard: WorkflowGuard = {
  name: "content-first-analysis",
  events: ["step_start"],
  costTier: "zero",  // No LLM call — pure text injection
  
  handle(event: WorkflowGuardEvent): Demand[] {
    const analysis = matchAnalysis(event);  // Look up expert doc by task pattern
    if (!analysis) return [];
    
    return [{
      type: "warn",  // "warn" prepends to next step's task text
      message: `## Expert Analysis (from a colleague who investigated this codebase)\n\n${analysis}`
    }];
  }
};
```

**Key**: `costTier: "zero"` — no LLM call, no token cost. This is pure text injection, which is why it scales.

### 2.3 Analysis Matching

The guard needs to match tasks to expert analysis documents. Three strategies, from simple to sophisticated:

**Phase 1 — Manual tagging**: Each expert analysis doc specifies which scenarios/task patterns it applies to. A simple keyword or tag match selects the right document.

```typescript
// analysis-registry.ts
const registry: AnalysisEntry[] = [
  { 
    id: "contradictory-requirements",
    tags: ["performance", "ordering", "impossible-requirements"],
    keywords: ["strict ordering", "throughput", "records per second"],
    document: "analyses/contradictory-requirements.md"
  },
  // ...
];

function matchAnalysis(event: WorkflowGuardEvent): string | null {
  const task = event.task.toLowerCase();
  for (const entry of registry) {
    if (entry.keywords.some(k => task.includes(k))) {
      return readFileSync(entry.document, "utf-8");
    }
  }
  return null;
}
```

**Phase 2 — Pattern classification**: Use a cheap model call to classify the task into a failure-mode category, then select the matching expert analysis. Cost: ~$0.001 per classification.

**Phase 3 — Generative analysis**: For novel tasks with no matching expert document, use a strong model to generate expert analysis from the codebase. This is the scalability unlock — but requires validating that model-generated analysis is as effective as human-written (untested).

### 2.4 Framing

EXP-166's successful framing: *"A colleague has already investigated this codebase."* This frames the analysis as authoritative external input, which triggers analytical reception rather than confirmation bias.

**Do NOT frame as**:
- "Here's some analysis to check" (invites competing production)
- "Consider whether..." (invites alternative hypotheses)
- "You should..." (invites resistance)

**DO frame as**:
- "A colleague investigated and found..." (authoritative, external)
- "Prior investigation identified..." (established fact)
- "The root cause has been identified as..." (definitive)

---

## 3. Failure Modes and Mitigations

### FM-1: Wrong Expert Analysis (HIGH RISK)

If the expert document misidentifies the root cause, the agent will confidently apply the wrong fix.

**Mitigation**: 
- Expert documents require validation against at least 3 successful runs before deployment
- Build documents from post-hoc analysis of *successful* runs, not from theory
- Version documents and track per-document pass rates

### FM-2: No Matching Expert Analysis (MEDIUM RISK)

Novel tasks won't have pre-written expert analysis.

**Mitigation**:
- Fallback to baseline (no guard) — no worse than today
- Phase 3 generative analysis addresses this long-term
- Track "no-match" events to prioritize new document creation

### FM-3: Stale Analysis (MEDIUM RISK)

Codebase changes could make expert analysis incorrect over time.

**Mitigation**:
- Tie expert documents to scenario versions
- If scenario changes, invalidate and re-validate the analysis
- Periodic re-testing (monthly gym runs per document)

### FM-4: Analysis-Production Displacement on Hard Tasks (KNOWN — SOLVED)

If any guard downstream forces the agent to produce analysis, it will displace the content-first benefit.

**Mitigation**:
- **Rule**: When content-first guard fires, suppress any process-first guards for the same workflow. This is a hard constraint — displacement is catastrophic (100% → 7%).
- Implement as a guard priority system: content-first guards set a flag that blocks production-requiring guards.

### FM-5: Over-reliance / Scaling Bottleneck (LOW RISK)

If everything needs expert analysis, document creation becomes a bottleneck.

**Mitigation**:
- Use content-first ONLY for hard tasks (<25% baseline). Easy/medium tasks don't need it.
- Phase 3 generative analysis removes the human bottleneck.

---

## 4. Implementation Plan

### Phase 1: Gym-Only Deployment (Week 1)

Convert the 4 proven gym scenarios to use content-first guards:

| Scenario | Baseline | With F1 | Status |
|----------|----------|---------|--------|
| cascading-fix-trap-v2 | 0% | 100% | Expert doc exists |
| contradictory-requirements | 0% | 100% | Expert doc exists |
| misleading-test-fix | 0% | 100% | Expert doc exists |
| sql-injection-in-query-builder | 67% | 100% | Expert doc exists |

**Deliverables**:
- `content-first-guard.ts` — the guard implementation
- `analyses/` directory with 4 expert documents (already written for experiments)
- `analysis-registry.ts` — manual tag-based matching

### Phase 2: Production Task Patterns (Weeks 2-3)

Identify hard recurring failure patterns in production and write expert analysis documents for them:

| Candidate Pattern | Why Hard | Expert Analysis Needed |
|-------------------|----------|----------------------|
| FM-3.3 verification collapse | Agent claims success without evidence | "Verification requires: read the file after editing, confirm specific content" |
| Multi-file architectural changes | Agent fixes one file, breaks another | Root cause analysis of dependency chains |
| Misleading error messages | Agent fixes symptom, not cause | "The error says X but the actual problem is Y" |

**Deliverables**:
- 3-5 production expert analysis documents
- Pattern classifier for production task matching
- A/B test: content-first vs current guards on matched production tasks

### Phase 3: Generative Analysis Pipeline (Weeks 4-6)

Build a pipeline where a strong model generates expert analysis for novel tasks:

1. Strong model (e.g., o3) reads the codebase and task
2. Generates expert analysis document
3. Analysis is injected into the working agent's context
4. Working agent (e.g., sonnet) executes with the analysis

**Key experiment**: Does model-generated analysis work as well as human-written? If yes, content-first scales to any task. If no, we need to understand what makes human analysis special.

### Phase 4: Guard Interaction Rules (Week 4)

Formalize the interaction between content-first and process-first guards:

```typescript
interface GuardPriority {
  // When content-first fires, these guards are suppressed
  suppressesOnFire: string[];  // e.g., ["verify-analysis", "produce-plan"]
}
```

This prevents the displacement effect (FM-4) at the architectural level.

---

## 5. Which Existing Guards to Convert First

### Convert to Content-First

| Current Guard | Current Behavior | Content-First Replacement |
|---------------|-----------------|--------------------------|
| `verify-wrap` | Forces agent to verify after editing | Inject "always read-after-edit" as context knowledge |
| `evidence-gate` | Blocks finish() without evidence | Inject "your finish() must include file read evidence" as pre-task instruction |

### Keep as Process-First (Low-Risk)

| Guard | Why Keep | Risk |
|-------|----------|------|
| `test-runner` | Runs tests after code changes — no analysis production involved | Zero displacement risk — it's a tool execution, not cognitive task |
| `secret-scanner` | Pattern match on outputs — no agent cognition involved | Pure automation, not a cognitive guard |

### Decision Framework

Convert to content-first when:
- The guard forces the agent to **produce analysis or reasoning** (displacement risk)
- The task the guard addresses has **<25% unassisted success** (hard enough to need it)
- A correct expert analysis can be written in advance

Keep as process-first when:
- The guard runs **automated checks** (tests, linting, scanning) — no displacement
- The guard addresses **easy tasks** (>50% baseline) — any approach works

---

## 6. Key Design Principles

1. **Inject, don't require**. Give the agent information. Never require it to produce competing information on hard tasks.

2. **Frame as authoritative external input**. "A colleague found..." not "Consider whether..."

3. **Zero-cost injection**. Content-first guards are costTier "zero" — pure text, no LLM calls.

4. **Suppress production guards when active**. If content-first fires, block any downstream guard that forces analysis production.

5. **Difficulty-gated deployment**. Only use content-first on hard tasks (<25% baseline). Easy tasks don't need the overhead of maintaining expert documents.

6. **Validate with runs, not theory**. Every expert analysis document must demonstrate effectiveness in at least 3 gym runs before production deployment.

---

## 7. Evidence Summary

| Experiment | N | Key Finding |
|------------|---|-------------|
| EXP-164 | 20 | On easy tasks, both F1 and F2 work (ceiling) |
| EXP-165 | 48 | On hard tasks, only F1 works; F2 = 0%; F1+F2 = 0% |
| EXP-166 | 120 | Displacement confirmed (D=7% vs C=100%); generalizes to recognition tasks |
| EXP-167 | 51 | F1 generalizes to judgment + diagnosis tasks (100% on both) |
| **Total** | **239** | **Content-first: 100% on hard tasks across 4 failure types** |

---

## Cross-References

| Entry | Relationship |
|-------|-------------|
| KE-191 | F1 generalization finding (+100pp across 4 types) |
| H-165 | Production-provision interference hypothesis (confirmed) |
| DD-769 | Solver-sampler mismatch — same displacement mechanism in negotiations |
| KE-091 | Alignment tax — forced verification harms complex tasks (content-first avoids this) |
| KE-123 | Intervention stacking degradation — content-first is a single intervention |
| content-first-guards.md | Prior design notes (this doc supersedes) |
