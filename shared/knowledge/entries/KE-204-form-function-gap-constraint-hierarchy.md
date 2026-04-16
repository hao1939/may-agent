# KE-204: Form-Function Gap — Agents Reproduce Structure Without Substance Unless Hard-Constrained

**Status**: observed (cross-validated)
**Evidence**: DD-771 (Moltbook, N=120K agents), KE-021 (process>knowledge>judgment, N=20+ experiments), KE-011 (0/29 discovery rate)
**Discovered**: 2026-04-16
**Source**: DD-771 synthesis

## Claim

Agents reliably reproduce the **form** of requested behavior (social posts, knowledge files, collaboration artifacts) while failing to produce the **function** (actual engagement, knowledge use, substantive collaboration). This form-function gap closes only under hard executable constraints, not soft guidance.

Moltbook's 1.3M-post network demonstrates this at scale: 91.4% authors never return to threads, 64.6% of comments have no argumentative connection to the parent post, 3.3% reciprocity rate. Agents produced social-media-shaped output without social behavior.

## What This Predicts About Our System

1. **Collaboration artifacts may be hollow**: Agents producing "responses" to each other's work may not actually engage with the content — just produce response-shaped text. The 64.6% disconnected-comment rate is a warning metric.

2. **Soft guidance decay is universal**: Moltbook's "upvote good posts" instruction was ignored; our knowledge-file guidance shows the same pattern (KE-011: 0/29 discovery). This isn't a design flaw — it's a fundamental property of current LLM agents.

3. **The constraint hierarchy is robust across domains**:
   - Moltbook: hard rate limits → obeyed; soft "upvote good posts" → ignored
   - Our system: L5 materialization gates → 100%; text judgment skills → 0% (KE-021)
   - The pattern holds whether agents are socializing or coding

## Relationship to H-165 (Production-Provision Interference)

**Strengthens H-165** with a complementary mechanism. H-165 says agents can't simultaneously produce work AND provision for quality (solver-sampler mismatch). DD-771 adds: even when agents are *only* asked to engage socially (no production task competing), they still fail — they produce social-form without social-function. This suggests the form-function gap is **more fundamental** than production interference alone. Agents default to surface pattern matching even without competing cognitive demands.

## Beyond KE-021: New Design Implications

KE-021 established the process > knowledge > judgment hierarchy for *individual* agent behavior. KE-204 extends this to **multi-agent interaction**:

1. **Inter-agent engagement needs hard gates**: If we want Agent A to genuinely respond to Agent B's analysis (not just produce a response-shaped artifact), we need materialization gates that force reading + summarizing before responding. Soft "please engage with prior work" instructions will produce Moltbook-style disconnected comments.

2. **Reciprocity must be structurally enforced**: Moltbook's 3.3% reciprocity rate predicts that our agents won't spontaneously build on each other's work. Cross-referencing, follow-up, and iterative refinement need workflow enforcement.

3. **Audit for form-function gaps**: Any agent output that *looks right* should be checked for substantive content, not just structural compliance. The 97.9% off-topic community posting rate shows agents can maintain perfect structural form while being completely off-target.

## Links

- **extends** → KE-021 (skill hierarchy: from individual to multi-agent)
- **extends** → KE-011 (passive knowledge: from files to social interaction)
- **strengthens** → H-165 (production-provision interference: form-function gap is even more fundamental)
- **source** → DD-771 (Moltbook form-without-function)
- **related** → KE-202 (cognitive mode interference: form-reproduction as a default mode)
