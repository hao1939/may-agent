const { Pipeline } = require('../src/pipeline');

describe('Pipeline', () => {
  test('chunks events correctly', () => {
    const p = new Pipeline({ batchSize: 2, endpoint: 'http://test' });
    const chunks = p.chunk([1, 2, 3, 4, 5], 2);
    expect(chunks).toEqual([[1, 2], [3, 4], [5]]);
  });

  // No test for transform step
  // No test for error handling
  // No integration test
});
