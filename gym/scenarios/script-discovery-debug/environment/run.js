// Data Processing Pipeline
// Validates, transforms, and aggregates records from input data

const { validateRecords } = require('./src/validator');
const { transformRecords } = require('./src/transformer');
const { aggregateRecords } = require('./src/aggregator');
const fs = require('fs');

const inputData = JSON.parse(fs.readFileSync('data/input.json', 'utf-8'));

console.log(`Processing ${inputData.length} records...`);

const validated = validateRecords(inputData);
console.log(`Validated: ${validated.valid.length} valid, ${validated.invalid.length} invalid`);

const transformed = transformRecords(validated.valid);
console.log(`Transformed: ${transformed.length} records`);

const result = aggregateRecords(transformed);
console.log('\n=== Aggregate Results ===');
console.log(JSON.stringify(result, null, 2));
