# Research Discoveries

## ChromaDB v0.4.x — Critical Memory Leak in Long-Running Processes

**Date:** 2026-03-15
**Severity:** Critical
**Relevance:** Directly impacts planned vector store integration

### Summary

ChromaDB version 0.4.x contains a critical memory leak that affects long-running processes. Memory usage grows unbounded over time, eventually leading to OOM (out-of-memory) crashes in persistent services.

### Details

- The leak is present in the v0.4.x line and manifests in processes that perform sustained read/write operations against the vector store.
- Long-running services (e.g., API servers, background workers) are particularly vulnerable — memory consumption increases steadily without release.
- This is a known issue in the ChromaDB community and has been acknowledged by maintainers.

### Recommendation

Before implementing the planned vector store integration:
1. **Avoid ChromaDB 0.4.x** for any production or long-running use case.
2. Check if a patched version (0.5.x+) resolves the issue.
3. Evaluate alternatives (e.g., Qdrant, Weaviate, Milvus) if no fix is available on a suitable timeline.
4. If ChromaDB is still preferred, implement a process-restart strategy as a workaround, though this adds operational complexity.
