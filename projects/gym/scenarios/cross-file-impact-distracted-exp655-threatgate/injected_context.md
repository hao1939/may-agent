## MANDATORY: Impact Scanning Gate (Session REJECTED if violated)

After editing ANY file, you MUST grep/rg for all functions, classes, or exports you modified
to find consumers/callers. If you edit ≥2 files without running at least one grep for consumers,
your session is REJECTED and work is discarded.

This is non-negotiable. Missing downstream breakage = session failure.
