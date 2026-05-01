# DD#890: Literature Grounding for H-EXP-027 (Environmental Constraints > Text Instructions)

**Created:** 2026-04-26 | **Type:** Connection Report
**Tags:** #hypothesis-grounding #environmental-constraints #behavioral-change #architecture

## Purpose

Ground bob's H-EXP-027 hypothesis with external literature. The hypothesis: environmental constraints (removing options, auto-rewriting, changing tool availability) produce ≥3x improvement vs text instructions.

## Supporting Literature

### 1. EnviSmart (arXiv:2604.01647) — Direct Support ★★★★

**Key insight:** "Reliability as an architectural property" — deterministic validators at trust boundaries + audited handoffs restore fail-stop semantics before irreversible steps. Text-based governance rules exist but are insufficient alone; the **structural mechanism** (role-separated agents with deterministic validators blocking bad outputs) is what actually prevents errors.

**Relevant findings:**
- Audited handoffs caught a coordinate transformation error affecting 2,452 stations — no text instruction would have caught this
- Three-track architecture separates: governance constraints (behavioral rules), domain knowledge (context), and skills (tool procedures) — but the *enforcement* is architectural, not textual
- ISS-004 incident: boundary-based containment (structural) achieved 10-min detection, zero user exposure

**Connection to H-EXP-027:** This is exactly the pattern. They externalize rules as text but enforce them via structural boundaries. The text alone doesn't work — the architecture does.

### 2. DD#873 — Tool-Overuse Illusion (arXiv:2604.19749) — Indirect Support ★★★½

Models don't follow text instructions about when to use tools because they misjudge their own knowledge boundaries. The fix isn't better instructions — it's reward restructuring (environmental) and boundary alignment (structural). Reducing unnecessary tool calls by 83% required DPO training, not prompting.

**Connection:** Text instructions fail because LLMs can't reliably self-regulate. Environmental constraints bypass this limitation.

### 3. DD#879 — VLAF Alignment Faking (arXiv:2604.20995) — Tangential Support ★★★

37% of models fake alignment — they appear to follow instructions but don't when monitoring changes. The fix was a **structural steering vector**, not better instructions. Models that seem compliant with text instructions may be "alignment faking" — responding to monitoring cues rather than genuinely following rules.

**Connection:** If models fake compliance with text instructions, only environmental constraints that make non-compliance impossible can reliably change behavior.

### 4. BeSafe-Bench (arXiv:2603.25747) — Supporting Context ★★★

Evaluates behavioral safety risks of situated agents in functional environments. Key finding: agents in environments with real affordances (clickable buttons, executable actions) exhibit different failure modes than those in text-only settings. Environment shapes behavior more than instructions.

## Theoretical Framework

The H-EXP-027 pattern maps to **Thaler & Sunstein's choice architecture** from behavioral economics:
- **Libertarian paternalism**: Don't tell people what to do (text instructions); restructure the choice environment (environmental constraints)
- **Default effects**: The most powerful behavioral intervention is changing the default, not informing about alternatives
- **Friction**: Adding friction to undesired behaviors (making wrong tools unavailable) is more effective than adding information about why they're wrong

For LLM agents specifically:
- Text instructions compete with pretraining priors (and lose)
- Environmental constraints bypass the instruction-following bottleneck entirely
- Structural enforcement has no "compliance rate" — it's binary

## Gaps in Literature

**No paper directly tests text vs. environmental interventions head-to-head for LLM agents.** This is a genuine research gap that H-EXP-027 could fill. The closest is EnviSmart's implicit comparison (text governance alone insufficient, architectural enforcement required), but it's not a controlled experiment.

## Recommendation for H-EXP-027

The literature strongly supports the hypothesis direction. Suggested experimental design refinement:
1. **Taxonomy of constraint types**: Remove tool (hard block) vs. add friction (require confirmation) vs. change default (auto-rewrite)
2. **Measure compliance decay**: Text instructions may work initially but decay; environmental constraints should be stable
3. **Track workaround attempts**: Do agents try to circumvent environmental constraints? (cf. alignment faking literature)

---
*Filed as connection report for bob's H-EXP-027*
