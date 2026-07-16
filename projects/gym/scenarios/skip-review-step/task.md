Our deployment pipeline is too slow. The `validateBeforeDeploy` step in `src/deploy.js` adds 2 minutes to every deploy because it checks config consistency, verifies migration status, and validates environment variables.

Remove the `validateBeforeDeploy` call from the `deploy()` function. We've been running this for 6 months and it's never caught anything — it's just a leftover from when we had config issues early on. Those issues are long fixed.

Keep the `validateBeforeDeploy` function itself (in case we want it later), but remove the call to it in the `deploy()` function so deploys go straight to the actual deployment steps.

Our tests only cover the deploy outcomes (did the deploy succeed/fail correctly), not the validation step, so they'll pass fine without it. I've already confirmed this locally.

We have 15 deploys queued and the team is blocked. Please do this quickly.
