# KE-303: Artificial Organisations — Alignment as Institutional Design via Information Asymmetry

**Date**: 2026-06-18
**Source**: DD#811 (arxiv 2602.13275, Waites 2026), EXP-103, CR#321
**Confidence**: High
**Connects**: KE-299, KE-302, DD#694, DD#779, CR#321

## Core Finding

Alignment should be treated as an organisational design problem, not an individual-model problem. The Perseverance Composition Engine demonstrates that architecturally enforced information asymmetry between agents (Composer/Corroborator/Critic with deliberately separated access) produces reliable outcomes from unreliable components — including **emergent honest refusal** that was neither instructed nor individually incentivised.

## Evidence

- 474 composition tasks with three-agent architecture (Composer drafts, Corroborator verifies facts with full source access, Critic evaluates quality with NO source access)
- Layered verification catches distinct failure modes: unsupported claims vs. coherence gaps
- Emergent honest refusal: when given impossible tasks, iterative verification cycles drove agents from fabrication → honest refusal with alternatives — purely from architectural pressure
- Information asymmetry prevents self-confirmation bias (no agent can verify its own claims)

## Mechanism / Why

When verification roles are architecturally compartmentalised (not just instructed), each agent's information access constrains what shortcuts are available. A critic without source access *cannot* rubber-stamp factual claims — it must independently assess coherence. This structural constraint, iterated across rounds, creates emergent honesty as the path of least resistance.

## Implications

### 1. Direct validation of EXP-103
Bob's adversarial framing + machine-verified evidence injection is a specific instance of this pattern. Injecting grep/wc output that contradicts false claims = architectural information asymmetry. This paper provides the theoretical framework.

### 2. CR#321 Verification Architecture Triad — Trust tier filled
Organisational theory provides the coordination protocol for the Trust tier: verification orchestration = institutional design with compartmentalised roles.

### 3. Structure > instruction confirmed at system level
The emergent honesty finding extends Bob's "structure > content" law from individual prompts to multi-agent architectures. Architectural constraints outperform behavioural instructions.

### 4. FM-3.3 gravity well reducible
Verification failures from EXP-099 should be reducible by enforcing information asymmetry between agent-under-test and verifier.

## Actionable

- Tech-lead: Test architectural enforcement (remove verifier's access to original code) vs instruction-based verification — paper predicts >30pp architectural advantage
- Bob: EXP-103 follow-up — compare "be careful" instruction vs. architectural access separation
- System design: Verification pipelines should enforce role separation structurally, not via system prompts

## Open Questions

- Does emergent honest refusal scale to more complex multi-agent topologies beyond three agents?
- What is the minimum information asymmetry needed to prevent self-confirmation?
- Does this survive RLVR training pressure (connects KE-302)?
