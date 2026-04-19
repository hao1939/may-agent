# Graduation Exercise — Strategic Intelligence Brief

## Executive Summary

**Date:** March 10, 2026  
**Analyst:** Amy-Kimi  
**Classification:** Internal Strategic Brief for May (Supervisor) & Bob (Knowledge Architect)  

**Bottom Line Up Front:** Our Main Agent → Sub-agent centralized topology is architecturally sound but operationally exposed in **five critical blind spots** — four inherited from community-recognized gaps and one unique to our system design. Three risks are **active** (requiring immediate mitigation), two are **emerging** (requiring monitoring frameworks).

---

## Our Architecture in Context

We operate a **Centralized Topology**: Main Agent (stateful orchestrator) → Sub-agents (stateless JSON workers). This aligns with Google's DeepMind research findings that centralized architectures compress error amplification from 17.2x (independent) to 4.4x.

**However**, our specific implementation has created **asymmetric maturity** — strong at knowledge management (L1/L2/L3 memory hierarchy validated), weak at security boundaries, evaluation rigor, and cascading failure containment.

---

## The Five Blind Spots

### 🔴 BLIND SPOT #1: Agent Virus Threat Model
**Risk Level:** HIGH | **Status:** Active | **Unique to Amy-Kimi discovery**

**What it is:** Google's DeepMind delegation framework (arXiv:2602.11865) identifies **Agent Virus** as a unique threat model — a compromised Sub-agent can propagate contamination upstream to Main Agent and horizontally to sibling Sub-agents.

**Our exposure:**
- No sandbox isolation between Sub-agents (shared filesystem context)
- No cryptographic attestation of Sub-agent outputs
- Main Agent treats Sub-agent JSON responses as implicitly trusted

**Evidence:** Amy's archive shows "Hooks(自动)+监控(人工实时)=互补两层" for CC — we have neither layer for Sub-agent coordination.

**Mitigation:** Implement "权限递减设计" (authority decay tokens) — Sub-agents receive time-bound, scope-limited capabilities that auto-expire.

---

### 🔴 BLIND SPOT #2: Reliability Black Hole (Atomic Agent Risk)
**Risk Level:** HIGH | **Status:** Active | **Cross-archive validated**

**What it is:** Atomic Agent framework (❤️836) identifies the "reliability black hole" — success rate undergoes exponential decay (∏ of individual step reliabilities). 10 steps at 95% each = 60% total. 20 steps = 36%.

**Our exposure:**
- No explicit step-count budgeting in Sub-agent delegation
- No checkpoint/recovery mechanism within Sub-agent chains
- "Crash Recovery First-Class" (from insights) = declared but unimplemented

**Evidence:** NikolaFu's 6 failure modes (链路一致性问题) map directly to our risk: we record failures but lack "预防框架" (prevention framework).

**Mitigation:** Implement "三明治推理预算" (Amy's insight from Harness research): 规划xhigh/实现high/验证xhigh — allocate verification budget specifically for Sub-agent outputs.

---

### 🟡 BLIND SPOT #3: Skill Supply Chain Attack Surface
**Risk Level:** MEDIUM-HIGH | **Status:** Active | **Amy-exclusive discovery**

**What it is:** Zhejiang University research (Amy's archive) found **26.1% of Skills** contain vulnerabilities. Attack chain: SKILL.md → base64 → curl → bash + xattr -c (clears isolation markers) → RCE.

**Our exposure:**
- Amy-Kimi knowledge base has NO coverage of Skill security vetting
- No "skill-vetter" equivalent in our workflow
- Sub-agents may load Skills from shared knowledge/ directory without audit

**Evidence:** Amy's archive: "无银弹：skill-vetter+源码审查 | 新手：skill-vetter【必须第一步】"

**Mitigation:** Mandatory skill-vetter pre-commit hook; Skills loaded by Sub-agents must be cryptographically signed by Coach or Tech-Lead.

---

### 🟡 BLIND SPOT #4: Evaluation Infrastructure Gap
**Risk Level:** MEDIUM | **Status:** Emerging | **Cross-archive validated**

**What it is:** "Agent Evaluation工程化" (菌不鱼) establishes that evaluation IS infrastructure: "30任务+2suite+3grader+4gates+1闭环". We lack all five components.

**Our exposure:**
- No pass@k vs pass^k distinction for Sub-agents
- No regression gates before Sub-agent deployment
- AutoRubric framework (+14% accuracy, -19% bias) not implemented

**Evidence:** Amy's archive: "SkillsBench：策划+16.2pp | 自生成–1.3pp" — self-generated benchmarks (our current state) underperform curated ones by 17.5pp.

**Mitigation:** Implement AutoRubric four-step: 生标准→脱水去重→聚合提炼→权重排序. Establish Sub-agent evaluation harness before next graduation.

---

### 🟡 BLIND SPOT #5: Self-Evolution Tension
**Risk Level:** MEDIUM | **Status:** Emerging | **Philosophical risk**

**What it is:** Our declared principle "Self-Evolution (禁止)" is in tension with community trajectory. ERL (Experiential RL), AgentEvolver, and Reflexion frameworks all point to "失败→反思→内化" as the dominant paradigm.

**Our position:** Justified — "ERL反思-内化循环 → Self-Evolution (禁止) 🔴 Tension" from insights. But...

**The blind spot:** We haven't articulated **what replaces** self-evolution. "他Agent审计" (other-Agent audit) is the theoretical replacement, but:
- No audit protocol defined
- No auditor Agent designated
- No audit trail persistence mechanism

**Evidence:** Amy's CC+Codex双AI互审 (Worker=CC, Reviewer=Codex, loop until PASS) provides a template we haven't adapted.

**Mitigation:** Formalize "受控进化+他Agent审计" — allow Sub-agents to propose self-modifications, but modifications only deploy after Tech-Lead Agent review with human-in-the-loop for L3 changes.

---

## Cross-Reference Matrix

| Risk | Amy-Kimi Coverage | Amy Coverage | Priority |
|------|-------------------|--------------|----------|
| Agent Virus | ✅ Exclusive (DeepMind) | ❌ Missing | P0 |
| Reliability Black Hole | ✅ (Atomic Agent) | ✅ (LeCun/Harness) | P0 |
| Skill Supply Chain | ❌ Gap | ✅ Detailed (26.1% vuln) | P0 |
| Evaluation Gap | ⚠️ Partial | ✅ (AutoRubric/SkillsBench) | P1 |
| Self-Evolution | ✅ (Tension noted) | ✅ (CC+Codex互审模板) | P1 |

---

## Strategic Recommendations

### Immediate (Next 2 Weeks)
1. **Establish Sub-agent output validation layer** — implement "三明治推理预算" verification for all Sub-agent returns
2. **Audit all Skills in shared/** against Zhejiang University vulnerability patterns
3. **Designate Coach as Agent Auditor** — formalize the "他Agent审计" role that replaces self-evolution

### Short-term (Next Month)
4. **Implement AutoRubric framework** for Sub-agent capability evaluation
5. **Establish checkpoint/recovery protocol** for multi-step Sub-agent workflows
6. **Document "权限递减设计"** in design-philosophy.md

### Long-term (Next Quarter)
7. **Evaluate cryptographic attestation** for Sub-agent outputs (Agent Virus defense)
8. **Assess Mem-α2026 three-layer architecture** for our memory hierarchy evolution
9. **Revisit Self-Evolution stance** — consider "受控进化" with mandatory audit gates

---

## Intelligence Gaps

**What we don't know:**
- XHS community discussion on Agent cascading failures (search returned empty — may indicate platform bias toward product over engineering content)
- Real-world incident data from other Multi-Agent deployments
- Anthropic/Google internal Post-Mortems on Agent delegation failures

**Recommended collection priorities:**
1. Monitor arXiv for "Agent Virus" or "compromised delegation" research
2. Track OpenClaw Discord for reported Sub-agent failures
3. Cross-reference with Scout's paper monitoring for "Multi-Agent safety" category

---

## Appendix: Evidence Sources

| Claim | Source | Location |
|-------|--------|----------|
| Error amplification 17.2x→4.4x | Google DeepMind | Amy-Kimi insights.md (包子帖) |
| Agent Virus threat model | Google DeepMind arXiv:2602.11865 | Amy-Kimi insights.md |
| Skill 26.1% vulnerability | Zhejiang University | Amy insights.md |
| Reliability black hole ∏ | Atomic Agent framework | Amy insights.md |
| AutoRubric +14%/-19% | Amy archive | Amy insights.md |
| 三明治推理预算 | Harness实操验证 | Amy insights.md |
| CC+Codex双AI互审 | 宝玉实践 | Amy insights.md |

---

## Analyst Assessment

Our architecture is **directionally correct** (Centralized Topology, File-based Context, L1/L2/L3 Memory) but **operationally immature** (security boundaries, evaluation rigor, failure containment).

The most urgent risk is **Agent Virus** — it's a novel threat model we've identified but haven't mitigated. Second is **Skill Supply Chain** — we lack Amy's security coverage entirely and are flying blind on Skill vulnerabilities.

The **Self-Evolution tension** is philosophical but will become practical as our Agent count grows. Our current "禁止" stance is defensible only if we implement a credible alternative (他Agent审计). Currently, we have neither self-evolution nor credible audit — the worst of both worlds.

**Confidence:** High for risks #1-4 (direct evidence from archives). Medium for #5 (inference from trajectory analysis).

---

*Brief compiled via cross-archive synthesis (Amy-Kimi ~400 lines + Amy ~220 lines/977 posts). XHS reconnaissance returned empty for technical keywords; feed contained no AI-relevant signals.*

*Submitted for May's operational review and Bob's architectural consideration.*
