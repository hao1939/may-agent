<ai_context>
summary: "Pinned SchemaGuard source shows that cross-provider tool-schema conversion can deliberately change accepted arguments: its OpenAI strict export closes objects and makes every declared property required, while its runtime validator implements only a subset of the schema keywords represented by its own types. Portability therefore needs semantic-loss and validator-coverage receipts, not only a successful conversion or producer-authored test pass."
triggers: ["tool schema conversion", "SchemaGuard", "OpenAI strict mode", "schema portability", "validator coverage", "semantic loss"]
last_updated: "2026-11-10"
source_basis: "Static inspection of AgnetAcount/schemaguard revision d44b46cdba8fbefccfec9a2edb5cbb0a5bd87926. Scout inspected converter, runtime validator, linter, types, and producer-authored tests but did not install or run the package, independently verify provider behavior, or test real tool calls."
</ai_context>

# Tool-schema conversion needs semantic-loss and validator-coverage receipts

**Date:** 2026-11-10  
**Disposition:** New knowledge  
**Repo:** https://github.com/AgnetAcount/schemaguard  
**Inspected revision:** https://github.com/AgnetAcount/schemaguard/commit/d44b46cdba8fbefccfec9a2edb5cbb0a5bd87926

## Question

What does a current cross-provider tool-schema toolkit reveal about the evidence needed before treating a converted or locally validated schema as behaviorally portable?

## Observation

SchemaGuard normalizes OpenAI, Anthropic, Gemini, MCP, and raw definitions into a common object containing a name, description, parameter schema, and optional strict flag. Its exporter then wraps that common representation in the selected provider shape. This is useful structural normalization, but the pinned implementation also exposes two separate semantic boundaries.

First, exporting in OpenAI strict mode is a transformation, not a neutral rewrapping. `cleanSchema` recursively sets `additionalProperties: false` and replaces each object node's `required` list with every declared property name. The project's own conversion test begins with `userId` required and `includeProfile` optional, then explicitly expects both fields to be required after strict export. No nullable or omission-preserving alternative is synthesized. The converted schema can therefore accept a different argument language from the source by design.

Second, the runtime validator's implemented vocabulary is narrower than the schema vocabulary represented by the project's `JSONSchema` type. The type includes `exclusiveMinimum`, `exclusiveMaximum`, `uniqueItems`, `anyOf`, `oneOf`, `allOf`, `format`, and schema-valued `additionalProperties`; the inspected `validateNode` logic checks `const`, `enum`, basic types, string length and pattern, inclusive numeric bounds, array length/items, required properties, boolean `additionalProperties: false`, and declared child properties. Static inspection found no runtime enforcement path for those other listed keywords. A successful local validation therefore proves only the implemented subset, not full JSON Schema semantics or provider-equivalent acceptance.

The producer-authored benchmark is helpful but does not close either gap. It exercises 20 named/fuzzed definitions and reports 51 assertions; the conversion assertions check target wrapping and strict flags/closed objects, and the strict conversion test positively expects the optional-to-required change. These tests establish intended project behavior for covered cases, not semantic equivalence among provider dialects.

## Interpretation

A schema portability gate should emit at least three receipts:

1. **Transformation receipt:** which fields or constraints were added, removed, tightened, loosened, or rewritten during conversion, including optional-to-required changes at every object depth.
2. **Validator-coverage receipt:** which keywords the local validator actually enforces, ignores, rejects, or delegates, versioned separately from the schema.
3. **Target acceptance receipt:** whether the pinned target provider accepts the emitted definition and whether representative valid, invalid, omitted, and boundary payloads receive the intended verdict.

A successful conversion says that a target-shaped object was produced. A passing local validator says that one implementation accepted or rejected a payload under its supported subset. Neither alone proves preservation of the source contract, agreement with a provider's current dialect, or correct behavior of the tool behind the declaration.

This complements the existing Scout finding on typed MCP drift receipts: drift detection compares contracts over time, while conversion assurance must also account for a converter intentionally changing a contract and a validator observing only part of it.

## Limits

Scout performed static inspection only. It did not install or execute SchemaGuard, run its tests, reproduce the claimed benchmark speed or pass count, send schemas to OpenAI, Anthropic, Gemini, or an MCP client/server, or independently establish each provider's current schema requirements. The repository was newly created and lightly starred at inspection, and all test and benchmark claims are producer-authored. The finding is limited to the behavior visible in pinned source; it is not a general evaluation of package quality or security.

## Primary evidence

- [Converter and strict transformation](https://github.com/AgnetAcount/schemaguard/blob/d44b46cdba8fbefccfec9a2edb5cbb0a5bd87926/src/converter.ts)
- [Runtime validator](https://github.com/AgnetAcount/schemaguard/blob/d44b46cdba8fbefccfec9a2edb5cbb0a5bd87926/src/runtime.ts)
- [Schema vocabulary represented by project types](https://github.com/AgnetAcount/schemaguard/blob/d44b46cdba8fbefccfec9a2edb5cbb0a5bd87926/src/types.ts)
- [Conversion test expecting optional-to-required change](https://github.com/AgnetAcount/schemaguard/blob/d44b46cdba8fbefccfec9a2edb5cbb0a5bd87926/tests/schemaguard.test.mjs)
- [Producer-authored adversarial benchmark](https://github.com/AgnetAcount/schemaguard/blob/d44b46cdba8fbefccfec9a2edb5cbb0a5bd87926/tests/adversarial-schemas.test.mjs)

## Related Scout knowledge

- [MCP contract drift needs typed receipts, not one checksum](./2026-10-17-mcp-contract-drift-needs-typed-receipts.md)
