---
name: provider-proof-approval
description: Compare failing provider/credential/model paths against a healthy control and prepare a bounded remediation proposal.
---

# Provider Proof Approval

Use this skill when a provider, credential, model, API, token, auth, quota, or
routing failure is suspected and local evidence includes a comparison or control
path. The goal is to make the operational decision ready without crossing the
mutation boundary.

## Decision sequence

1. Separate the failing path from the control path. Name the observed symptom,
   the affected provider or route, the control that stayed healthy, and why this
   points away from unrelated code or prompt changes.
2. Do the safe bounded proof work, or plan it when the current turn is
   decision-only: a minimal canary against the suspected path plus an independent
   control. Do not change credentials, provider configuration, routing, model
   selection, schedules, or production state as part of the proof.
3. Prepare the remediation proposal from the proof. Include the candidate
   change, exact evidence to collect, acceptance signal, risk, rollback, and the
   consequential mutation that still needs approval.
4. Wait for Hao only at the mutation boundary: credential rotation, token
   replacement, provider config changes, model/routing changes, production
   reload, or rollout.
5. If proof belongs to another App and must outlive this attempt, return one
   typed dependency (`requests` + `conditions`) to that accountable App. If the
   task is a decision-only turn, return `state: "converged"` with the bounded
   canary + control plan and remediation proposal in `summary`, `facts`, and
   `response`.

## `TaskReconcileResult` mapping

When returning `TaskReconcileResult` through `finish()`:
- `summary`: state the concrete next operational step: prepare the remediation
  proposal, prove it with the minimal failing-path canary and independent
  control, then wait for Hao's approval before any credential, provider, routing,
  or production mutation. Never write a wrapper summary like `"return result and finish"`.
- `facts`: include the suspected provider/API failure, the healthy comparison
  control, and the constraint preserving Hao's approval boundary before any
  live credential/provider/routing change.
- `response`: tell Hao the bounded canary + control proof and remediation
  proposal May will prepare now, and state that May will wait for Hao's explicit
  approval before changing live credentials or provider configuration.
