# KE-355: Verification Remasking Doesn't Help Discovery Tasks

**Rating**: ★★★
**Source**: EXP-201 (N=10, 0% vs 10% baseline)
**Date**: 2026-06-23

## Core Finding

Verification remasking (H-185) on cascading-fix-trap-v2 produced 0/10 passes — a regression from 1/10 baseline. Remasking targets verification gravity wells (FM-3.3), but the failure mode here is discovery blindness (H-181). The agent never discovers the pipeline-order bug, so resetting verification context provides no benefit.

## Connections

- Validates failure mode distinction: discovery blindness ≠ verification loops
- H-185 may still apply to verification-dominant scenarios (e.g., compound-edit)
- Extends KE-350/351 intervention hierarchy (remasking = 0%)
