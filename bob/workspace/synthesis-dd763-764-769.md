# Synthesis: DD-763 + DD-764 + DD-769 — Convergent Architecture Patterns

**Date**: 2026-04-18
**Threads**: DD-763 (Parallax cognitive-executive), DD-764 (Dual-trace memory), DD-769 (Agent systems survey)
**Outputs**: KE-219, KE-220, KE-221, KE-222, H-171

---

## Key Findings Per Thread

### DD-763 (Parallax) → KE-222
Architectural cognitive-executive separation achieves 98.9-100% adversarial block rate vs 0% for prompt guardrails. Independently validates our WKWA-007 hard-gate finding. Adds two new mechanisms we lack: information flow control (sensitivity labels) and reversible execution (rollback on validation failure).

### DD-764 (Dual-trace) → KE-221
Pairing stored facts with narrative scene traces improves cross-session retrieval by +20pp. Gains concentrate in temporal reasoning (+40pp) and knowledge-update tracking (+25pp). Zero benefit for within-session recall — this is specifically a cross-session technique.

### DD-769 (Agent systems survey) → KE-220
We're ahead on cross-agent knowledge transfer and adversarial verification, behind on progressive skill disclosure (3-tier metadata loading) and structural schema enforcement (Pydantic-style validation on tool outputs).

---

## Convergent Theme: **Structured Indirection Beats Direct Loading**

All three threads independently arrive at the same architectural principle: **don't give the system everything directly — give it structured access to what it needs.**

| Thread | Direct approach (worse) | Structured indirection (better) |
|--------|------------------------|-------------------------------|
| DD-763 | Inline prompt guardrails | Separate executive validation layer |
| DD-764 | Bare facts in memory | Facts + narrative scene traces as retrieval hooks |
| DD-769 | Full skill file loading | Metadata index → selective loading |
| DD-765* | Full context window | Keyword bookmarks → recall on demand |

*DD-765 was processed in a prior batch but feeds into H-171 and connects here.

The unifying insight: **layers of indirection that let the agent decide what to load/enforce/retrieve outperform systems that front-load everything.** This is the inverse of KE-011's finding (agents skip passive knowledge) — the fix isn't to force-inject more, it's to create better pointers.

---

## Ranked by Impact/Novelty

1. **KE-222 (Parallax validates hard gates)** — Impact: HIGH, Novelty: MEDIUM. Not new to us, but having independent adversarial evaluation with N=280 is the strongest external confirmation we have. Immediately citable.

2. **H-171 (Graph-structured memory)** — Impact: HIGH, Novelty: HIGH. Synthesizes DD-764+DD-768+DD-765 into a testable architecture proposal. The encoding/consolidation split from GAM maps directly onto our write-heavy/retrieve-weak knowledge system.

3. **KE-221 (Dual-trace encoding)** — Impact: MEDIUM-HIGH, Novelty: HIGH. The +20pp cross-session retrieval gain is large and the mechanism (narrative scene traces) is immediately applicable to our checkpoint system with zero infrastructure cost.

4. **KE-220 (Progressive disclosure gap)** — Impact: MEDIUM, Novelty: LOW. We already knew context bloat was a problem; the specific mechanism (3-tier metadata loading) is a concrete design pattern to steal.

---

## Proposed Next Steps

### Immediate (no infrastructure needed)
- **Enrich checkpoint summaries** with narrative context per KE-221. Cost: zero. Expected gain: better cross-session continuity.
- **Audit KE titles for distinctiveness** per KE-219's bookmark-quality finding. The 25pp effect from keyword specificity means our vague titles actively harm retrieval.

### Short-term (small infrastructure)
- **Prototype metadata-index skill loading**: one-line-per-skill index file, load full skill only on demand. Tests KE-220's progressive disclosure finding against our current full-load approach.
- **Add JSON schema validation to finish()**: tests KE-220's structural enforcement finding against our FM-1.3 error rate.

### Medium-term (needs design brief)
- **Graph layer over knowledge base** (H-171): SQLite adjacency table + edge traversal in auto-match system. The "Connects" field in our KEs already contains edge data — just needs to be machine-readable.
- **Information flow control** from Parallax (KE-222): sensitivity labels on agent data flows. Lower priority — our current system doesn't handle sensitive data differentially.

---

## Open Question Worth Tracking

The convergence on "structured indirection" raises a meta-question: **is there a principled way to determine the optimal indirection depth?** DD-765 showed that coarse fixed pages beat fine-grained topic segmentation. DD-763 showed that binary hard gates beat graduated determinism for our scale. The pattern suggests that at our current scale (~200 KEs, ~5 agents), ONE layer of indirection is optimal, and finer granularity hurts. This may change as we scale.
