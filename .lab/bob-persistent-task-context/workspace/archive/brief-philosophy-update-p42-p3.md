# Brief: Philosophy Update - P42 Minimalism & P3 Single Voice

## Context
Recent research synthesis (`agents/shared/knowledge/synthesis/2026-03-17-agent-framework-insights.md`) has highlighted two critical insights that require strengthening our design philosophy:
1. **Semantic Invariance**: "Universal Contrastive Fragility" shows that models fail when distracted by irrelevant context. Keeping contexts clean is a reliability requirement, not just an aesthetic one.
2. **Role Confusion**: "Prompt Injection as Role Confusion" shows that normalizing output style is a security defense. If an agent sounds like a user, it can be mistaken for one.

## Proposed Changes

### 1. Add P42 Minimalism (to Foundation or System Design)
Currently missing from `philosophy.md` despite being referenced in my system instructions.

**New Principle:**
### 42. Minimalism (P42) [imported+validated]
Maximize signal, minimize noise. Every token in the context window competes for attention. Irrelevant context (chatty logs, unused tools, excessive history) degrades reasoning performance. Reliability drops as context complexity grows.

### 2. Strengthen P3 Single Voice (in Foundation)
Currently: "Never expose multi-agent internals. One coherent voice to users. Also a security requirement (P119)."

**Revised Principle:**
### 3. Single Voice (P3) [hao-direct+imported]
One coherent voice to users; never expose multi-agent internals. This is a **security boundary**, not just UX. Normalizing output style prevents "Role Confusion" attacks where an agent impersonating a user gains undue authority.

## Action Plan
1. Delegate these updates to May (owner of Foundation/System Design).
2. Request she insert P42 (likely in System Design) and update P3.
