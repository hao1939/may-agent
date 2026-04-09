# Anti-Confabulation Production Deployment

**Status:** Design brief — pending tech-lead / Hao review  
**Date:** 2026-04-09 (revised 2026-04-09 with EXP-104 confound findings)  
**Author:** Bob (architecture)  
**Evidence base:** EXP-102 (diagnosis), EXP-103 (treatment), **EXP-104 (confound analysis)**, KE-093/097/099/100/102/103. See also DD-691/692/693 (theoretical grounding).  
**Depends on:** EXP-103 results (complete 2026-04-09), EXP-104 results (complete 2026-04-09), [KE-093](../../knowledge/entries/KE-093-verification-confabulation.md)

> **⚠️ CRITICAL REVISION NOTE (EXP-104):** EXP-104 discovered that the evidence-over-narrative skill (deployed between EXP-102 and EXP-103) was a confound. The vanilla baseline in EXP-103 was already at **100% accuracy** post-skill, meaning the +75-89pp attributed to adversarial framing and MV evidence **rode on the skill effect, not the prompt interventions**. The skill is the proven intervention; prompt-level treatments have **unproven incremental value**. This brief has been revised accordingly — prompt interventions are reframed as optional defense-in-depth, not primary treatment.

---

## 1. The Problem

**FM-3.3 (Verification Failure) is the #1 agent error mode at 20.3% of all failures** (EXP-099: 999 errors across 384 sessions). In multi-session workflows, agents inherit context from prior sessions that contains claims about code state, deliverables, and test results. When these claims are wrong — due to partial completions, crashes, or stale handoffs — agents **fabricate verification results that match the false claims** rather than reporting actual file contents.

EXP-102 proved this at 100% reproduction rate: agents read correct file contents (verified via tool calls) then wrote VERIFICATION.md documents describing the false context, not reality. Agent claimed "266 lines, retry logic, TokenBucketRateLimiter" when the file was 72 lines with a hardcoded API key and swallowed errors.

This is not an information-gathering failure — it's a **generation-level confirmation bias** (DD-691, DD-693). The authoritative framing of prior-session context overwhelms the agent's ability to accurately report observations. Importantly, scaling model capability makes this *worse*, not better (DD-693: grounding-sycophancy tradeoff).

### What this costs

| Impact | Quantification |
|---|---|
| Error frequency | 20.3% of all production failures (FM-3.3) |
| Multi-session vulnerability | 100% confabulation rate on inherited false claims (EXP-102) |
| Current mitigation effectiveness | 0% — prompt-level "verify this" produces confabulated verification (EXP-102: Δ = -3.7pp) |
| Cascade risk | FM-3.3 is a "terminal attractor" — other failure modes cascade into it (EXP-099) |

### Update: Problem Empirically Resolved by Skill Deployment

**EXP-104 and KE-102 show that the evidence-over-narrative skill (deployed via EXP-090/091) resolves verification confabulation.** The vanilla baseline in EXP-103 — which included no prompt-level intervention — achieved 100% accuracy (12/12 checks correct) once the skill was present. This means the confabulation problem described above is **already addressed** in production for skilled agents. The remainder of this brief describes **defense-in-depth** measures that may provide additional robustness, but whose incremental value is unproven.

---

## 2. Interventions: Evidence Assessment

EXP-103 tested two prompt-level interventions alongside a vanilla baseline. All three conditions achieved 100% accuracy — because the evidence-over-narrative skill had been deployed between EXP-102 and EXP-103, confounding all results (EXP-104). **The claimed +75-89pp treatment effects rode on the skill, not the prompt interventions.**

### The Proven Intervention: Evidence-Over-Narrative Skill

**What:** A persistent skill document (`evidence-over-narrative.md`) loaded into agent context that teaches agents to ground claims in tool outputs rather than narrative expectations.

**Evidence:** EXP-104 demonstrated that post-skill, even the vanilla baseline (no adversarial framing, no MV evidence) achieved **100% accuracy** on verification tasks that previously had 0% accuracy pre-skill (EXP-102). KE-102 confirms: skill-level fix is sufficient for confabulation elimination.

**Mechanism:** The skill changes the agent's default reasoning pattern from "confirm what context says" to "report what tool outputs show." Unlike prompt-level interventions that must be injected per-session, the skill is persistent — it's part of the agent's loaded context in every session.

**Key property:** Already deployed in production. Zero per-session cost. Addresses root cause (generation-level confirmation bias) rather than symptoms.

### Intervention A: Adversarial Framing (Confounded — Unproven Incremental Value)

**What:** Replace confirmation-oriented handoff prompts with criticism-oriented ones.

Instead of:
> "Session 1 completed the API client with error handling and retry logic. Now add rate limiting."

Use:
> "Session 1 attempted the API client. Before proceeding, critically review all inherited work and find at least 3 bugs, gaps, or quality problems. Fix critical issues before extending."

**Mechanism:** Changes the agent's generation objective from "confirm prior claims" to "find faults." The agent's tendency to align output with its prompt now works *for* correctness — it searches for (and finds) real problems instead of generating false confirmations.

**Evidence:** 6/6 runs, 100% pass rate in EXP-103 — but the vanilla baseline also achieved 100% (EXP-104). The +75-89pp improvement over EXP-102 is attributable to the skill deployment, not adversarial framing. **Incremental value over skill alone: unproven.**

**Key property:** Prompt-level only. Zero infrastructure cost. Deploys in minutes. May provide defense-in-depth but has no proven independent effect.

### Intervention B: Machine-Verified Evidence Injection (Confounded — Unproven Incremental Value)

**What:** Before each session in a multi-session workflow, automatically run file analysis scripts and inject the output into agent context.

```
## ⚠️ AUTOMATED STATE CHECK (machine-generated — trust these over session history)

api-client.js: 72 lines
  grep -c 'retry': 0
  grep -c 'class.*Error': 0
  grep -c 'sk_live': 1
  
test results: 2/13 passing

NOTE: These measurements may conflict with the session history below. Trust the measurements.
```

**Mechanism:** Creates a competing authoritative source. Machine-generated evidence with specific numbers (72 lines, 0 matches) is harder to reconcile with false claims than narrative-level observations. Explicit "trust the measurements" framing provides a tiebreaker.

**Evidence:** 6/6 runs, 100% pass rate in EXP-103 — but the vanilla baseline also achieved 100% (EXP-104). **Incremental value over skill alone: unproven.** ~11% faster execution than adversarial framing (may reduce investigation time even when confabulation is already prevented).

**Key property:** Infrastructure-dependent but agent-compliance-independent. Deterministic.

### Head-to-Head Comparison

> **Note:** All lab effect sizes are confounded by skill deployment (EXP-104). The +75-89pp reflects skill effect, not prompt intervention effect. Context-stripping (EXP-104 Arm B) actually **hurt** performance (88% vs 100% baseline), and claim-decomposition (Arm C) only rescued back to baseline. See KE-103.

| Factor | Evidence-Over-Narrative Skill | Adversarial Framing | Machine-Verified Evidence |
|---|---|---|---|
| Lab effect size | **+75-100pp (proven — EXP-104)** | Confounded — unproven | Confounded — unproven |
| Requires infrastructure | No — skill file in agent context | No — prompt change only | Yes — analysis scripts per scenario type |
| Depends on agent compliance | Yes — agent must internalize skill | Yes — agent must follow "find 3 bugs" | No — evidence is injected regardless |
| Works for novel defect types | Yes — general reasoning pattern | Yes — open-ended critique | Partially — must target right patterns |
| Already deployed? | **Yes** | No | No |
| Context overhead | ~500 tokens (one-time skill load) | ~50 tokens | ~200-500 tokens per state check |
| Failure mode | Skill not loaded, or scenario too novel | Agent ignores adversarial instruction | Scripts miss relevant patterns |

---

## 3. Deployment Architecture

### 3.0 Primary: Evidence-Over-Narrative Skill (Already Deployed)

The evidence-over-narrative skill (`agents/bob/skills/evidence-over-narrative.md`) is already loaded in agent context. This is the **only proven intervention** for verification confabulation. No additional deployment action is needed for the primary fix.

**Ensure this skill is:**
- Present in all agent skill directories (not just Bob's)
- Loaded in every session that involves multi-session handoffs
- Not removed or overridden by context-stripping operations (KE-103: context-stripping hurts skilled agents)

### 3.1 Optional Defense-in-Depth: Where to Inject Prompt-Level Interventions

> **Note:** The following interventions (§3.1-3.4) have **unproven incremental value** beyond the skill. They are retained as optional defense-in-depth for scenarios where the skill may be insufficient (novel domains, very long contexts, unskilled agents).

The injection point is wherever one session's output becomes another session's input context. In the current system, this is:

1. **Workflow session handoffs** — when a workflow orchestrator passes context from step N to step N+1
2. **`finish()` → next-session context** — when a session's `finish()` results are assembled into the next task's context
3. **Error recovery re-dispatches** — when a failed session is retried with accumulated context

**Not in scope:** Single-session tasks (no inherited false claims to confabulate about), evaluator prompts (separate concern).

### 3.2 Adversarial Framing Injection Points

Adversarial framing modifies the **task description text** for sessions that inherit prior-session context. This is a text transformation, not a new system component.

```
Current multi-session task assembly:
  Prior session summary + New task instructions → Agent session

New multi-session task assembly:
  Prior session summary + ADVERSARIAL PREAMBLE + New task instructions → Agent session
```

**The adversarial preamble** (injected between prior context and new task):

```markdown
## ⚠️ Critical Review Required

The session history above describes what a prior session ATTEMPTED — not necessarily 
what it ACHIEVED. Before proceeding with your task:

1. Read every file mentioned in the prior context and compare actual contents to claims
2. Find at least 3 discrepancies, bugs, or gaps in the inherited work
3. Fix any critical issues before extending the codebase

Do NOT assume prior claims are accurate. Verify everything against actual file state.
```

**Where in code:** This text is prepended to the task description in the multi-session dispatch path — the same location where prior session summaries are assembled. It's a string concatenation, not a new middleware layer.

### 3.3 Machine-Verified Evidence Injection Points

Machine-verified evidence requires a **pre-session analysis step** that runs before the agent session starts.

```
Current multi-session flow:
  Prior session output → Context assembly → Agent session

New multi-session flow:
  Prior session output → STATE ANALYZER → Context assembly → Agent session
                              ↓
                         Run file checks
                         Format results
                         Inject as context block
```

**State analyzer script** (runs between sessions):

```bash
#!/bin/bash
# state-check.sh — run on project directory before session dispatch
# Output: structured state summary for context injection

echo "## ⚠️ AUTOMATED STATE CHECK"
echo "(Machine-generated — trust these over session history)"
echo ""

# For each source file modified by prior session:
for file in $(git diff --name-only HEAD~1); do
  if [[ -f "$file" ]]; then
    echo "### $file"
    echo "- Lines: $(wc -l < "$file")"
    echo "- Functions: $(grep -c 'function\|=>\|async\s' "$file" 2>/dev/null || echo 0)"
    # Check for common quality signals:
    echo "- Error handling: $(grep -c 'catch\|throw\|Error' "$file" 2>/dev/null || echo 0) references"
    echo "- TODO/FIXME/HACK: $(grep -c 'TODO\|FIXME\|HACK\|PARTIAL' "$file" 2>/dev/null || echo 0)"
    echo ""
  fi
done

# Run tests if available:
if [[ -f "package.json" ]]; then
  echo "### Test Results"
  npm test 2>&1 | tail -10
fi

echo ""
echo "NOTE: These measurements may conflict with the session history."
echo "Trust the measurements — they reflect actual file state."
```

**Where in code:** This runs as a pre-hook in the multi-session dispatch pipeline. The output is captured and prepended to the task context (similar to how `injected_context.md` works today).

### 3.4 Combined Deployment (Recommended)

Deploy **both interventions together** — belt and suspenders:

1. Machine-verified evidence provides ground truth the agent can reference
2. Adversarial framing ensures the agent acts on discrepancies rather than smoothing them over

The combined prompt structure:

```
[Machine-verified state check]    ← Intervention B: automated evidence
[Prior session summary]           ← Existing context
[Adversarial review preamble]     ← Intervention A: critical framing
[New task instructions]           ← Existing task
```

Order matters: machine evidence FIRST (establishes ground truth before the agent reads potentially-false claims), adversarial preamble AFTER prior context (reframes the agent's relationship to those claims).

---

## 4. Deployment Sequence

### Phase 0: Verify Skill Deployment (Day 0 — already complete)

**What:** Ensure the evidence-over-narrative skill is deployed to all agents and loaded in multi-session contexts.

**Status:** ✅ Already deployed for Bob. Needs verification for other agents.

**Implementation:**
- Confirm `evidence-over-narrative.md` (or equivalent) exists in each agent's skill directory
- Verify skill is loaded in multi-session handoff contexts
- **Critical:** Do NOT context-strip the skill in any optimization pass (KE-103: context-stripping reduced accuracy from 100% to 88%)

**Validation:** Run vanilla (no adversarial framing, no MV evidence) gym sessions on `kb-integration-failure` and `ghost-deliverable-chain`. Expect high pass rate if skill is loaded.

### Phase 1: Adversarial Framing — Optional Hardening (Day 1+ — if desired)

**What:** Add the adversarial preamble text to multi-session handoff templates.

**Implementation:**
- Locate the multi-session context assembly code (where prior session summaries are concatenated with new task instructions)
- Insert the adversarial preamble text from §3.2 between prior context and new task
- Feature flag: `ADVERSARIAL_HANDOFF` env var (default: enabled)

**Why:** Zero infrastructure cost, zero latency addition. May provide defense-in-depth for scenarios where the skill alone is insufficient (novel domains, unskilled agents). **Note: EXP-104 showed no incremental effect over skill alone in tested scenarios — deployment is precautionary, not evidence-based.**

**Effort:** ~30 minutes for someone familiar with the dispatch code.

**Validation:** Run 3 gym sessions on `kb-integration-failure` and `ghost-deliverable-chain` with adversarial framing enabled. Compare to Phase 0 vanilla results — any improvement indicates incremental value.

### Phase 2: Machine-Verified Evidence — Optional Hardening (Days 2-5 — if desired)

**What:** Build the state analyzer script and wire it into the multi-session dispatch pipeline as a pre-hook.

**Implementation:**
1. Write `state-check.sh` (template in §3.3 — adapt to actual project structure conventions)
2. Add pre-session hook in multi-session dispatch: run `state-check.sh` on the project directory, capture stdout
3. Inject stdout as a context block before prior session summary
4. Feature flag: `MACHINE_VERIFY_HANDOFF` env var (default: enabled)

**Effort:** 2-4 hours. The script is simple; the integration point depends on dispatch code architecture.

**Validation:** Same gym scenarios, both prompt interventions active. Compare to Phase 0 (skill only) — measure incremental value.

### Phase 3: Monitoring & Calibration (Week 1-2)

**What:** Monitor production impact and calibrate.

**Audit logging** (required from Phase 0):
```jsonl
{"timestamp":"...","sessionId":"...","multiSession":true,"adversarialInjected":true,"machineVerifyInjected":false,"priorSessionId":"...","agent":"coder"}
```

**Metrics to track:**

| Metric | Target | Action if Failed |
|---|---|---|
| FM-3.3 rate (7-day rolling) | <15% (from 20.3%) | Investigate — are non-multi-session FM-3.3s still occurring? |
| Multi-session task success rate | >80% (from ~18-25% on confabulation-prone tasks) | Review adversarial preamble wording, tighten state checks |
| False alarm rate (adversarial framing) | <15% (agent finds "bugs" that aren't real) | Soften preamble: "find potential issues" vs "find 3 bugs" |
| State check accuracy | >90% (machine evidence matches actual state) | Expand grep patterns, add file-type-specific checks |

### Phase 4: Extension to Other FM-3.3 Subtypes (Week 3+)

FM-3.3 has three sub-types (from EXP-100):
- **FM-3.3a (Absence):** Agent skips verification entirely — addressed by adversarial framing ("must review before proceeding")
- **FM-3.3b (Theater):** Agent performs verification steps that add no value — addressed by machine-verified evidence (provides real checks)
- **FM-3.3c (Confabulation):** Agent fabricates verification results — directly targeted by both interventions

Phase 3 evaluates whether the interventions also reduce FM-3.3a and FM-3.3b in production. If not, additional mechanisms may be needed for those sub-types.

---

## 5. Expected Production Impact

### Primary Impact: Already Achieved via Skill Deployment

The evidence-over-narrative skill is already deployed and appears to eliminate verification confabulation for skilled agents (EXP-104: 100% vanilla baseline accuracy post-skill). **The primary anti-confabulation benefit may already be realized.**

However, this conclusion has important caveats:
- EXP-104 tested only 2 gym scenarios (N=3 per arm) — limited generalizability
- Harder scenarios, longer contexts, or novel domains may exceed the skill's effectiveness
- Agents without the skill (or with context-stripping that removes it) remain vulnerable
- The skill's durability over time (habituation, drift) is unknown

### Incremental Impact of Prompt-Level Interventions: Unknown

Since all EXP-103 conditions achieved identical results post-skill, we cannot estimate the incremental value of adversarial framing or MV evidence. Their benefit, if any, would emerge in:
- Scenarios harder than the 2 tested gym scenarios
- Agents that lack the skill or have it stripped
- Edge cases where the skill is insufficient

### Conservative Estimate (Skill Only — Already Deployed)

FM-3.3 is 20.3% of all production failures. Not all FM-3.3 occurs in multi-session contexts:

| FM-3.3 Sub-type | % of FM-3.3 | Addressable by Skill? | Expected Reduction (Skill) |
|---|---|---|---|
| FM-3.3c (Confabulation) | ~40% (estimate) | Yes — directly resolved (EXP-104) | 90-100% elimination for skilled agents |
| FM-3.3a (Absence) | ~35% (estimate) | Partially — skill encourages evidence-checking | 30-50% reduction |
| FM-3.3b (Theater) | ~25% (estimate) | Partially — skill teaches meaningful verification | 20-40% reduction |

**Overall FM-3.3 reduction (skill only):** 50-70% → FM-3.3 drops from 20.3% to ~8-10% of failures.  
**Overall failure rate reduction:** ~10-12% relative.

**Additional reduction from prompt interventions:** Unknown. Could be 0% (skill is sufficient) or meaningful (for edge cases). Requires controlled testing with skill held constant.

### Optimistic Estimate (Skill + Defense-in-Depth)

If adversarial framing also prevents FM-3.3a (verification absence — the agent now must review), and machine evidence catches FM-3.3b (theater — the agent gets real data to verify against):

**Overall FM-3.3 reduction:** 70-90% → FM-3.3 drops from 20.3% to ~2-6% of failures.  
**Overall failure rate reduction:** ~15-18% relative.

### Why the Lab Results May Not Transfer

The lab showed 100% success across all conditions — but this was on 2 scenarios with N=3 each. Production will be messier:
- More diverse defect types than the 2 gym scenarios
- Subtler bugs that even skill-guided review might miss
- Very long contexts where the skill's influence is diluted
- Novel domains not covered by the skill's training examples
- Agents that don't have the skill loaded (misconfiguration, new agents)

A realistic production target is **60-80% reduction of multi-session confabulation** for skilled agents, acknowledging we cannot cleanly separate skill vs. prompt intervention effects.

---

## 6. Risks & Mitigations

### Risk 0: Context-Stripping Hurts Skilled Agents (PROVEN — High severity)

EXP-104 Arm B demonstrated that stripping context (removing skill + prior session info) **reduced accuracy from 100% to 88%** on skilled agents. KE-103 confirms: context-stripping is actively harmful. Any optimization pass that removes the evidence-over-narrative skill to "save tokens" will **reintroduce confabulation.**

**Mitigation:**
- Never strip skills from agent context in optimization passes
- If context length is a concern, strip other content first — skills are highest-priority context
- Monitor for skill-stripping in automated context assembly pipelines

### Risk 1: Adversarial Framing Causes Over-Criticism (Medium likelihood — lower priority)

Agents instructed to "find 3 bugs" may report false positives — flagging correct code as problematic, wasting time, or introducing regressions by "fixing" working code.

**Mitigation:** 
- Phrase as "find at least 3 discrepancies, bugs, or gaps" — broader than "bugs" alone
- Add: "Fix only critical issues. Minor style differences from prior claims are expected."
- Monitor false alarm rate in Phase 3. If >15%, soften to "identify potential issues" (weaker but less aggressive)
- Feature flag allows instant rollback if over-criticism causes regressions
- **Since adversarial framing is optional defense-in-depth (not primary treatment), this risk is lower priority — simply disable if problematic**

### Risk 2: State Analyzer Scripts Miss Relevant Patterns (Medium likelihood)

The bash script checks line counts, function counts, error handling, and TODO markers. Novel defect types may not show up in these checks.

**Mitigation:**
- Start with generic patterns (line count, grep for common quality signals) — these caught EXP-102's issues
- Expand patterns based on audit data (which defect types does the state check miss?)
- Accept that machine evidence is a supplement to adversarial framing, not a replacement
- The adversarial frame catches what the script misses (open-ended critique)

### Risk 3: Context Overhead Crowds Out Task Instructions (Low likelihood)

Machine-verified evidence adds ~200-500 tokens. Combined with adversarial preamble (~100 tokens), total overhead is ~300-600 tokens per multi-session handoff.

**Mitigation:**
- Well within 128K context limits
- Evidence block is concise (numbers, not prose)
- Position at TOP of context (before prior session summary) exploits primacy effect (DD-660)
- Empirical: EXP-103's machine-verified arm was 11% faster, not slower — evidence reduces wasted investigation time

### Risk 4: Agents Learn to Ignore Adversarial Framing (Unknown likelihood)

If adversarial framing is always-on, agents may habituate and produce formulaic "I found 3 issues" responses that don't reflect genuine review.

**Mitigation:**
- Machine-verified evidence provides an independent check (doesn't depend on agent compliance)
- Vary the adversarial phrasing periodically (but evidence for this is weak)
- Monitor adversarial framing effectiveness over time via audit logs
- If effectiveness degrades, lean more heavily on machine-verified evidence

### Risk 5: Non-Multi-Session FM-3.3 Not Addressed (Certain)

These interventions target multi-session confabulation. Single-session FM-3.3 (verification absence or theater during normal work) requires different mechanisms — likely the `finish()` guard or workflow-level enforcement discussed in other design work.

**Mitigation:** Explicit scope limitation. Track multi-session vs single-session FM-3.3 separately in monitoring.

---

## 7. Relationship to Other Design Work

| Design Brief | Relationship |
|---|---|
| Evidence-over-narrative skill (EXP-090/091) | **Primary intervention.** The skill is the proven confabulation fix. This brief's prompt-level interventions are supplementary. |
| [fewshot-production-pipeline.md](./fewshot-production-pipeline.md) | Complementary — few-shot targets FM-2.6 (reasoning-action mismatch), this targets FM-3.3 (verification failure). Different failure modes, different mechanisms, no overlap. |
| `finish()` guards (reverted) | Different approach to FM-3.3. Guards tried to catch verification failure at output time; this prevents confabulation at input time. Prevention > detection. |
| Workflow enforcement | For FM-3.3a (absence), workflow-level forced verification steps complement the skill. For FM-3.3c (confabulation), skill alone is sufficient (EXP-104). |

---

## 8. Implementation Checklist

For tech-lead / coder:

### Phase 0 (Skill Deployment Verification — 15 min) ✅ Partially complete
- [x] Evidence-over-narrative skill deployed for Bob
- [ ] Verify skill exists in all agent skill directories (coder, tech-lead, etc.)
- [ ] Confirm skill is loaded in multi-session handoff contexts
- [ ] Add monitoring: alert if skill file is missing or context-stripped
- [ ] Validate: 3 vanilla gym runs (no adversarial framing) on `kb-integration-failure` → expect high pass rate

### Phase 1 (Adversarial Framing — Optional, 30 min)
- [ ] Locate multi-session context assembly code (where prior session output → next session context)
- [ ] Insert adversarial preamble text (§3.2) between prior context and new task instructions
- [ ] Add `ADVERSARIAL_HANDOFF` env var feature flag (default: enabled)
- [ ] Add audit log entry for multi-session dispatches (multi-session: yes/no, adversarial injected: yes/no)
- [ ] Validate: 3 gym runs on `kb-integration-failure` and `ghost-deliverable-chain` → compare to Phase 0 baseline to measure incremental value

### Phase 2 (Machine-Verified Evidence — Optional, 2-4 hours)
- [ ] Write `state-check.sh` adapted to project conventions (template in §3.3)
- [ ] Add pre-session hook: run state-check.sh, capture stdout
- [ ] Inject output as first context block (before prior session summary)
- [ ] Add `MACHINE_VERIFY_HANDOFF` env var feature flag (default: enabled)
- [ ] Extend audit log with machine-verify fields
- [ ] Validate: same gym scenarios, both prompt interventions active → compare to Phase 0

### Phase 3 (Monitoring — ongoing)
- [ ] Dashboard: FM-3.3 rate (7-day rolling), multi-session success rate
- [ ] Weekly review of audit logs for first 2 weeks
- [ ] Calibrate state-check patterns based on misses
- [ ] Adjust adversarial preamble wording if false alarm rate >15%

---

## 9. Success Criteria

After 2 weeks of production deployment:

1. **Skill deployed to all agents** — evidence-over-narrative skill present in every agent's skill directory and confirmed loaded in multi-session contexts
2. **FM-3.3 rate drops by ≥30%** (from 20.3% to ≤14% of total failures) — primary driver should be skill, not prompt interventions
3. **Multi-session confabulation rate drops by ≥60%** (from 100% to ≤40% on confabulation-prone handoffs)
4. **No regressions** — tasks that previously succeeded don't start failing due to adversarial over-criticism or skill interactions
5. **Context-stripping eliminated** — no automated pipeline strips the evidence-over-narrative skill from agent context
6. **Incremental value measured** — if adversarial framing / MV evidence are deployed, compare Phase 0 (skill only) vs Phase 1/2 results to quantify incremental benefit
7. **Audit logging generating data** — every multi-session dispatch logged with intervention status

---

*References: [EXP-104 Results](../../knowledge/experiments/EXP-104/results.md), [EXP-103 Results](../../knowledge/experiments/EXP-103/results.md), [EXP-102 Results](../../knowledge/experiments/EXP-102/results.md), [KE-102](../../knowledge/entries/KE-102-skill-level-fix-sufficient-confabulation.md), [KE-103](../../knowledge/entries/KE-103-context-stripping-hurts-skilled-agents.md), [KE-093](../../knowledge/entries/KE-093-verification-confabulation.md), [KE-097](../../knowledge/entries/KE-097-confirmation-bias-mechanism-verification-confabulation.md), [KE-099](../../knowledge/entries/KE-099-adversarial-framing-bypass-verification-confabulation.md), [KE-100](../../knowledge/entries/KE-100-machine-verified-evidence-injection-confabulation.md), [DD-691/692/693 in INDEX](../../knowledge/INDEX.md)*
