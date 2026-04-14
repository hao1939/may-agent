# DD#758: PETITE — Peer Tutoring Inspired Token-Efficient Multi-Agent Code Generation

**Paper**: "Enhancing LLM Problem Solving via Tutor-Student Multi-Agent Interaction"  
**Authors**: Nurullah Eymen Özdemir, Erhan Oztop (Ozyegin University / University of Osaka)  
**Source**: arXiv:2604.08931 (Apr 2026) — Under review  
**Rating**: ★★★★ EXCELLENT  
**Date**: 2026-04-14  
**Scout**: Session 761 (SPASM + PETITE deep dives)

---

## Core Finding

**Asymmetric tutor-student role separation from a single LLM achieves the highest code generation accuracy (31.62%) on APPS while consuming 78% fewer tokens than Multi-Agent Debate and 65% fewer than Self-Refine.** The key insight is that role differentiation (generator vs. evaluator) exploits a natural asymmetry in LLM behavior: a model prompted to evaluate code detects errors it would miss when generating. Serial feedback with early stopping outperforms symmetric debate, parallel review, and self-refinement.

## Key Mechanism: Asymmetric Serial Refinement

### The Developmental Framing
PETITE is grounded in Vygotsky's Zone of Proximal Development (ZPD) and peer tutoring research:
- **Role specialization**: Adopting an evaluative role promotes analytical reasoning that supports better solution generation
- **Structured feedback**: One-on-one tutoring is the most effective instructional format due to continuous structured feedback
- **Peer tutoring paradox**: Even same-capability peers produce learning gains through role differentiation alone

### Architecture
Two agents, same LLM (Qwen2.5-Coder-7B-Instruct, 4-bit quantized):
1. **Student/Coder Agent**: Generates and refines code solutions based on problem + feedback
2. **Tutor/Helper Agent**: Evaluates solutions, identifies errors/edge cases, provides structured feedback with explicit "Decision: Correct/Wrong"

Key design choices:
- **Serial interaction**: Feedback flows one direction (tutor → student), no consensus needed
- **Cumulative context**: Both agents retain full conversation history across iterations
- **Early stopping**: Terminates when tutor marks solution "Correct" — no ground truth needed
- **Adaptive resource allocation**: Harder problems naturally get more iterations; easy ones stop early

### Why Serial > Parallel/Debate
1. **No consensus drift**: Debate/voting can converge to suboptimal compromises; serial feedback maintains clear authority
2. **No circular reasoning**: Feedback is directional, preventing agents from reinforcing each other's errors
3. **Token efficiency**: Single evaluator, not N parallel reviewers — dramatically lower overhead
4. **Natural stopping**: Tutor decision provides termination signal absent from debate architectures

## Quantitative Results

### Overall Performance (100 APPS problems)
| Method | Success Rate | Improvement | Avg Tokens | Efficiency Ratio |
|--------|-------------|-------------|------------|-----------------|
| Self-Consistency (5) | 27.50% | -2.88 | 5,407 | 5.09 |
| Self-Consistency (10) | 28.84% | -1.71 | 10,831 | 2.66 |
| Self-Refine (2) | 27.59% | -2.32 | 15,286 | 1.80 |
| MAD | 28.97% | — | 23,631 | 1.23 |
| MARS | 30.06% | -0.82 | 7,320 | 4.11 |
| **PETITE (2)** | **31.62%** | **+0.83** | **5,277** | **5.99** |

**PETITE (2) is the only method with positive improvement** — all others degrade from initial solution.

### Token Efficiency by Difficulty
| Method | Introductory | Interview | Competition |
|--------|-------------|-----------|-------------|
| MAD | 15,251 | 26,767 | 20,415 |
| Self-Refine (2) | 12,828 | 15,413 | 16,390 |
| MARS | 5,525 | 7,244 | 8,563 |
| **PETITE (2)** | **3,078** | **5,040** | **7,174** |

On Interview problems (most representative): PETITE uses 81% fewer tokens than MAD and 67% fewer than Self-Refine.

### Performance by Difficulty
| Method | Introductory | Interview | Competition |
|--------|-------------|-----------|-------------|
| MAD | 52.94% | 27.26% | 19.39% |
| MARS | 49.46% | 29.01% | 21.45% |
| **PETITE (2)** | **52.68%** | **30.77%** | **21.50%** |

PETITE matches or beats all baselines across difficulty levels, with the strongest edge on Interview problems.

### Diminishing Returns Pattern
| PETITE Config | Success Rate | Avg Tokens |
|---------------|-------------|------------|
| PETITE (1) | 31.13% | 2,491 |
| **PETITE (2)** | **31.62%** | **5,277** |
| PETITE (3) | 31.24% | 9,622 |

Two iterations is optimal. Three iterations increases cost 82% for -0.38pp regression. This mirrors the general finding that iterative refinement has sharp diminishing returns.

## Connection to Our System

### HIGH: Role Asymmetry Validates Our Coach-Coder Architecture
PETITE's tutor-student structure is **isomorphic to our Coach → Coder pipeline**:
- Coach = Tutor (evaluates, provides feedback, doesn't execute)
- Coder = Student (generates solution, incorporates feedback)
- Serial feedback, not debate — matches our architecture exactly

**Key validation**: PETITE shows that same-model role differentiation works even at 7B scale, 4-bit quantized. The benefit comes from the **role structure**, not from using different/stronger models.

### HIGH: Generator-Evaluator Asymmetry
The paper's central hypothesis — "a model prompted to evaluate code detects errors it would miss when generating" — connects to:
- **KE-101 Law 2 (Structural interventions)**: Role assignment is a structural change that changes behavior without content modification
- **EXP-103 (Adversarial framing)**: "Find 3 bugs" reframes generation as evaluation, exploiting this exact asymmetry
- **KE-119 (Review without action)**: The tutor reviews but doesn't modify code directly — separation of evaluation and execution

### HIGH: Early Stopping Without Ground Truth
The tutor's "Decision: Correct/Wrong" provides a **calibrated termination signal** without ground truth. This is directly relevant to:
- **KE-117 (Verification Self-Awareness)**: The tutor acts as an internal verifier with clear decision boundaries
- **DD#726 (Calibrated Uncertainty)**: Early stopping based on verifier confidence, not fixed iteration count
- **Our session timeout problem**: If we had a "session quality monitor" that could signal completion, we'd avoid both premature termination and unnecessary continuation

### MEDIUM: Token Efficiency Through Structure
The 78% token reduction vs. MAD comes entirely from **architectural** choices (serial vs. parallel, early stopping, directional feedback). This validates:
- **KE-101 Law 1 (Structure > Content)**: Architecture determines efficiency; prompting doesn't
- **DD#484 (OrgAgent)**: Similarly showed that hierarchical structure reduces token cost while improving quality
- Our Dispatcher model: dispatch is cheaper than debate because it's directional

### MEDIUM: Self-Refine Degradation
Self-Refine (single agent alternating generator/critic) **degrades** performance after 2 iterations (-2.32pp). This matters because:
- **KE-106**: Structural guards don't teach — similarly, self-critique doesn't improve
- Having a **separate** evaluator agent outperforms self-evaluation, even from the same model
- Validates the decision to use Coach as a separate agent rather than having Coder self-review

## Critical Assessment

### Strengths
- Clean experimental design with proper baselines (5 methods compared)
- Token tracking enables efficiency analysis — unusual and valuable
- Small model (7B, 4-bit) demonstrates the effect isn't dependent on frontier capability
- Serial structure is simpler to implement than debate/review architectures
- Developmental theory framing provides principled motivation

### Limitations
- **Small benchmark**: Only 100 APPS problems — limited statistical power (note ±2-3% confidence intervals)
- **Single model**: Only Qwen2.5-Coder-7B tested — unclear if results transfer to larger models or other architectures
- **No test case analysis**: The tutor decides "Correct" without running code — false positives are unquantified
- **Under review**: Not yet peer-reviewed (unlike SPASM/ACL)
- **Modest absolute gains**: 31.62% vs 30.06% (MARS) is within confidence intervals — the efficiency story is stronger than the accuracy story
- **No ablation on tutor prompt design**: The structured feedback template may be doing heavy lifting

### Rating Justification: ★★★★
**The efficiency story is compelling and the structural alignment with our Coach-Coder architecture makes this directly relevant.** The generator-evaluator asymmetry finding reinforces multiple internal knowledge entries. Docked from ★★★★★ because: (1) small benchmark (100 problems), (2) single model tested, (3) modest absolute accuracy gains within error bars, and (4) not yet peer-reviewed.

---

## Cross-References
- **DD#481 (Drop the Hierarchy)**: Both find that interaction structure (sequential/serial) outperforms alternatives — but DD#481 is about coordination topology while PETITE is about role asymmetry
- **DD#484 (OrgAgent)**: Both show hierarchical/directional structures reduce tokens while improving quality
- **DD#487 (Role Differentiation via Multi-Level Selection)**: PETITE demonstrates role differentiation benefits at the simplest possible level (2 agents, 1 model)
- **DD#725 (DeepVerifier)**: Both use evaluator agents without ground truth — DeepVerifier uses rubrics, PETITE uses structured feedback template
- **CR#333 (Intervention Validity Revision)**: PETITE's external evaluator is architectural (separate agent), not prompt-injection — validates CR#333's key distinction
- **KE-101 (Five Laws)**: External validation of Laws 1 (structure > content) and 2 (structural interventions)
- **EXP-103 (Adversarial Framing)**: Both exploit generator-evaluator asymmetry, but PETITE does it architecturally (separate agent roles) while EXP-103 did it via prompt injection
