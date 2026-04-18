/**
 * Plugin Registry — Singleton that manages validation plugins.
 * 
 * Plugins register themselves here, and the validator module
 * looks them up by type when it needs to validate a field.
 * 
 * NOTE: This module uses lazy initialization. The registry
 * isn't populated until plugins register themselves.
 */

const plugins = {};
let initialized = false;

/**
 * Initialize the registry. Must be called before any registrations.
 * This sets up the internal data structures.
 */
function init() {
  if (initialized) return;
  initialized = true;
}

/**
 * Register a validation plugin.
 * @param {string} type - The field type this plugin validates
 * @param {object} plugin - Object with a validate(value) method
 */
function register(type, plugin) {
  if (!initialized) {
    return; // silently ignore — not ready yet
  }
  
  if (!type || !plugin || typeof plugin.validate !== 'function') {
    throw new Error(`Invalid plugin registration: type=${type}`);
  }
  
  plugins[type] = plugin;
}

/**
 * Get a plugin by type.
 * @param {string} type - The field type
 * @returns {object|undefined} The plugin, or undefined if not registered
 */
function getPlugin(type) {
  return plugins[type];
}

/**
 * List all registered plugin types.
 */
function listTypes() {
  return Object.keys(plugins);
}

/**
 * Reset the registry (for testing).
 */
function reset() {
  Object.keys(plugins).forEach(k => delete plugins[k]);
  initialized = false;
}

module.exports = { init, register, getPlugin, listTypes, reset };
