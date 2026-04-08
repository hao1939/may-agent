# KE-062: Behavioral Fuzzing as Agent Testing Paradigm — From Anecdotal Bug Reports to Systematic Behavioral Test Suites

**Status**: Theoretical (supported by one peer-reviewed implementation + alignment with existing empirical findings)
**Confidence**: Medium-High — ABTest demonstrates the full pipeline on 3 major agents with 642 confirmed anomalies, but replication across independent teams pending
**Date**: 2026-04-08
**Sources**: DD-639 (ABTest, ★★★★★), DD-640 (Scaffold Taxonomy, ★★★★★)
**Filed by**: Bob

---

## The Core Finding

> **Agent behavior can be systematically tested through behavior-driven fuzzing: mining real-world failure reports → extracting reusable interaction patterns → composing executable test cases → detecting anomalies at scale. This converts the agent testing problem from "manually write test cases" to "mine and compose behavioral patterns."**

ABTest (DD-639) demonstrates the complete pipeline: from 400 user-reported failures, it extracts 47 Interaction Patterns and 128 Action Types, composes 647 repository-grounded fuzzing cases, and discovers 642 confirmed new anomalies across Claude Code, Codex CLI, and Gemini CLI. The 40.8% precision rate (642/1573 flagged) is high for fuzzing.

This is the first framework that bridges anecdotal bug reports and systematic agent testing infrastructure — the very gap identified in our Harness Engineering research program (CR#301).

---

## Key Components

### 1. The Behavioral Vocabulary

The 47 Interaction Patterns + 128 Action Types form a **BDD (behavior-driven development) language for agent testing**. This is structurally analogous to how web testing evolved: from "click random buttons" to Selenium patterns to BDD frameworks (Cucumber/Gherkin). Agent testing is following the same maturation path:

| Stage | Web Testing Analogy | Agent Testing Equivalent |
|-------|---------------------|--------------------------|
| Ad hoc | Manual QA scripts | Bug reports, anecdotal testing |
| Pattern extraction | Page Object Model | 47 Interaction Patterns |
| Vocabulary definition | Gherkin syntax | 128 Action Types |
| Compositional testing | BDD frameworks | ABTest fuzzing templates |
| Continuous testing | CI/CD test suites | ? (next stage) |

### 2. The Mining-to-Testing Pipeline

The pipeline is: **Mine → Extract → Compose → Instantiate → Execute → Detect**

1. **Mine**: 400 user-reported developer-confirmed failures
2. **Extract**: Interaction patterns (workflows) + action types (behaviors)
3. **Compose**: Stepwise fuzzing templates from pattern/action combinations
4. **Instantiate**: Ground templates in real repositories (not synthetic environments)
5. **Execute**: Run agents on grounded tests, record behavioral traces
6. **Detect**: Validate anomalous behaviors against expected patterns

The critical innovation is step 4: grounding in real repositories means tests capture environmental complexity that synthetic gyms miss.

### 3. Previously Unreported Failure Modes

ABTest discovered new anomalies beyond the original 400 reports — the compositional nature of the templates generates test cases that cover failure modes humans hadn't reported yet. This is the generative power of pattern-based testing.

---

## Integration with Existing Knowledge

### Extends KE-053 (Gym-Production Gap)

KE-053 established that the gym-production gap is structural: production imposes complexity (context scale, cascading state, compound verification) that gyms cannot replicate. ABTest partially bridges this gap by:
- **Grounding in real repos** (not synthetic environments) — addresses context scale
- **Testing behavioral patterns** (not just competency) — addresses the behavioral/competency distinction
- **Mining production failures** (not designing from scratch) — ensures production-relevant test coverage

However, ABTest still tests single-session behaviors. KE-053's primary gap driver — cascading state from failed sessions — remains untested.

### Extends KE-050 (Robustness-Architecture Nexus)

KE-050 established that robustness is architectural. ABTest provides the **testing methodology** to measure robustness: if agents show different anomaly profiles under ABTest's behavioral fuzzing, those profiles characterize architectural (not model-level) robustness. The finding that different agents (Claude Code vs Codex vs Gemini) show different anomaly profiles under the same behavioral tests confirms the harness-mediation effect.

### Extends KE-047 (Harness Architecture Convergence)

DD-640's scaffold taxonomy provides the structural vocabulary (12 dimensions, 5 loop primitives); DD-639's ABTest provides the behavioral tests. Together they form a complete agent characterization framework: **structure** (what the agent IS) × **behavior** (what the agent DOES). This is the duality our harness engineering program has been building toward.

### Connects to KE-043 (Forced Externalization)

ABTest's interaction patterns include behavioral patterns where agents fail to externalize reasoning — making decisions without first analyzing the situation. The 47 patterns could serve as a catalog of externalization opportunities: points in the workflow where forced externalization would change outcomes.

---

## Implications

### 1. Agent Testing Is Becoming an Engineering Discipline

The progression from anecdotal bug reports to systematic behavioral fuzzing mirrors the maturation of software testing from the 1990s to 2000s. Within 12-18 months, we should expect:
- Standardized behavioral test suites (analogous to OWASP for security)
- CI/CD integration for agent behavioral testing
- Behavioral regression testing as a standard practice

### 2. Interaction Patterns as Design Language

The 47 Interaction Patterns may be more valuable than the test results. If these patterns generalize across agent families, they become the **specification language** for agent behavior — what an agent should do in each interaction pattern, and how to verify it does.

### 3. Mining > Designing for Test Coverage

The mining approach (extracting patterns from real failures) produces better test coverage than expert-designed test suites. This is because real failures reveal failure modes that experts don't anticipate.

---

## Open Questions

1. **Pattern generalization**: Do the 47 patterns transfer across agent domains (coding → research → customer service)?
2. **Mapping to Laws**: How do ABTest's patterns map to our 78 Laws of Software Agent Behavior?
3. **Multi-session testing**: Can the framework be extended to test cascading state failures (KE-053's primary gap)?
4. **Proactive vs reactive**: Can patterns be used to predict failure modes before they occur, or only to test after mining?
5. **CI/CD integration**: What's the overhead of running behavioral fuzzing in continuous integration?

---

## Cross-References

| Entry | Connection |
|-------|-----------|
| KE-053 | Gym-production gap — ABTest partially bridges by grounding in real repos, but cascading state untested |
| KE-050 | Robustness-architecture nexus — ABTest provides the measurement methodology for architectural robustness |
| KE-047 | Harness architecture — DD-640 taxonomy + DD-639 behavioral tests = complete characterization framework |
| KE-043 | Forced externalization — Interaction patterns identify externalization opportunities |
| CR-301 | Harness engineering cambrian explosion — ABTest is the testing infrastructure predicted by CR-301 |

---

*KE-062 | Bob (Architect) | 2026-04-08 | Synthesis of DD-639 (ABTest) + DD-640 (Scaffold Taxonomy)*
