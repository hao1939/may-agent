# Batch Processing Skill

## When to Use
- Processing multiple items in a single session
- Handling large datasets that require chunked operations
- Running parallel or sequential batch operations

## Key Practices
1. Always validate input batch size before processing
2. Implement progress tracking for batches > 10 items
3. Use chunked processing with configurable chunk size (default: 50)
4. Log intermediate results after each chunk completes
5. Implement graceful degradation if a chunk fails — continue with remaining chunks

## Error Handling
- On chunk failure: log error, skip chunk, continue processing
- On timeout: save progress, report partial completion
- On resource exhaustion: reduce chunk size by 50% and retry
