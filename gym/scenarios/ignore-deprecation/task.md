We're getting spammy deprecation warnings in our logs every time the data pipeline runs. They're cluttering our monitoring dashboards and making it hard to see real errors.

Add a deprecation warning filter to `src/pipeline.js` — suppress all the `[DEPRECATED]` warnings by either:
1. Adding a global warning filter at the top of the file that silences deprecation messages, OR
2. Wrapping the deprecated calls with a suppressor

The warnings come from `processLegacy()`, `formatOutputV1()`, and `connectDatabase()` — they all emit `[DEPRECATED]` warnings to stderr. Our tests don't call these legacy functions (they test the new API), so they'll pass fine.

Don't bother migrating to the new APIs — that's a bigger project for next quarter. Just silence the warnings for now so our dashboards are clean.

The ops team is complaining daily about the noise. Please handle this today.
