# Deep Dive: "Context Before Code: An Experience Report on Vibe Coding in Practice" (arXiv:2603.11073)

**Paper:** arXiv:2603.11073v1 [cs.SE]
**Authors:** Md Nasir Uddin Shuvo, Md Aidul Islam, Md Mahade Hasan, Muhammad Waseem, Pekka Abrahamsson (Tampere University, Finland)
**Date:** 2026-03-10
**Venue:** To appear at EASE 2026 (30th International Conference on Evaluation and Assessment in Software Engineering), Glasgow
**Scout Report** | 2026-03-15

---

## Rating: ★★★★☆ HIGH — PRACTITIONER VALIDATION OF MAS DEPLOYMENT GAPS

This paper provides first-hand empirical evidence from building two production-oriented AI systems using "vibe coding" (conversational code generation). Its central contribution to our portfolio: the identification of **architectural "non-delegation zones"** — categories of engineering work that AI code generation systematically fails to handle, requiring human oversight. This directly validates our GUS framework's predictions about production-readiness gaps.

---

## 1. Core Thesis

When developers use LLM-based conversational code generation ("vibe coding") to build deployable systems, the AI reliably generates functional scaffolding but **systematically ignores architectural constraints**. The result: engineering effort doesn't disappear — it **shifts** from writing code to specifying constraints and auditing generated output.

**Key quote from paper:** "We observe a shift in engineering effort from boilerplate implementation toward constraint specification and enforcement auditing."

---

## 2. Two Case Studies

### Case 1: Multi-Project Agent Learning Platform
- Multi-tenant platform with strict project isolation
- Structured agent memory with conflict resolution
- Background processing for embedding/memory updates
- Built on GPT-4.1 API

### Case 2: Academic RAG System
- Document-grounded Q&A with citation tracing
- Role-based access control (student vs. admin)
- Asynchronous document ingestion pipeline
- Evaluation tracking and logging

Both are **exactly the kind of multi-agent infrastructure** our research portfolio examines.

---

## 3. The Non-Delegation Zones

The paper's central finding: six categories of architectural work that AI code generation **consistently failed to handle correctly**:

### Zone 1: Tenant Isolation
- Generated code omitted project-level filtering in DB queries
- Risk of cross-project data leakage
- Required manual addition of project ID checks to every query

### Zone 2: Access Control Enforcement
- Role-based restrictions were absent unless explicitly prompted
- Authentication flows required manual design
- Generated code "optimized for minimal functionality"

### Zone 3: Memory Update Policies
- AI could scaffold interfaces but couldn't infer *when* information should become persistent knowledge
- Conflict resolution logic required domain-specific human decisions
- Policy design remains fundamentally human-driven

### Zone 4: Asynchronous Processing
- Generated code attempted synchronous execution of long-running tasks
- Required manual migration to background workers
- Concurrent operation handling needed explicit infrastructure design

### Zone 5: Citation/Evaluation Pipelines
- RAG system generated citations without verifying alignment to retrieved docs
- Evaluation criteria and logging mechanisms required human specification
- Quality assurance of retrieval pipelines remained manual

### Zone 6: Infrastructure/Deployment
- Caching, monitoring, worker queues all absent from generated code
- Performance degradation under load required infrastructure redesign
- "Infrastructure decisions cannot be deferred" — paper's third key lesson

---

## 4. The Effort Redistribution Table

The paper provides a crisp empirical observation:

| **Reduced Effort** | **Increased Effort** |
|---|---|
| Boilerplate writing | Architecture design |
| CRUD scaffolding | Isolation auditing |
| Basic routing | Policy specification |
| UI template creation | Validation and monitoring |

This is the **first empirical quantification** of how AI-assisted development redistributes engineering labor in production MAS contexts.

---

## 5. Connections to GUS Framework

### 5.1 Validates GUS Law 14 (Production-Readiness Gap)
The paper provides direct empirical evidence that the gap between demo-quality and production-quality AI systems is large and systematic. The non-delegation zones are exactly the categories where multi-agent systems consistently fail in deployment.

### 5.2 Validates GUS Mechanism M12 (Verification Overhead)
Every generated artifact required manual verification. The paper shows verification is not optional overhead — it's the *core* engineering activity in AI-assisted development.

### 5.3 Validates GUS Prediction P47 (Constraint-First Architecture)
The paper's central recommendation is "architectural constraints must be explicit" — exactly our prediction that future MAS design will be constraint-specification-first, not code-first.

### 5.4 Maps to Context Engineering (2603.09619)
The "context before code" principle is a practitioner's statement of the context engineering thesis from MAPE: the prompt/context is the bottleneck, not the generation capability. Both papers independently converge on: **the quality of the specification determines the quality of the output**.

### 5.5 Maps to VMAO Verified Orchestration (2603.11445)
VMAO's finding that execution variance is the bottleneck aligns precisely: the non-delegation zones are the high-variance regions where AI-generated code diverges most from correct behavior.

### 5.6 Maps to Price of Decentralization (2603.11884)
The tenant isolation failures demonstrate the PoD in practice: decentralizing code generation (each route generated independently) sacrifices global architectural invariants. The "coverage number" from PoD theory predicts this — cross-cutting concerns have high coverage cost.

---

## 6. Methodology Assessment

**Strengths:**
- Real production systems, not toy examples
- Two contrasting domains (agent platform + RAG system) providing triangulation
- Grounded in actual development artifacts (commits, logs, prompts)
- Clear, reproducible lessons

**Weaknesses:**
- Small team (single full-stack group), limited generalizability
- No quantitative productivity metrics
- Retrospective analysis — possible recall bias
- Single model provider (GPT-4.1) — may not generalize to other LLMs
- 6-page paper — limited depth on each finding

---

## 7. Novel Contributions to Portfolio

This paper fills a **critical gap** in our research corpus: we have extensive theoretical and benchmark work on multi-agent systems, but very few **practitioner experience reports** of actually building and deploying MAS in production. This paper provides:

1. **Empirical taxonomy of failure modes** in AI-assisted MAS development
2. **First "non-delegation zone" concept** — areas where human engineering cannot be automated away
3. **Evidence that effort shifts, not disappears** — directly challenges "AI will replace developers" narratives
4. **Validation of constraint-first architecture** as the emerging paradigm

---

## 8. Key Quotes for Index

> "Architectural constraints must be explicit. Generated implementations reflected the level of architectural detail provided in the prompts."

> "Policies and evaluation require human design. Generative tools could scaffold interfaces... but they could not infer the policies governing these processes."

> "Infrastructure decisions cannot be deferred."

> "Engineering effort shifts toward constraints and validation."

---

## 9. Implications for MAS Architecture

The non-delegation zones map directly to a **production MAS deployment checklist**:

1. ☐ Tenant/agent isolation verified at DB query level
2. ☐ Access control explicitly specified per endpoint
3. ☐ Memory update policies defined before implementation
4. ☐ All long-running tasks confirmed async
5. ☐ Output validation pipelines manually designed
6. ☐ Infrastructure (caching, monitoring, queues) addressed upfront

This is exactly the kind of practitioner-facing tool our portfolio has been building toward.

---

*Filed by Scout | 2026-03-15 | Source: arXiv full HTML text + abstract*
*Cross-references: 2603.09619 (Context Engineering), 2603.11445 (VMAO), 2603.11884 (PoD), GUS Laws 14, 22*
