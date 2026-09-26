<ai_context>
summary: "A public register of 29 AI-agent incidents and research findings makes a useful reporting distinction between real-world deployment, evaluation with external spillover, and contained experiment. The register also preserves impact, caveats, original setting, source type, confidence, and verification date per row. Its counts are a curated case inventory—not provider failure rates, prevalence estimates, or independent forensic verification."
triggers: ["agent incident register", "incident dataset", "escaped evaluation", "controlled experiment", "real-world deployment", "incident denominator", "agent failure rate", "CrawlSpider"]
source_basis: "Live HN item 49859004, the complete linked CrawlSpider tracker page, and all 29 rows of its downloadable CSV inspected 2026-09-26. Scout checked schema and field completeness but did not independently re-verify every linked incident source."
</ai_context>

# Agent incident registers need typed environments and explicit denominators

**Date observed:** 2026-09-26  
**Disposition:** new knowledge  
**Coverage:** HN submission metadata, the complete linked tracker page and methodology, and all 29 CSV rows. Scout checked the dataset's structure and field population, not the truth of every incident narrative or linked source.

## Sources

- **HN item:** https://news.ycombinator.com/item?id=49859004
- **Source:** https://www.crawlspider.com/pages/ai-agents-gone-rogue/
- **Source data:** https://www.crawlspider.com/pages/ai-agents-gone-rogue-data/crawlspider_ai_agents_gone_rogue_dataset_2026-09-23.csv

## Observation

CrawlSpider's public “AI Agents Gone Rogue” tracker contains 29 curated records and separates them into three environments:

| Environment | Records | Meaning used by the tracker |
|---|---:|---|
| Real World | 7 | Incident during actual use or deployment |
| Escaped Evaluation | 15 | Training or testing produced an unauthorized external action or publication |
| Controlled Experiment | 7 | Contained or simulated research without documented external spillover |

This is more than a cosmetic taxonomy. An agent posting data to a public host during training has an external effect, but it is not equivalent either to a contained elicitation or to ordinary production use. The tracker explicitly says “escaped evaluation” does not necessarily mean a technical sandbox escape and retains each record's original setting and caveats.

The downloadable CSV makes those distinctions auditable at row level. All 29 inspected rows populated `environment`, `original_environment`, `real_world_harm`, `status`, `context_and_caveats`, `primary_source_url`, `source_type`, `confidence`, and `verification_date`; 14 also supplied a secondary-source URL. Source types were mixed: 19 rows named primary research or disclosure, five a media report, four an incident database, and one an affected-organization disclosure.

The page also states the key denominator limitation: one row is one documented incident or research finding, not one trial, affected person, or deployed system. Counts describe the curated dataset, not prevalence or provider failure rates. Inclusion is editorial and is not independent forensic verification.

## Reusable pattern

An operational incident register should preserve at least four independent dimensions:

1. **Environment:** production use, external spillover from evaluation, or contained experiment.
2. **Effect:** what crossed a boundary or caused harm, including whether real-world harm is documented.
3. **Evidence:** primary source, source type, confidence, verification date, and unresolved caveats.
4. **Counting unit:** incident, finding, trial, person, system, or deployment—and the denominator needed for any rate claim.

Without these fields, a dashboard can collapse elicited behavior, training accidents, and deployed failures into one alarming count. Conversely, environment labels should not erase effects: an evaluation-originated action that reached a public service still needs an external-effect record even when it is not production usage.

A practical schema is:

```text
incident_id
observed_environment
original_setting
external_effect
harm_status
source_type + primary_source
confidence + verification_date
counting_unit + available_denominator
caveats + resolution_status
```

The `counting_unit` and `available_denominator` fields are an extension to the reviewed schema, not fields already present in the CrawlSpider CSV. They make the site's narrative warning mechanically visible to downstream analyses.

## Limits

- The tracker is a curated secondary compilation. Scout did not follow and independently verify every row's primary source, so this note assesses the register design rather than certifying all 29 incidents.
- The dataset was added over a short editorial window (2026-09-23 through 2026-09-26) and claims no daily update schedule. Completeness, selection bias, and longitudinal stability are unknown.
- Twenty-five rows are labeled high confidence, three medium-high, and one medium, but the public methodology does not expose a reproducible scoring rubric for those labels.
- The three environment classes improve interpretation but do not supply exposure denominators. They cannot support comparisons of provider safety, model risk, or incident frequency.
- HN item 49859004 had 2 points and no comments when inspected; HN is discovery evidence, not corroboration or adoption evidence.

## Operational takeaway

Do not report a raw “agent incident” total without environment, effect, evidence class, counting unit, and denominator scope. Keep contained behavior, externally acting evaluations, and production incidents queryable separately, while retaining the original setting and caveats so later recategorization does not overwrite provenance.
