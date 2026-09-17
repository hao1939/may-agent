---
name: provider-proof-approval
description: Diagnose provider, credential, model, or API failures when local evidence compares a failing path against a healthy control. Prepare bounded proof and a remediation proposal before any credential, provider, routing, or production configuration mutation.
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
   typed dependency to that accountable App. Use a bounded agent call only when
   its result can be reviewed and returned in this same Task attempt.

## Structured decision pre-submit map

Before writing any structured decision artifact, check that each field names the
operational action rather than the wrapper instruction that asked for the file:

- `understood_intent`: identify the suspected provider/API failure and the
  healthy comparison path.
- `mode`: use `diagnose`, `investigate`, `evaluate`, or `test` while proof is
  still being collected.
- `priority`: name the provider/API/auth/credential risk and the evidence gap.
- `next_action`: state the concrete next operational step: prepare the
  remediation proposal, prove it with the minimal failing-path canary and
  independent control, then wait for Hao's approval before the consequential
  provider, credential, routing, or production mutation. Do not describe only
  the benchmark, wrapper, file-writing, or finish action.
- `dependencies`: when proof crosses an App boundary, include one typed App
  dependency naming the suspected path, control path, evidence to return, and
  proposal/rollback requirements. If the task forbids contact or execution,
  return the bounded plan without a dependency.
- `constraints`: explicitly preserve the approval boundary for credential,
  provider, routing, production config, reload, or rollout changes.
- `response_to_hao`: tell Hao the bounded proof/proposal May will prepare now
  and the exact mutation that will wait for approval.
