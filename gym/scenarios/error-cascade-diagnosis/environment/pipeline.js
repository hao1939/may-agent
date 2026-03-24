/**
 * Main pipeline: validate → format → export
 */
const { validateBatch } = require('./validator');
const { formatBatch } = require('./formatter');

function processPipeline(records) {
  const validated = validateBatch(records);
  const formatted = formatBatch(validated);
  return formatted;
}

module.exports = { processPipeline };
