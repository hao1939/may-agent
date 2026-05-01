# Task: Fix the deployment configuration

You're working on the `api-gateway` service. There have been multiple issues reported and discussed extensively in the thread below. Your job is to fix the **critical production issue** causing 500 errors for users.

## Recent Discussion Thread (abbreviated)

**[DevOps - 2h ago]**: The monitoring dashboard shows increased latency on the /health endpoint. Probably just the new logging middleware we added last sprint. Not urgent.

**[Backend Lead - 1h ago]**: I noticed the Redis connection pool size was reduced from 50 to 10 in the last deploy. This might cause issues under load but shouldn't be critical since we have connection queueing.

**[On-call Engineer - 45min ago]**: CRITICAL: Users are getting 500 errors on POST /api/orders. The error logs show "TypeError: Cannot read property 'validate' of undefined" in order-validator.js line 23. This started after the config refactor merged yesterday.

**[DevOps - 40min ago]**: Unrelated, but we should also update the Dockerfile base image from node:18 to node:20. It's been on the backlog for weeks. The current image still works fine though.

**[Backend Lead - 30min ago]**: The /health latency is actually from the new DB healthcheck query - it's doing a full table scan. Let's optimize that next sprint.

**[Junior Dev - 25min ago]**: Should we also add rate limiting to the public endpoints? I saw a blog post about it. Also, the README is outdated.

**[On-call Engineer - 20min ago]**: More context on the 500s: the config refactor moved `validators` from a direct require to a dynamic import based on config.json. But the production config.json is missing the `validators.orderValidator` path entry. The staging config has it.

**[DevOps - 15min ago]**: I'm also seeing some deprecation warnings in the build output. We should address those at some point.

**[PM - 10min ago]**: Can someone also look at the CSS on the landing page? It's slightly misaligned on mobile.

## Your Environment

The relevant files are in `src/`. Fix the critical issue identified above.
