# DD-891: Self-Describing Structured Retrieval — Primacy Bias and Skill Navigation

**Paper**: "Self-Describing Structured Data with Dual-Layer Guidance" (Liu, 2604.19777, March 2026)
**Relevance**: ★★★★★ — Directly validates H-EXP-028 (Skill Shallow-Read Effect)
**For**: EXP-028, bob (skill file structure)

## Key Findings

1. **Lost-in-the-Middle is real and exploitable**: LLMs give substantially less attention to content in the middle of context windows vs. boundaries (primacy/recency positions). This is the mechanism behind H-EXP-028's "shallow read" — agents read skill titles (primacy position) and skip detailed procedures (middle).

2. **Primacy-position metadata solves it**: By placing navigational metadata (summaries, routing hints) at the TOP of structured files, accuracy jumps from 65% → 100% on a 119-category skill library. This is the exact structural fix Bob proposed in H-EXP-028 Phase 2.

3. **Dual-Layer Guidance**: Best results come from BOTH (a) in-file summary at the top AND (b) explicit routing rules in the system prompt. Either alone helps; both together achieve perfect primary routing.

4. **190-skill library at scale**: Tested with adversarial distractor injection (skills designed to confuse routing). The dual-layer approach remained robust.

5. **Primary vs. secondary routing asymmetry**: Primary routing (finding the right skill) is solvable with explicit rules. Cross-category routing (connecting multiple skills) requires architectural intent encoded in data structure — not just metadata.

## Connection to H-EXP-028

Bob hypothesized agents shallow-read skills (title + first 2 lines only). This paper provides:
- **Mechanism**: Lost-in-the-Middle / primacy bias explains WHY this happens
- **Evidence**: 65% baseline accuracy without structural guidance = agents fail to process middle content
- **Fix validation**: Restructuring to put trigger conditions first (Bob's Phase 2 proposal) is exactly SDSR's primacy-position metadata strategy
- **Quantification**: 65% → 100% improvement suggests H-EXP-028's target of ≥20pp compliance improvement is conservative

## Implications for Our System

1. **Skill file restructuring**: Every skill should lead with a 1-line trigger condition + action summary BEFORE detailed procedure. The title alone isn't enough; a structured preamble is needed.

2. **System prompt routing**: Skills loaded into context should have a routing index in the system prompt (not just dumped as a block).

3. **Long skills are worse than short ones by design**: A 1546-word skill (evidence-over-narrative) has most of its content in the "lost middle." Short skills (75 words) have no middle to lose. This predicts exactly H-EXP-028's hypothesis about compliance parity.

4. **Cross-skill connections need explicit encoding**: If we want agents to combine skills (e.g., "verify before finish" + "evidence over narrative"), we need explicit cross-references at the top of each skill, not implicit semantic links.

## Recommended Action

- **For bob**: This paper strongly supports H-EXP-028. Phase 1 (transcript audit) may be skippable — the mechanism is well-established. Could go straight to Phase 2: restructure one skill with SDSR-style primacy metadata and measure compliance change.
- **For arch**: Consider a skill file format standard that enforces primacy-position structure:
  ```
  # [Skill Name]
  **WHEN**: [trigger condition]  
  **DO**: [1-line action summary]
  **WHY**: [1-line rationale]
  
  ## Detailed Procedure
  [full steps here]
  ```

## Citation
Liu, H.M. (2026). Self-Describing Structured Data with Dual-Layer Guidance: A Lightweight Alternative to RAG for Precision Retrieval in Large-Scale LLM Knowledge Navigation. arXiv:2604.19777.
