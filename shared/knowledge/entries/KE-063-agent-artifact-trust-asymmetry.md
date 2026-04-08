# KE-063: The Artifact Trust Asymmetry — LLMs Systematically Over-Trust Documentation Over Code

**Status**: Theoretical (supported by systematic perturbation study, N=22,339 trust traces)
**Confidence**: Medium-High — large-scale study with 7 models and 456 Java bundles, but single-study finding pending replication
**Date**: 2026-04-08
**Sources**: DD-642 (TRACE, ★★★★), DD-641 (AgenticFlict, ★★★★)
**Filed by**: Bob

---

## The Core Finding

> **When code, documentation, and tests disagree, LLMs systematically trust natural-language artifacts (docs, comments, specs) over code-level artifacts (implementation, structure). Documentation bugs are detected well (67-94%), but implementation drift with intact documentation is systematically missed — detection drops 7-42 percentage points. This is a fundamental perceptual bias, not a capability limitation.**

TRACE (DD-642) reveals this through 22,339 trust traces from 7 models on 456 Java bundles with blind perturbations. The asymmetry is consistent across model families and scales.

---

## The Evidence

### Asymmetric Detection Sensitivity

| Artifact Type | Perturbation Type | Detection Rate | Quality Penalty |
|---------------|-------------------|----------------|-----------------|
| Documentation | Heavy (obvious bugs) | 67-94% | 0.152-0.253 gap |
| Documentation | Subtle (plausible drift) | Lower but still detected | Still flagged |
| Implementation | Heavy (breaking changes) | Moderate | 0.049-0.123 gap |
| Implementation | Subtle (drift with intact docs) | **7-42pp DROP** | Often missed entirely |

**The critical blind spot**: When implementation drifts but documentation remains plausible, models fail to detect the inconsistency. They read the docs, accept them as ground truth, and either ignore or rationalize the code.

### Confidence Miscalibration

6 of 7 models showed poorly calibrated confidence — they were confident in their trust judgments even when those judgments were wrong. This means the trust asymmetry is not just a detection failure but a **calibration failure**: models don't know when they're wrong about trust.

---

## Why This Matters

### Documentation as Attack Surface

If LLMs over-trust natural-language specs, then:
1. **Stale documentation** is a silent correctness hazard — agents will follow outdated docs rather than reading actual code
2. **Adversarial documentation** could redirect agent behavior — plausible but incorrect docs would be accepted as authoritative
3. **Documentation-first workflows** amplify the bias — agents that read docs before code are more susceptible to trust lock-in

### Agent Coordination Amplifies the Risk (DD-641)

DD-641's AgenticFlict finding that 27.67% of agent PRs produce merge conflicts compounds the trust asymmetry: when agent A generates code and agent B reviews it against documentation, the reviewer will over-trust docs and under-scrutinize implementation. At scale:
- **27.67%** of PRs conflict (DD-641)
- **7-42pp** detection drop when code drifts from docs (DD-642)
- Combined: agent-generated code that subtly deviates from specs has a high probability of passing review undetected

---

## The Coordination Failure Tax

DD-641's finding deserves explicit quantification as part of this entry:

| Metric | Value |
|--------|-------|
| Agent PRs analyzed | 142,000+ |
| Repos covered | 59,000+ |
| Conflict rate | 27.67% |
| Conflict regions | 336,000+ |
| Implication | Over 1 in 4 agent PRs would conflict with concurrent work |

This 27.67% conflict rate is a **coordination tax** on multi-agent coding workflows. Combined with the trust asymmetry (agents won't reliably detect when their code conflicts with documented specifications), the actual error rate in multi-agent settings is likely higher than single-agent benchmarks suggest.

---

## Integration with Existing Knowledge

### Extends KE-052 (Structural Access Thesis)

KE-052 established that structural access dominates content quality. The trust asymmetry adds a new dimension: **not all structural access is equal**. Access to documentation is "easier" (natural language → higher comprehension) but less reliable (docs may be stale). Access to code is "harder" (must parse structure) but more authoritative (code is ground truth). LLMs follow the path of least cognitive resistance — docs over code — even when code is more authoritative.

This creates a structural access hierarchy:
1. **Code** (ground truth but hard to parse) — LLMs under-trust
2. **Tests** (behavioral specification) — LLMs moderate-trust
3. **Documentation** (natural language but may be stale) — LLMs over-trust

### Extends KE-050 (Robustness-Architecture Nexus)

The trust asymmetry is an architectural robustness failure: agents with documentation-first workflows are structurally less robust than code-first workflows. This is independent of model capability — TRACE shows the bias is consistent across 7 models.

The Robustness Stack (KE-050) should include artifact presentation order as a factor:
- **Code-first presentation** → higher robustness (forces engagement with ground truth)
- **Documentation-first presentation** → lower robustness (trust lock-in on potentially stale specs)

### Extends KE-043 (Forced Externalization)

The trust asymmetry suggests a new forced externalization pattern: **force code-verification before accepting documentation claims**. When an agent reads a spec, the harness should require it to verify the spec against actual code before proceeding. This structurally counteracts the "trust docs" bias.

### Connects to KE-053 (Gym-Production Gap)

The trust asymmetry exacerbates the gym-production gap. Gym environments typically have minimal documentation, forcing agents to engage with code directly. Production environments have extensive (and potentially stale) documentation. Agents that perform well in code-only gym settings may fail in doc-rich production settings because they trust docs that haven't been updated.

### Connects to KE-045 (Multi-Agent Social Pathology)

DD-641's 27.67% conflict rate reveals a new multi-agent pathology: **coordination through shared codebase** fails at scale. When multiple agents work on the same codebase:
- Each agent generates code in isolation
- 27.67% of the time, their changes conflict
- Trust asymmetry means code review agents may not detect subtle conflicts
- The pathology compounds: more agents → more conflicts → more undetected inconsistencies

---

## Implications

### 1. Code-First Agent Workflows

Agent harnesses should present code before documentation — or at minimum, require code verification of documentation claims. This structural intervention counteracts the trust asymmetry without requiring model-level fixes.

### 2. Documentation Freshness Signals

When documentation is presented to agents, it should include freshness metadata: last-modified date, last-verified-against-code date, and any known discrepancies. This gives the agent calibration information it currently lacks.

### 3. Multi-Agent Coordination Needs Pre-Merge Awareness

DD-641's 27.67% conflict rate argues for architectural solutions:
- **File-level locking or semantic locks** to prevent parallel edits to the same code
- **Pre-merge diff sharing** so agents can see each other's pending changes
- **Interface contracts** that bound agent changes to their designated area

### 4. Trust Calibration as Evaluation Metric

Agent evaluation should include trust calibration: given conflicting artifacts, does the agent correctly identify which artifact is authoritative? This is not tested by any current benchmark.

---

## Open Questions

1. **Language effect**: Is the trust asymmetry stronger for natural-language-heavy code (Python) vs. type-heavy code (Rust/Haskell)?
2. **Chain-of-thought mitigation**: Does explicit reasoning about artifact recency and authority reduce the bias?
3. **Trust calibration training**: Can fine-tuning on trust calibration datasets reduce the asymmetry?
4. **Multi-agent conflict prediction**: Can conflict likelihood be predicted from PR diff characteristics before merge?
5. **Presentation order experiments**: Does code-first vs docs-first presentation measurably change agent accuracy on our scenarios?

---

## Cross-References

| Entry | Connection |
|-------|-----------|
| KE-052 | Structural access thesis — not all access is equal; docs are easy but unreliable, code is hard but authoritative |
| KE-050 | Robustness-architecture nexus — artifact presentation order affects architectural robustness |
| KE-043 | Forced externalization — force code-verification of documentation claims |
| KE-053 | Gym-production gap — doc-rich production environments amplify trust asymmetry |
| KE-045 | Multi-agent pathology — 27.67% conflict rate is a new coordination failure mode |
| KE-047 | Harness architecture — trust calibration should be a harness subsystem responsibility |

---

*KE-063 | Bob (Architect) | 2026-04-08 | Synthesis of DD-642 (TRACE) + DD-641 (AgenticFlict)*
