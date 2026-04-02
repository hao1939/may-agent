# Deep-Dive #235: iSWE Agent — Resolving Java Code Repository Issues

**Paper:** arXiv:2603.11356  
**Authors:** Ganhotra, Serhan, Abu Nassar, Shinnar, Nevo, Hirzel (IBM Research)  
**Published:** March 11, 2026  
**Rating:** ★★★★☆  
**Date Analyzed:** 2026-03-15

---

## 1. Core Contribution

First issue-resolution agent specialized for Java, achieving state-of-the-art on Java splits of Multi-SWE-bench (128 instances) and SWE-PolyBench (165 instances) while spending 2-3× fewer dollars on model inference than competing agents using the same LLM.

## 2. Architecture

Two-agent pipeline, both ReAct-based:

### 2.1 Localization Agent (Read-Only)
- **Input:** Issue description + repository code
- **Output:** Structured edit recommendation with code locations (file paths, line ranges, proposed edit descriptions, scope information)
- **Tools:** Read-only, Java-aware static analysis via CLDK framework
- **Key design:** Output is typed, structured, and sanitized — not free-form text

### 2.2 Editing Agent (Mostly Read-Only)
- **Input:** Localization recommendation + code locations
- **Output:** Modified code (the actual patch)
- **Tools:** Mostly read-only, with containerized build for error checking
- **Key design:** Only sandbox action is Java project build for compiler error feedback

### 2.3 Key Architectural Decisions

| Decision | Choice | Rationale |
|---|---|---|
| **Task Decomposition** | 2-agent (localize → edit) | Simpler sub-tasks, modular, each independently valuable |
| **Tool Philosophy** | Language-specific static analysis | Java's type system/OO nature needs domain tools |
| **Containerization** | Minimal (only for builds) | Most tools run in user-space — faster, simpler |
| **LLM Coupling** | LLM-agnostic, inline reasoning & tool calling | More robust across different LLMs |
| **Prompting** | Declarative YAML via PDL | Readable prompts, type-checked data flow |
| **Action Space** | Constrained tools, not arbitrary code | Safer, fewer turns, lower cost |

## 3. Why Java Is Different (and Harder)

The paper identifies structural differences that make Java issue resolution harder than Python:

1. **Multi-file edits are the norm** — Java's OO nature spreads functionality across more files
2. **No useful linter feedback** — Java compiler catches what Python linters do, but running the compiler requires correct build environment setup (Maven/Gradle dependencies)
3. **Strong type system** — type-aware refactoring is not optional
4. **Less benchmark saturation** — Python SWE-bench is overfitted; Java is fresher ground
5. **Less model fine-tuning** — frontier LLMs are fine-tuned for Python tasks, not Java

## 4. The Tool Philosophy

This is the paper's core theoretical contribution — **the argument that language-specific tools trump general-purpose code execution for agent-based SE tasks.**

Tools should be:
- **(i) More effective** by leveraging language-specific knowledge
- **(ii) Less LLM-dependent** with fewer ReAct turns
- **(iii) Safer** by avoiding arbitrary side-effects
- **(iv) Lighter-weight** with minimal sandboxing

Built on two open-source technologies:
- **CLDK** (CodeLLM DevKit) — Java static analysis framework providing structural understanding (class hierarchies, method signatures, call graphs)
- **PDL** (Prompt Description Language) — Declarative YAML prompting with type-checked data flow

## 5. Results

### 5.1 Performance
- **Multi-SWE-bench Java (128 instances):** State-of-the-art resolution rate
- **SWE-PolyBench Java (165 instances):** At or near top of leaderboard
- **Total evaluation:** 293 Java instances across both benchmarks

### 5.2 Cost Efficiency
- **2-3× cheaper** than other leading agents using the same LLM
- Fewer ReAct turns needed due to stronger, higher-level tools
- Minimal containerization overhead (only for build verification)

### 5.3 Localization Quality
- Paper reports precision and recall metrics for localization
- Structured localization output enables separate evaluation of each sub-agent

## 6. Connections to GUS Framework

### 6.1 Validates GUS Principles

**GUS Principle: Decompose → Gate → Aggregate (P42)**
- The two-agent pipeline is a textbook implementation: localization decomposes the problem, structured output gates what the editor sees, editing aggregates the solution

**GUS Law 19 (Minimum Sufficient Coordination)**
- Two agents with minimal, typed interface is exactly minimum sufficient coordination
- No shared memory, no complex protocols — just a structured handoff

**GUS Principle: Scaffolding Paradox**
- Language-specific tools are scaffolding that actually works because they provide genuine domain knowledge, not generic structure

### 6.2 Challenges GUS Assumptions

**Counter-evidence to pessimism:** This is a clear MAS success case where:
- Task is naturally decomposable (localize vs. edit)
- Sub-tasks have clear success criteria
- Interface between agents is typed and sanitized
- Domain tools reduce LLM burden

This fits within the boundary conditions for MAS success identified in DD#220.

### 6.3 Novel Insight: The Constrained Tool Advantage

The paper's strongest finding for multi-agent theory: **constrained, domain-specific tools produce better outcomes than general-purpose code execution**. This is because:

1. **Fewer turns** → less context pollution (validates GUS Mechanism 1: Token Budget Fragmentation)
2. **Type-checked outputs** → less error propagation between agents
3. **No arbitrary side-effects** → no need for heavyweight safety measures
4. **Domain knowledge baked into tools** → the LLM doesn't need to reason about language semantics

## 7. Actionable Takeaways for Our System

1. **Tool Philosophy:** Our agents should have tools that are domain-specific, safe by default, and minimize LLM turns — not general-purpose code execution
2. **Typed Interfaces:** The structured localization output is a model for inter-agent communication — typed, sanitized, independently evaluable
3. **Minimal Containerization:** Most agent operations don't need sandboxing; only isolate the dangerous parts
4. **Inline Tool Calling:** Client-side parsing of tool calls in LLM output is more robust across models than native tool-calling APIs
5. **Declarative Prompts:** YAML-based prompt templates (PDL) keep prompts readable and type-safe

## 8. Limitations

1. **Java-only specialization** — the approach's advantage is domain-specific tools, which must be rebuilt for each language
2. **Narrow evaluation** — SWE-bench-style benchmarks test issue resolution in well-structured open-source repos, not enterprise-specific patterns
3. **No multi-agent coordination complexity** — this is a two-agent pipeline, not a dynamic multi-agent system. The coordination challenge is trivial by design
4. **Python benchmarks not tested** — unclear how the tool philosophy compares on Python where linters + arbitrary code work well

## 9. Research Leads

- **CLDK framework** — Open-source Java analysis toolkit worth examining for our own Java-related tool design
- **PDL prompting language** — Declarative prompt engineering could reduce prompt engineering errors in our system
- **Benchmark contamination concerns** — Paper raises important point about Python SWE-bench saturation; Java provides cleaner evaluation ground

## 10. Bottom Line

iSWE demonstrates that **the right architecture for multi-agent SE tasks is: decompose the problem, give each agent domain-specific tools, and keep the inter-agent interface typed and minimal.** This is a production-grade validation of GUS's Decompose→Gate→Aggregate principle. The 2-3× cost reduction from constrained tools vs. arbitrary code execution is the most actionable finding for anyone building multi-agent coding systems.

---

*Cross-references: DD#233 (AutoSkill non-delegation zones), CR#101 (SE-MAS Bridge), CR#104 (Code Review Noise Frontier), DD#220 (MAS Success Boundary Conditions)*
