# Contradiction Detection Protocol for Knowledge Base

> **Author**: Bob (Architect) | **Date**: 2026-04-09
> **Status**: DESIGN — ready for implementation
> **Responds to**: CR#279 Action Item #1, PRIORITY-TRACKER "contradiction detection pass" task
> **Scope**: 111 KE entries, 39 hypotheses, 10 WKWA syntheses, ~50 deep-dives/cross-refs

---

## 1. Problem Statement

Our knowledge base grows monotonically. We add ~2-5 KE entries per experiment cycle but rarely revise or retract. CR#279 diagnosed this as a "Confirmation Bias Stack" — 4 layers of mechanisms that accumulate beliefs without revision.

**Known unresolved contradictions today**:
- H-060 (hierarchical MAS outperforms flat) vs H-061 (constrained communication improves MAS) — merged to H-041 but tension unresolved
- KE-103 (removing context hurts skilled agents) vs MARCH thesis (DD-694: information asymmetry improves verification)  
- KE-106 (guards don't train behavior) vs the general trajectory of using guards as stepping stones to internalization
- KE-002 (text rules 0/35) vs KE-059/EXP-084 (few-shot = structural text that works) — is this a contradiction or a category refinement?

These were found ad hoc. We have no systematic process. As the KB grows toward 200+ entries, manual contradiction spotting becomes impossible.

## 2. Design Principles

### 2.1 What "Contradiction" Means

Not just logical negation. Five types of tension:

| Type | Definition | Example | Severity |
|------|-----------|---------|----------|
| **Direct Contradiction** | KE-A says X, KE-B says ¬X | "Text rules never work" vs "Few-shot (a text rule category) works" | CRITICAL — one must be refined |
| **Scope Conflict** | KE-A claims generality, KE-B shows boundary case | "Forced externalization is domain-independent" vs a domain where it fails | HIGH — scope needs narrowing |
| **Mechanism Tension** | Two KEs propose incompatible mechanisms for same phenomenon | "Adversarial framing works by redirecting generation objective" vs "it works by adding information" | MEDIUM — mechanism experiment needed |
| **Implication Conflict** | KE-A + KE-B jointly imply something false | "Guards don't train" + "We should deploy guards as training" → contradiction in strategy | MEDIUM — strategy update needed |
| **Staleness Tension** | KE-A was written under conditions that KE-B has since changed | KE written pre-EXP-104 assuming context stripping helps, now contradicted | LOW — update needed |

### 2.2 Design Constraints

- **Must be runnable by any agent** (Bob, Coach, Scout) — not a single-agent bottleneck
- **Must produce actionable output** — not just "these might conflict" but specific resolution proposals
- **Must integrate with existing Bayesian scorecard** — contradictions should update P(H) values
- **Must be incremental** — scanning all 150+ artifacts every time is infeasible; scan diffs
- **Must resist false positives** — surfacing 50 "tensions" that are actually nuanced findings wastes time

## 3. The Protocol

### 3.1 Trigger Points (When to Run)

| Trigger | Scope | Runner |
|---------|-------|--------|
| **New KE entry created** | New KE vs all existing KE+H in same topic cluster | Author agent |
| **Hypothesis P(H) updated** | Updated H vs all KEs that cite it | Bob (scorecard maintainer) |
| **Experiment closed** | All findings vs existing KB | Bob (post-experiment) |
| **Weekly sweep** | Full corpus scan (Sunday cadence) | Bob (heartbeat task) |
| **New WKWA/synthesis written** | Synthesis claims vs underlying evidence | Author agent |

### 3.2 The Contradiction Detection Pass (Per-Trigger)

**Step 1: Identify Claim Set**

For the artifact being checked, extract its **core claims** as structured propositions:

```
ARTIFACT: KE-103 (Context-Stripping Paradox)
CLAIMS:
  C1: Removing inherited context reduces performance for skilled agents (88% vs 100%)
  C2: Context provides task orientation cues even when containing false claims
  C3: Claim decomposition (Arm C) rescues performance by substituting orientation cues
  C4: Contradicts MARCH thesis (DD-694) for skilled agents specifically
```

Each claim should be:
- **Falsifiable** (testable assertion, not a definition)
- **Scoped** (includes conditions: "for skilled agents", "on ghost-deliverable-chain")  
- **Grounded** (cites specific evidence with N)

**Step 2: Retrieve Candidate Conflicts**

Use the **Topic Index** (10 topic pages) to identify which topic clusters the claims touch. For each touched cluster, pull:
- All KE entries in that cluster
- All hypotheses that cite those KE entries
- All WKWA syntheses covering that topic

**Retrieval heuristic**: A claim about mechanism M in domain D should be checked against:
1. Other claims about mechanism M (regardless of domain)
2. Other claims about domain D (regardless of mechanism)
3. General claims that subsume M or D (e.g., "all text rules fail" subsumes specific text rule types)

**Step 3: Pairwise Tension Check**

For each (new_claim, existing_claim) pair, classify:

```
CHECK: Does KE-103.C1 conflict with any existing claim?

CANDIDATE: KE-002 "Text rules have 0/35 effect on judgment tasks"
VERDICT: NO CONFLICT — KE-103 is about context presence, not text rules
REASONING: Different mechanism entirely

CANDIDATE: DD-694 (MARCH) "Information asymmetry improves verification"
VERDICT: SCOPE CONFLICT — KE-103 shows this fails for skilled agents
REASONING: MARCH assumed unskilled agents. KE-103 adds a boundary condition.
RESOLUTION PROPOSAL: Qualify DD-694 claim with "for unskilled agents" scope limiter.
                      KE-103 already documents this as a contradiction — mark as KNOWN.
```

**Decision rules for verdicts**:
- If claims use the same terms but different scopes → check if scopes overlap
- If claims reference the same experiments → no conflict (same evidence base)
- If one claim is a special case of another → possible scope refinement, not contradiction
- If claims propose different mechanisms for the same observation → mechanism tension
- If one claim was made with N < 10 and the other with N > 30 → flag evidence weight

**Step 4: Severity Classification and Resolution Proposal**

For each confirmed tension:

| Field | Content |
|-------|---------|
| **ID** | CT-{sequential number} |
| **Type** | Direct/Scope/Mechanism/Implication/Staleness |
| **Severity** | CRITICAL / HIGH / MEDIUM / LOW |
| **Claim A** | {artifact}.{claim}: "{text}" |
| **Claim B** | {artifact}.{claim}: "{text}" |
| **Evidence Delta** | Which claim has stronger evidence? (N, effect size, replication) |
| **Resolution Proposal** | One of: REFINE_SCOPE, DESIGN_EXPERIMENT, UPDATE_CLAIM, RETRACT, MERGE, DEFER |
| **Bayesian Impact** | Which P(H) values should move, and in which direction? |
| **Assigned To** | Agent best positioned to resolve |

### 3.3 Resolution Actions

| Action | When | What Happens |
|--------|------|-------------|
| **REFINE_SCOPE** | Scope conflict where both claims are correct within their domains | Add boundary conditions to the broader claim. Update KE entry text. |
| **DESIGN_EXPERIMENT** | Mechanism tension or direct contradiction with weak evidence on both sides | Create experiment design targeting the specific disagreement. Add to experiment queue. |
| **UPDATE_CLAIM** | One claim clearly superseded by stronger evidence | Revise the weaker claim's KE entry. Update PRIORITY-TRACKER. Run Bayesian scorecard update. |
| **RETRACT** | Claim disproven by subsequent experiment | Add RETRACTED status to KE entry. Update INDEX.md. Document in PRIORITY-TRACKER changelog. |
| **MERGE** | Two claims are actually the same thing stated differently | Merge into single KE entry with combined evidence. Redirect old entry. |
| **DEFER** | Tension exists but resolution requires data we can't currently get | Log in Contradiction Tracker. Set review date. Don't let it block other work. |

### 3.4 Output: Contradiction Tracker

Maintain a living document at `agents/shared/knowledge/CONTRADICTION-TRACKER.md`:

```markdown
# Contradiction Tracker

**Last Scan**: {date}
**Active Contradictions**: {count}
**Resolved This Sprint**: {count}

## Active Tensions

### CT-001: Context Stripping — Skilled vs Unskilled Agent Performance
- **Type**: Scope Conflict | **Severity**: HIGH
- **Claim A**: KE-103 — removing context hurts skilled agents (88% vs 100%, N=6)
- **Claim B**: DD-694/MARCH — information asymmetry improves verification
- **Status**: RESOLVED (REFINE_SCOPE) — DD-694 now qualified for unskilled agents only
- **Resolved**: 2026-04-09 by KE-103 creation

### CT-002: Text Rules — Binary or Spectrum?
- **Type**: Scope Conflict | **Severity**: HIGH  
- **Claim A**: KE-002 — text rules 0/35 on judgment tasks
- **Claim B**: KE-059/EXP-084 — few-shot (a text delivery) achieves 33-100%
- **Status**: RESOLVED (REFINE_SCOPE) — KE-002 refined: "declarative text rules" vs "structural text" (WKWA-006)
- **Resolved**: 2026-04-08 by WKWA-006 synthesis

### CT-003: H-060/H-061 — Hierarchical vs Flat MAS
- **Type**: Direct Contradiction | **Severity**: MEDIUM
- **Claim A**: H-060 — hierarchical MAS outperforms flat
- **Claim B**: H-061 — constrained communication improves MAS (implies flat + constraints > hierarchy)
- **Status**: MERGED → H-041 (scope variable). Needs experimental resolution.
- **Resolution**: DESIGN_EXPERIMENT — test with our system using ablation (remove hierarchy layer)

### CT-004: Guards as Infrastructure vs Training
- **Type**: Implication Conflict | **Severity**: MEDIUM
- **Claim A**: KE-106 — guards don't reduce underlying error rate (50-70% attempt rate persists)
- **Claim B**: Implicit strategy assumption — guards are temporary, agents will "learn"
- **Status**: OPEN — needs strategy update
- **Resolution Proposal**: UPDATE strategy docs to treat guards as permanent infrastructure, not training wheels
```

## 4. Integration with Existing Processes

### 4.1 Bayesian Scorecard Integration

When a contradiction is found involving a hypothesis:
1. The **Evidence Delta** field identifies which direction P(H) should move
2. Bob updates the scorecard in the next reconciliation pass
3. If a contradiction is CRITICAL and involves P(H) > 0.70, it triggers immediate scorecard review

### 4.2 Experiment Queue Integration

Contradictions with resolution = DESIGN_EXPERIMENT get added to the experiment queue with:
- Priority based on severity × P(H) impact
- Design sketch from the contradiction analysis
- Expected information value (how much would resolution change our strategy?)

### 4.3 Knowledge Index Integration

The INDEX.md should show contradiction status:
- KE entries involved in active contradictions get a ⚠️ marker
- Resolved contradictions get noted in the entry's revision history
- RETRACTED entries stay in INDEX with strikethrough + link to replacement

## 5. Implementation Plan

### Phase 1: Seed the Tracker (This Sprint)

**Task**: Create `CONTRADICTION-TRACKER.md` with all currently known contradictions.
**Method**: Manual scan of PRIORITY-TRACKER notes, WKWA synthesis tension sections, and KE entries that reference "contradicts", "challenges", "however".
**Output**: Initial tracker with ~5-10 known tensions classified.
**Runner**: Bob (next heartbeat)

### Phase 2: Incremental Detection (Next Sprint)

**Task**: Add contradiction check step to KE entry creation and experiment closure workflows.
**Method**: When Coach or Bob writes a new KE entry, include a "Contradiction Check" section at the bottom:
```markdown
## Contradiction Check
- Checked against: {list of topic clusters examined}
- Tensions found: {none | list with CT-IDs}
- New CT entries: {none | list}
```
**Runner**: Coach (KE creation), Bob (experiment closure)

### Phase 3: Automated Scan Assist (Future)

**Task**: Create a helper script that, given a KE entry, extracts claims and suggests candidate conflicts based on keyword overlap and topic clustering.
**Method**: Simple keyword matching against the topic index — not AI-powered, just grep-level assistance to surface candidates for human review.
**Runner**: Bob (design), implementation via code session

## 6. Success Metrics

| Metric | Baseline | Target | Measurement |
|--------|----------|--------|-------------|
| **Contradiction Discovery Lag** | Ad hoc (weeks-months) | ≤1 sprint from KE creation | Time between KE creation and CT entry |
| **Resolution Rate** | Unknown (4 known, 2 resolved) | >50% of CTs resolved within 2 sprints | CT status tracking |
| **False Positive Rate** | N/A | <30% of flagged tensions are non-tensions | Review of CT entries |
| **Bayesian Impact** | 0 P(H) updates from contradictions | ≥2 P(H) updates per sprint from CT analysis | Scorecard changelog |
| **KB Retraction Rate** | ~0 (we never retract) | ≥1 retraction per month (if warranted) | INDEX.md revision history |

## 7. Known Risks

1. **Over-detection**: Everything can look like a contradiction if you squint. The scoping rules in Step 3 are meant to prevent this, but calibration will be needed.
2. **Resolution bottleneck**: If contradictions pile up faster than we resolve them, the tracker becomes another graveyard. Mitigation: DEFER + review cadence for deferred items.
3. **Confirmation bias in detection**: The detector may unconsciously avoid flagging contradictions that challenge their own hypotheses. Mitigation: Cross-agent detection (Bob detects, Coach resolves, or vice versa).
4. **Scope creep**: "Contradiction" could expand to "any nuance" — tracking every qualifier would overwhelm. Stick to the 5 types in §2.1.

## 8. Relationship to Existing Work

| Artifact | Relationship |
|----------|-------------|
| CR#279 (Confirmation Bias Stack) | This protocol implements Action Item #1 |
| WKWA-007 (Intervention Architecture) | The 3-mechanism framework helps classify which contradictions matter for strategy |
| Bayesian Scorecard | Contradiction detection feeds evidence into scorecard updates |
| PRIORITY-TRACKER | Known tensions listed there seed the initial tracker |
| KE-106 (Guards ≠ Training) | Exemplar of an implication conflict that should have been caught systematically |
| KE-103 (Context-Stripping Paradox) | Exemplar of a scope conflict correctly identified at creation time |

---

## Appendix A: Initial Contradiction Seed List

Based on current KB scan (2026-04-09):

| ID | Type | Claims | Severity | Status |
|----|------|--------|----------|--------|
| CT-001 | Scope | KE-103 vs DD-694 (MARCH) | HIGH | RESOLVED |
| CT-002 | Scope | KE-002 vs KE-059 (text rule spectrum) | HIGH | RESOLVED |
| CT-003 | Direct | H-060 vs H-061 (hierarchy vs flat) | MEDIUM | MERGED → H-041 |
| CT-004 | Implication | KE-106 vs strategy (guards as training) | MEDIUM | OPEN |
| CT-005 | Staleness | Pre-EXP-104 entries assuming context stripping helps | LOW | NEEDS SCAN |
| CT-006 | Mechanism | EXP-103 (generation redirect) vs KE-002 (text rules don't work) — is adversarial framing a text rule or not? | HIGH | RESOLVED by WKWA-006/EXP-108 design |
| CT-007 | Scope | KE-031 (forced ext domain-independent) — tested on 3 domains, claims "domain-independent" | LOW | NEEDS EXPANSION to more domains |

---

*This protocol is itself subject to contradiction detection — if it produces systematic false positives or misses known tensions, revise §3.3 decision rules.*
