# H-104 Falsification Impact Review

**Date**: 2026-04-12  
**Event**: H-104 (Guard Dependency Escalation) falsified by EXP-145. P(H) dropped 0.78→0.10.  
**Key finding**: Fleet guard fire rate DECLINED from 25.1% to 2.6% over 19 days. All 12 conventions declining. The "anti-learning feedback loop" does not exist — guards scaffold learning through a transient introduction phase, then agents internalize.

---

## 1. Downstream Knowledge Artifacts Affected

### 1a. H-105 (Three-Layer Reasoning Model) — ⚠️ NEEDS UPDATE
**File**: `knowledge/hypotheses/H-105.md`  
**Impact**: H-105 lists H-104 as a source (line 7) and has a section "Extends H-104 (Guard Dependency Hierarchy)" (lines 37-38). The section claims H-104's "verification guard should outperform commit guard" and predicts guard effectiveness correlates with layer proximity.

**What changes**: EXP-145 showed commit and verification guards both declined in parallel (C12.1: 91.6%→2.4%, C1.3: 52.7%→4.5%). There is NO divergence between guard types — the complexity threshold prediction is disproven. H-105's "Extends H-104" section needs rewriting to note the falsification and that the layer-proximity prediction (P-105b) for guards now has weaker motivation (though it could still be true for other reasons).

**Severity**: Moderate. H-105's core model (latent→thinking→output) stands independently. Only the guard-hierarchy extension relies on H-104.

### 1b. KE-145 (30K-Agent Scaling Insights) — ⚠️ NEEDS UPDATE
**File**: `knowledge/entries/KE-145-30k-agent-scaling-insights.md`  
**Impact**: KE-145 has an entire section "Connection to H-104: Guard Dependency Escalation" (lines 40-52) built on the premise that guards create escalating infrastructure dependency. The conclusion (line 89) states guards "will lead to escalating infrastructure dependency" per H-104.

**What changes**: The escalation spiral is disproven. However, the Oracle Verification Divide insight (mechanical vs. judgment verification) remains valid — it just doesn't lead to an escalation spiral. Guards have a transient cost, not a permanent escalating one. The section needs rewriting to note that while judgment-based verification is more expensive than mechanical verification, the system self-corrects over time (guards scaffold and fire rates decline). The fundamental architectural contrast between oracle vs. judgment verification still holds.

**Severity**: Moderate. Core insight (oracle vs. judgment verification) survives; escalation prediction does not.

### 1c. KE-146 (Guard Internalization Taxonomy) — ℹ️ MINOR UPDATE
**File**: `knowledge/entries/KE-146.md`  
**Impact**: References H-104 in connections (line 5) and has a section "Connection to Guard Internalization (H-104 / KE-144)" (line 39). States guard internalization may only be meaningful for Category 1 guards.

**What changes**: EXP-145 showed internalization happens across ALL guard categories (even judgment-dependent ones), just with varying speed. The distinction between Category 1 and 2 guards re: internalization is weaker than claimed.

**Severity**: Low. The taxonomy itself (format-violation vs. reasoning-omission) remains useful; only the internalization prediction is affected.

### 1d. INDEX.md — ⚠️ STALE STATUS
**File**: `knowledge/INDEX.md` (line 685)  
**Impact**: Still shows H-104 as "**Proposed** (P(H)=0.78)". Should read "**Falsified** (P(H)=0.10)".

**Severity**: Low — bookkeeping, but affects anyone looking up hypothesis status.

### 1e. PRIORITY-TRACKER.md — ⚠️ STALE STATUS
**File**: `knowledge/hypotheses/PRIORITY-TRACKER.md`  
**Impact**: Header still describes H-104 at P(H)=0.78 as newly authored. The high-confidence list (line 199) still includes H-104 at 0.78. Neither reflects the falsification.

**Severity**: Low — bookkeeping, but the tracker is a primary reference for Bob and Coach.

### 1f. EXP-146 Design — ℹ️ MINOR
**File**: `knowledge/experiments/EXP-146/design.md` (line 275, 278)  
**Impact**: Lists H-104 as connected. References EXP-145 as testing H-104 "which H-105 extends mechanistically."

**What changes**: The connection is now to a falsified hypothesis. EXP-146 itself tests H-105 (Three-Layer Model) which is independent. No design changes needed — just a note that the H-104 connection is historical.

**Severity**: Minimal. EXP-146 design is unaffected.

---

## 2. Agent Workspace Items Affected

### 2a. Bob's Improvement Queue — ⚠️ NEEDS UPDATE
**File**: `agents/bob/workspace/improvement-queue.md` (line 14)  
**Item**: "Bayesian scorecard for H-101 through H-104"  
**Impact**: H-104 already has EXP-145 results — the scorecard is partially done. Bob should note P(H)=0.10 (falsified) in any scorecard update rather than computing from priors.

**Severity**: Low — the task still makes sense, just needs to reflect current state.

### 2b. Coach's Reflection — ⚠️ STALE REFERENCE
**File**: `agents/coach/workspace/reflections/2026-04-12-05-reflection.md` (line 135)  
**Item**: "IT-2: Common-sense enforcement guard — Related to H-104/EXP-145"  
**Impact**: IT-2 was motivated partly by H-104's claim that guards create anti-learning loops. Since guards actually scaffold learning, the common-sense guard design should shift from "minimal intervention to avoid dependency" to "standard guard — transient dependency is fine, agents internalize."

**Severity**: Low-Moderate. Changes the design philosophy for IT-2, not whether to build it.

### 2c. Coach's Workflow Adoption Evidence Brief
**File**: `agents/coach/workspace/workflow-adoption-evidence-brief.md` (line 87)  
**Item**: "EXP-145 (Guard Dependency Escalation) — understand why guards aren't internalizing"  
**Impact**: This premise is reversed — guards ARE internalizing. The brief's recommendation to understand non-internalization should be updated to reflect the scaffolding model.

**Severity**: Low. The brief's other content stands.

### 2d. Scout's CR-339 and Journal
**Files**: `agents/scout/workspace/cr339-guard-bifurcation-compliance-internalization-gap.md`, `agents/scout/workspace/journal.md`, `agents/scout/workspace/todo.md`  
**Impact**: Scout already processed the falsification (todo.md line 715-722). CR-339's H-104 section (line 83) proposed "Optional Guards as Internalization Detector" — this concept is now supported differently: guards DO scaffold internalization, so optional-vs-mandatory is less critical than originally argued.

**Severity**: Minimal. Scout has already self-corrected.

---

## 3. Dispatch Board Items

### 3a. EXP-145 Row — ✅ Already correct
Shows "✅ COMPLETE | H-104 FALSIFIED (0.78→0.10)". No action needed.

### 3b. Improvement Queue Reference — ⚠️ Needs marking
The dispatch board footer notes "H-104 impact review" as a ready item. This review satisfies that item.

---

## 4. Summary of Required Actions

| Priority | Action | Owner | What |
|----------|--------|-------|------|
| **P1** | Update INDEX.md H-104 status | Bob | Change "Proposed (P(H)=0.78)" → "Falsified (P(H)=0.10)" |
| **P1** | Update PRIORITY-TRACKER.md | Bob | Remove H-104 from high-confidence list, add falsification note to header |
| **P1** | Revise KE-145 H-104 section | Bob | Rewrite "Connection to H-104" to note falsification; preserve Oracle Verification Divide insight |
| **P2** | Revise H-105 "Extends H-104" section | Bob | Note guard-hierarchy prediction lost its primary motivation; P-105b still testable but weakened |
| **P2** | Update KE-146 H-104 connection | Bob | Note all guard categories show internalization (not just Category 1) |
| **P2** | Update coach IT-2 design philosophy | Coach | Design common-sense guard without anti-dependency concerns |
| **P3** | Update coach evidence brief | Coach | Remove "understand why guards aren't internalizing" — they are |
| **P3** | Bob scorecard item | Bob | Note H-104 P(H)=0.10 when running Bayesian scorecard for H-101-104 |

---

## 5. Systemic Implications

**The falsification is GOOD NEWS for the system.** H-104 predicted a doom spiral: more guards → more dependency → more guards. EXP-145 shows the opposite: guards scaffold learning through a transient phase (days), then agents internalize and fire rates drop to 2-5%.

**What this means operationally:**
1. **Guards are safe to deploy.** No need to be cautious about adding new convention guards — transient dependency self-corrects.
2. **Guard pruning is less urgent.** The 10→3 skill pruning was good hygiene but not existentially necessary.
3. **Common-sense guards can be aggressive.** Coach's IT-2 can use standard guard design without worrying about creating dependency loops.
4. **The Oracle Verification Divide still holds** — judgment-based verification is more expensive than mechanical verification, but it doesn't escalate. It has a fixed transient cost.
5. **H-101/H-102 are unaffected.** They explain WHICH agents internalize faster (those with workflows/architectural readiness), and this still matters even though all agents eventually internalize.

**No active experiments or designs need to be blocked or cancelled due to this falsification.**
