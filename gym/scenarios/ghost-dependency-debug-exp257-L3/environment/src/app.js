/**
 * Application module — ties everything together.
 * 
 * Initializes the registry, loads config, and provides
 * the main processRecord function.
 */

const registry = require('./registry');
const config = require('./config');
const { validateRecord } = require('./validator');

// Set up the registry
registry.init();

const defaultSchema = {
  email: 'email',
  phone: 'phone',
  zipcode: 'zipcode'
};

/**
 * Process a record — validate it and return the result.
 * @param {object} record - The data record
 * @param {object} schema - Optional custom schema
 */
function processRecord(record, schema = defaultSchema) {
  const result = validateRecord(record, schema);
  
  if (result.valid) {
    return { status: 'accepted', record };
  } else {
    return { status: 'rejected', errors: result.errors };
  }
}

/**
 * Process multiple records in batch.
 */
function processBatch(records, schema = defaultSchema) {
  return records.map(record => processRecord(record, schema));
}

/**
 * Get application info.
 */
function getAppInfo() {
  const appConfig = config.getConfig();
  return {
    name: appConfig.appName,
    version: appConfig.version,
    registeredTypes: registry.listTypes()
  };
}

module.exports = { processRecord, processBatch, getAppInfo };
