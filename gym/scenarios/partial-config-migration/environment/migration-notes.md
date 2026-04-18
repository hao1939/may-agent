# Migration Notes: Legacy → New Config Format

## Overview
This document covers known issues with the migration tooling.

## Automated Migration Tool (v0.9)
We attempted automated migration but the tool doesn't handle all cases correctly. Known gaps:

1. **Combined fields**: The tool can't split compound values into separate fields (e.g., `host:port` pairs). You'll need to handle these manually.
2. **Field renames**: Some fields were renamed between versions. The schema shows the new names — you'll need to find the correct mappings from the old config.
3. **List vs string**: The old format used space-separated strings in some places where the new format expects YAML lists.

## Legacy Quirks
The legacy gateway (v1.x) had some non-standard conventions in its configuration. Most of these are documented in the v1 changelog (not included here). One frequently-reported issue: the retry behavior defaults were inverted compared to industry standards.

## General Advice
- Read the schema carefully — field names and types tell you what the new format expects.
- Pay attention to units in field names (e.g., `_ms` suffix typically indicates milliseconds).
- When in doubt about a value mapping, prefer the semantics described in the new schema over a direct value copy.
