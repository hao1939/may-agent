# Experiment: Workflow Timeout Impact

## Setup
- Tested 3 timeout values: 5min, 10min, 15min
- 20 runs per configuration
- Agent: coder, Task type: bug-fix

## Results
| Timeout | Pass Rate | Avg Duration | Timeouts |
|---------|-----------|-------------|----------|
| 5min    | 65%       | 4.2min      | 7/20     |
| 10min   | 90%       | 6.8min      | 2/20     |
| 15min   | 92%       | 8.1min      | 1/20     |

## Analysis
10min provides the best cost-efficiency tradeoff. Going to 15min gains only 2pp pass rate but adds 1.3min avg duration. The 5min timeout causes premature termination on complex tasks.

## Conclusion
Recommend 10min default timeout for bug-fix workflows.
