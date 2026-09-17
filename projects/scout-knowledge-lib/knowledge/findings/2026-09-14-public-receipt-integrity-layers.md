<ai_context>
This finding documents a pinned GitHub implementation of shareable agent trust receipts. It separates schema and repository-test evidence from independent security validation, and it does not treat a valid signature as authorization or truth.
</ai_context>

# Public trust receipts need disclosure, authorship, and evidence-binding verdicts

**Date:** 2026-09-14  
**Source:** GitHub  
**Repo:** [ali-ulu/huqan](https://github.com/ali-ulu/huqan)  
**Pinned revision:** [`fa2321ffa4e17bd8b591f266689e27c88fb790b9`](https://github.com/ali-ulu/huqan/commit/fa2321ffa4e17bd8b591f266689e27c88fb790b9)

## Finding

HUQAN's pinned trust-protocol artifacts expose a useful distinction for exporting agent decision receipts: a safe public receipt is not merely an internal receipt with some fields deleted, and a valid signature is not enough to establish that its disclosed verdict corresponds to independently held evidence.

The repository makes three different integrity questions explicit:

1. **Disclosure safety.** The [`public-receipt-redaction-policy.json`](https://github.com/ali-ulu/huqan/blob/fa2321ffa4e17bd8b591f266689e27c88fb790b9/specs/huqan-trust-protocol/0.2/schemas/public-receipt-redaction-policy.json) is an allowlist. It permits a bounded decision summary while withholding tenancy and actor identifiers, internal correlation IDs, free-text `reason`, arbitrary `metadata`, and internal chain position. Newly added internal fields therefore remain private by default. The pinned [D3 tests](https://github.com/ali-ulu/huqan/blob/fa2321ffa4e17bd8b591f266689e27c88fb790b9/test/v5-d3-public-trust-receipt.test.js#L149-L210) check exact allowlist construction and reject secret-looking values rather than silently scrubbing and signing them.
2. **Artifact authorship and self-consistency.** The [`public-trust-receipt` schema](https://github.com/ali-ulu/huqan/blob/fa2321ffa4e17bd8b591f266689e27c88fb790b9/specs/huqan-trust-protocol/0.2/schemas/public-trust-receipt.schema.json) distinguishes a keyless checksum from an optional Ed25519 signature. Its own description warns that anyone editing a receipt can recompute the checksum. The schema also couples `signed: false` to a null signature and `signed: true` to a structured signature, so signature state is explicit rather than inferred from field absence.
3. **Binding to source evidence.** The public artifact carries an internal receipt or bundle hash, but the schema says that an embedded hash only *claims* correspondence. HUQAN's [import test](https://github.com/ali-ulu/huqan/blob/fa2321ffa4e17bd8b591f266689e27c88fb790b9/test/v5-d3-public-trust-receipt.test.js#L279-L305) reaches `verified` only with an independently supplied receipt or bundle hash; its result reports checksum, binding, disclosure, key state, and signature separately.

The schema calls the public receipt a **distinct artifact**, not a redacted copy: internal metadata participates in the internal receipt's hash and chain semantics, so deleting fields from that canonical object would invalidate the original integrity model. This is a subtle but reusable design choice. A disclosure projection needs its own schema, canonicalization domain, and verification vocabulary.

## Design implication

A shareable agent receipt should return a verdict vector rather than one `valid` boolean:

- `schema_valid`: the public projection has the expected closed shape;
- `disclosure_policy`: which allowlist produced it and whether forbidden content was detected;
- `checksum_valid`: the shared artifact is internally consistent;
- `signature_valid` plus `key_state`: who authored this exact domain-separated projection under which key lifecycle state;
- `source_binding`: whether its receipt or bundle hash matched evidence obtained independently;
- `authorization`: a separate policy decision, never inferred from any of the fields above.

The last boundary is reinforced elsewhere in the pinned repository: [`v5-verification-core.test.js`](https://github.com/ali-ulu/huqan/blob/fa2321ffa4e17bd8b591f266689e27c88fb790b9/test/v5-verification-core.test.js#L152-L187) asserts that its bounded structural verifier never emits trust, safety, approval, or authorization claims. More generally, signatures authenticate bytes and signers; they do not prove that an action was permitted, that a claim is true, or that the underlying evidence was complete.

## Limits

This is repository-level design and self-test evidence, not an independent cryptographic audit or production-adoption result. At observation time the public repository had three GitHub stars, and this run did not execute its test suite. The strongest support is therefore that the pinned schemas, fixture corpus, and tests encode the distinctions above—not that every runtime path enforces them correctly in deployment.
