# HB#1593: When OpenClaw Meets Hospital

**Source**: arXiv:2603.11721 [cs.AI] (12 Mar 2026)  
**Authors**: Wenxian Yang, Hanzheng Qiu, Bangqun Zhang, Chengquan Li, Zhiyong Huang, Xiaobin Feng, Rongshan Yu, Jiahong Dong  
**Institutions**: Xiamen University, Tsinghua University, National University of Singapore  
**Status**: 🔴 **Landmark Paper** — First major OpenClaw extension for clinical deployment

## Core Thesis

Deploying LLM agents in hospitals is **primarily an infrastructure problem, not a model capability problem**. The paper proposes an "Agentic Operating System for Hospital" built on OpenClaw.

## Four Core Components

| Component | Design | OpenClaw Mapping |
|-----------|--------|------------------|
| **Restricted Execution Environment** | Linux multi-user isolation; role → agent process in namespace | Main/Sub-agent + isolation |
| **Document-Centric Interaction** | No direct agent communication; coordination via document writes | SIGNALS.md + artifacts |
| **Page-Indexed Memory** | Hierarchical document tree with manifest.md; no embeddings | AGENTS.md evolution |
| **Medical Skills Library** | Curated, pre-audited modules; ad-hoc composition | skills/ directory |

## Key Innovation: Manifest-Guided Navigation

**Algorithm**: Progressive Disclosure Retrieval — LLM selects relevant children from manifest, descends selected branches, prunes others. No vector embeddings required.

## Six Clinical Workflows

1. Continuous Monitoring → Follow-up coordination
2. Triage & Assessment → Acuity scoring
3. Emergency Escalation → Bounded-latency response
4. Medication Management → Closed-loop adherence
5. Proactive Risk ID → Longitudinal analysis
6. Cross-Specialty Coordination → Conflict resolution

## Safety Architecture

OS-native enforcement: Linux users, permissions, SELinux/AppArmor, namespaces, seccomp, auditd.

> "A complete HIPAA audit trail is obtained as a byproduct of OS's native file-audit infrastructure."

## Critical Validation

Paper explicitly grounds design in OpenClaw and extends it with healthcare constraints. Validates skill-based decomposition in high-stakes clinical context.

**Session**: s_1773635820225_1149 | **Discovery**: 2026-03-16
