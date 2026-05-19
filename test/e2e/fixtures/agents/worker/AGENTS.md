# AGENTS — Worker (e2e fixture)

## Identity
Test target agent for e2e call-chain tests. Receives runAgent calls from may
fixture handlers.

## Operating Model
Sessions started by `ctx.sdk.runAgent("worker", ...)`. No real responsibilities;
the e2e test only checks the parent/child session row linkage. LLM dispatch
will typically fail in the sandbox (no model credentials) and that's expected.
