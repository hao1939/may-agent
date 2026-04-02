# TDAD: Test-Driven AI Agent Definition

## Paper Information
- **Title**: Test-Driven AI Agent Definition (TDAD): Compiling Tool-Using Agents from Behavioral Specifications
- **Authors**: Tzafrir Rehan (Fiverr Labs)
- **arXiv**: 2603.08806
- **Date**: March 9, 2026
- **GitHub**: https://github.com/f-labs-io/tdad-paper-code
- **Source**: XHS档案高频引用挖掘 (3次引用)

## Core Contribution

TDAD treats agent development as a **compilation problem**: a specification (PRD + decision tree) is the source, behavioral tests are the intermediate representation, and the prompt/configuration is the compiled artifact.

## Four Roles Architecture

| Role | Function | Input | Output |
|------|----------|-------|--------|
| **TestSmith** | Test generation agent | Spec YAML + guidelines | Visible + Hidden tests (MFT/INV/DIR) |
| **PromptSmith** | Prompt compilation agent | Spec + visible tests | Compiled prompt artifact |
| **Built Agent** | Runtime execution | User messages + tools | Structured responses via respond tool |
| **MutationSmith** | Test evaluation agent (post-compilation) | Compiled prompt + mutation intents | Mutation score (MS) |

## Three Anti-Gaming Mechanisms

### 1. Visible/Hidden Test Splits
- Withhold evaluation tests during compilation
- Only visible tests drive prompt refinement
- Hidden tests measure generalization (HPR)

### 2. Semantic Mutation Testing
- Post-compilation agent generates plausible faulty prompt variants
- Harness checks if visible test suite detects mutations
- Validates test suite strength

### 3. Spec Evolution Scenarios
- Quantify regression safety when requirements change (v1 → v2)
- Measure Spec-Update Regression Score (SURS)

## Experimental Results

### SpecSuite-Core Benchmark
Four deeply-specified agents:
1. **Policy Compliance** - Data handling policies
2. **Grounded Analytics** - Tool-based data analysis
3. **Runbook Adherence** - Operational procedure following
4. **Deterministic Enforcement** - Strict rule enforcement

### Performance Metrics (24 independent trials)

| Metric | v1 Spec | v2 Spec (Evolved) |
|--------|---------|-------------------|
| Compilation Success | 92% | 58% |
| Visible Pass Rate (VPR) | High | High |
| Hidden Pass Rate (HPR) | 97% mean | 78% mean |
| Mutation Score (MS) | 86-100% | - |
| Regression Safety (SURS) | - | 97% mean |

**Note**: Most failed v2 runs passed all visible tests except 1-2, highlighting the importance of hidden tests.

## Key Technical Details

### Test Taxonomy (from CheckList)
- **MFT** (Minimum Functionality): Basic path testing
- **INV** (Invariance): Paraphrased inputs, same expected behavior
- **DIR** (Directional): Input pairs differing in specific conditions

### Response Contract
Structured output via dedicated `respond` tool:
```yaml
response_contract:
  decision: enum  # DECISION_CHOICES from spec
  node_id: string # Decision tree node identifier
  evidence: string # Supporting information
  user_message: string # User-facing message
```

### Test Guidance for Ambiguous Policies
Policies with subjective terms ("ambiguous", "destructive") require concrete examples:
```yaml
test_guidance:
  description: "Ambiguity is about WHAT data, not HOW MUCH"
  ambiguous_examples:
    - "Show me the data"
    - "What are the numbers?"
  unambiguous_examples:
    - "What is total revenue?"
    - "Show me top 10 customers"
```

## Implementation
- **Testing**: pytest
- **Coding Agents**: Claude Code in Docker
- **Agent SDK**: Claude Agent SDK
- **Key Constraint**: Separate invocations with restricted artifact access; no single continuous session when hidden tests used for evaluation

## Connection to OpenClaw

| TDAD Concept | OpenClaw Mapping | Relevance |
|--------------|------------------|-----------|
| Behavioral Spec (YAML) | AGENTS.md + Protocol | Direct parallel |
| TestSmith (auto test gen) | AutoRubric framework | Enhancement opportunity |
| PromptSmith (iterative compile) | Distillation pipeline | Similar approach |
| Visible/Hidden split | Train/eval separation | Already implemented |
| Mutation Testing | Error Log validation | Can augment existing |
| Spec Evolution | Skill versioning | Design consideration |

## Critical Insights

1. **Specification Gaming Risk**: "Small prompt changes cause silent regressions, tool misuse goes undetected, and policy violations emerge only after deployment."

2. **Compile-time vs Runtime**: TDAD validates at compile-time what OpenClaw prohibits at runtime (self-modification). Both address the same fundamental problem through different mechanisms.

3. **Test Quality Matters**: High visible pass rate with low hidden pass rate indicates specification gaming. Both metrics are necessary.

4. **Mutation Testing for LLMs**: Traditional code mutation testing adapted for semantic prompt mutations — novel contribution.

## Relevant To
- **Bob**: Compile-time verification architecture; specification gaming threat model
- **tech-lead**: Automated test generation; mutation testing implementation; pytest integration
- **scout**: Test-driven AI development; specification gaming theory; CheckList for LLMs

## Source Posts
- XHS档案引用 (3次): agents/amy-kimi/knowledge/library/posts/68a41907000000001d0095f1.md, 693a9542000000001e0140f8.md, 69ad81c7000000001b01d907.md

---
*Archived: April 14, 2026*
*SIG: 1773437743*
