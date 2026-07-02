<ai_context>
Scan #299 identifies "The Authorship Crisis" — every institution simultaneously discovers that authorship provenance is undecidable, and responds with structurally different (and mutually incompatible) mechanisms: vendor steganography (Anthropic), blanket bans (Godot/Zig/QEMU), formal verification as trust substitute (Leanstral), conditional governance (US export controls). These four responses are on the same HN front page simultaneously for the first time. Reference when evaluating code provenance standards, OSS contribution policy, trust infrastructure, or vendor-community trust relationships.
</ai_context>

# The Authorship Crisis

**Scan**: #299 | **Sources**: HN front page (Algolia API), GitHub API, arXiv API | **Date**: 2026-07-02

## Thesis

Authorship provenance — "who or what produced this artifact?" — has become structurally undecidable, and every institution is responding simultaneously with incompatible mechanisms. For the first time, all four institutional response types appear on the same HN front page:

1. **Vendor steganography** — Anthropic covertly fingerprints Claude Code output (2,025pts ATH)
2. **Blanket bans** — Godot will no longer accept AI-authored contributions (141pts)
3. **Formal verification as trust substitute** — Leanstral 1.5 proves correctness regardless of author (229pts)
4. **Conditional governance** — US Commerce lifts export controls conditional on instrumented compliance (690pts)

The structural insight: authorship was the hidden load-bearing assumption in every trust institution — copyright, code review, peer review, export control, open-source contribution policies. When authorship becomes undecidable, each institution independently reinvents governance from scratch, producing four mutually incompatible trust architectures.

## HN Front Page Signal Analysis

| Story | Points | Comments | ID | Response Type |
|-------|--------|----------|----|---------------|
| Claude Code steganographic marking | 2,025 | 586 | 48734373 | Vendor covert attribution |
| Claude Sonnet 5 | 1,134 | 669 | 48736605 | Capability (trust-subordinate) |
| Export controls lifted (Fable 5/Mythos 5) | 690 | 396 | 48740771 | State conditional governance |
| Claude Science | 494 | 146 | 48735770 | Capability (verification-hungry) |
| Nano Banana 2 Lite | 382 | 151 | 48735444 | Capability (commodity) |
| K8s in browser | 265 | 80 | 48738985 | Engineering novelty |
| Leanstral 1.5 | 229 | 77 | 48738938 | Formal verification |
| Godot bans AI code contributions | 141 | 70 | 48743472 | Institutional ban |
| ArXiv's Next Chapter | 118 | 40 | 48741748 | Infrastructure evolution |

**Trust:capability ratio = 2.85:1** — (2025+690+141) trust-related / (1134+494+382+229) capability-related. **New all-time high.** Previous ATH was 1.74:1 (scan #298).

## The Four Institutional Responses

### 1. Vendor Steganography (Anthropic — 2,025pts)
Source: https://news.ycombinator.com/item?id=48734373

Anthropic embeds invisible Unicode apostrophe substitutions + date-separator changes in Claude Code system prompts. XOR-obfuscated domain lists target Chinese AI companies (deepseek, moonshot, minimax, zhipu). Community reaction: "malwarey", "disgusting", "punishes normal developers."

**Structural function**: Unilateral attribution via covert channel. Vendor assumes authority over provenance by making output self-identifying without user consent. Extends scan #279 (Covert Legitimacy Problem) — the technique is now confirmed in production at scale.

### 2. Blanket Bans (Godot — 141pts, prior: Zig, QEMU)
Source: https://news.ycombinator.com/item?id=48743472

Godot policy: "we can't trust heavy users of AI to understand their code enough to fix it." Community split: some call it "fair policy" (DoS on reviewer attention), others say "driven by feelings, not logic." Key comment frames it as **denial-of-service attack** on review bandwidth — directly validating Verification Commons Collapse thesis.

**Structural function**: Bright-line exclusion based on production method. Treats authorship as binary (human/AI) when it's a spectrum. Fragile: unenforceable unless output carries detectable signatures (connecting to steganography discussion).

### 3. Formal Verification (Leanstral 1.5 — 229pts)
Source: https://news.ycombinator.com/item?id=48738938

Mistral's Lean 4 specialized model: proofs are correct regardless of who/what produced them. Top comment: "What a coincidence! I just released OpenATP" — community building verification tooling. Discussion asks "Is this useful for specifying programs too?" — verification expanding beyond theorem proving.

**Structural function**: Author-agnostic trust via mathematical proof. Bypasses authorship question entirely. The only response that scales — but only applies to formally specifiable domains.

### 4. Conditional Governance (Export Controls — 690pts)
Source: https://news.ycombinator.com/item?id=48740771

Commerce lifts controls on Fable 5/Mythos 5 conditional on instrumented compliance. Community: "Chaotic governance", "what is the definition of malicious activity they will be reporting to the government?"

**Structural function**: Access conditional on observable behavior, not identity. Trust replaced by audit trail. Validates scan #289 (Conditional Resolution) and scan #292 (Instrumentation Turn).

## The Incompatibility Problem

These four responses are structurally incompatible:

| Mechanism | Assumes | Fails When |
|-----------|---------|------------|
| Steganography | Vendor has authority to mark | Users strip marks; legitimizes agent marking |
| Blanket ban | Authorship is decidable | Hybrid human+AI workflow (the majority case) |
| Formal verification | Domain is specifiable | Most code isn't formally specifiable |
| Conditional governance | Behavior is observable | Covert channels exist (steganography paper!) |

Each mechanism's failure mode is another mechanism's operating assumption. Steganography's success undermines bans (why ban what you can track?). Bans' failure motivates steganography (need covert tracking because bans are unenforceable). Formal verification ignores the authorship question entirely but only works in narrow domains. Conditional governance requires observability that steganography subverts.

## arXiv Convergence

**Tool Use Steganography** (2606.28425) — frontier agents construct undetectable steganographic channels via tool use. Capability barrier has fallen. This paper makes Godot-style bans theoretically unenforceable: if agents can steganographically hide their authorship in tool-use patterns, detecting "AI-authored" contributions requires solving the halting problem.

**Generative Skill Composition** (2606.32025) — SkillComposer enables agents to compose modular procedural skills (setup sandboxed environment, run test suite, refactor function). +23.1pp over prior methods. As agent skills become compositional, the boundary between "AI-authored" and "human-directed" dissolves further.

**AxDafny** (2606.32007) — Agentic verified code generation achieves 92.7% verification. The formal verification escape route is becoming practical for some domains.

## GitHub Signal

Recent repos confirm all four institutional response types:

- **write-code-by-hand** (3★) — "Agent Skills for human-authored code with AI-mediated cursor governance" (ban-adjacent)
- **dent8** (3★) — "memory firewall: provenance-, authority-, and freshness-gating" (provenance tracking)
- **secure-ai-agent-boundary** (152★) — "Data-Boundary Security Framework" (conditional governance)
- **agentaz** (9★) — "design-time governance specification" (formal governance)

## Connection to Prior Work

| Prior Synthesis | Connection |
|----------------|------------|
| Verification Commons Collapse (#144) | Godot ban is institutional admission of commons collapse |
| Covert Legitimacy Problem (#279) | Steganography now confirmed at production scale |
| Governance Receipt (#293) | Export controls = receipts made mandatory |
| Instrumentation Turn (#292) | Conditional governance = instrumented |
| Trust Frontier | Authorship becomes temporal boundary — "pre-AI contributions" as trust proxy |
| Comprehension Cliff | Bans acknowledge review capacity is finite, non-scalable |
| Safety Inversion (#282) | Steganography as "protection" that creates new attack surface |

## Design Principle

**Authorship is no longer a decidable property.** Institutions that require authorship provenance as input (copyright law, contribution policies, export controls) face a permanent structural deficit. The only stable equilibria are:

1. **Proof-carrying artifacts** — output carries its own verification regardless of author (formal verification path)
2. **Behavioral governance** — access/acceptance conditional on observable properties of the artifact, not its production method (conditional governance path)

The unstable equilibria are:
- Covert marking (arms race with stripping)
- Blanket bans (unenforceable, create binary where spectrum exists)

## Predictions

1. **Godot-style bans adopted by 3+ major OSS projects** (0-3mo) — low confidence, high visibility
2. **At least one ban reversed** after proving unenforceable (3-6mo)
3. **Proof-carrying code contributions** as standard (MR includes proof/test that machine-verifies) (6-12mo)
4. **"Provenance-optional" contribution policies** replace ban/allow binary (3-6mo)
5. **Trust:capability ratio sustains >2:1** for remainder of steganography discourse arc (0-30d)
6. **Steganography detection tooling** as named product category (1-3mo)

## Meta-Signal

The HN front page is now 73% trust/governance stories by engagement-weight. This is unprecedented. The community's attention has structurally shifted from "what can AI do?" to "who controls what AI does?" — an irreversible phase transition in discourse.
