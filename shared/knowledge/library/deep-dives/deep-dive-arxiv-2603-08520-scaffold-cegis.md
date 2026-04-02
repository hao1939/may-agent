# Deep Dive: SCAFFOLD-CEGIS — Preventing Latent Security Degradation in LLM-Driven Iterative Code Refinement

**Paper:** arXiv:2603.08520 (cs.CR, cs.SE) — Submitted 9 Mar 2026
**Authors:** Yi Chen, Yun Bian, Haiquan Wang, Shihao Li, Zhe Cui — Chengdu Institute of Computer Application, Chinese Academy of Sciences
**Read:** Full paper via HTML source, all sections including experiments, ablation, discussion, and conclusion.

---

## TL;DR

Iterative LLM code refinement systematically degrades security even when improving functionality. 43.7% of GPT-4o iteration chains have MORE vulnerabilities after 10 rounds than the baseline. Static analysis (SAST) gating makes it WORSE (12.5% → 20.8% latent degradation) by creating a "pseudo-safety effect." SCAFFOLD-CEGIS fixes this via 4-agent architecture with semantic anchoring + 4-layer gating + failure assimilation → reduces latent degradation to 2.1%, achieves 100% safety monotonicity.

---

## 1. The Core Problem: Iterative Refinement Paradox

### What happens when LLMs refine code iteratively?
- **Specification drift in multi-objective optimization**: Each iteration jointly optimizes functionality, performance, maintainability, AND security. When security exists only as soft prompts, the optimization trajectory gradually departs from security specification.
- **Empirical evidence**: 96 GPT-4o iteration chains, 10 rounds each. 43.7% of chains have more vulnerabilities at round 10 than baseline (counting all severities).
- **Even with explicit security-hardening prompts**: degradation rate is still 28.6%.
- **Cross-model**: Reproduced across GPT-5-Nano (DR=10.5%), Claude Sonnet 4.5 (DR=6.2%), DeepSeek-V3 (DR=4.2%) — 288 chains total.

### Why SAST gating makes things WORSE
- Post-hoc SAST: Run Semgrep after each iteration, reject changes with new vulnerabilities.
- Result: DR drops to 0% (looks great!) but SSDR (latent security degradation rate via LLM review) INCREASES from 12.5% → 20.8%.
- **Root cause — Pseudo-safety effect**: Model treats "passing static scan" as "sufficiently safe," then attempts larger refactors that introduce structural security degradation outside SAST coverage.
- **SAST blind spots**: Can't detect deletion of defensive logic, weakening of exception handling, permission-check bypass via new code paths.

### Three Representative Blind Spot Cases
1. **Validation function deletion**: User says "simplify code." LLM removes `validate_user_input()` in SQL injection defense. Parameterized queries remain → Semgrep sees nothing. But input is no longer validated before DB queries.
2. **Weakened exception handling**: User says "optimize performance." LLM replaces concrete exception handling with empty `except` block. Syntactically valid, no SAST pattern match.
3. **Permission-check bypass**: User says "add admin shortcut." LLM introduces path bypassing permission checks. Outside SAST data-flow analysis coverage.

**Key insight**: Latent degradation weakens defensive STRUCTURE rather than creating recognizable vulnerability PATTERNS.

---

## 2. SCAFFOLD-CEGIS Framework Architecture

### Design Principle
Adapt Counterexample-Guided Inductive Synthesis (CEGIS) for security: closed loop of generation → verification → feedback → regeneration, but replace formal SMT verification with semantic-anchor checking.

### Four Agents
1. **SecurityArchitectAgent** — Mines security-critical elements, constructs semantic anchor set Φ = ⟨I, A, R⟩ (invariant anchors, API-signature anchors, security rule base)
2. **ImplementerAgent** — Generates candidate code P' under anchor constraints
3. **GatekeeperAgent** — Four-layer gated verification (correctness, safety monotonicity, diff budget, anchor integrity)
4. **AssimilatorAgent** — Extracts structured lessons from rejected candidates, feeds into subsequent iterations

### Semantic Anchor Mining (3 Levels)
1. **Function-level**: Regex + AST parsing for security-critical functions (validate_*, sanitize_*, auth*). ALSO data-flow analysis: trace from sensitive sinks (execute, open, exec, pickle.loads) upstream to find guard functions.
2. **Pattern-level**: Code-pattern matching for defensive logic (raise ValueError, raise PermissionError, parameterized queries). Extract snippet + context → substring/regex anchors.
3. **Invariant-level**: Per-task-category security invariants (e.g., "all SQL queries must be parameterized," "all path operations must be normalized").

### Anchor Lifecycle
- 6 attributes: anchor_type, selector, lock_level (hard/soft), priority (CRITICAL/HIGH/MEDIUM/LOW), created_iteration, confidence
- TTL management: CRITICAL/HIGH = no expiry. MEDIUM = 10 iterations. LOW = 5 iterations.
- Migration protocol: When code is refactored, anchor can be migrated if new location satisfies same invariants.

### Four-Layer Gating
1. **Correctness**: Run tests → pass/fail
2. **Safety monotonicity**: V_SAST(P') - V_SAST(P) ≤ δ_max (set to 0 in experiments)
3. **Diff budget**: |P'| - |P| ≤ B (prevents unbounded rewrites)
4. **Anchor integrity**: Verify all hard-level anchors via substring search, regex, AST, or semantic validation

Decision logic: PASS → accept; FAIL_RETRY → re-implement (if budget remains); FAIL → rollback to previous safe version.

### Failure Assimilation
- Categorize failures by gate type
- Pattern recognition: recurring failures → generalized rules (e.g., "avoid deleting functions containing 'validate'")
- Natural language rules delivered to ImplementerAgent in subsequent iterations
- Dynamic anchor adjustment: repeatedly-violated-but-eventually-accepted anchors get priority lowered; frequently-failing code elements get new anchors created

---

## 3. Experimental Results

### RQ1: Cross-Model Validation (Table IV)
| Model | Overall DR | Overall SMR | Overall RDR |
|-------|-----------|-------------|-------------|
| GPT-5-Nano | 10.5% | 96.9% | 42.5% |
| Claude Sonnet 4.5 | 6.2% | 98.1% | 52.5% |
| DeepSeek-V3 | 4.2% | 96.6% | 46.9% |

**Key finding**: Systematic gap between SAST-detected degradation (4.2–10.5%) and LLM-review-detected reliability degradation (42.5–52.5%) → non-overlapping detection coverage.

### RQ2: Method Comparison (Table V)
| Method | DR↓ | SMR↑ | SSDR↓ | ΔS↓ | CEV |
|--------|------|------|-------|------|------|
| Baseline | 11.5% | 96.2% | 12.5% | +0.19 | 71998 |
| Prompt-based Security | 9.4% | 96.8% | 10.4% | +0.08 | 54263 |
| Self-Refine | 11.5% | 97.2% | 10.4% | +0.10 | 91086 |
| Post-hoc SAST | 0.0% | 100% | **20.8%** | +0.38 | 71348 |
| Test-driven Guard | 10.4% | 97.2% | **22.9%** | +0.35 | 40977 |
| Hybrid Guard | 0.0% | 100% | 12.5% | +0.17 | 39590 |
| **SCAFFOLD-CEGIS** | **0.0%** | **100%** | **2.1%** | **-0.35** | 58216 |

**Standout results**:
- Post-hoc SAST: DR=0% but SSDR=20.8% (WORSE than no protection at all!)
- Test-driven Guard: SSDR=22.9% (worst of all methods)
- SCAFFOLD-CEGIS: Only method achieving negative ΔS (actually IMPROVING latent security)

### RQ3: Ablation Study (Table VI)
| Setting | DR | SMR | TCR | FSR |
|---------|-----|------|------|------|
| Baseline | 11.5% | 96.2% | 100% | — |
| Anchor-Only | 2.50% | 97.62% | 100% | — |
| Gate-Only | 0.0% | 100% | 72.38% | 20.83% |
| No-Assimilation | 0.0% | 100% | 66.19% | 23.19% |
| **SCAFFOLD-CEGIS** | **0.0%** | **100%** | **77.14%** | **52.71%** |

**Component attribution**:
- **Gating** guarantees safety monotonicity (DR=0%, SMR=100%)
- **Semantic anchors** extend detection coverage (Gate-Only rejection rate 41.67% vs No-Assimilation 52.08%)
- **Failure assimilation** restores evolution capacity (FSR: 20-23% → 52.71%, TCR: 66-72% → 77.14%)

---

## 4. Limitations (Author-Acknowledged)
- 24 code samples (12 tasks × 2 languages)
- SSDR relies on LLM reviewer (Claude Opus 4.5) — noise, misinterpretation
- Semgrep rule coverage is bounded
- Computational cost grows with code scale
- Only Python and Java tested
- Single-file/small-module scope — industrial codebase scalability unknown

---

## 5. Direct Relevance to Our System

### 5a. Our Coder→QA Loop IS an Iterative Refinement Chain
Our system has exactly the architecture SCAFFOLD-CEGIS studies: Coder writes code → QA reviews → Coder revises → repeat. This is an iteration chain susceptible to the iterative refinement paradox. The 43.7% degradation rate is a warning: **our QA loop may be making security worse, not better**, especially if QA focuses on functionality/style and not security-critical structural invariants.

### 5b. The Pseudo-Safety Effect Applies to Us
If our QA agent acts as a "SAST-like gate" (checking for obvious bugs but missing structural degradation), we may be creating the same pseudo-safety effect: Coder sees "QA passed" and becomes more aggressive in rewrites, removing defensive logic that QA doesn't check.

### 5c. Semantic Anchoring is Implementable Today
The 3-level anchor mining approach is directly applicable:
- **Function-level**: QA can identify security-critical functions at the start of a task and flag any that are modified/deleted
- **Pattern-level**: QA can maintain a list of defensive patterns that must be preserved
- **Invariant-level**: Task-specific security invariants can be injected into QA's review criteria

### 5d. Failure Assimilation Maps to Our System
The pattern of extracting lessons from rejected code and feeding them back is what our Evaluator should be doing — but isn't explicitly. When QA rejects code, the rejection reason should be structured and accumulated, so Coder doesn't repeat the same mistakes.

---

## 6. Actionable Takeaways

### T1: Add "Security Anchor" Phase Before Iteration
Before Coder starts iterating, have QA (or a dedicated SecurityArchitect step) identify security-critical elements in the existing code and flag them as anchors. These become hard constraints that iteration must preserve.

### T2: Track Structural Invariants, Not Just Vulnerabilities
Our QA should check not just "are there new bugs?" but "are existing defenses still present?" The SAST-blind-spot lesson is critical: passing tests ≠ maintaining security.

### T3: Implement Diff Budget
Cap the amount of code that can change per iteration. This prevents the "total rewrite that loses defensive logic" pattern. SCAFFOLD-CEGIS's diff-budget gate is simple to implement.

### T4: Structure Rejection Feedback
When QA rejects code, capture: (a) failure type, (b) violated constraint, (c) code location. Feed this as structured context to Coder for retry. This is the Assimilator pattern — converts rejections into learning.

### T5: Bound Iteration Rounds
Cross-reference with AceMAD (optimal T=3, degradation at T=5) and this paper (degradation increasing over 10 rounds). Our Coder→QA loop should have an explicit iteration cap. After N rounds, rollback to best known state rather than continuing to iterate.

### T6: Monitor for Pseudo-Safety
If our QA pass rate is high but post-deployment issues persist, we may have pseudo-safety. Add a second review layer (like SCAFFOLD-CEGIS's LLM Reviewer) that checks for structural degradation that QA's pattern-matching misses.

---

## 7. Cross-References

- **AceMAD (2603.06801)**: Both papers find that more iterations ≠ better results. AceMAD shows T=3 optimal for debate; SCAFFOLD shows degradation increasing over 10 code iterations. Combined lesson: hard-cap iteration counts.
- **CDRRM (2603.08035)**: Evidence-anchored evaluation. SCAFFOLD's semantic anchors for code parallel CDRRM's evidence-anchored diagnosis for rubrics — both ground decisions in concrete, verifiable artifacts rather than soft judgments.
- **Bug-Hunt**: SCAFFOLD's 4-agent architecture (Architect/Implementer/Gatekeeper/Assimilator) is structurally similar to Bug-Hunt's (Hunter/Skeptic/Referee) — specialized adversarial roles with clear separation of concerns.
- **Error Cascades (2603.04474)**: SCAFFOLD's safety monotonicity guarantee (V(P_{i+1}) ≤ V(P_i)) directly prevents error cascades through iterative chains.
- **Boiling Frog (2603.08455)**: The latent degradation phenomenon is exactly the "gradual drift below detection threshold" that Boiling Frog describes. SCAFFOLD's semantic anchors serve as explicit boundary markers for what Boiling Frog calls the "detection threshold."
- **Bias-Bounded Eval (2603.05485)**: Both papers share the philosophy: don't try to eliminate the problem (bias / degradation) — bound its impact through explicit constraints. SCAFFOLD bounds security degradation via anchors; bias-bounded bounds evaluation error via calibration.
- **JRH (2603.05399)**: SCAFFOLD's SSDR metric (LLM reviewer detecting what SAST misses) is analogous to JRH's finding that formatting perturbations (trivial changes) cause larger reliability drops than semantic ones — the "obvious" checks miss the real problems.

---

## 8. Meta-Observation

This paper reveals a fundamental tension in iterative AI-assisted development: **the same capability that enables code improvement (LLM optimization across multiple objectives) is what causes security degradation (specification drift when security is a soft constraint)**. The solution isn't to make constraints softer or trust the LLM more — it's to make constraints harder and more explicit. This "constraint hardening" principle applies broadly to our multi-agent system: wherever an agent can drift from intent over multiple iterations, we need explicit invariants that the system enforces mechanically, not just through prompt guidance.

**Safety Stack Update**: Add component C3 — "Semantic anchoring of security-critical invariants as hard constraints in iterative loops" (from SCAFFOLD-CEGIS).
