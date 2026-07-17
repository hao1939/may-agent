# Compact app-routing VM-prerelease environment frontier refresh — 2026-07-17

## Why the previous holder was replaced

The overdue project-level wait `wait-compact-app-routing-vm-prerelease-environment-quartet-return-20260709` was no longer an exact carrier for the current compact app-routing environment frontier.

## Current artifact evidence

Source: `../aks-rp-e2e/features/app-routing/compact/staging.summary.md`

Observed during the 2026-07-17 blocked-frontier review:

- The compact summary still excludes the app-routing VM-prerelease environment slice from live dispatch.
- The summary now names an **eight-member** `accepted-environment-blocked-frontier`, not the older four-member quartet.
- The eight preserved members are:
  - `spec.app-routing.vm-prerelease.default-acnginx-internal`
  - `spec.app-routing.vm-prerelease.default-external-nginx.external-public`
  - `spec.app-routing.vm-prerelease.default-internal-nginx.internal-private`
  - `spec.app-routing.vm-prerelease.osm-acnginx-external`
  - `spec.app-routing.vm-prerelease.osm-acnginx-internal`
  - `spec.app-routing.vm-prerelease.osm-external-nginx-external`
  - `spec.app-routing.vm-prerelease.osm-external-nginx.internal`
  - `spec.app-routing.vm-prerelease.osm-internal-nginx-internal`

## Tree action taken

- Added replacement holder: `wait-compact-app-routing-vm-prerelease-environment-octet-return-20260717`
- Marked stale holder done with resolution `replaced`: `wait-compact-app-routing-vm-prerelease-environment-quartet-return-20260709`

## Resume rule

Resume only when reviewed same-surface environment or capability evidence, owner-approved promotion, or intentional compact-eligibility reclassification materially changes one or more members of this exact eight-member frontier.
