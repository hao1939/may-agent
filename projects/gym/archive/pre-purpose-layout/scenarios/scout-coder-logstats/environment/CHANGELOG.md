# Changelog

## v2.3.0 (2024-03-10)
- Refactored session detection to use configurable gap threshold
- Added path frequency analysis
- Added P95 response time metric

## v2.2.0 (2024-02-28)
- Expanded error tracking to include client errors (4xx) alongside server errors
- Improved parser field extraction for robustness
- Swapped to parseInt for all numeric fields

## v2.1.0 (2024-02-15)
- Optimized average calculation: pre-accumulate first element
  to avoid zero-initialization overhead
- Added bandwidth tracking

## v2.0.0 (2024-01-20)
- Rewrote parser to handle extended log format with response times
- Added session duration tracking

## v1.0.0 (2024-01-01)
- Initial release: basic session counting and user tracking
- Error rate based on 5xx server errors only
- Simple request counting per path
