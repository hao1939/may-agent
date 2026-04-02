# Deep Dive: arXiv 2603.11864 — Social, Legal, Ethical, Empathetic and Cultural Norm Operationalisation for AI Agents

**Paper:** "Social, Legal, Ethical, Empathetic and Cultural Norm Operationalisation for AI Agents"
**Authors:** Radu Calinescu, Ana Cavalcanti, Marsha Chechik, Lina Marsso, Beverley Townsend (York, Toronto, Polytechnique Montréal)
**ArXiv:** [2603.11864](https://arxiv.org/abs/2603.11864) — March 12, 2026
**Area:** AI governance, normative compliance, formal verification, multi-agent alignment

---

## Summary

This paper proposes a systematic 5-stage process for **operationalising** abstract SLEEC (Social, Legal, Ethical, Empathetic, and Cultural) norms into concrete, formally verifiable requirements for AI agents. The core argument: while international frameworks (OECD, UNESCO, IEEE, ISO/IEC) have established high-level normative principles, a **critical engineering gap** exists in translating these into concrete, implementable requirements that can be verified prior to deployment. The paper surveys existing tools supporting this process and identifies key open challenges.

---

## The 5-Stage SLEEC Process

### Stage 1: AI Agent Capability Specification
- Enumerate functional capabilities that either **trigger** SLEEC concerns (e.g., camera = privacy issue) or are **required** to satisfy norms (e.g., communication channel needed for duty-of-care alerting)
- Output: informal capability list + use cases for stakeholder communication

### Stage 2: SLEEC Requirements Elicitation
- Uses the pluralistic elicitation approach (Townsend et al., 2022): engages ethicists, lawyers, sociologists, developers, regulators, users
- Three sub-steps:
  1. **Identify high-level principles** (non-maleficence, autonomy, privacy) from governance frameworks
  2. **Derive normative-principle proxies** — actionable placeholders mapping abstract values to agent capabilities (e.g., "assent" proxies for "human autonomy" → voice-recognition capability)
  3. **Define SLEEC rules** in a dedicated DSL:
     ```
     id when triggerEvent [and triggerGuard] then response [within timeframe]
     unless defeaterGuard [then defeaterResponse]
     ```
  - Defeaters handle exceptions (circumstances where the base rule doesn't apply)

### Stage 3: Well-Formedness Checking
Two complementary formal methods:
1. **Process-algebraic (tock-CSP):** Maps SLEEC rules to timed communicating sequential processes; uses FDR model checker to detect **conflicts** (pairs of rules that can't both always be obeyed) and **redundancies** (one rule always implies another). Supported by SLEEC-TK toolkit + LLM-guided debugging tool.
2. **Logic-based (FOL*/LEGOS):** Encodes entire ruleset into first-order logic with relational objects; uses satisfiability checker to find **insufficiency** (failure to prevent undesirable behaviors) and **over-restrictiveness** (blocking desirable behaviors). Produces causal proofs translated back to SLEEC DSL for stakeholder accessibility.

### Stage 4: SLEEC-Aware Implementation
- Map validated requirements to implementable abstractions (observable events, monitored measures, state variables, controllable actions)
- Incorporate into **training-time** dataset schemas (encoding situations that satisfy/violate rules)
- Deploy as **runtime guardrails** that monitor perceptions, constrain actions, and handle defeaters
- Guardrails can be revised or overridden for requirement evolution

### Stage 5: Compliance Verification
- Novel notion of conformance extending timed refinement with SLEEC measure constructs
- Uses RoboChart (diagrammatic modeling language with tock-CSP semantics) for formal verification
- Verified models can be auto-translated to deployment code, preserving formal guarantees
- Process can result in **cancellation** — a valid positive outcome preventing deployment of non-compliant agents

---

## Key Open Challenges Identified

1. **Normative-principle reification:** Translating abstract UNESCO/OECD values into concrete requirements for specific applications (assistive robots vs. self-driving cars vs. medical diagnosis)
2. **Value-conflict resolution:** Transparency vs. privacy; safety vs. autonomy; Turing's impossibility of complete rulesets. Need formal stopping criteria for "sufficient" rulesets.
3. **SLEEC-capable agent engineering:** Traceability gaps between high-level norms and low-level actions; temporal scale mismatch (consent = days/weeks; sensor processing = milliseconds); computational cost of normative inference
4. **Runtime adaptation:** Agents must adapt to SLEEC norms of users/contexts unknown at development time, while maintaining formal guarantees from verification
5. **Normative and AI competence:** Cross-disciplinary education needed — engineers need SLEEC understanding, domain experts need AI literacy

---

## Relevance to Our Research

### Direct Connections
- **Governance-alignment track:** This is the most rigorous formalization of the norm-to-implementation pipeline we've seen. The SLEEC DSL with defeaters is essentially a formal version of the "constitutional" approach to AI alignment, but with mathematical verification.
- **Multi-agent coordination:** The process-algebraic approach (CSP-based) inherently models multi-agent interaction — rule conflicts between agents are structurally identical to the coordination problems studied in our MAS topology work.
- **Runtime guardrails:** Stage 4's guardrail architecture connects directly to our work on sandboxing and containment (cf. deep-dives on MASAI, overrefusal triggers, authorization revocation).

### Cross-References
- **2603.11126 (Value Alignment via CFA):** CFA provides an automated alignment mechanism; SLEEC provides the formal verification that CFA's outputs actually satisfy normative requirements. Complementary approaches.
- **2603.10476 (Learning to Negotiate):** Multi-agent value negotiation maps directly onto Stage 2's stakeholder elicitation — SLEEC formalizes what the negotiation outcomes must satisfy.
- **2603.09875 (Bureaucracy of Speed — authorization revocation):** The tock-CSP formalism used for SLEEC rule checking is structurally related to the memory consistency models mapped onto authorization revocation protocols.
- **2603.11388 (Overrefusal triggers):** Over-restrictiveness checking in Stage 3 directly addresses the overrefusal problem — SLEEC's LEGOS tool can prove when a ruleset unnecessarily blocks desirable behaviors.

### Novel Insight
The **cancellation-as-positive-outcome** framing is philosophically significant: the framework explicitly values the ability to determine that a normatively compliant agent *cannot be built* with current technology. This contrasts with most AI development pipelines where project cancellation is always negative. It suggests a "safety-first" development methodology where the verification infrastructure exists *before* the agent.

---

## Limitations
- **Scalability:** The formal verification approach (CSP model checking, FOL* satisfiability) may not scale to the complexity of frontier LLM-based agents with millions of possible behavioral states
- **Static rulesets:** While runtime adaptation is discussed as an open challenge, the current tooling only supports development-time verification
- **Example domain:** The assistive-care robot example, while compelling, is relatively constrained compared to open-ended LLM agents operating in unrestricted environments
- **DSL expressiveness:** The SLEEC DSL's event-trigger-response pattern may not capture all normative requirements (e.g., emergent behavioral patterns, statistical fairness constraints)

---

## Bottom Line
**Rating: HIGH RELEVANCE (8/10)**

This paper provides the most complete formal framework we've seen for translating abstract governance principles into verified agent behavior. While the scalability to frontier LLM agents remains an open question, the SLEEC process defines the *standard of proof* that governance frameworks should aspire to. The formal well-formedness checking (detecting conflicts, redundancies, insufficiency, over-restrictiveness) directly addresses failure modes we've documented across dozens of papers. Essential reading for anyone working on AI governance operationalization.
