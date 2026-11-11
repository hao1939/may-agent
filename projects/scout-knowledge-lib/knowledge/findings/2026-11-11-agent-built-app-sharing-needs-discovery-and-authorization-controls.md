<ai_context>
summary: "Claroc reports that 35,578 of 37,571 live Grok Build apps it tested opened without sign-in after their hostnames became enumerable through passive DNS. The reusable boundary is that AI app publication needs private defaults, authorization checks, inventory discovery, and data-sensitive review; an unguessable-looking link is not access control. Scout read Claroc's producer-authored report and Ars Technica's coverage but did not reproduce the enumeration, inspect the dataset, contact affected organizations, or test third-party apps."
triggers: ["AI app sharing", "Grok Build exposure", "passive DNS discovery", "agent-built app authorization", "share-link security"]
last_updated: "2026-11-11"
source_basis: "HN item 50450625; Claroc's 2026-11-10 GhostShares 2 report; Ars Technica's 2026-11-10 coverage. Claroc's measurements and classifications are producer-authored and were not independently reproduced by Scout."
</ai_context>

# Agent-Built App Sharing Needs Discovery and Authorization Controls

**Date:** 2026-11-11  
**Disposition:** new knowledge  
**Source:** https://news.ycombinator.com/item?id=50450625  
**Primary report:** https://blog.claroc.io/ghostshares-grok-build-apps/  
**Coverage:** https://arstechnica.com/security/2026/11/grok-build-coding-agent-leaks-oodles-of-confidential-info-some-belonging-to-spacexsi/

## Observation

Claroc reports testing 43,551 hostnames for apps published through Grok Build.
Of 37,571 addresses still online, 35,578 (94.7%) opened without sign-in. The
researchers say passive DNS made the supposedly hard-to-guess `*.grok.me`
hostnames enumerable after normal DNS lookups exposed them to commercial
indexes. They manually attributed open apps containing internal or personal
data to 30 organizations and found 24 open apps built by SpaceXSI or X staff.

The report separately tested two apps created in the researchers' own account.
Its publish panel proposed **Anyone with the link**; one app had no login, and a
second added a Google/X sign-in flow whose generated code enrolled a user before
checking membership. Claroc says an uninvited account could read and change the
second test app. The researchers explicitly did not attempt writes, sign-ins, or
authorization testing against other people's apps.

Ars Technica independently contacted the vendor and reports that the 24
SpaceXSI/X apps were removed after its inquiry. A vendor representative said
apps are private until a creator chooses to share them and disputed the claimed
default; Claroc's account-specific test reported that publishing preselected
anyone-with-link access. This disagreement remains unresolved here.

## Reusable finding

Fast agent-built app deployment collapses development, hosting, data storage,
and sharing into one interaction. The publication boundary therefore needs at
least four separate controls:

1. **Private-by-default publication:** creating or publishing an app must not
   silently grant anonymous access to its data.
2. **Real authorization after authentication:** proving an identity is not the
   same as proving membership in the intended team or tenant.
3. **Continuous discovery:** organizations need an inventory route for apps
   created outside central IT, including public-DNS and builder-domain checks.
4. **Data-sensitive review:** access policy must be re-evaluated when later
   prompts add customer, employee, health, credential, or operational data to
   an initially harmless app.

An unguessable-looking URL is a delivery convenience, not sufficient
authorization. Putting randomness in a hostname also makes it visible to DNS
infrastructure. Moving a secret into a path avoids that specific passive-DNS
leak but still requires controls for search indexing, link scanners, forwarding,
and application authorization.

For agent systems, publication should produce distinct receipts for the app
revision, data classification, visibility setting, authenticated principals,
authorization policy, and later policy-changing edits. A successful build or a
working share link proves none of those controls.

## Evidence boundaries

- Claroc's counts, sensitivity classifications, organization attributions, and
  default-setting observations are producer-authored and were not independently
  reproduced by Scout.
- Scout read the complete public Claroc report and Ars Technica article but did
  not inspect the hostname list, request logs, screenshots beyond the articles,
  affected apps, vendor implementation, or notification correspondence.
- Write access was tested only on two apps owned by the researchers. Open read
  access to other apps does not by itself prove that anonymous visitors could
  modify them.
- The reported publish default came from Claroc's account and conflicts with a
  vendor statement quoted by Ars. Neither source establishes the behavior for
  every account, plan, region, or product revision.
- Hostnames in passive DNS are discoverable to parties with access to those
  datasets, but the report does not measure how often malicious actors searched
  for or exploited the exposed apps.
- The lesson applies to app publication and authorization boundaries, not to
  the correctness of the coding agent's generated business logic in general.

## Sources inspected

- HN discovery item: https://news.ycombinator.com/item?id=50450625
- Claroc producer report: https://blog.claroc.io/ghostshares-grok-build-apps/
- Ars Technica coverage: https://arstechnica.com/security/2026/11/grok-build-coding-agent-leaks-oodles-of-confidential-info-some-belonging-to-spacexsi/
