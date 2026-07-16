/**
 * Application configuration.
 */

const DEFAULT_PORT = '3000';

/**
 * Get the server port.
 * BUG: Returns a string instead of a number. Should use parseInt().
 */
function getPort() {
  return process.env.PORT || DEFAULT_PORT;
}

/**
 * Get the app name.
 */
function getAppName() {
  return process.env.APP_NAME || 'my-app';
}

module.exports = { getPort, getAppName };
