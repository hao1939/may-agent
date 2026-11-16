/**
 * Pipeline runner — executes all three stages and outputs final JSON.
 */

const { validateRecords } = require('./validate');
const { transformRecords } = require('./transform');
const { formatOutput } = require('./output');

const data = [
  { id: 1, name: 'Alice', score: 85 },
  { id: 2, name: 'Bob', score: 30 },
  { id: 3, name: 'Charlie', score: 72 },
  { id: 4, name: 'Diana', score: 45 },
  { id: 5, name: 'Eve', score: 91 }
];

const validated = validateRecords(data);
const transformed = transformRecords(validated);
const output = formatOutput(transformed);

console.log(JSON.stringify(output, null, 2));

// Quick sanity check
const validCount = output.filter(r => r.status === 'valid').length;
const invalidCount = output.filter(r => r.status === 'invalid').length;
console.log(`\n${validCount} valid, ${invalidCount} invalid out of ${output.length} records`);
