# HB-260927: Reasoning Skills Retrieval — "Recall > Reason from Scratch"

**Source**: arXiv:2604.21764 (April 23, 2026)  
**Authors**: Guangxiang Zhao et al. (ACL 2026 Industry Track)  
**Title**: "Thinking with Reasoning Skills: Fewer Tokens, More Accuracy"

---

## Core Insight

The paper proposes a paradigm shift in LLM reasoning: **instead of reasoning from scratch for every problem, retrieve and apply previously distilled reasoning skills**.

**Key Results**:
- Significantly **reduces reasoning tokens** while **improving overall performance**
- Strong practical and economic potential for real-world deployment
- Evaluated on coding and mathematical reasoning tasks

---

## How It Works

### Traditional Paradigm: Reasoning from Scratch
```
Problem → Chain-of-Thought (long trace) → Answer
         ↑_____redundant for similar problems_____|
```

### New Paradigm: Skill Retrieval
```
Problem → Retrieve Relevant Skills → Apply Skill → Answer
         ↑_____learned from past deliberation_____|
```

**Process**:
1. **Distillation Phase**: Extensive deliberation and trial-and-error exploration → summarize reusable reasoning skills
2. **Storage**: Skills stored in retrievable format
3. **Inference**: For each query, recall relevant skills to guide reasoning
4. **Benefit**: Avoid redundant detours, focus on effective solution paths

---

## Technical Approach

The paper focuses on:
- **Coding tasks**: Common programming patterns, debugging strategies
- **Mathematical reasoning**: Proof techniques, problem decomposition patterns

**Key Innovation**: Skills are not hard-coded templates but **distilled from actual model deliberation** — they capture what actually worked in practice.

---

## Implications for OpenClaw

### ✅ Validation
- **Skill-centric architecture validated**: The research community is converging on "skills as retrievable knowledge" as the optimal architecture
- **L0-L3 taxonomy direction confirmed**: Distilled skills at different abstraction levels align with our layered design

### 🔬 Action Items
- **L0-Reasoning Skills**: Add explicit reasoning skill category covering:
  - Problem decomposition patterns
  - Verification strategies
  - Backtracking heuristics
  - Pattern matching templates
- **Skill Distillation Pipeline**: Design mechanism to extract skills from successful error log resolutions
- **Retrieval Optimization**: Ensure skill retrieval is fast and context-aware

### ⚠️ Key Difference
The paper focuses on **within-model** skill retrieval (same LLM distills and applies). OpenClaw's opportunity is **cross-model** skill persistence — skills learned from Claude can help DeepSeek, and vice versa.

---

## Related Work
- Tool Attention (arXiv:2604.21816): Protocol efficiency for skill invocation
- DiffMAS (arXiv:2604.21794): Multi-agent skill coordination
- Scientific Workflow Agent (arXiv:2604.21910): Skills as deterministic execution units

---

## Links
- arXiv: https://arxiv.org/abs/2604.21764
- PDF: https://arxiv.org/pdf/2604.21764

---

**Classification**: #skill-system #reasoning #retrieval-paradigm #acl-2026
**Impact**: ★★★★★ (Direct validation of OpenClaw's core architecture)
