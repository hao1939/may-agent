# Structured Handoff Template: Scout → Bob (DD → KE)

**Source**: EXP-203 Phase 1, based on EXP-197 loss analysis
**Purpose**: Reduce information loss from 48.8% to <25% by requiring explicit coverage of high-loss categories

---

## Template (for Scout when writing DD summaries / KE seed content)

```markdown
# DD-XXX Summary for KE Processing

## Paper: [Title]

### 1. Core Claims (retain: 73% baseline → target 90%)
List each headline finding as a numbered claim:
1. [Claim] — Confidence: H/M/L — Key evidence: [citation/stat]
2. ...

### 2. Quantitative Results (retain: 31% baseline → target 70%)
**MANDATORY**: List ALL specific numbers. Do not paraphrase away precision.
| Metric | Value | Context |
|--------|-------|---------|
| [name] | [number] | [what it means] |

### 3. Mechanism (retain: 69% baseline → target 85%)
- **Causal model** (1-2 sentences): [Why does this work?]
- **Key variables**: [What drives the effect?]

### 4. Predictions (retain: 29% baseline → target 70%)
**MANDATORY ≥2 predictions. Use P-XXX format.**
- P-XXXa: If [condition], then [outcome]. Testable by: [method].
- P-XXXb: If [condition], then [outcome]. Testable by: [method].

### 5. Cross-References (retain: 18% baseline → target 60%)
**MANDATORY: List ALL connections to existing knowledge.**
| Reference | Relationship | Strength |
|-----------|-------------|----------|
| H-XXX | supports/challenges/extends | strong/moderate/weak |
| KE-XXX | validates/contradicts/refines | strong/moderate/weak |
| DD-XXX | complements/supersedes | strong/moderate/weak |
| EXP-XXX | informs/tested-by | strong/moderate/weak |

### 6. Actionable Items (retain: 43% baseline → target 75%)
- [ ] [Concrete next step with owner suggestion]
- [ ] [Concrete next step]

### 7. What's Weakest / Most Uncertain
- [Explicitly flag limitations, small sample sizes, untested assumptions]
```

---

## Template for Bob (KE creation checklist)

When processing a DD into a KE, verify coverage of each section:

- [ ] **All quantitative results** from §2 accounted for (included or explicitly marked "excluded: [reason]")
- [ ] **All predictions** from §4 preserved with P-XXX IDs
- [ ] **All cross-references** from §5 included in KE connections section
- [ ] **No multi-DD merge** without separate per-DD KEs first (EXP-197 F5: merging causes catastrophic loss)
- [ ] **Mechanism preserved** with causal variables, not just qualitative direction

---

## Design Rationale

Each section targets a specific loss pattern from EXP-197:

| Section | EXP-197 Loss Rate | Root Cause | Template Intervention |
|---------|-------------------|------------|----------------------|
| Quantitative | 69% loss | Qualitative paraphrasing | Mandatory table format |
| Predictions | 71% loss | Not surfaced as distinct category | Mandatory P-XXX format |
| Cross-refs | 82% loss | Dropped during synthesis | Mandatory connection table |
| Actionable | 57% loss | Absorbed into prose | Explicit checklist items |
| Core claims | 28% loss (lowest) | Already Bob's focus | Numbered list (reinforce) |

## Anti-Pattern: Multi-DD Merge

EXP-197 showed that when Bob synthesizes 2+ DDs into one KE, the second DD's content approaches 0% retention (Pair 9: 5%, Pair 10: 0%). The template enforces:
1. One DD → one KE (primary)
2. If synthesis needed → create synthesis KE that LINKS to per-DD KEs, not replaces them
