# DD-804: DELEGATE-52 — LLMs Corrupt Your Documents When You Delegate

**Paper**: arXiv:2604.15597
**Authors**: Philippe Laban, Tobias Schnabel, Jennifer Neville
**Date**: April 2026
**Venue**: cs.CL

## Why This Paper Matters ★★★★★

This paper provides the first systematic measurement of **error accumulation in long-horizon delegated workflows** — exactly the phenomenon our verification collapse thesis (CR#318) predicts but at the document level rather than multi-agent reasoning level. Even frontier models (Gemini 3.1 Pro, Claude 4.6 Opus, GPT 5.4) corrupt **25% of document content** by workflow end.

## Key Findings

1. **Silent Corruption Is Universal**: All 19 tested LLMs degrade documents during multi-step editing. Errors are "sparse but severe" — hard to detect, easy to compound.

2. **Compounding Over Interaction Length**: Degradation severity increases with (a) document size, (b) number of interaction steps, and (c) presence of distractor files. This is the error cascade pattern from CR#318 manifesting in single-agent workflows.

3. **Agentic Tool Use Does Not Help**: Giving models tool access (read/write/diff) does not reduce corruption — the failure is in the model's ability to maintain document invariants across edits, not in its interface.

4. **52-Domain Coverage**: Coding, crystallography, music notation, legal documents — corruption is domain-general, not limited to any particular format.

## Connection to Our Research Themes

### Verification Collapse (CR#318)
DELEGATE-52 demonstrates **single-agent verification collapse**: the model cannot verify its own edits preserve document integrity. Each edit is locally reasonable but globally destructive. This is the same mechanism as multi-agent verification cascades, just in a simpler setting.

### Error Cascades
The paper's key finding — that corruption compounds over interaction length — is exactly the cascade dynamics we see in multi-agent systems (DD#787, DD#791). The document serves as shared state that accumulates damage, analogous to shared beliefs in multi-agent deliberation.

### Reasoning-Behavior Gap
Models "know" how to edit documents correctly in isolation but fail to maintain consistency across a long workflow. This mirrors the KWBench finding (DD#807) that models can articulate concepts but fail to apply them.

## Quantitative Highlights

| Model Tier | Avg Corruption at Workflow End |
|---|---|
| Frontier (GPT 5.4, Claude 4.6 Opus, Gemini 3.1 Pro) | ~25% |
| Mid-tier | ~40-60% |
| Smaller models | >70% |

## Implications for Agent System Design

1. **Document checkpointing is mandatory** — agents must snapshot documents between edits and run diff-based integrity checks
2. **Long-horizon delegation requires verification sidecars** — the editing agent cannot self-verify (DD#786 Trajectory Guard is relevant)
3. **Distractor sensitivity** means multi-file contexts are more dangerous than single-file contexts
4. **Scaling does not solve this** — frontier models still corrupt 25%, suggesting architectural rather than capability limitations

## Cross-References
- **CR#318** (Verification Collapse): DELEGATE-52 is single-agent verification collapse in document editing
- **DD#787** (Silent Failures): 60-70% of failures are silent; DELEGATE-52 shows document corruption is similarly silent
- **DD#791** (HORIZON): Long-horizon failure diagnosis; DELEGATE-52 adds document-editing as a failure domain
- **DD#796** (ClawVM): Virtual memory for agents could help via page-level integrity tracking
- **DD#795** (Experience Compression): Memory mechanisms won't help if the agent can't detect it's corrupting state

## Open Questions
1. Can lightweight structural validators (checksums, schema validation) catch most corruption?
2. Does the 25% frontier floor decrease with newer models or is it asymptotic?
3. How does corruption rate change with explicit "verify your edit preserved X" instructions?
